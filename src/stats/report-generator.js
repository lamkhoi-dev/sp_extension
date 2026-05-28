const db = require('../db');
const logger = require('../logger');

class ReportGenerator {
  async generateReport(userId) {
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

    // 3. Matched orders ONLY (critical filter — only orders from user's sent links)
    const matchedOrders = await db.all(
      `SELECT DISTINCT o.order_id, o.item_name, o.shop_name, o.price, o.quantity,
              o.order_status, o.order_time, o.complete_time,
              o.net_commission, o.total_product_commission, o.total_product_commission_new,
              o.order_value, o.refund_amount, o.sub_id1
       FROM orders o
       INNER JOIN convert_logs cl ON (
         (o.item_id != '' AND o.item_id = cl.item_id AND o.sub_id1 = cl.sub_id1)
         OR
         (cl.item_id = '' AND o.item_name != '' AND o.item_name = cl.product_name AND o.sub_id1 = cl.sub_id1)
       )
       WHERE cl.user_id = ? AND cl.status = 'success'
       ORDER BY o.order_time DESC`,
      [userId]
    );

    // 4. Payout history
    const payouts = await db.all(
      `SELECT amount, role, payment_method, bill_image, admin_note, status, paid_at
       FROM payouts WHERE user_id = ?
       ORDER BY paid_at DESC`,
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

    // 6. CTV list (user này đã mời những ai) + thống kê đơn hàng/hoa hồng từng CTV
    const ctvList = await db.all(
      `SELECT u.user_id, u.display_name, u.zalo_name, u.avatar, u.first_contact,
              COALESCE(ctv_stats.order_count, 0) as order_count,
              COALESCE(ctv_stats.total_commission, 0) as total_commission
       FROM users u
       LEFT JOIN LATERAL (
         SELECT COUNT(DISTINCT o.order_id) as order_count,
                COALESCE(SUM(o.net_commission), 0) as total_commission
         FROM orders o
         INNER JOIN convert_logs cl ON (
           (o.item_id != '' AND o.item_id = cl.item_id AND o.sub_id1 = cl.sub_id1)
           OR
           (cl.item_id = '' AND o.item_name != '' AND o.item_name = cl.product_name AND o.sub_id1 = cl.sub_id1)
         )
         WHERE cl.user_id = u.user_id AND cl.status = 'success'
       ) ctv_stats ON TRUE
       WHERE u.referrer_id = ?
       ORDER BY ctv_stats.total_commission DESC NULLS LAST`,
      [userId]
    );

    const formattedCtvList = ctvList.map(c => ({
      userId: c.user_id,
      displayName: c.display_name || c.zalo_name || 'Unknown',
      avatar: c.avatar || '',
      joinDate: c.first_contact || '',
      orderCount: Number(c.order_count) || 0,
      totalCommission: Number(c.total_commission) || 0,
    }));

    // 7. Monthly revenue chart (last 6 months)
    const monthlyRevenue = await db.all(
      `SELECT TO_CHAR(DATE_TRUNC('month', TO_TIMESTAMP(o.order_time, 'YYYY-MM-DD HH24:MI:SS')), 'YYYY-MM') as month,
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
       GROUP BY TO_CHAR(DATE_TRUNC('month', TO_TIMESTAMP(o.order_time, 'YYYY-MM-DD HH24:MI:SS')), 'YYYY-MM')
       ORDER BY month ASC`,
      [userId]
    );

    // Fill missing months to ensure 6-month contiguous chart
    const chartMonths = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      chartMonths.push(d.toISOString().slice(0, 7)); // 'YYYY-MM'
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

    // 8. Calculate summary
    const buyerRate = user.cashback_buyer_rate || 60;
    const referrerRate = user.cashback_referrer_rate || 20;
    const hasReferrer = !!(user.referrer_id && user.referrer_id !== '');

    const totalNetCommission = matchedOrders.reduce((s, o) => s + (o.net_commission || 0), 0);
    const completedOrders = matchedOrders.filter(o =>
      o.order_status?.toLowerCase().includes('hoàn thành') ||
      o.order_status?.toLowerCase().includes('completed') ||
      o.order_status?.toLowerCase().includes('settled')
    );
    const completedNetCommission = completedOrders.reduce((s, o) => s + (o.net_commission || 0), 0);

    // Buyer always gets buyerRate (system-wide 60%), NOT buyer+referrer
    const effectiveBuyerRate = buyerRate;
    const totalBuyerCashback = totalNetCommission * effectiveBuyerRate / 100;
    const completedBuyerCashback = completedNetCommission * effectiveBuyerRate / 100;
    const totalPaid = payouts
      .filter(p => p.role === 'buyer')
      .reduce((s, p) => s + (p.amount || 0), 0);
    const pendingPayment = Math.max(0, completedBuyerCashback - totalPaid);

    // CTV referrer earnings for this user
    const ctvTotalCommission = formattedCtvList.reduce((s, c) => s + c.totalCommission, 0);
    const ctvReferrerEarnings = ctvTotalCommission * (user.referrer_earn_rate || 20) / 100;

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
        cashbackBuyerRate: buyerRate,
      },
      referrer,
      ctvList: formattedCtvList,
      monthlyChart,
      summary: {
        totalNetCommission,
        completedNetCommission,
        totalBuyerCashback,
        completedBuyerCashback,
        totalPaid,
        pendingPayment,
        totalOrders: matchedOrders.length,
        completedCount: completedOrders.length,
        totalLinks: links.length,
        ctvCount: formattedCtvList.length,
        ctvTotalCommission,
        ctvReferrerEarnings,
      },
      links,
      matchedOrders,
      payouts,
      generatedAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
    };
  }
}

module.exports = new ReportGenerator();
