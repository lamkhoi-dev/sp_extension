const db = require('../zalo/database');
const logger = require('../logger');

// ─── Prepared Statements ────────────────────────────────
const stmts = {
  // Get user cashback rates
  getUserRates: db.prepare(`
    SELECT user_id, display_name, cashback_buyer_rate, cashback_referrer_rate,
           referrer_id, referrer_name
    FROM users WHERE user_id = ?
  `),

  // Update user cashback rates
  updateRates: db.prepare(`
    UPDATE users SET cashback_buyer_rate = ?, cashback_referrer_rate = ?
    WHERE user_id = ?
  `),

  // Get all completed orders that have a matching convert_log (by item_id or product_name)
  // Grouped per user (sub_id1 = buyer)
  getMatchedOrders: db.prepare(`
    SELECT o.*, cl.sub_id2 as referrer_id
    FROM orders o
    INNER JOIN convert_logs cl ON (
      (o.item_id != '' AND o.item_id = cl.item_id AND o.sub_id1 = cl.sub_id1)
      OR
      (cl.item_id = '' AND o.item_name != '' AND o.item_name = cl.product_name AND o.sub_id1 = cl.sub_id1)
    )
    WHERE cl.status = 'success'
    ORDER BY o.order_time DESC
  `),

  // Get matched orders for a specific user (buyer)
  getMatchedOrdersByUser: db.prepare(`
    SELECT o.*, cl.sub_id2 as referrer_id
    FROM orders o
    INNER JOIN convert_logs cl ON (
      (o.item_id != '' AND o.item_id = cl.item_id AND o.sub_id1 = cl.sub_id1)
      OR
      (cl.item_id = '' AND o.item_name != '' AND o.item_name = cl.product_name AND o.sub_id1 = cl.sub_id1)
    )
    WHERE cl.status = 'success' AND o.sub_id1 = ?
    ORDER BY o.order_time DESC
  `),

  // Get total paid out to a user in a given role
  getTotalPaid: db.prepare(`
    SELECT COALESCE(SUM(amount), 0) as total_paid
    FROM payouts WHERE user_id = ? AND role = ?
  `),

  // Insert a payout record
  insertPayout: db.prepare(`
    INSERT INTO payouts (user_id, user_name, role, amount, payment_method, bill_image, admin_note)
    VALUES (@userId, @userName, @role, @amount, @paymentMethod, @billImage, @adminNote)
  `),

  // Get payout history
  getPayoutHistory: db.prepare(`
    SELECT * FROM payouts ORDER BY paid_at DESC LIMIT ? OFFSET ?
  `),

  // Get payout history for a user
  getPayoutsByUser: db.prepare(`
    SELECT * FROM payouts WHERE user_id = ? ORDER BY paid_at DESC
  `),

  // Update bill image
  updateBill: db.prepare(`
    UPDATE payouts SET bill_image = ? WHERE id = ?
  `),

  // All users with any matched orders
  getUsersWithOrders: db.prepare(`
    SELECT DISTINCT u.user_id, u.display_name, u.zalo_name, u.avatar,
           u.cashback_buyer_rate, u.cashback_referrer_rate,
           u.referrer_id, u.referrer_name
    FROM users u
    INNER JOIN orders o ON o.sub_id1 = u.user_id
    INNER JOIN convert_logs cl ON (
      (o.item_id != '' AND o.item_id = cl.item_id AND o.sub_id1 = cl.sub_id1)
      OR
      (cl.item_id = '' AND o.item_name != '' AND o.item_name = cl.product_name AND o.sub_id1 = cl.sub_id1)
    )
    WHERE cl.status = 'success'
  `),
};

// Completed statuses for Shopee orders
const COMPLETED_STATUSES = new Set(['Hoàn thành', 'Completed']);

const payoutStore = {
  /**
   * Get cashback summary for all users who have matched orders.
   * Returns an array of user summaries with total/completed/pending breakdowns.
   */
  getSummary() {
    try {
      const users = stmts.getUsersWithOrders.all();
      const allOrders = stmts.getMatchedOrders.all();

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

        const buyerRate = user.cashback_buyer_rate ?? 40;
        const referrerRate = user.cashback_referrer_rate ?? 30;
        const hasReferrer = !!(user.referrer_id && user.referrer_id !== '');

        let totalNetCommission = 0;
        let completedNetCommission = 0;
        let pendingNetCommission = 0;
        let completedCount = 0;
        let pendingCount = 0;

        for (const o of orders) {
          const nc = o.net_commission || 0;
          totalNetCommission += nc;
          if (COMPLETED_STATUSES.has(o.order_status)) {
            completedNetCommission += nc;
            completedCount++;
          } else {
            pendingNetCommission += nc;
            pendingCount++;
          }
        }

        // Calculate buyer cashback
        const effectiveBuyerRate = hasReferrer ? buyerRate : (buyerRate + referrerRate);
        const totalBuyerCashback = Math.round(totalNetCommission * effectiveBuyerRate / 100);
        const completedBuyerCashback = Math.round(completedNetCommission * effectiveBuyerRate / 100);

        // Already paid
        const paidAsBuyer = stmts.getTotalPaid.get(uid, 'buyer').total_paid;
        const pendingPayment = Math.max(0, completedBuyerCashback - paidAsBuyer);

        summaries.push({
          userId: uid,
          displayName: user.display_name || user.zalo_name || uid,
          avatar: user.avatar || '',
          referrerId: user.referrer_id || '',
          referrerName: user.referrer_name || '',
          hasReferrer,
          buyerRate,
          referrerRate,
          adminRate: 100 - buyerRate - referrerRate,
          totalNetCommission: Math.round(totalNetCommission),
          completedNetCommission: Math.round(completedNetCommission),
          pendingNetCommission: Math.round(pendingNetCommission),
          totalBuyerCashback,
          completedBuyerCashback,
          totalPaid: paidAsBuyer,
          pendingPayment,
          completedCount,
          pendingCount,
          totalOrders: orders.length,
        });
      }

      // Also calculate referrer payouts
      const referrerSummaries = this._calcReferrerSummaries(allOrders, users);

      return { buyers: summaries, referrers: referrerSummaries };
    } catch (err) {
      logger.error('PayoutStore', `getSummary failed: ${err.message}`);
      return { buyers: [], referrers: [] };
    }
  },

  /**
   * Calculate referrer summaries — users who earn cashback as referrers.
   */
  _calcReferrerSummaries(allOrders, users) {
    // Build map: referrerId → orders they referred
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
      // Look up the buyer's config to get the referrer rate
      let totalRef = 0;
      let completedRef = 0;

      for (const o of orders) {
        const buyerUser = userMap[o.sub_id1];
        const refRate = buyerUser?.cashback_referrer_rate ?? 30;
        const nc = o.net_commission || 0;
        totalRef += nc * refRate / 100;
        if (COMPLETED_STATUSES.has(o.order_status)) {
          completedRef += nc * refRate / 100;
        }
      }

      const paidAsReferrer = stmts.getTotalPaid.get(refId, 'referrer').total_paid;
      const refUser = userMap[refId];

      summaries.push({
        userId: refId,
        displayName: refUser?.display_name || refUser?.zalo_name || refId,
        avatar: refUser?.avatar || '',
        totalReferrerCashback: Math.round(totalRef),
        completedReferrerCashback: Math.round(completedRef),
        totalPaid: paidAsReferrer,
        pendingPayment: Math.max(0, Math.round(completedRef) - paidAsReferrer),
        orderCount: orders.length,
      });
    }

    return summaries;
  },

  /**
   * Get detailed order list for a specific user (for expanded tree view).
   */
  getUserDetail(userId) {
    try {
      const orders = stmts.getMatchedOrdersByUser.all(userId);
      const userRow = stmts.getUserRates.get(userId);

      const buyerRate = userRow?.cashback_buyer_rate ?? 40;
      const referrerRate = userRow?.cashback_referrer_rate ?? 30;
      const hasReferrer = !!(userRow?.referrer_id && userRow.referrer_id !== '');
      const effectiveBuyerRate = hasReferrer ? buyerRate : (buyerRate + referrerRate);

      const completed = [];
      const pending = [];

      for (const o of orders) {
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
          buyerCashback: Math.round(nc * effectiveBuyerRate / 100),
          referrerCashback: hasReferrer ? Math.round(nc * referrerRate / 100) : 0,
          adminProfit: Math.round(nc * (100 - effectiveBuyerRate - (hasReferrer ? referrerRate : 0)) / 100),
        };

        if (COMPLETED_STATUSES.has(o.order_status)) {
          completed.push(item);
        } else {
          pending.push(item);
        }
      }

      const payoutHistory = stmts.getPayoutsByUser.all(userId);

      return {
        userId,
        displayName: userRow?.display_name || userId,
        buyerRate,
        referrerRate,
        hasReferrer,
        referrerId: userRow?.referrer_id || '',
        referrerName: userRow?.referrer_name || '',
        completed,
        pending,
        payoutHistory,
      };
    } catch (err) {
      logger.error('PayoutStore', `getUserDetail(${userId}) failed: ${err.message}`);
      return null;
    }
  },

  /**
   * Create a new payout record.
   */
  createPayout(data) {
    try {
      const result = stmts.insertPayout.run({
        userId: data.userId,
        userName: data.userName || '',
        role: data.role || 'buyer',
        amount: data.amount,
        paymentMethod: data.paymentMethod || '',
        billImage: data.billImage || '',
        adminNote: data.adminNote || '',
      });
      return result.lastInsertRowid;
    } catch (err) {
      logger.error('PayoutStore', `createPayout failed: ${err.message}`);
      return null;
    }
  },

  /**
   * Update bill image for a payout.
   */
  updateBill(payoutId, imagePath) {
    try {
      stmts.updateBill.run(imagePath, payoutId);
      return true;
    } catch (err) {
      logger.error('PayoutStore', `updateBill failed: ${err.message}`);
      return false;
    }
  },

  /**
   * Get payout history.
   */
  getHistory(limit = 50, offset = 0) {
    return stmts.getPayoutHistory.all(limit, offset);
  },

  /**
   * Update user cashback rates.
   */
  updateUserRates(userId, buyerRate, referrerRate) {
    try {
      const adminRate = 100 - buyerRate - referrerRate;
      if (adminRate < 0 || buyerRate < 0 || referrerRate < 0) {
        return { success: false, error: 'Invalid rates: total must be 100%' };
      }
      stmts.updateRates.run(buyerRate, referrerRate, userId);
      return { success: true, buyerRate, referrerRate, adminRate };
    } catch (err) {
      logger.error('PayoutStore', `updateUserRates failed: ${err.message}`);
      return { success: false, error: err.message };
    }
  },
};

module.exports = payoutStore;
