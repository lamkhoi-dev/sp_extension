const db = require('../db');
const logger = require('../logger');

/** Strip currency symbols & handle Vietnamese thousands separator (.) */
function _safeNumber(val) {
  if (val == null) return 0;
  if (typeof val === 'number') return isNaN(val) ? 0 : val;
  const raw = String(val).replace(/[₫đ\s]/gi, '').trim();
  // Vietnamese format: 120.000 means 120000 (dot = thousands separator)
  // If has 3+ digits after last dot, treat dot as thousands separator
  if (/^\d{1,3}(\.\d{3})+$/.test(raw)) {
    return parseInt(raw.replace(/\./g, ''), 10) || 0;
  }
  return parseFloat(raw.replace(/[^0-9.\-]/g, '')) || 0;
}

const convertLogStore = {
  async save(data) {
    try {
      const result = await db.runNamed(`
        INSERT INTO convert_logs (user_id, user_name, original_link, affiliate_link, short_link, product_name, commission_rate, commission_amount, price, source, sub_id1, sub_id2, sub_id3, sub_id4, status, error_message, item_id, shop_id)
        VALUES (@userId, @userName, @originalLink, @affiliateLink, @shortLink, @productName, @commissionRate, @commissionAmount, @price, @source, @subId1, @subId2, @subId3, @subId4, @status, @errorMessage, @itemId, @shopId)
        RETURNING id
      `, {
        userId: data.userId || '',
        userName: data.userName || '',
        originalLink: data.originalLink || '',
        affiliateLink: data.affiliateLink || '',
        shortLink: data.shortLink || '',
        productName: data.productName || '',
        commissionRate: _safeNumber(data.commissionRate),
        commissionAmount: _safeNumber(data.commissionAmount),
        price: _safeNumber(data.price),
        source: data.source || 'shopee',
        subId1: data.subId1 || '',
        subId2: data.subId2 || '',
        subId3: data.subId3 || '',
        subId4: data.subId4 || '',
        status: data.status || 'success',
        errorMessage: data.errorMessage || '',
        itemId: data.itemId || '',
        shopId: data.shopId || '',
      });
      return result?.id || result?.lastInsertRowid || 0;
    } catch (err) {
      logger.error('ConvertLogStore', `Save failed: ${err.message}`);
      return null;
    }
  },

  async getRecent(limit = 50, offset = 0) {
    return db.all(`
      SELECT cl.*,
             u.avatar as user_avatar,
             r.avatar as referrer_avatar,
             r.display_name as referrer_name_db,
             lr.click_count
      FROM convert_logs cl
      LEFT JOIN users u ON cl.user_id = u.user_id
      LEFT JOIN users r ON cl.sub_id2 = r.user_id
      LEFT JOIN link_redirects lr ON cl.redirect_token = lr.token
      ORDER BY cl.created_at DESC
      LIMIT ? OFFSET ?
    `, [limit, offset]);
  },

  async getByUser(userId, limit = 20, offset = 0) {
    return db.all(`
      SELECT cl.*,
             u.avatar as user_avatar,
             r.avatar as referrer_avatar,
             r.display_name as referrer_name_db,
             lr.click_count
      FROM convert_logs cl
      LEFT JOIN users u ON cl.user_id = u.user_id
      LEFT JOIN users r ON cl.sub_id2 = r.user_id
      LEFT JOIN link_redirects lr ON cl.redirect_token = lr.token
      WHERE cl.user_id = ?
      ORDER BY cl.created_at DESC
      LIMIT ? OFFSET ?
    `, [userId, limit, offset]);
  },

  async getByUserCount(userId) {
    const row = await db.get('SELECT COUNT(*) as count FROM convert_logs WHERE user_id = ?', [userId]);
    return row?.count || 0;
  },

  async getCount() {
    const row = await db.get('SELECT COUNT(*) as count FROM convert_logs');
    return row.count;
  },

  async getStats() {
    return db.get(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as success,
        SUM(CASE WHEN status = 'error' THEN 1 ELSE 0 END) as failed,
        SUM(commission_amount) as "totalCommission",
        AVG(commission_rate) as "avgRate",
        COUNT(DISTINCT user_id) as "uniqueUsers"
      FROM convert_logs
    `);
  },

  async getTodayStats() {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    return db.get(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as success
      FROM convert_logs
      WHERE created_at >= ?
    `, [todayStart.toISOString()]);
  },

  async search(query, limit = 20, offset = 0) {
    const q = `%${query}%`;
    return db.all(`
      SELECT cl.*,
             u.avatar as user_avatar,
             r.avatar as referrer_avatar,
             r.display_name as referrer_name_db,
             lr.click_count
      FROM convert_logs cl
      LEFT JOIN users u ON cl.user_id = u.user_id
      LEFT JOIN users r ON cl.sub_id2 = r.user_id
      LEFT JOIN link_redirects lr ON cl.redirect_token = lr.token
      WHERE cl.user_name LIKE ? OR cl.product_name LIKE ? OR cl.original_link LIKE ?
      ORDER BY cl.created_at DESC
      LIMIT ? OFFSET ?
    `, [q, q, q, limit, offset]);
  },

  async searchCount(query) {
    const q = `%${query}%`;
    const row = await db.get(`
      SELECT COUNT(*) as count 
      FROM convert_logs 
      WHERE user_name LIKE ? OR product_name LIKE ? OR original_link LIKE ?
    `, [q, q, q]);
    return row?.count || 0;
  },

  async getAllByUser(userId) {
    return db.all('SELECT * FROM convert_logs WHERE user_id = ? AND status = ? ORDER BY created_at DESC', [userId, 'success']);
  },

  async updateRedirectToken(id, token) {
    await db.run('UPDATE convert_logs SET redirect_token = ? WHERE id = ?', [token, id]);
  },
};

module.exports = convertLogStore;
