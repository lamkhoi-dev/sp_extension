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

    // 5. Calculate summary
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
