const db = require('../zalo/database');
const logger = require('../logger');

const stmts = {
  insert: db.prepare(`
    INSERT INTO convert_logs (user_id, user_name, original_link, affiliate_link, short_link, product_name, commission_rate, commission_amount, price, source, sub_id1, sub_id2, sub_id3, status, error_message, item_id, shop_id)
    VALUES (@userId, @userName, @originalLink, @affiliateLink, @shortLink, @productName, @commissionRate, @commissionAmount, @price, @source, @subId1, @subId2, @subId3, @status, @errorMessage, @itemId, @shopId)
  `),

  getRecent: db.prepare(`
    SELECT * FROM convert_logs ORDER BY created_at DESC LIMIT ? OFFSET ?
  `),

  getByUser: db.prepare(`
    SELECT * FROM convert_logs WHERE user_id = ? ORDER BY created_at DESC LIMIT ?
  `),

  getCount: db.prepare(`SELECT COUNT(*) as count FROM convert_logs`),

  getStats: db.prepare(`
    SELECT
      COUNT(*) as total,
      SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as success,
      SUM(CASE WHEN status = 'error' THEN 1 ELSE 0 END) as failed,
      SUM(commission_amount) as totalCommission,
      AVG(commission_rate) as avgRate,
      COUNT(DISTINCT user_id) as uniqueUsers
    FROM convert_logs
  `),

  getTodayStats: db.prepare(`
    SELECT
      COUNT(*) as total,
      SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as success
    FROM convert_logs
    WHERE date(created_at) = date('now','localtime')
  `),

  search: db.prepare(`
    SELECT * FROM convert_logs
    WHERE user_name LIKE ? OR product_name LIKE ? OR original_link LIKE ?
    ORDER BY created_at DESC LIMIT ?
  `),
};

const convertLogStore = {
  save(data) {
    try {
      const result = stmts.insert.run({
        userId: data.userId || '',
        userName: data.userName || '',
        originalLink: data.originalLink || '',
        affiliateLink: data.affiliateLink || '',
        shortLink: data.shortLink || '',
        productName: data.productName || '',
        commissionRate: data.commissionRate || 0,
        commissionAmount: data.commissionAmount || 0,
        price: data.price || 0,
        source: data.source || 'shopee',
        subId1: data.subId1 || '',
        subId2: data.subId2 || '',
        subId3: data.subId3 || '',
        status: data.status || 'success',
        errorMessage: data.errorMessage || '',
        itemId: data.itemId || '',
        shopId: data.shopId || '',
      });
      return result.lastInsertRowid;
    } catch (err) {
      logger.error('ConvertLogStore', `Save failed: ${err.message}`);
      return null;
    }
  },

  getRecent(limit = 50, offset = 0) {
    return stmts.getRecent.all(limit, offset);
  },

  getByUser(userId, limit = 20) {
    return stmts.getByUser.all(userId, limit);
  },

  getCount() {
    return stmts.getCount.get().count;
  },

  getStats() {
    return stmts.getStats.get();
  },

  getTodayStats() {
    return stmts.getTodayStats.get();
  },

  search(query, limit = 20) {
    const q = `%${query}%`;
    return stmts.search.all(q, q, q, limit);
  },
};

module.exports = convertLogStore;
