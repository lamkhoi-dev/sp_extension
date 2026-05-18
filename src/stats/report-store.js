const crypto = require('crypto');
const db = require('../db');
const logger = require('../logger');

class ReportStore {
  async createReport(userId, data) {
    const token = crypto.randomBytes(16).toString('hex');
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const dataStr = typeof data === 'string' ? data : JSON.stringify(data);

    await db.run(
      `INSERT INTO stat_reports (token, user_id, data, expires_at)
       VALUES (?, ?, ?, ?)`,
      [token, userId, dataStr, expiresAt.toISOString()]
    );

    logger.info('ReportStore', `Report created for user ${userId}, token=${token.slice(0, 8)}...`);
    return token;
  }

  async getReport(token) {
    const row = await db.get(
      "SELECT * FROM stat_reports WHERE token = ? AND expires_at > ?",
      [token, new Date().toISOString()]
    );
    if (!row) return null;

    return {
      userId: row.user_id,
      data: typeof row.data === 'string' ? JSON.parse(row.data) : row.data,
      expiresAt: row.expires_at,
      createdAt: row.created_at,
    };
  }

  async cleanup() {
    const result = await db.run(
      "DELETE FROM stat_reports WHERE expires_at < ?",
      [new Date().toISOString()]
    );
    if (result?.changes > 0) {
      logger.info('ReportStore', `Cleaned up ${result.changes} expired reports`);
    }
    return result?.changes || 0;
  }
}

module.exports = new ReportStore();
