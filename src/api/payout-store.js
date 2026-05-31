const db = require('../db');
const logger = require('../logger');

// Completed statuses for Shopee orders
const COMPLETED_STATUSES = new Set(['Hoàn thành', 'Completed']);

// Cancelled orders — excluded entirely from all cashback calculations
const CANCELLED_STATUSES = new Set(['Đã huỷ', 'Cancelled']);

// SQL: Get all matched orders — also fetch sub_id4 from convert_logs to identify custom orders
const MATCHED_ORDERS_SQL = `
  SELECT DISTINCT o.*, cl.sub_id2 as referrer_id, cl.sub_id4 as cl_sub_id4
  FROM orders o
  INNER JOIN convert_logs cl ON (
    (o.item_id != '' AND o.item_id = cl.item_id AND o.sub_id1 = cl.sub_id1)
    OR
    (cl.item_id = '' AND o.item_name != '' AND o.item_name = cl.product_name AND o.sub_id1 = cl.sub_id1)
  )
  WHERE cl.status = 'success'
  ORDER BY o.order_time DESC
`;

const MATCHED_ORDERS_BY_USER_SQL = `
  SELECT DISTINCT o.*, cl.sub_id2 as referrer_id, cl.sub_id4 as cl_sub_id4
  FROM orders o
  INNER JOIN convert_logs cl ON (
    (o.item_id != '' AND o.item_id = cl.item_id AND o.sub_id1 = cl.sub_id1)
    OR
    (cl.item_id = '' AND o.item_name != '' AND o.item_name = cl.product_name AND o.sub_id1 = cl.sub_id1)
  )
  WHERE cl.status = 'success' AND o.sub_id1 = ?
  ORDER BY o.order_time DESC
`;

// Custom orders (F1 mode) — linked via sub_id1 = F1 uid AND cl.sub_id4 = 'from_custom'
const CUSTOM_ORDERS_BY_USER_SQL = `
  SELECT DISTINCT o.*, cl.sub_id2 as customer_phone, cl.sub_id4 as cl_sub_id4
  FROM orders o
  INNER JOIN convert_logs cl ON (
    (o.item_id != '' AND o.item_id = cl.item_id AND o.sub_id1 = cl.sub_id1)
    OR
    (cl.item_id = '' AND o.item_name != '' AND o.item_name = cl.product_name AND o.sub_id1 = cl.sub_id1)
  )
  WHERE cl.status = 'success' AND o.sub_id1 = ? AND cl.sub_id4 = 'from_custom'
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
  ORDER BY o.order_time DESC
`;

const USERS_WITH_ORDERS_SQL = `
  SELECT DISTINCT u.user_id, u.display_name, u.zalo_name, u.avatar,
         u.cashback_buyer_rate, u.cashback_referrer_rate, u.referrer_earn_rate, u.is_special,
         u.referrer_id, u.referrer_name, u.custom_rate,
         u.bank_name, u.bank_account, u.qr_code
  FROM users u
  INNER JOIN orders o ON o.sub_id1 = u.user_id
  INNER JOIN convert_logs cl ON (
    (o.item_id != '' AND o.item_id = cl.item_id AND o.sub_id1 = cl.sub_id1)
    OR
    (cl.item_id = '' AND o.item_name != '' AND o.item_name = cl.product_name AND o.sub_id1 = cl.sub_id1)
  )
  WHERE cl.status = 'success'
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

const payoutStore = {
  async getSummary() {
    try {
      const users = await db.all(USERS_WITH_ORDERS_SQL);
      const allOrders = await db.all(MATCHED_ORDERS_SQL);

      // Group orders by buyer (sub_id1)
      const ordersByUser = {};
      for (const order of allOrders) {
        const uid = order.sub_id1;
        if (!ordersByUser[uid]) ordersByUser[uid] = [];
        ordersByUser[uid].push(order);
      }

      const summaries = [];

      for (const user of users) {
        const uid = user.user_id;
        const orders = ordersByUser[uid] || [];
        if (orders.length === 0) continue;

        const buyerRate = user.cashback_buyer_rate ?? 60;
        const hasReferrer = !!(user.referrer_id && user.referrer_id !== '');
        
        let referrerRate = 0;
        if (hasReferrer) {
          const refId = user.referrer_id;
          let refUser = users.find(u => u.user_id === refId);
          if (!refUser) {
            refUser = await db.get('SELECT referrer_earn_rate FROM users WHERE user_id = ?', [refId]);
          }
          referrerRate = refUser?.referrer_earn_rate ?? 20;
        }

        const customRate = user.custom_rate ?? 0;
        const referrerEarnRate = user.referrer_earn_rate ?? 20;
        const isSpecial = !!(user.is_special);

        // Collect paid order IDs from snapshots (immutable)
        const paidOrderIds = await _getPaidOrderIds(uid, 'buyer');
        const paidCustomIds = await _getPaidOrderIds(uid, 'custom');

        let totalNetCommission = 0;
        let completedNetCommission = 0;
        let pendingNetCommission = 0;
        let completedCount = 0;
        let pendingCount = 0;
        let unpaidCompletedCashback = 0;

        // Custom commission totals
        let totalCustomNetCommission = 0;
        let completedCustomNetCommission = 0;
        let pendingCustomNetCommission = 0;
        let completedCustomCount = 0;
        let pendingCustomCount = 0;
        let unpaidCustomCashback = 0;

        for (const o of orders) {
          // Skip cancelled orders entirely — don't count toward any totals
          if (CANCELLED_STATUSES.has(o.order_status)) continue;

          const isCustom = o.cl_sub_id4 === 'from_custom';
          const nc = o.net_commission || 0;

          if (isCustom) {
            // Custom orders: use custom_rate, separate tracking
            totalCustomNetCommission += nc;
            if (COMPLETED_STATUSES.has(o.order_status)) {
              if (!paidCustomIds.has(o.order_id)) {
                completedCustomNetCommission += nc;
                completedCustomCount++;
                unpaidCustomCashback += Math.round(nc * customRate / 100);
              }
            } else {
              pendingCustomNetCommission += nc;
              pendingCustomCount++;
            }
          } else {
            // Normal buyer orders
            totalNetCommission += nc;
            if (COMPLETED_STATUSES.has(o.order_status)) {
              if (!paidOrderIds.has(o.order_id)) {
                completedNetCommission += nc;
                completedCount++;
                unpaidCompletedCashback += Math.round(nc * buyerRate / 100);
              }
            } else {
              pendingNetCommission += nc;
              pendingCount++;
            }
          }
        }

        const totalBuyerCashback = Math.round(totalNetCommission * buyerRate / 100);
        const completedBuyerCashback = Math.round(completedNetCommission * buyerRate / 100);
        const totalCustomCashback = Math.round(totalCustomNetCommission * customRate / 100);

        // totalPaid from payouts SUM (exact bank amount, immutable)
        const paidRow = await db.get('SELECT COALESCE(SUM(amount), 0) as total_paid FROM payouts WHERE user_id = ? AND role = ?', [uid, 'buyer']);
        const paidAsBuyer = paidRow.total_paid;
        const paidCustomRow = await db.get('SELECT COALESCE(SUM(amount), 0) as total_paid FROM payouts WHERE user_id = ? AND role = ?', [uid, 'custom']);
        const paidAsCustom = paidCustomRow.total_paid;

        summaries.push({
          userId: uid,
          displayName: user.display_name || user.zalo_name || uid,
          avatar: user.avatar || '',
          bankName: user.bank_name || '',
          bankAccount: user.bank_account || '',
          customQr: user.qr_code || '',
          referrerId: user.referrer_id || '',
          referrerName: user.referrer_name || '',
          hasReferrer,
          buyerRate,
          referrerRate,
          referrerEarnRate,
          customRate,
          isSpecial,
          adminRate: 100 - buyerRate - referrerRate,
          totalNetCommission: Math.round(totalNetCommission),
          completedNetCommission: Math.round(completedNetCommission),
          pendingNetCommission: Math.round(pendingNetCommission),
          totalBuyerCashback,
          completedBuyerCashback,
          totalPaid: paidAsBuyer + paidAsCustom,
          pendingBuyerPayment: unpaidCompletedCashback,
          completedCount,
          pendingCount,
          totalOrders: orders.length,
          // Custom
          totalCustomCashback,
          completedCustomNetCommission: Math.round(completedCustomNetCommission),
          pendingCustomNetCommission: Math.round(pendingCustomNetCommission),
          pendingCustomPayment: unpaidCustomCashback,
          customOrderCount: orders.filter(o => o.cl_sub_id4 === 'from_custom').length,
          completedCustomCount,
          pendingCustomCount,
        });
      }

      // Merge buyer + referrer + custom into unified list
      const referrerSummaries = await this._calcReferrerSummaries(allOrders, users);
      const userMap = {};
      for (const b of summaries) {
        userMap[b.userId] = {
          ...b,
          pendingReferrerPayment: 0,
          referrerOrderCount: 0,
          totalReferrerCashback: 0,
        };
      }
      for (const r of referrerSummaries) {
        if (userMap[r.userId]) {
          userMap[r.userId].pendingReferrerPayment = r.pendingPayment;
          userMap[r.userId].referrerOrderCount = r.orderCount;
          userMap[r.userId].totalReferrerCashback = r.totalReferrerCashback;
          userMap[r.userId].totalPaid += r.totalPaid;
        } else {
          userMap[r.userId] = {
            userId: r.userId, displayName: r.displayName, avatar: r.avatar,
            bankName: r.bankName || '', bankAccount: r.bankAccount || '', customQr: r.customQr || '',
            referrerId: '', referrerName: '', hasReferrer: false,
            buyerRate: 0, referrerRate: 0, adminRate: 0,
            referrerEarnRate: r.referrerEarnRate ?? 20,
            customRate: r.customRate ?? 0,
            isSpecial: !!(r.isSpecial),
            totalNetCommission: 0, completedNetCommission: 0, pendingNetCommission: 0,
            totalBuyerCashback: 0, completedBuyerCashback: 0,
            totalPaid: r.totalPaid,
            pendingBuyerPayment: 0, completedCount: 0, pendingCount: 0, totalOrders: 0,
            pendingReferrerPayment: r.pendingPayment,
            referrerOrderCount: r.orderCount,
            totalReferrerCashback: r.totalReferrerCashback,
            // Custom defaults for referrer-only users
            pendingCustomPayment: 0, customOrderCount: 0, totalCustomCashback: 0,
            completedCustomCount: 0, pendingCustomCount: 0,
          };
        }
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

  async _calcReferrerSummaries(allOrders, users) {
    const referrerOrders = {};
    for (const o of allOrders) {
      const refId = o.referrer_id;
      if (!refId || refId === '') continue;
      if (!referrerOrders[refId]) referrerOrders[refId] = [];
      referrerOrders[refId].push(o);
    }

    const userMap = {};
    for (const u of users) userMap[u.user_id] = u;

    const summaries = [];
    for (const [refId, orders] of Object.entries(referrerOrders)) {
      // Collect paid order IDs from referrer snapshots
      const paidOrderIds = await _getPaidOrderIds(refId, 'referrer');

      // Fetch the referrer user details and their referrer_earn_rate
      let refUser = userMap[refId];
      if (!refUser) {
        refUser = await db.get('SELECT user_id, display_name, zalo_name, avatar, bank_name, bank_account, qr_code, referrer_earn_rate, is_special FROM users WHERE user_id = ?', [refId]);
      }
      const refRate = refUser?.referrer_earn_rate ?? 20;

      let totalRef = 0;
      let completedRef = 0;
      let unpaidCompletedRef = 0;
      let completedCount = 0;

      for (const o of orders) {
        // Skip cancelled orders entirely
        if (CANCELLED_STATUSES.has(o.order_status)) continue;

        const nc = o.net_commission || 0;
        const cb = Math.round(nc * refRate / 100);
        totalRef += cb;
        if (COMPLETED_STATUSES.has(o.order_status)) {
          if (!paidOrderIds.has(o.order_id)) {
            completedRef += cb;
            completedCount++;
            unpaidCompletedRef += cb;
          }
        }
      }

      const paidRow = await db.get('SELECT COALESCE(SUM(amount), 0) as total_paid FROM payouts WHERE user_id = ? AND role = ?', [refId, 'referrer']);
      const paidAsReferrer = paidRow.total_paid;

      summaries.push({
        userId: refId,
        displayName: refUser?.display_name || refUser?.zalo_name || refId,
        avatar: refUser?.avatar || '',
        bankName: refUser?.bank_name || '',
        bankAccount: refUser?.bank_account || '',
        customQr: refUser?.qr_code || '',
        totalReferrerCashback: totalRef,
        completedReferrerCashback: completedRef,
        totalPaid: paidAsReferrer,
        pendingPayment: unpaidCompletedRef,
        completedCount,
        orderCount: orders.length,
        referrerEarnRate: refRate,
        isSpecial: !!(refUser?.is_special),
      });
    }

    return summaries;
  },

  async getUserDetail(userId) {
    try {
      // --- Buyer orders (this user bought) ---
      const buyerOrders = await db.all(MATCHED_ORDERS_BY_USER_SQL, [userId]);
      const userRow = await db.get(`
        SELECT user_id, display_name, cashback_buyer_rate, cashback_referrer_rate,
               referrer_earn_rate, custom_rate, is_special, referrer_id, referrer_name
        FROM users WHERE user_id = ?
      `, [userId]);

      const buyerRate = userRow?.cashback_buyer_rate ?? 60;
      const referrerRate = userRow?.cashback_referrer_rate ?? 20;
      const customRate = userRow?.custom_rate ?? 0;
      const hasReferrer = !!(userRow?.referrer_id && userRow.referrer_id !== '');

      let referrerEarnRateOfReferrer = 20;
      if (hasReferrer) {
        const refRow = await db.get('SELECT referrer_earn_rate FROM users WHERE user_id = ?', [userRow.referrer_id]);
        referrerEarnRateOfReferrer = refRow?.referrer_earn_rate ?? 20;
      }

      const completed = [];
      const pending = [];

      const paidBuyerIds = await _getPaidOrderIds(userId, 'buyer');

      for (const o of buyerOrders) {
        // Cancelled orders: skip cashback calc, don't add to completed or pending
        if (CANCELLED_STATUSES.has(o.order_status)) continue;
        // Skip custom orders from buyer section (handled separately below)
        if (o.cl_sub_id4 === 'from_custom') continue;

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
          buyerCashback: Math.round(nc * buyerRate / 100),
          referrerCashback: hasReferrer ? Math.round(nc * referrerEarnRateOfReferrer / 100) : 0,
          adminProfit: Math.round(nc * (100 - buyerRate - (hasReferrer ? referrerEarnRateOfReferrer : 0)) / 100),
          type: 'buyer',
        };

        if (COMPLETED_STATUSES.has(o.order_status)) {
          if (!paidBuyerIds.has(o.order_id)) {
            completed.push(item);
          }
        } else {
          pending.push(item);
        }
      }

      // --- Referrer orders (this user referred the buyer) ---
      const refOrders = await db.all(REFERRER_ORDERS_BY_USER_SQL, [userId]);

      // Fix Bug #6: Batch lookup all buyer IDs instead of N+1
      const buyerIds = [...new Set(refOrders.map(o => o.sub_id1).filter(Boolean))];
      const buyerMap = {};
      if (buyerIds.length > 0) {
        const placeholders = buyerIds.map((_, i) => `$${i + 1}`).join(',');
        const buyerRows = await db.all(
          `SELECT user_id, display_name, avatar, cashback_referrer_rate FROM users WHERE user_id IN (${placeholders})`,
          buyerIds
        );
        for (const b of buyerRows) buyerMap[b.user_id] = b;
      }

      const completedReferrer = [];
      const pendingReferrer = [];

      const paidReferrerIds = await _getPaidOrderIds(userId, 'referrer');
      const currentUserReferrerEarnRate = userRow?.referrer_earn_rate ?? 20;

      for (const o of refOrders) {
        // Cancelled orders: skip from referrer cashback entirely
        if (CANCELLED_STATUSES.has(o.order_status)) continue;

        const nc = o.net_commission || 0;
        const buyerUser = buyerMap[o.sub_id1];
        const refRate = currentUserReferrerEarnRate;
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
          type: 'referrer',
        };

        if (COMPLETED_STATUSES.has(o.order_status)) {
          if (!paidReferrerIds.has(o.order_id)) {
            completedReferrer.push(item);
          }
        } else {
          pendingReferrer.push(item);
        }
      }

      // --- Custom orders (F1 mode: this user created links for customers) ---
      const customOrders = await db.all(CUSTOM_ORDERS_BY_USER_SQL, [userId]);
      const completedCustom = [];
      const pendingCustom = [];
      const paidCustomIds = await _getPaidOrderIds(userId, 'custom');

      for (const o of customOrders) {
        if (CANCELLED_STATUSES.has(o.order_status)) continue;
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

      // --- Payout history (buyer, referrer, and custom roles) ---
      const payoutHistory = await db.all('SELECT * FROM payouts WHERE user_id = ? ORDER BY paid_at DESC', [userId]);

      for (const p of payoutHistory) {
        if (typeof p.paid_orders === 'string') {
          try {
            p.paid_orders = JSON.parse(p.paid_orders);
          } catch (e) {
            p.paid_orders = null;
          }
        }
      }

      return {
        userId,
        displayName: userRow?.display_name || userId,
        buyerRate,
        referrerRate,
        referrerEarnRate: userRow?.referrer_earn_rate ?? 20,
        customRate,
        isSpecial: !!(userRow?.is_special),
        hasReferrer,
        referrerId: userRow?.referrer_id || '',
        referrerName: userRow?.referrer_name || '',
        completed,
        pending,
        completedReferrer,
        pendingReferrer,
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
      return await db.transaction(async (tx) => {
        const userRow = await tx.get(
          'SELECT display_name, zalo_name, cashback_buyer_rate, referrer_earn_rate FROM users WHERE user_id = $1',
          [userId]
        );
        const userName = userRow?.display_name || userRow?.zalo_name || userId;

        // Helper: get paid order IDs for a specific role
        const getPaidIds = async (r) => {
          const rows = await tx.all('SELECT paid_orders FROM payouts WHERE user_id = $1 AND role = $2', [userId, r]);
          const ids = new Set();
          for (const p of rows) {
            let o = p.paid_orders;
            if (typeof o === 'string') { try { o = JSON.parse(o); } catch { o = null; } }
            if (Array.isArray(o)) o.forEach(x => x.orderId && ids.add(x.orderId));
          }
          return ids;
        };

        // Helper: collect unpaid buyer orders
        const getBuyerUnpaid = async () => {
          const paidIds = await getPaidIds('buyer');
          const buyerRate = userRow?.cashback_buyer_rate ?? 60;
          const orders = await tx.all(`
            SELECT DISTINCT o.* FROM orders o
            INNER JOIN convert_logs cl ON (
              (o.item_id != '' AND o.item_id = cl.item_id AND o.sub_id1 = cl.sub_id1) OR
              (cl.item_id = '' AND o.item_name != '' AND o.item_name = cl.product_name AND o.sub_id1 = cl.sub_id1)
            ) WHERE cl.status = 'success' AND o.sub_id1 = $1 ORDER BY o.order_time ASC
          `, [userId]);
          const unpaid = [];
          for (const o of orders) {
            // Skip cancelled orders — no payout for cancelled
            if (CANCELLED_STATUSES.has(o.order_status)) continue;
            if (!COMPLETED_STATUSES.has(o.order_status) || paidIds.has(o.order_id)) continue;
            const nc = o.net_commission || 0;
            unpaid.push({ orderId: o.order_id, itemName: o.item_name, shopName: o.shop_name, netCommission: nc, cashback: Math.round(nc * buyerRate / 100), appliedRate: buyerRate, role: 'buyer' });
          }
          return unpaid;
        };

        // Helper: collect unpaid referrer orders
        const getReferrerUnpaid = async () => {
          const paidIds = await getPaidIds('referrer');
          const refOrders = await tx.all(`
            SELECT DISTINCT o.*, cl.sub_id2 as referrer_id, o.sub_id1 as buyer_id FROM orders o
            INNER JOIN convert_logs cl ON (
              (o.item_id != '' AND o.item_id = cl.item_id AND o.sub_id1 = cl.sub_id1) OR
              (cl.item_id = '' AND o.item_name != '' AND o.item_name = cl.product_name AND o.sub_id1 = cl.sub_id1)
            ) WHERE cl.status = 'success' AND cl.sub_id2 = $1 ORDER BY o.order_time ASC
          `, [userId]);
          const refRate = userRow?.referrer_earn_rate ?? 20;
          const unpaid = [];
          for (const o of refOrders) {
            // Skip cancelled orders — no referrer payout for cancelled
            if (CANCELLED_STATUSES.has(o.order_status)) continue;
            if (!COMPLETED_STATUSES.has(o.order_status) || paidIds.has(o.order_id)) continue;
            const nc = o.net_commission || 0;
            unpaid.push({ orderId: o.order_id, itemName: o.item_name, shopName: o.shop_name, netCommission: nc, cashback: Math.round(nc * refRate / 100), appliedRate: refRate, role: 'referrer', buyerId: o.sub_id1 });
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

        // Execute based on role
        if (role === 'combined') {
          const buyerOrders = await getBuyerUnpaid();
          const refOrders = await getReferrerUnpaid();
          const bResult = await insertPayout('buyer', buyerOrders);
          const rResult = await insertPayout('referrer', refOrders);
          const totalAmount = (bResult?.amount || 0) + (rResult?.amount || 0);
          if (totalAmount <= 0) return { amount: 0, userName, error: 'No unpaid orders found' };
          return { amount: totalAmount, userName, buyerPayout: bResult, referrerPayout: rResult };
        } else {
          const orders = role === 'buyer' ? await getBuyerUnpaid() : await getReferrerUnpaid();
          const amount = orders.reduce((s, o) => s + o.cashback, 0);
          if (amount <= 0) return { amount: 0, userName, error: 'No unpaid orders found' };
          const result = await insertPayout(role, orders);
          return { ...result, userName };
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

  async updateUserReferrerRate(userId, buyerRate, referrerRate, customRate) {
    try {
      // If any is undefined, load the current values first
      if (buyerRate === undefined || referrerRate === undefined || customRate === undefined) {
        const userRow = await db.get('SELECT cashback_buyer_rate, referrer_earn_rate, custom_rate FROM users WHERE user_id = ?', [userId]);
        if (buyerRate === undefined) buyerRate = userRow?.cashback_buyer_rate ?? 60;
        if (referrerRate === undefined) referrerRate = userRow?.referrer_earn_rate ?? 20;
        if (customRate === undefined) customRate = userRow?.custom_rate ?? 0;
      }

      if (buyerRate < 0 || buyerRate > 100) {
        return { success: false, error: 'Buyer rate must be between 0% and 100%' };
      }
      if (referrerRate < 0 || referrerRate > 100) {
        return { success: false, error: 'Referrer rate must be between 0% and 100%' };
      }
      if (customRate < 0 || customRate > 100) {
        return { success: false, error: 'Custom rate must be between 0% and 100%' };
      }
      if (buyerRate + referrerRate > 100) {
        return { success: false, error: 'Total rates (Buyer + Referrer) cannot exceed 100%' };
      }

      const isSpecial = (buyerRate !== 60 || referrerRate !== 20 || customRate > 0) ? 1 : 0;

      await db.run(
        `UPDATE users 
         SET cashback_buyer_rate = ?, referrer_earn_rate = ?, custom_rate = ?, is_special = ? 
         WHERE user_id = ?`,
        [buyerRate, referrerRate, customRate, isSpecial, userId]
      );
      
      const adminRate = 100 - buyerRate - referrerRate;
      return { success: true, buyerRate, referrerRate, customRate, adminRate, isSpecial: !!isSpecial };
    } catch (err) {
      logger.error('PayoutStore', `updateUserReferrerRate failed: ${err.message}`);
      return { success: false, error: err.message };
    }
  },

};

module.exports = payoutStore;
