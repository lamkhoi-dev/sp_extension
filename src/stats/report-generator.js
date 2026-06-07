const db = require('../db');
const logger = require('../logger');
const commissionRatesStore = require('../api/commission-rates-store');

// All matched orders (non-custom) — same pattern as payout-store MATCHED_ORDERS_SQL
const CHAIN_ORDERS_SQL = `
  SELECT DISTINCT o.order_id, o.sub_id1, o.order_status, o.net_commission
  FROM orders o
  INNER JOIN convert_logs cl ON (
    (o.item_id != '' AND o.item_id = cl.item_id AND o.sub_id1 = cl.sub_id1)
    OR
    (cl.item_id = '' AND o.item_name != '' AND o.item_name = cl.product_name AND o.sub_id1 = cl.sub_id1)
  )
  WHERE cl.status = 'success' AND COALESCE(o.sub_id4, '') NOT IN ('from_custom', 'custom')
`;

function isChainCancelled(status) {
  if (!status) return false;
  const s = status.toLowerCase();
  return s.includes('hủy') || s.includes('huỷ') || s.includes('cancel') || s.includes('chưa thanh toán');
}

// Calculate referrer earnings using buyer registration chain — matches payout-store logic exactly.
// LNK earns F1 rate on buyers directly under LNK, F2 rate on buyers under LNK's F1s, etc.
async function calcReferrerEarnings(userId, rates) {
  const uid = String(userId);
  const allUsers = await db.all('SELECT user_id, referrer_id FROM users');
  const parentOf = {};
  for (const u of allUsers) parentOf[String(u.user_id)] = u.referrer_id ? String(u.referrer_id) : null;

  const orders = await db.all(CHAIN_ORDERS_SQL);
  let f1 = 0, f2 = 0, f3 = 0;

  for (const o of orders) {
    if (isChainCancelled(o.order_status)) continue;
    const nc = Number(o.net_commission) || 0;
    if (nc <= 0) continue;
    const b = String(o.sub_id1);
    const p1 = parentOf[b] || null;
    const p2 = p1 ? (parentOf[p1] || null) : null;
    const p3 = p2 ? (parentOf[p2] || null) : null;
    if (p1 === uid) f1 += Math.round(nc * rates.f1 / 100);
    else if (p2 === uid) f2 += Math.round(nc * rates.f2 / 100);
    else if (p3 === uid) f3 += Math.round(nc * rates.f3 / 100);
  }

  return { totalF1Earnings: f1, totalF2Earnings: f2, totalF3Earnings: f3 };
}

// SQL: Load a user's direct downline (CTVs) with their order/commission stats.
// Excludes cancelled orders. `referrerId` = userId of the parent.
const DOWNLINE_SQL = `
  SELECT u.user_id, u.display_name, u.zalo_name, u.avatar,
         u.first_contact, u.commission_mode,
         COALESCE((
           SELECT COUNT(DISTINCT o.order_id)
           FROM orders o
           INNER JOIN convert_logs cl ON (
             (o.item_id != '' AND o.item_id = cl.item_id AND o.sub_id1 = cl.sub_id1)
             OR
             (cl.item_id = '' AND o.item_name != '' AND o.item_name = cl.product_name AND o.sub_id1 = cl.sub_id1)
           )
           WHERE cl.user_id = u.user_id AND cl.status = 'success'
             AND COALESCE(o.order_status,'') NOT LIKE '%hủy%'
             AND COALESCE(o.order_status,'') NOT LIKE '%huỷ%'
             AND COALESCE(o.order_status,'') NOT LIKE '%Cancel%'
         ), 0) AS order_count,
         COALESCE((
           SELECT SUM(o2.net_commission)
           FROM orders o2
           INNER JOIN convert_logs cl3 ON (
             (o2.item_id != '' AND o2.item_id = cl3.item_id AND o2.sub_id1 = cl3.sub_id1)
             OR
             (cl3.item_id = '' AND o2.item_name != '' AND o2.item_name = cl3.product_name AND o2.sub_id1 = cl3.sub_id1)
           )
           WHERE cl3.user_id = u.user_id AND cl3.status = 'success'
             AND COALESCE(o2.order_status,'') NOT LIKE '%hủy%'
             AND COALESCE(o2.order_status,'') NOT LIKE '%huỷ%'
             AND COALESCE(o2.order_status,'') NOT LIKE '%Cancel%'
         ), 0) AS total_commission,
         COALESCE((
           SELECT SUM(o3.net_commission)
           FROM orders o3
           INNER JOIN convert_logs cl4 ON (
             (o3.item_id != '' AND o3.item_id = cl4.item_id AND o3.sub_id1 = cl4.sub_id1)
             OR
             (cl4.item_id = '' AND o3.item_name != '' AND o3.item_name = cl4.product_name AND o3.sub_id1 = cl4.sub_id1)
           )
           WHERE cl4.user_id = u.user_id AND cl4.status = 'success'
             AND (COALESCE(o3.order_status,'') LIKE '%hoàn thành%' OR COALESCE(o3.order_status,'') LIKE '%completed%' OR COALESCE(o3.order_status,'') LIKE '%settled%')
         ), 0) AS completed_commission
  FROM users u
  WHERE u.referrer_id = $1
  ORDER BY total_commission DESC
`;

function mapDownlineRow(r) {
  return {
    userId: r.user_id,
    displayName: r.display_name || r.zalo_name || 'Unknown',
    avatar: r.avatar || '',
    joinDate: r.first_contact || '',
    commissionMode: r.commission_mode || 'normal',
    orderCount: Number(r.order_count) || 0,
    totalCommission: Number(r.total_commission) || 0,
    completedCommission: Number(r.completed_commission) || 0,
  };
}

/**
 * Recursively load downline with earnings the report user collects at each level.
 * Stops at depth 3 (F1 → F2 → F3) — matches the system's F-tier cap.
 * If a node is in 'custom' mode, the chain breaks below it (no F2/F3 from that branch).
 */
async function loadDownlineTree(userId, rates) {
  const f1Rows = await db.all(DOWNLINE_SQL, [userId]);
  const f1List = [];
  let totalF1Earnings = 0;
  let totalF2Earnings = 0;
  let totalF3Earnings = 0;

  for (const r of f1Rows) {
    const f1 = mapDownlineRow(r);
    f1.earnings = Math.round(f1.totalCommission * rates.f1 / 100);
    f1.completedEarnings = Math.round(f1.completedCommission * rates.f1 / 100);
    f1.pendingEarnings = Math.max(0, f1.earnings - f1.completedEarnings);
    totalF1Earnings += f1.earnings;

    // If F1 is custom mode, the user doesn't earn F2/F3 from this branch
    if (f1.commissionMode === 'custom') {
      f1.subCtvs = [];
      f1List.push(f1);
      continue;
    }

    // Load F2 (CTVs of this F1 — these are F2 from the report user's perspective)
    const f2Rows = await db.all(DOWNLINE_SQL, [f1.userId]);
    const subCtvs = [];
    for (const r2 of f2Rows) {
      const f2 = mapDownlineRow(r2);
      f2.earnings = Math.round(f2.totalCommission * rates.f2 / 100);
      f2.completedEarnings = Math.round(f2.completedCommission * rates.f2 / 100);
      f2.pendingEarnings = Math.max(0, f2.earnings - f2.completedEarnings);
      totalF2Earnings += f2.earnings;

      if (f2.commissionMode === 'custom') {
        f2.subCtvs = [];
        subCtvs.push(f2);
        continue;
      }

      // Load F3 (CTVs of this F2)
      const f3Rows = await db.all(DOWNLINE_SQL, [f2.userId]);
      const f3SubCtvs = f3Rows.map(r3 => {
        const f3 = mapDownlineRow(r3);
        f3.earnings = Math.round(f3.totalCommission * rates.f3 / 100);
        f3.completedEarnings = Math.round(f3.completedCommission * rates.f3 / 100);
        f3.pendingEarnings = Math.max(0, f3.earnings - f3.completedEarnings);
        totalF3Earnings += f3.earnings;
        return f3;
      });
      f2.subCtvs = f3SubCtvs;
      subCtvs.push(f2);
    }
    f1.subCtvs = subCtvs;
    f1List.push(f1);
  }

  return {
    list: f1List,
    totalF1Earnings,
    totalF2Earnings,
    totalF3Earnings,
  };
}

class ReportGenerator {
  async generateReport(userId) {
    const rates = await commissionRatesStore.getRates();

    // 1. User info
    const user = await db.get('SELECT * FROM users WHERE user_id = ?', [userId]);
    if (!user) throw new Error('User not found');

    // 2. All convert_logs for this user
    const links = await db.all(
      `SELECT original_link, affiliate_link, short_link, product_name,
              commission_rate, commission_amount, price, item_id, shop_id, created_at
       FROM convert_logs WHERE user_id = ? AND status = 'success'
       ORDER BY created_at DESC`,
      [userId]
    );

    // 3. Matched orders ONLY (standard buyer/referrer flow, exclude from_custom)
    const matchedOrders = await db.all(
      `SELECT DISTINCT o.order_id, o.item_name, o.shop_name, o.price, o.quantity,
              o.order_status, o.order_time, o.complete_time,
              o.net_commission, o.total_product_commission, o.total_product_commission_new,
              o.order_value, o.refund_amount, o.sub_id1, o.sub_id2
       FROM orders o
       INNER JOIN convert_logs cl ON (
         (o.item_id != '' AND o.item_id = cl.item_id AND o.sub_id1 = cl.sub_id1)
         OR
         (cl.item_id = '' AND o.item_name != '' AND o.item_name = cl.product_name AND o.sub_id1 = cl.sub_id1)
       )
       WHERE cl.user_id = ? AND cl.status = 'success'
         AND COALESCE(o.sub_id4, '') NOT IN ('from_custom', 'custom')
         AND COALESCE(o.order_status,'') NOT LIKE '%hủy%'
         AND COALESCE(o.order_status,'') NOT LIKE '%huỷ%'
         AND COALESCE(o.order_status,'') NOT LIKE '%Cancel%'
       ORDER BY o.order_time DESC`,
      [userId]
    );

    // 4. Payout history
    const payouts = await db.all(
      `SELECT amount, role, payment_method, bill_image, admin_note, status, paid_at, paid_orders
       FROM payouts WHERE user_id = ?
       ORDER BY paid_at DESC`,
      [userId]
    );

    // Build paid order ID sets (to separate paid vs unpaid completed orders)
    const paidBuyerOrderIds = new Set();
    const paidCustomOrderIds = new Set();
    for (const p of payouts) {
      let orders = p.paid_orders;
      if (typeof orders === 'string') { try { orders = JSON.parse(orders); } catch { orders = null; } }
      if (!Array.isArray(orders)) continue;
      for (const o of orders) {
        if (!o.orderId) continue;
        if (['f0', 'buyer'].includes(p.role)) paidBuyerOrderIds.add(o.orderId);
        if (p.role === 'custom') paidCustomOrderIds.add(o.orderId);
      }
    }

    // 4b. Custom orders — F1 gửi link cho F2 (sub_id4 = from_custom)
    const customOrders = await db.all(
      `SELECT o.order_id, o.item_name, o.shop_name, o.price, o.quantity,
              o.order_status, o.order_time, o.complete_time,
              o.net_commission, o.order_value, o.refund_amount,
              o.sub_id1, o.sub_id2
       FROM orders o
       WHERE o.sub_id1 = ?
         AND o.sub_id4 IN ('from_custom', 'custom')
         AND COALESCE(o.order_status,'') NOT LIKE '%hủy%'
         AND COALESCE(o.order_status,'') NOT LIKE '%huỷ%'
         AND COALESCE(o.order_status,'') NOT LIKE '%Cancel%'
       ORDER BY o.order_time DESC`,
      [userId]
    );

    // 5. Referrer info (ai mời user này vào)
    let referrer = null;
    if (user.referrer_id && user.referrer_id !== '') {
      referrer = await db.get(
        'SELECT user_id, display_name, zalo_name, avatar FROM users WHERE user_id = ?',
        [user.referrer_id]
      );
      if (referrer) {
        referrer = {
          userId: referrer.user_id,
          displayName: referrer.display_name || referrer.zalo_name || 'Unknown',
          avatar: referrer.avatar || '',
        };
      }
    }

    // 6. Downline tree (F1 + F2 + F3) for display + correct chain-based earnings
    const downline = await loadDownlineTree(userId, rates);
    const ctvList = downline.list;
    const referrerEarnings = await calcReferrerEarnings(userId, rates);

    // 7. Monthly revenue chart (last 6 months) — based on user's own orders only
    const monthlyRevenue = await db.all(
      `SELECT LEFT(o.order_time, 7) as month,
              COUNT(DISTINCT o.order_id) as orders,
              COALESCE(SUM(o.net_commission), 0) as commission
       FROM orders o
       INNER JOIN convert_logs cl ON (
         (o.item_id != '' AND o.item_id = cl.item_id AND o.sub_id1 = cl.sub_id1)
         OR
         (cl.item_id = '' AND o.item_name != '' AND o.item_name = cl.product_name AND o.sub_id1 = cl.sub_id1)
       )
       WHERE cl.user_id = ? AND cl.status = 'success'
         AND o.order_time >= TO_CHAR(NOW() - INTERVAL '6 months', 'YYYY-MM-DD')
         AND COALESCE(o.order_status,'') NOT LIKE '%hủy%'
         AND COALESCE(o.order_status,'') NOT LIKE '%huỷ%'
         AND COALESCE(o.order_status,'') NOT LIKE '%Cancel%'
       GROUP BY LEFT(o.order_time, 7)
       ORDER BY month ASC`,
      [userId]
    );

    const chartMonths = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      chartMonths.push(d.toISOString().slice(0, 7));
    }
    const revenueMap = {};
    for (const r of monthlyRevenue) {
      revenueMap[r.month] = { orders: Number(r.orders) || 0, commission: Number(r.commission) || 0 };
    }
    const monthlyChart = chartMonths.map(m => ({
      month: m,
      label: `T${parseInt(m.split('-')[1])}/${m.split('-')[0].slice(2)}`,
      orders: revenueMap[m]?.orders || 0,
      commission: revenueMap[m]?.commission || 0,
    }));

    // 8. Buyer (F0) cashback calculation
    // from_direct orders always use standard F0 (custom_rate only for from_custom orders)
    const commissionMode = user.commission_mode || 'normal';
    const isCustomMode = commissionMode === 'custom';
    const customRate = user.custom_rate || 0;
    const f0Rate = rates.f0;
    const hasReferrer = !!(user.referrer_id && user.referrer_id !== '');

    const isCompleted = (o) =>
      o.order_status?.toLowerCase().includes('hoàn thành') ||
      o.order_status?.toLowerCase().includes('completed') ||
      o.order_status?.toLowerCase().includes('settled');

    const completedOrders = matchedOrders.filter(isCompleted);
    const pendingOrders = matchedOrders.filter(o => !isCompleted(o));

    const totalNetCommission = matchedOrders.reduce((s, o) => s + (o.net_commission || 0), 0);
    const completedNetCommission = completedOrders.reduce((s, o) => s + (o.net_commission || 0), 0);
    const pendingNetCommission = pendingOrders.reduce((s, o) => s + (o.net_commission || 0), 0);

    // Tổng HH = paid actual (rate lịch sử) + unpaid completed × rate + processing × rate
    const totalPaidAsBuyer = payouts
      .filter(p => ['buyer', 'f0'].includes(p.role))
      .reduce((s, p) => s + (p.amount || 0), 0);

    const unpaidCompletedBuyerCashback = completedOrders
      .filter(o => !paidBuyerOrderIds.has(o.order_id))
      .reduce((s, o) => s + Math.round((o.net_commission || 0) * f0Rate / 100), 0);
    const pendingBuyerCashback = Math.round(pendingNetCommission * f0Rate / 100);

    const totalBuyerCashback = totalPaidAsBuyer + unpaidCompletedBuyerCashback + pendingBuyerCashback;
    const completedBuyerCashback = totalPaidAsBuyer + unpaidCompletedBuyerCashback;
    const pendingBuyerPayment = unpaidCompletedBuyerCashback;

    // 9. Referrer earnings (F1+F2+F3) — chain-based: earn rate on buyers by registration depth
    const totalReferrerEarnings =
      referrerEarnings.totalF1Earnings + referrerEarnings.totalF2Earnings + referrerEarnings.totalF3Earnings;
    const totalPaidAsReferrer = payouts
      .filter(p => ['referrer', 'f1', 'f2', 'f3'].includes(p.role))
      .reduce((s, p) => s + (p.amount || 0), 0);

    // 10. Custom orders summary
    const completedCustomOrders = customOrders.filter(isCompleted);
    const pendingCustomOrders = customOrders.filter(o => !isCompleted(o));
    const totalCustomNetCommission = customOrders.reduce((s, o) => s + (o.net_commission || 0), 0);

    const totalCustomPaid = payouts.filter(p => p.role === 'custom').reduce((s, p) => s + (p.amount || 0), 0);
    const unpaidCustomCashback = completedCustomOrders
      .filter(o => !paidCustomOrderIds.has(o.order_id))
      .reduce((s, o) => s + Math.round((o.net_commission || 0) * customRate / 100), 0);
    const processingCustomCashback = Math.round(
      pendingCustomOrders.reduce((s, o) => s + (o.net_commission || 0), 0) * customRate / 100
    );
    const totalCustomCashback = totalCustomPaid + unpaidCustomCashback + processingCustomCashback;
    const completedCustomCashback = totalCustomPaid + unpaidCustomCashback;
    const pendingCustomPayment = unpaidCustomCashback;

    const uniqueF2Phones = [...new Set(customOrders.map(o => o.sub_id2).filter(Boolean))];

    const now = new Date();
    const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    return {
      user: {
        userId: user.user_id,
        displayName: user.display_name || user.zalo_name || 'Unknown',
        avatar: user.avatar || '',
        phone: user.phone_number || '',
        bankName: user.bank_name || '',
        bankAccount: user.bank_account || '',
        commissionMode,
        isCustomMode,
        f0Rate,
        customRate,
        // Backward compat
        cashbackBuyerRate: f0Rate,
      },
      rates,           // full F0/F1/F2/F3/Admin (for tooltips + sidebar breakdown)
      referrer,
      ctvList,         // nested F1 → F2 → F3 with earnings
      monthlyChart,
      summary: {
        // Raw totals (giúp user biết quy mô)
        totalNetCommission,
        completedNetCommission,
        pendingNetCommission,
        totalOrders: matchedOrders.length,
        completedCount: completedOrders.length,
        pendingCount: pendingOrders.length,
        totalLinks: links.length,

        // Buyer (F0) cashback — số tiền thực user nhận
        totalBuyerCashback,
        completedBuyerCashback,
        pendingBuyerCashback,
        totalPaidAsBuyer,
        pendingBuyerPayment,

        // Referrer (F1+F2+F3) earnings — số tiền nhận từ downline (chain-based, khớp trang Payouts)
        totalF1Earnings: referrerEarnings.totalF1Earnings,
        totalF2Earnings: referrerEarnings.totalF2Earnings,
        totalF3Earnings: referrerEarnings.totalF3Earnings,
        totalReferrerEarnings,
        totalPaidAsReferrer,
        ctvCount: ctvList.length,

        // Combined totals
        totalEarnings: totalBuyerCashback + totalReferrerEarnings + totalCustomCashback,
        totalPaid: totalPaidAsBuyer + totalPaidAsReferrer + totalCustomPaid,
        totalPendingPayment: pendingBuyerPayment + pendingCustomPayment,
        pendingPayment: pendingBuyerPayment,

        // Custom orders summary
        hasCustomOrders: customOrders.length > 0,
        customRate,
        totalCustomOrders: customOrders.length,
        completedCustomCount: completedCustomOrders.length,
        pendingCustomCount: pendingCustomOrders.length,
        totalCustomNetCommission,
        completedCustomNetCommission: completedCustomOrders.reduce((s,o)=>s+(o.net_commission||0),0),
        totalCustomCashback,
        completedCustomCashback,
        totalCustomPaid,
        pendingCustomPayment,
        uniqueF2Count: uniqueF2Phones.length,
      },
      links,
      matchedOrders,
      customOrders,
      payouts,
      generatedAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
    };
  }
}

module.exports = new ReportGenerator();
