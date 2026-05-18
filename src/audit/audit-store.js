const db = require('../db');
const logger = require('../logger');

class AuditStore {
  async log(adminUsername, action, resourceType, resourceId = '', details = {}, ipAddress = '') {
    try {
      const detailsStr = typeof details === 'string' ? details : JSON.stringify(details);
      await db.run(
        `INSERT INTO audit_logs (admin_username, action, resource_type, resource_id, details, ip_address)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [adminUsername, action, resourceType, resourceId, detailsStr, ipAddress]
      );
    } catch (err) {
      logger.error('AuditStore', `Failed to log audit: ${err.message}`);
    }
  }

  async getRecent(limit = 50, offset = 0, filters = {}) {
    let where = '1=1';
    const params = [];

    if (filters.action) {
      where += ' AND action = ?';
      params.push(filters.action);
    }
    if (filters.admin) {
      where += ' AND admin_username = ?';
      params.push(filters.admin);
    }
    if (filters.resourceType) {
      where += ' AND resource_type = ?';
      params.push(filters.resourceType);
    }
    if (filters.dateFrom) {
      where += ' AND created_at >= ?';
      params.push(filters.dateFrom);
    }
    if (filters.dateTo) {
      where += " AND created_at <= ? || ' 23:59:59'";
      params.push(filters.dateTo);
    }

    params.push(limit, offset);

    const rows = await db.all(
      `SELECT * FROM audit_logs WHERE ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      params
    );

    const countRow = await db.get(
      `SELECT COUNT(*) as total FROM audit_logs WHERE ${where}`,
      params.slice(0, -2)
    );

    return {
      logs: rows.map(r => ({
        ...r,
        details: typeof r.details === 'string' ? JSON.parse(r.details || '{}') : r.details,
      })),
      total: countRow?.total || 0,
    };
  }

  async getByAdmin(username, limit = 50) {
    return this.getRecent(limit, 0, { admin: username });
  }

  async getByResource(type, id) {
    const rows = await db.all(
      'SELECT * FROM audit_logs WHERE resource_type = ? AND resource_id = ? ORDER BY created_at DESC',
      [type, id]
    );
    return rows.map(r => ({
      ...r,
      details: typeof r.details === 'string' ? JSON.parse(r.details || '{}') : r.details,
    }));
  }

  async getStats() {
    const rows = await db.all(
      `SELECT action, COUNT(*) as count FROM audit_logs GROUP BY action ORDER BY count DESC`
    );
    const total = await db.get('SELECT COUNT(*) as total FROM audit_logs');
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayCount = await db.get(
      'SELECT COUNT(*) as total FROM audit_logs WHERE created_at >= ?',
      [todayStart.toISOString()]
    );
    return {
      byAction: rows,
      total: total?.total || 0,
      today: todayCount?.total || 0,
    };
  }

  async getAdminList() {
    const rows = await db.all(
      'SELECT DISTINCT admin_username FROM audit_logs ORDER BY admin_username'
    );
    return rows.map(r => r.admin_username);
  }

  async cleanup(monthsOld = 6) {
    const cutoffDate = new Date();
    cutoffDate.setMonth(cutoffDate.getMonth() - monthsOld);
    const result = await db.run(
      'DELETE FROM audit_logs WHERE created_at < ?',
      [cutoffDate.toISOString()]
    );
    if (result?.changes > 0) {
      logger.info('AuditStore', `Cleaned up ${result.changes} audit logs older than ${monthsOld} months`);
    }
    return result?.changes || 0;
  }
}

module.exports = new AuditStore();
