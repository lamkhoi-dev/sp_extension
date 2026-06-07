const db = require('../db');
const logger = require('../logger');
const commissionRatesStore = require('./commission-rates-store');

// Completed statuses for Shopee orders
const COMPLETED_STATUSES = new Set(['Hoàn thành', 'Completed']);

// Cancelled orders — excluded entirely from all cashback calculations
// Vietnamese has two spellings: "hủy" (hook above ủ) vs "huỷ" (tilde+dot ỷ)
const CANCELLED_STATUSES = new Set(['Đã hủy', 'Đã huỷ', 'Cancelled', 'Chưa thanh toán']);

/** Robust cancelled check — handles Unicode variants + partial matches */
function isCancelled(status) {
  if (!status) return false;
  if (CANCELLED_STATUSES.has(status)) return true;
  const lower = status.toLowerCase();
  return lower.includes('hủy') || lower.includes('huỷ') || lower.includes('cancelled') || lower.includes('cancel')
    || lower.includes('chưa thanh toán');
}

// ═══ Multi-level Commission System (F0-F3) ═══
// Rates live in DB (system_settings.commission_rates). Each async entry-point
// preloads them once via commissionRatesStore.getRates() then passes the
// resolved object around — never read from a module-level constant.

/**
 * Trace the referrer chain: F0 → F1 → F2 → F3
 * Returns { f1: userId|null, f2: userId|null, f3: userId|null }
 * Rules:
 * - If any user in the chain is mode 'custom', chain stops (they're excluded)
 * - Chain only follows users in 'normal' mode
 */
async function resolveCommissionChain(buyerId) {
  // F0-F3 referral chain is purely based on referrer_id relationships.
  // commission_mode/custom_rate ONLY affects from_custom orders (handled separately),
  // NOT the normal from_direct buyer/referrer chain.
  try {
    const f0 = await db.get('SELECT referrer_id FROM users WHERE user_id = ?', [buyerId]);
    if (!f0) return { f1: null, f2: null, f3: null };

    const f1Id = f0.referrer_id || null;
    if (!f1Id) return { f1: null, f2: null, f3: null };

    const f1 = await db.get('SELECT referrer_id FROM users WHERE user_id = ?', [f1Id]);
    if (!f1) return { f1: f1Id, f2: null, f3: null };

    const f2Id = f1.referrer_id || null;
    if (!f2Id) return { f1: f1Id, f2: null, f3: null };

    const f2 = await db.get('SELECT referrer_id FROM users WHERE user_id = ?', [f2Id]);
    if (!f2) return { f1: f1Id, f2: f2Id, f3: null };

    const f3Id = f2.referrer_id || null;
    if (!f3Id) return { f1: f1Id, f2: f2Id, f3: null };

    return { f1: f1Id, f2: f2Id, f3: f3Id };
  } catch (err) {
    logger.error('PayoutStore', `resolveCommissionChain(${buyerId}) failed: ${err.message}`);
    return { f1: null, f2: null, f3: null };
  }
}

/**
 * Calculate commission split for Normal mode.
 * Missing F-levels have their % added to Admin.
 * `rates` must be the object returned by commissionRatesStore.getRates().
 */
function calculateNormalSplit(nc, chain, rates) {
  const f0 = Math.round(nc * rates.f0 / 100);
  const f1 = chain.f1 ? Math.round(nc * rates.f1 / 100) : 0;
  const f2 = chain.f2 ? Math.round(nc * rates.f2 / 100) : 0;
  const f3 = chain.f3 ? Math.round(nc * rates.f3 / 100) : 0;
  const admin = nc - f0 - f1 - f2 - f3; // Admin gets the remainder (base admin% + missing F%)
  return { admin, f0, f1, f2, f3 };
}

/**
 * Calculate commission split for Custom mode.
 * customRate: 40-70%, Admin gets the rest.
 */
function calculateCustomSplit(nc, customRate) {
  const userAmount = Math.round(nc * customRate / 100);
  const admin = nc - userAmount;
  return { admin, user: userAmount };
}

// SQL: Get all matched orders — fetch sub_id4 from orders directly + referrer_id from convert_logs
const MATCHED_ORDERS_SQL = `
  SELECT DISTINCT o.*, cl.sub_id2 as referrer_id, o.sub_id4 as cl_sub_id4
  FROM orders o
  INNER JOIN convert_logs cl ON (
    (o.item_id != '' AND o.item_id = cl.item_id AND o.sub_id1 = cl.sub_id1)
    OR
    (cl.item_id = '' AND o.item_name != '' AND o.item_name = cl.product_name AND o.sub_id1 = cl.sub_id1)
  )
  WHERE cl.status = 'success' AND COALESCE(o.sub_id4, '') NOT IN ('from_custom', 'custom')
  ORDER BY o.order_time DESC
`;

const MATCHED_ORDERS_BY_USER_SQL = `
  SELECT DISTINCT o.*, cl.sub_id2 as referrer_id, o.sub_id4 as cl_sub_id4
  FROM orders o
  INNER JOIN convert_logs cl ON (
    (o.item_id != '' AND o.item_id = cl.item_id AND o.sub_id1 = cl.sub_id1)
    OR
    (cl.item_id = '' AND o.item_name != '' AND o.item_name = cl.product_name AND o.sub_id1 = cl.sub_id1)
  )
  WHERE cl.status = 'success' AND o.sub_id1 = ? AND COALESCE(o.sub_id4, '') NOT IN ('from_custom', 'custom')
  ORDER BY o.order_time DESC
`;

// Custom orders (F1 mode) — query directly on orders.sub_id4 = 'from_custom'
// No INNER JOIN needed — order itself knows it's custom via sub_id4 field
const CUSTOM_ORDERS_BY_USER_SQL = `
  SELECT o.*, o.sub_id2 as customer_phone, o.sub_id4 as cl_sub_id4
  FROM orders o
  WHERE o.sub_id1 = ? AND o.sub_id4 IN ('from_custom', 'custom')
  ORDER BY o.order_time DESC
`;

// Orders where this user is the REFERRER (not the buyer)
const REFERRER_ORDERS_BY_USER_SQL = `
  SELECT DISTINCT o.*, cl.sub_id2 as referrer_id, o.sub_id1 as buyer_id
  FROM orders o
  INNER JOIN convert_logs cl ON (
    (o.item_id != '' AND o.item_id = cl.item_id AND o.sub_id1 = cl.sub_id1)
    OR
    (cl.item_id = '' AND o.item_name != '' AND o.item_name = cl.product_name AND o.sub_id1 = cl.sub_id1)
  )
  WHERE cl.status = 'success' AND cl.sub_id2 = ?
    AND COALESCE(o.sub_id4, '') NOT IN ('from_custom', 'custom')
  ORDER BY o.order_time DESC
`;

const USERS_WITH_ORDERS_SQL = `
  SELECT DISTINCT u.user_id, u.display_name, u.zalo_name, u.avatar,
         u.cashback_buyer_rate, u.cashback_referrer_rate, u.referrer_earn_rate, u.is_special,
         u.referrer_id, u.referrer_name, u.custom_rate, u.commission_mode,
         u.bank_name, u.bank_account, u.qr_code
  FROM users u
  WHERE u.user_id IN (
    SELECT DISTINCT o.sub_id1 FROM orders o
    INNER JOIN convert_logs cl ON (
      (o.item_id != '' AND o.item_id = cl.item_id AND o.sub_id1 = cl.sub_id1)
      OR
      (cl.item_id = '' AND o.item_name != '' AND o.item_name = cl.product_name AND o.sub_id1 = cl.sub_id1)
    )
    WHERE cl.status = 'success'
    UNION
    SELECT DISTINCT o2.sub_id1 FROM orders o2 WHERE o2.sub_id4 = 'from_custom'
  )
`;

/**
 * Collect all order IDs that have been paid in previous payouts for a user+role.
 * Returns Set<orderId>.
 */
async function _getPaidOrderIds(userId, role) {
  const payouts = await db.all(
    'SELECT paid_orders FROM payouts WHERE user_id = ? AND role = ?',
    [userId, role]
  );
  const paidIds = new Set();
  for (const p of payouts) {
    let orders = p.paid_orders;
    if (typeof orders === 'string') {
      try { orders = JSON.parse(orders); } catch { orders = null; }
    }
    if (Array.isArray(orders)) {
      for (const o of orders) {
        if (o.orderId) paidIds.add(o.orderId);
      }
    }
  }
  return paidIds;
}

/**
 * Build an in-memory chain resolver from ALL users rows (zero DB queries).
 * Returns getChain(uid) => { f1, f2, f3 }.
 * Pass the result of `SELECT user_id, referrer_id FROM users`.
 */
function buildChainMap(allUserRows) {
  const parentOf = {};
  for (const u of allUserRows) parentOf[String(u.user_id)] = u.referrer_id || null;
  const memo = {};
  return function getChain(uid) {
    const key = String(uid);
    if (memo[key] !== undefined) return memo[key];
    const f1Id = parentOf[key] || null;
    if (!f1Id) return (memo[key] = { f1: null, f2: null, f3: null });
    const f2Id = parentOf[f1Id] || null;
    if (!f2Id) return (memo[key] = { f1: f1Id, f2: null, f3: null });
    const f3Id = parentOf[f2Id] || null;
    return (memo[key] = { f1: f1Id, f2: f2Id, f3: f3Id || null });
  };
}

/**
 * Build paid-order-IDs and paid-sum maps from ALL payouts rows (zero DB queries).
 * Returns { getPaidIds(userId, role), getPaidSum(userId, ...roles) }.
 * Pass the result of `SELECT user_id, role, paid_orders, amount FROM payouts`.
 */
function buildPaidMaps(allPayouts) {
  const paidOrderIds = {}; // `${userId}:${role}` → Set<orderId>
  const paidSums = {};     // `${userId}:${role}` → number

  for (const p of allPayouts) {
    const key = `${p.user_id}:${p.role}`;
    if (!paidOrderIds[key]) paidOrderIds[key] = new Set();
    let orders = p.paid_orders;
    if (typeof orders === 'string') { try { orders = JSON.parse(orders); } catch { orders = null; } }
    if (Array.isArray(orders)) {
      for (const o of orders) { if (o.orderId) paidOrderIds[key].add(o.orderId); }
    }
    paidSums[key] = (paidSums[key] || 0) + Number(p.amount || 0);
  }

  const getPaidIds = (userId, role) => paidOrderIds[`${userId}:${role}`] || new Set();
  const getPaidSum = (userId, ...roles) =>
    roles.reduce((s, r) => s + (paidSums[`${userId}:${r}`] || 0), 0);
  return { getPaidIds, getPaidSum };
}

const payoutStore = {
  async getSummary() {
    try {
      // All 6 initial fetches run in parallel — none depend on each other
      const [
        rates,
        users,
        allOrders,
        allUsersForChain,
        allPayoutsRows,
        allCustomOrders,
      ] = await Promise.all([
        commissionRatesStore.getRates(),
        db.all(USERS_WITH_ORDERS_SQL),
        db.all(MATCHED_ORDERS_SQL),
        db.all('SELECT user_id, referrer_id FROM users'),
        db.all('SELECT user_id, role, paid_orders, amount FROM payouts'),
        db.all(`SELECT * FROM orders WHERE COALESCE(sub_id4,'') IN ('from_custom','custom')`),
      ]);
      const getChain = buildChainMap(allUsersForChain);
      const { getPaidIds, getPaidSum } = buildPaidMaps(allPayoutsRows);

      // Group orders by buyer in-memory
      const ordersByUser = {};
      for (const o of allOrders) {
        if (!ordersByUser[o.sub_id1]) ordersByUser[o.sub_id1] = [];
        ordersByUser[o.sub_id1].push(o);
      }
      const customByUser = {};
      for (const o of allCustomOrders) {
        if (!customByUser[o.sub_id1]) customByUser[o.sub_id1] = [];
        customByUser[o.sub_id1].push(o);
      }
      // ───────────────────────────────────────────────────────────────────────

      const summaries = [];

      for (const user of users) {
        const uid = user.user_id;
        const orders = ordersByUser[uid] || [];
        const commissionMode = user.commission_mode || 'normal';
        const isCustomMode = commissionMode === 'custom';
        const customRate = user.custom_rate ?? 0;
        // from_direct buyer orders ALWAYS use standard F0 + chain.
        // custom_rate only applies to from_custom orders (handled in custom section below).
        const f0Rate = rates.f0;

        // Chain + paid IDs resolved from in-memory maps (zero DB queries)
        const chain = getChain(uid);
        const allPaidBuyerIds = new Set([...getPaidIds(uid, 'f0'), ...getPaidIds(uid, 'buyer')]);
        const paidCustomIds = getPaidIds(uid, 'custom');

        let totalNetCommission = 0;
        let completedNetCommission = 0;
        let pendingNetCommission = 0;
        let completedCount = 0;
        let pendingCount = 0;
        let unpaidCompletedCashback = 0;

        for (const o of orders) {
          if (isCancelled(o.order_status)) continue;
          const nc = o.net_commission || 0;
          totalNetCommission += nc;
          if (COMPLETED_STATUSES.has(o.order_status)) {
            if (!allPaidBuyerIds.has(o.order_id)) {
              completedNetCommission += nc;
              completedCount++;
              unpaidCompletedCashback += Math.round(nc * f0Rate / 100);
            }
          } else {
            pendingNetCommission += nc;
            pendingCount++;
          }
        }

        // Custom orders — already grouped in-memory (no DB query)
        const customOrders = customByUser[uid] || [];
        let totalCustomNetCommission = 0;
        let completedCustomCount = 0;
        let pendingCustomCount = 0;
        let unpaidCustomCashback = 0;

        for (const o of customOrders) {
          if (isCancelled(o.order_status)) continue;
          const nc = o.net_commission || 0;
          totalCustomNetCommission += nc;
          if (COMPLETED_STATUSES.has(o.order_status)) {
            if (!paidCustomIds.has(o.order_id)) {
              completedCustomCount++;
              unpaidCustomCashback += Math.round(nc * (user.custom_rate || 0) / 100);
            }
          } else {
            pendingCustomCount++;
          }
        }

        if (orders.length === 0 && customOrders.length === 0) continue;

        const totalBuyerCashback = Math.round(totalNetCommission * f0Rate / 100);

        // Paid sums from in-memory map (no DB query)
        const paidAsBuyer = getPaidSum(uid, 'f0', 'buyer');
        const paidAsCustom = getPaidSum(uid, 'custom');

        const pendingBuyerPayment = unpaidCompletedCashback;
        const pendingCustomPayment = unpaidCustomCashback;

        summaries.push({
          userId: uid,
          displayName: user.display_name || user.zalo_name || uid,
          avatar: user.avatar || '',
          bankName: user.bank_name || '',
          bankAccount: user.bank_account || '',
          customQr: user.qr_code || '',
          referrerId: user.referrer_id || '',
          referrerName: user.referrer_name || '',
          commissionMode,
          isCustomMode,
          customRate,
          chain,
          f0Rate,
          adminRate: rates.admin,
          totalNetCommission: Math.round(totalNetCommission),
          completedNetCommission: Math.round(completedNetCommission),
          pendingNetCommission: Math.round(pendingNetCommission),
          totalBuyerCashback,
          totalCustomCashback: Math.round(totalCustomNetCommission * (user.custom_rate || 0) / 100),
          totalPaid: paidAsBuyer + paidAsCustom,
          pendingBuyerPayment,
          completedCount,
          pendingCount,
          totalOrders: orders.length + customOrders.length,
          pendingCustomPayment,
          customOrderCount: customOrders.length,
          completedCustomCount,
          pendingCustomCount,
          isSpecial: isCustomMode,
          buyerRate: f0Rate,
          hasReferrer: !!(user.referrer_id && user.referrer_id !== ''),
          referrerRate: 0,
          referrerEarnRate: 0,
        });
      }

      // Merge F1/F2/F3 referrer earnings (pass in-memory maps — no extra DB queries)
      const referrerSummaries = await this._calcReferrerSummaries(allOrders, users, rates, getChain, getPaidIds, getPaidSum);
      const userMap = {};
      for (const b of summaries) {
        userMap[b.userId] = {
          ...b,
          pendingF1Payment: 0, f1OrderCount: 0, totalF1Cashback: 0,
          pendingF2Payment: 0, f2OrderCount: 0, totalF2Cashback: 0,
          pendingF3Payment: 0, f3OrderCount: 0, totalF3Cashback: 0,
          pendingReferrerPayment: 0, referrerOrderCount: 0, totalReferrerCashback: 0,
        };
      }
      for (const r of referrerSummaries) {
        if (!userMap[r.userId]) {
          userMap[r.userId] = {
            userId: r.userId, displayName: r.displayName, avatar: r.avatar,
            bankName: r.bankName || '', bankAccount: r.bankAccount || '', customQr: r.customQr || '',
            referrerId: '', referrerName: '', hasReferrer: false,
            commissionMode: r.commissionMode || 'normal', isCustomMode: false,
            customRate: 0, chain: { f1: null, f2: null, f3: null },
            f0Rate: rates.f0, adminRate: rates.admin,
            totalNetCommission: 0, completedNetCommission: 0, pendingNetCommission: 0,
            totalBuyerCashback: 0, totalCustomCashback: 0, totalPaid: 0,
            pendingBuyerPayment: 0, completedCount: 0, pendingCount: 0, totalOrders: 0,
            pendingCustomPayment: 0, customOrderCount: 0, completedCustomCount: 0, pendingCustomCount: 0,
            isSpecial: false, buyerRate: rates.f0, referrerRate: 0, referrerEarnRate: 0,
            pendingF1Payment: 0, f1OrderCount: 0, totalF1Cashback: 0,
            pendingF2Payment: 0, f2OrderCount: 0, totalF2Cashback: 0,
            pendingF3Payment: 0, f3OrderCount: 0, totalF3Cashback: 0,
            pendingReferrerPayment: 0, referrerOrderCount: 0, totalReferrerCashback: 0,
          };
        }
        const u = userMap[r.userId];
        u[`pendingF${r.fLevel}Payment`] = r.pendingPayment;
        u[`f${r.fLevel}OrderCount`] = r.orderCount;
        u[`totalF${r.fLevel}Cashback`] = r.totalCashback;
        u.totalPaid += r.totalPaid;
        u.pendingReferrerPayment += r.pendingPayment;
        u.referrerOrderCount += r.orderCount;
        u.totalReferrerCashback += r.totalCashback;
      }
      const unified = Object.values(userMap).map(u => ({
        ...u,
        pendingPayment: u.pendingBuyerPayment + u.pendingReferrerPayment + (u.pendingCustomPayment || 0),
      }));

      return { users: unified };
    } catch (err) {
      logger.error('PayoutStore', `getSummary failed: ${err.message}`);
      return { users: [] };
    }
  },

  // getChain, getPaidIds, getPaidSum are optional — passed from getSummary() for
  // zero-query operation. When called standalone they fall back to DB queries.
  async _calcReferrerSummaries(allOrders, users, rates, getChain, getPaidIds, getPaidSum) {
    if (!rates) rates = await commissionRatesStore.getRates();
    const userLookup = {};
    for (const u of users) userLookup[u.user_id] = u;

    // Accumulate per userId per fLevel
    const refEarnings = {};

    for (const o of allOrders) {
      if (isCancelled(o.order_status)) continue;
      const nc = o.net_commission || 0;
      if (nc <= 0) continue;

      const buyerId = o.sub_id1;
      // Use in-memory chain map when available, fall back to DB
      const chain = getChain ? getChain(buyerId) : await resolveCommissionChain(buyerId);

      const fLevels = [
        { id: chain.f1, level: 1, rate: rates.f1 },
        { id: chain.f2, level: 2, rate: rates.f2 },
        { id: chain.f3, level: 3, rate: rates.f3 },
      ];

      for (const { id, level, rate } of fLevels) {
        if (!id) continue;
        if (!refEarnings[id]) refEarnings[id] = {};
        if (!refEarnings[id][level]) refEarnings[id][level] = { orders: [], total: 0 };
        refEarnings[id][level].orders.push(o);
        refEarnings[id][level].total += Math.round(nc * rate / 100);
      }
    }

    // Batch-fetch any referrer users not already in userLookup (edge case: referrer
    // has no orders of their own so USERS_WITH_ORDERS_SQL didn't include them)
    const missingIds = Object.keys(refEarnings).filter(id => !userLookup[id]);
    if (missingIds.length > 0) {
      const placeholders = missingIds.map((_, i) => `$${i + 1}`).join(',');
      const missingRows = await db.all(
        `SELECT user_id, display_name, zalo_name, avatar, bank_name, bank_account, qr_code, commission_mode FROM users WHERE user_id IN (${placeholders})`,
        missingIds
      );
      for (const u of missingRows) userLookup[u.user_id] = u;
    }

    const summaries = [];
    for (const [userId, levels] of Object.entries(refEarnings)) {
      const refUser = userLookup[userId];

      for (const [level, data] of Object.entries(levels)) {
        const fRole = `f${level}`;

        // Use in-memory paid maps when available, fall back to DB
        let allPaidIds;
        let totalPaidAmount = 0;
        if (getPaidIds) {
          const legacyIds = level === '1' ? getPaidIds(userId, 'referrer') : new Set();
          allPaidIds = new Set([...getPaidIds(userId, fRole), ...legacyIds]);
          totalPaidAmount = getPaidSum
            ? (level === '1' ? getPaidSum(userId, fRole, 'referrer') : getPaidSum(userId, fRole))
            : 0;
        } else {
          const paidIds = await _getPaidOrderIds(userId, fRole);
          const legacyPaidIds = level === '1' ? await _getPaidOrderIds(userId, 'referrer') : new Set();
          allPaidIds = new Set([...paidIds, ...legacyPaidIds]);
          const roleFilter = level === '1' ? `role IN ('${fRole}', 'referrer')` : `role = '${fRole}'`;
          const paidRow = await db.get(
            `SELECT COALESCE(SUM(amount), 0) as total_paid FROM payouts WHERE user_id = ? AND ${roleFilter}`,
            [userId]
          );
          totalPaidAmount = paidRow?.total_paid || 0;
        }

        const rate = level === '1' ? rates.f1 : level === '2' ? rates.f2 : rates.f3;
        let unpaid = 0;
        for (const o of data.orders) {
          if (COMPLETED_STATUSES.has(o.order_status) && !allPaidIds.has(o.order_id)) {
            unpaid += Math.round((o.net_commission || 0) * rate / 100);
          }
        }

        summaries.push({
          userId,
          displayName: refUser?.display_name || refUser?.zalo_name || userId,
          avatar: refUser?.avatar || '',
          bankName: refUser?.bank_name || '',
          bankAccount: refUser?.bank_account || '',
          customQr: refUser?.qr_code || '',
          commissionMode: refUser?.commission_mode || 'normal',
          fLevel: level,
          rate,
          totalCashback: data.total,
          pendingPayment: unpaid,
          orderCount: data.orders.length,
          totalPaid: totalPaidAmount,
        });
      }
    }

    return summaries;
  },

  async getUserDetail(userId) {
    try {
      // Pre-load all data in parallel — eliminates sequential round-trips
      const [rates, buyerOrders, userRow, allUsersForChain, allUserPayouts, refOrders, customOrders, allMatchedOrders] = await Promise.all([
        commissionRatesStore.getRates(),
        db.all(MATCHED_ORDERS_BY_USER_SQL, [userId]),
        db.get(`SELECT user_id, display_name, cashback_buyer_rate, cashback_referrer_rate,
               referrer_earn_rate, custom_rate, is_special, referrer_id, referrer_name,
               commission_mode FROM users WHERE user_id = ?`, [userId]),
        db.all('SELECT user_id, referrer_id FROM users'),
        db.all('SELECT * FROM payouts WHERE user_id = $1 ORDER BY paid_at DESC', [userId]),
        db.all(REFERRER_ORDERS_BY_USER_SQL, [userId]),
        db.all(CUSTOM_ORDERS_BY_USER_SQL, [userId]),
        db.all(MATCHED_ORDERS_SQL),
      ]);

      // In-memory chain resolver — zero DB queries per order
      const getChain = buildChainMap(allUsersForChain);

      // Build paid-order ID sets for all roles from a single query.
      // Also parse paid_orders JSON in-place so payoutHistory returned to frontend has arrays.
      const paidIdsByRole = {};
      for (const p of allUserPayouts) {
        if (typeof p.paid_orders === 'string') {
          try { p.paid_orders = JSON.parse(p.paid_orders); } catch { p.paid_orders = []; }
        }
        if (!paidIdsByRole[p.role]) paidIdsByRole[p.role] = new Set();
        if (Array.isArray(p.paid_orders)) {
          for (const o of p.paid_orders) { if (o.orderId) paidIdsByRole[p.role].add(o.orderId); }
        }
      }
      const getPaidSet = (...roles) => {
        const s = new Set();
        for (const role of roles) for (const id of (paidIdsByRole[role] || new Set())) s.add(id);
        return s;
      };

      const commissionMode = userRow?.commission_mode || 'normal';
      const isCustomMode = commissionMode === 'custom';
      const customRate = userRow?.custom_rate ?? 0;
      // from_direct buyer orders ALWAYS use standard F0 + chain (custom_rate only for from_custom)
      const f0Rate = rates.f0;
      const hasReferrer = !!(userRow?.referrer_id && userRow.referrer_id !== '');

      // Chain is referrer_id based, regardless of commission_mode
      const chain = getChain(userId);

      const completed = [];
      const pending = [];

      const allPaidBuyerIds = getPaidSet('f0', 'buyer');

      for (const o of buyerOrders) {
        // Cancelled orders: skip cashback calc, don't add to completed or pending
        if (isCancelled(o.order_status)) continue;
        // Skip custom orders from buyer section (handled separately below)
        if (o.cl_sub_id4 === 'from_custom' || o.cl_sub_id4 === 'custom') continue;

        const nc = o.net_commission || 0;
        const item = {
          orderId: o.order_id,
          itemId: o.item_id,
          itemName: o.item_name,
          shopName: o.shop_name,
          price: o.price,
          quantity: o.quantity,
          orderStatus: o.order_status,
          orderTime: o.order_time,
          completeTime: o.complete_time,
          netCommission: nc,
          buyerCashback: Math.round(nc * f0Rate / 100),
          f1Cashback: chain.f1 ? Math.round(nc * rates.f1 / 100) : 0,
          f2Cashback: chain.f2 ? Math.round(nc * rates.f2 / 100) : 0,
          f3Cashback: chain.f3 ? Math.round(nc * rates.f3 / 100) : 0,
          adminProfit: Math.round(nc - (nc * f0Rate / 100) - (chain.f1 ? nc * rates.f1 / 100 : 0) - (chain.f2 ? nc * rates.f2 / 100 : 0) - (chain.f3 ? nc * rates.f3 / 100 : 0)),
          type: 'f0',
        };

        if (COMPLETED_STATUSES.has(o.order_status)) {
          if (!allPaidBuyerIds.has(o.order_id)) {
            completed.push(item);
          }
        } else {
          pending.push(item);
        }
      }

      // One-shot buyer lookup for all F1/F2/F3 display names (refOrders + allMatchedOrders merged)
      const allBuyerIdSet = new Set([
        ...refOrders.map(o => o.sub_id1),
        ...allMatchedOrders.map(o => o.sub_id1),
      ].filter(Boolean));
      const allBuyerMap = {};
      if (allBuyerIdSet.size > 0) {
        const allBuyerIds = [...allBuyerIdSet];
        const ph = allBuyerIds.map((_, i) => `$${i + 1}`).join(',');
        const buyerRows = await db.all(
          `SELECT user_id, display_name, avatar, cashback_referrer_rate FROM users WHERE user_id IN (${ph})`,
          allBuyerIds
        );
        for (const b of buyerRows) allBuyerMap[b.user_id] = b;
      }

      // --- Referrer orders (this user referred the buyer) --- pre-loaded above

      const completedReferrer = [];
      const pendingReferrer = [];

      const allPaidRefIds = getPaidSet('referrer', 'f1');

      for (const o of refOrders) {
        if (isCancelled(o.order_status)) continue;

        const nc = o.net_commission || 0;
        const buyerUser = allBuyerMap[o.sub_id1];
        const refRate = rates.f1;
        const buyerDisplayName = buyerUser?.display_name || o.sub_id1;

        const item = {
          orderId: o.order_id,
          itemId: o.item_id,
          itemName: o.item_name,
          shopName: o.shop_name,
          price: o.price,
          quantity: o.quantity,
          orderStatus: o.order_status,
          orderTime: o.order_time,
          completeTime: o.complete_time,
          netCommission: nc,
          referrerCashback: Math.round(nc * refRate / 100),
          buyerName: buyerDisplayName,
          buyerId: o.sub_id1,
          buyerAvatar: buyerUser?.avatar || '',
          type: 'f1',
        };


        if (COMPLETED_STATUSES.has(o.order_status)) {
          if (!allPaidRefIds.has(o.order_id)) {
            completedReferrer.push(item);
          }
        } else {
          pendingReferrer.push(item);
        }
      }

      // --- Custom orders (F1 mode: this user created links for customers) --- pre-loaded above
      const completedCustom = [];
      const pendingCustom = [];
      const paidCustomIds = getPaidSet('custom');

      for (const o of customOrders) {
        if (isCancelled(o.order_status)) continue;
        const nc = o.net_commission || 0;
        const item = {
          orderId: o.order_id,
          itemId: o.item_id,
          itemName: o.item_name,
          shopName: o.shop_name,
          price: o.price,
          quantity: o.quantity,
          orderStatus: o.order_status,
          orderTime: o.order_time,
          completeTime: o.complete_time,
          netCommission: nc,
          customCashback: Math.round(nc * customRate / 100),
          phone: o.customer_phone || '',
          type: 'custom',
        };
        if (COMPLETED_STATUSES.has(o.order_status)) {
          if (!paidCustomIds.has(o.order_id)) {
            completedCustom.push(item);
          }
        } else {
          pendingCustom.push(item);
        }
      }

      // --- F2/F3 referrer orders (this user is 2nd/3rd-level referrer) --- pre-loaded above
      // Iterate all matched orders and resolve chain to find where userId sits at F2 or F3
      const completedF2 = [];
      const pendingF2 = [];
      const completedF3 = [];
      const pendingF3 = [];

      const paidF2Ids = getPaidSet('f2');
      const paidF3Ids = getPaidSet('f3');

      for (const o of allMatchedOrders) {
        if (isCancelled(o.order_status)) continue;
        const nc = o.net_commission || 0;
        if (nc <= 0) continue;

        const orderBuyerId = o.sub_id1;
        const orderChain = getChain(orderBuyerId);

        // Check if this user is F2 for this order
        if (orderChain.f2 === userId) {
          const bUser = allBuyerMap[orderBuyerId];
          const item = {
            orderId: o.order_id,
            itemId: o.item_id,
            itemName: o.item_name,
            shopName: o.shop_name,
            price: o.price,
            quantity: o.quantity,
            orderStatus: o.order_status,
            orderTime: o.order_time,
            completeTime: o.complete_time,
            netCommission: nc,
            fCashback: Math.round(nc * rates.f2 / 100),
            buyerName: bUser?.display_name || orderBuyerId,
            buyerId: orderBuyerId,
            buyerAvatar: bUser?.avatar || '',
            type: 'f2',
          };
          if (COMPLETED_STATUSES.has(o.order_status)) {
            if (!paidF2Ids.has(o.order_id)) completedF2.push(item);
          } else {
            pendingF2.push(item);
          }
        }

        // Check if this user is F3 for this order
        if (orderChain.f3 === userId) {
          const bUser = allBuyerMap[orderBuyerId];
          const item = {
            orderId: o.order_id,
            itemId: o.item_id,
            itemName: o.item_name,
            shopName: o.shop_name,
            price: o.price,
            quantity: o.quantity,
            orderStatus: o.order_status,
            orderTime: o.order_time,
            completeTime: o.complete_time,
            netCommission: nc,
            fCashback: Math.round(nc * rates.f3 / 100),
            buyerName: bUser?.display_name || orderBuyerId,
            buyerId: orderBuyerId,
            buyerAvatar: bUser?.avatar || '',
            type: 'f3',
          };
          if (COMPLETED_STATUSES.has(o.order_status)) {
            if (!paidF3Ids.has(o.order_id)) completedF3.push(item);
          } else {
            pendingF3.push(item);
          }
        }
      }

      // --- Payout history — reuse pre-loaded allUserPayouts (already sorted by paid_at DESC) ---
      const payoutHistory = allUserPayouts;

      return {
        userId,
        displayName: userRow?.display_name || userId,
        commissionMode,
        isCustomMode,
        f0Rate,
        customRate,
        chain,
        adminRate: rates.admin,
        isSpecial: isCustomMode,
        hasReferrer,
        referrerId: userRow?.referrer_id || '',
        referrerName: userRow?.referrer_name || '',
        // Backward compat
        buyerRate: f0Rate,
        referrerRate: 0,
        referrerEarnRate: 0,
        completed,
        pending,
        completedReferrer,
        pendingReferrer,
        completedF2,
        pendingF2,
        completedF3,
        pendingF3,
        completedCustom,
        pendingCustom,
        payoutHistory,
      };
    } catch (err) {
      logger.error('PayoutStore', `getUserDetail(${userId}) failed: ${err.message}`);
      return null;
    }
  },

  /**
   * Server-side payout calculator.
   * Atomically determines unpaid orders, calculates amount, and creates payout record.
   * Returns { payoutId, amount, paidOrders, userName } or null on failure.
   */
  async calculateServerPayout(userId, role, paymentMethod, adminNote, billImage) {
    try {
      const rates = await commissionRatesStore.getRates();
      return await db.transaction(async (tx) => {
        // Pre-load all shared data in parallel — eliminates redundant per-role queries
        const [userRow, allUsersForChain, sharedMatchedOrders, allUserPayouts] = await Promise.all([
          tx.get('SELECT display_name, zalo_name, commission_mode, custom_rate FROM users WHERE user_id = $1', [userId]),
          tx.all('SELECT user_id, referrer_id FROM users'),
          tx.all(MATCHED_ORDERS_SQL),
          tx.all('SELECT role, paid_orders FROM payouts WHERE user_id = $1', [userId]),
        ]);
        const userName = userRow?.display_name || userRow?.zalo_name || userId;
        const getChainLocal = buildChainMap(allUsersForChain);

        // Build in-memory paid-order ID sets from the single pre-loaded payouts query
        const paidIdsByRole = {};
        for (const p of allUserPayouts) {
          if (!paidIdsByRole[p.role]) paidIdsByRole[p.role] = new Set();
          let orders = p.paid_orders;
          if (typeof orders === 'string') { try { orders = JSON.parse(orders); } catch { orders = null; } }
          if (Array.isArray(orders)) {
            for (const o of orders) { if (o.orderId) paidIdsByRole[p.role].add(o.orderId); }
          }
        }
        const getPaidIds = (r) => paidIdsByRole[r] || new Set();

        // Helper: collect unpaid buyer orders
        const getBuyerUnpaid = async () => {
          const paidIds = new Set([...getPaidIds('buyer'), ...getPaidIds('f0')]);
          // from_direct buyer orders always use standard F0 (custom_rate only for from_custom)
          const rate = rates.f0;
          const orders = await tx.all(`
            SELECT DISTINCT o.* FROM orders o
            INNER JOIN convert_logs cl ON (
              (o.item_id != '' AND o.item_id = cl.item_id AND o.sub_id1 = cl.sub_id1) OR
              (cl.item_id = '' AND o.item_name != '' AND o.item_name = cl.product_name AND o.sub_id1 = cl.sub_id1)
            ) WHERE cl.status = 'success' AND o.sub_id1 = $1
              AND COALESCE(o.sub_id4, '') NOT IN ('from_custom', 'custom')
            ORDER BY o.order_time ASC
          `, [userId]);
          const unpaid = [];
          for (const o of orders) {
            if (isCancelled(o.order_status)) continue;
            if (!COMPLETED_STATUSES.has(o.order_status) || paidIds.has(o.order_id)) continue;
            const nc = o.net_commission || 0;
            unpaid.push({ orderId: o.order_id, itemName: o.item_name, shopName: o.shop_name, netCommission: nc, cashback: Math.round(nc * rate / 100), appliedRate: rate, role: 'f0' });
          }
          return unpaid;
        };

        // Helper: collect unpaid referrer orders
        const getReferrerUnpaid = async () => {
          const paidIds = new Set([...getPaidIds('referrer'), ...getPaidIds('f1')]);
          const refOrders = await tx.all(`
            SELECT DISTINCT o.*, cl.sub_id2 as referrer_id, o.sub_id1 as buyer_id FROM orders o
            INNER JOIN convert_logs cl ON (
              (o.item_id != '' AND o.item_id = cl.item_id AND o.sub_id1 = cl.sub_id1) OR
              (cl.item_id = '' AND o.item_name != '' AND o.item_name = cl.product_name AND o.sub_id1 = cl.sub_id1)
            ) WHERE cl.status = 'success' AND cl.sub_id2 = $1
              AND COALESCE(o.sub_id4, '') NOT IN ('from_custom', 'custom')
            ORDER BY o.order_time ASC
          `, [userId]);
          const refRate = rates.f1;
          const unpaid = [];
          for (const o of refOrders) {
            if (isCancelled(o.order_status)) continue;
            if (!COMPLETED_STATUSES.has(o.order_status) || paidIds.has(o.order_id)) continue;
            const nc = o.net_commission || 0;
            unpaid.push({ orderId: o.order_id, itemName: o.item_name, shopName: o.shop_name, netCommission: nc, cashback: Math.round(nc * refRate / 100), appliedRate: refRate, role: 'f1', buyerId: o.sub_id1 });
          }
          return unpaid;
        };

        // Helper: collect unpaid F2 orders — uses shared matched orders + in-memory chain map
        const getF2Unpaid = () => {
          const paidIds = getPaidIds('f2');
          const f2Rate = rates.f2;
          const unpaid = [];
          for (const o of sharedMatchedOrders) {
            if (isCancelled(o.order_status)) continue;
            if (!COMPLETED_STATUSES.has(o.order_status) || paidIds.has(o.order_id)) continue;
            const nc = o.net_commission || 0;
            if (nc <= 0) continue;
            if (getChainLocal(o.sub_id1).f2 === userId) {
              unpaid.push({ orderId: o.order_id, itemName: o.item_name, shopName: o.shop_name, netCommission: nc, cashback: Math.round(nc * f2Rate / 100), appliedRate: f2Rate, role: 'f2', buyerId: o.sub_id1 });
            }
          }
          return unpaid;
        };

        // Helper: collect unpaid F3 orders — uses shared matched orders + in-memory chain map
        const getF3Unpaid = () => {
          const paidIds = getPaidIds('f3');
          const f3Rate = rates.f3;
          const unpaid = [];
          for (const o of sharedMatchedOrders) {
            if (isCancelled(o.order_status)) continue;
            if (!COMPLETED_STATUSES.has(o.order_status) || paidIds.has(o.order_id)) continue;
            const nc = o.net_commission || 0;
            if (nc <= 0) continue;
            if (getChainLocal(o.sub_id1).f3 === userId) {
              unpaid.push({ orderId: o.order_id, itemName: o.item_name, shopName: o.shop_name, netCommission: nc, cashback: Math.round(nc * f3Rate / 100), appliedRate: f3Rate, role: 'f3', buyerId: o.sub_id1 });
            }
          }
          return unpaid;
        };

        // Helper: collect unpaid Custom orders
        const getCustomUnpaid = async () => {
          const paidIds = getPaidIds('custom');
          const customRate = userRow?.custom_rate || 0;
          const customOrders = await tx.all(CUSTOM_ORDERS_BY_USER_SQL, [userId]);
          const unpaid = [];
          for (const o of customOrders) {
            if (isCancelled(o.order_status)) continue;
            if (!COMPLETED_STATUSES.has(o.order_status) || paidIds.has(o.order_id)) continue;
            const nc = o.net_commission || 0;
            if (nc <= 0) continue;
            
            unpaid.push({ orderId: o.order_id, itemName: o.item_name, shopName: o.shop_name, netCommission: nc, cashback: Math.round(nc * customRate / 100), appliedRate: customRate, role: 'custom', phone: o.customer_phone || '' });
          }
          return unpaid;
        };

        // Helper: insert payout record
        const insertPayout = async (r, orders) => {
          if (orders.length === 0) return null;
          const amt = orders.reduce((s, o) => s + o.cashback, 0);
          if (amt <= 0) return null;
          const res = await tx.runNamed(`
            INSERT INTO payouts (user_id, user_name, role, amount, payment_method, bill_image, admin_note, paid_orders)
            VALUES (@userId, @userName, @role, @amount, @paymentMethod, @billImage, @adminNote, @paidOrders) RETURNING id
          `, { userId, userName, role: r, amount: amt, paymentMethod: paymentMethod || '', billImage: billImage || '', adminNote: adminNote || '', paidOrders: JSON.stringify(orders) });
          logger.info('PayoutStore', `Payout created: user=${userId}, role=${r}, amount=${amt}, orders=${orders.length}`);
          return { payoutId: res?.lastInsertRowid, amount: amt, paidOrders: orders };
        };

        if (role === 'combined') {
          // All 3 DB-querying helpers run in parallel; F2/F3 are synchronous (in-memory only)
          const [buyerOrders, refOrders, customOrders] = await Promise.all([
            getBuyerUnpaid(), getReferrerUnpaid(), getCustomUnpaid(),
          ]);
          const f2Orders = getF2Unpaid();
          const f3Orders = getF3Unpaid();

          const bResult = await insertPayout('f0', buyerOrders);
          const rResult = await insertPayout('f1', refOrders);
          const f2Result = await insertPayout('f2', f2Orders);
          const f3Result = await insertPayout('f3', f3Orders);
          const customResult = await insertPayout('custom', customOrders);

          const totalAmount = (bResult?.amount || 0) + (rResult?.amount || 0) + (f2Result?.amount || 0) + (f3Result?.amount || 0) + (customResult?.amount || 0);
          if (totalAmount <= 0) return { amount: 0, userName, error: 'No unpaid orders found' };
          return { amount: totalAmount, userName, buyerPayout: bResult, referrerPayout: rResult, f2Payout: f2Result, f3Payout: f3Result, customPayout: customResult };
        } else if (role === 'f0' || role === 'buyer') {
          const buyerOrders = await getBuyerUnpaid();
          const amount = buyerOrders.reduce((s, o) => s + o.cashback, 0);
          if (amount <= 0) return { amount: 0, userName, error: 'No unpaid orders found' };
          const result = await insertPayout('f0', buyerOrders);
          return { ...result, userName };
        } else if (role === 'referrer' || role === 'f1') {
          const orders = await getReferrerUnpaid();
          const amount = orders.reduce((s, o) => s + o.cashback, 0);
          if (amount <= 0) return { amount: 0, userName, error: 'No unpaid orders found' };
          const result = await insertPayout('f1', orders);
          return { ...result, userName };
        } else if (role === 'f2') {
          const orders = getF2Unpaid();
          const amount = orders.reduce((s, o) => s + o.cashback, 0);
          if (amount <= 0) return { amount: 0, userName, error: 'No unpaid orders found' };
          const result = await insertPayout('f2', orders);
          return { ...result, userName };
        } else if (role === 'f3') {
          const orders = getF3Unpaid();
          const amount = orders.reduce((s, o) => s + o.cashback, 0);
          if (amount <= 0) return { amount: 0, userName, error: 'No unpaid orders found' };
          const result = await insertPayout('f3', orders);
          return { ...result, userName };
        } else if (role === 'custom') {
          const orders = await getCustomUnpaid();
          const amount = orders.reduce((s, o) => s + o.cashback, 0);
          if (amount <= 0) return { amount: 0, userName, error: 'No unpaid orders found' };
          const result = await insertPayout('custom', orders);
          return { ...result, userName };
        } else {
          return { amount: 0, userName, error: `Unsupported role: ${role}` };
        }
      });
    } catch (err) {
      logger.error('PayoutStore', `calculateServerPayout failed: ${err.message}`);
      return null;
    }
  },

  async createPayout(data) {
    try {
      const paidOrdersStr = data.paidOrders ? JSON.stringify(data.paidOrders) : null;
      const result = await db.getNamed(`
        INSERT INTO payouts (user_id, user_name, role, amount, payment_method, bill_image, admin_note, paid_orders)
        VALUES (@userId, @userName, @role, @amount, @paymentMethod, @billImage, @adminNote, @paidOrders)
        RETURNING id
      `, {
        userId: data.userId,
        userName: data.userName || '',
        role: data.role || 'buyer',
        amount: data.amount,
        paymentMethod: data.paymentMethod || '',
        billImage: data.billImage || '',
        adminNote: data.adminNote || '',
        paidOrders: paidOrdersStr,
      });
      return result?.id;
    } catch (err) {
      logger.error('PayoutStore', `createPayout failed: ${err.message}`);
      return null;
    }
  },

  async updateBill(payoutId, imagePath) {
    try {
      await db.run('UPDATE payouts SET bill_image = ? WHERE id = ?', [imagePath, payoutId]);
      return true;
    } catch (err) {
      logger.error('PayoutStore', `updateBill failed: ${err.message}`);
      return false;
    }
  },

  async getHistory(limit = 50, offset = 0) {
    return db.all('SELECT * FROM payouts ORDER BY paid_at DESC LIMIT ? OFFSET ?', [limit, offset]);
  },

  /**
   * Update user commission mode and custom rate.
   * @param {string} userId
   * @param {string} commissionMode - 'normal' or 'custom'
   * @param {number} customRate - Only used when mode is 'custom', must be 40-70
   */
  async updateUserCommissionMode(userId, commissionMode, customRate) {
    try {
      const rates = await commissionRatesStore.getRates();
      if (!['normal', 'custom'].includes(commissionMode)) {
        return { success: false, error: 'Invalid commission mode. Must be "normal" or "custom".' };
      }

      if (commissionMode === 'custom') {
        if (customRate === undefined || customRate === null) {
          return { success: false, error: 'Custom rate is required when mode is "custom".' };
        }
        if (customRate < 40 || customRate > 70) {
          return { success: false, error: 'Custom rate must be between 40% and 70%.' };
        }
      }

      const isCustom = commissionMode === 'custom';
      const rate = isCustom ? customRate : 0;

      await db.run(
        `UPDATE users 
         SET commission_mode = ?, custom_rate = ?, is_special = ?
         WHERE user_id = ?`,
        [commissionMode, rate, isCustom ? 1 : 0, userId]
      );

      return {
        success: true,
        commissionMode,
        customRate: rate,
        isCustomMode: isCustom,
        f0Rate: isCustom ? rate : rates.f0,
        adminRate: isCustom ? (100 - rate) : rates.admin,
      };
    } catch (err) {
      logger.error('PayoutStore', `updateUserCommissionMode failed: ${err.message}`);
      return { success: false, error: err.message };
    }
  },

  // Legacy wrapper for backward compatibility
  async updateUserReferrerRate(userId, buyerRate, referrerEarnRate, customRate) {
    if (customRate > 0) {
      return this.updateUserCommissionMode(userId, 'custom', customRate);
    }
    return this.updateUserCommissionMode(userId, 'normal', 0);
  },

};

module.exports = payoutStore;
