const bcrypt = require('bcryptjs');
const db = require('../db');
const logger = require('../logger');

const SALT_ROUNDS = 10;

class AuthStore {
  async createAdmin(username, password, displayName = '') {
    const hash = await bcrypt.hash(password, SALT_ROUNDS);
    await db.run(
      `INSERT INTO admin_users (username, password_hash, display_name, is_active, must_change_password)
       VALUES (?, ?, ?, true, true)
       ON CONFLICT(username) DO NOTHING`,
      [username, hash, displayName || username]
    );
    logger.info('AuthStore', `Admin created/exists: ${username}`);
  }

  async validateLogin(username, password) {
    const admin = await db.get(
      'SELECT * FROM admin_users WHERE username = ? AND is_active = true',
      [username]
    );
    if (!admin) return null;

    const valid = await bcrypt.compare(password, admin.password_hash);
    if (!valid) return null;

    await db.run(
      "UPDATE admin_users SET last_login = datetime('now','localtime') WHERE username = ?",
      [username]
    );

    return {
      id: admin.id,
      username: admin.username,
      displayName: admin.display_name,
      mustChangePassword: !!admin.must_change_password,
      lastLogin: admin.last_login,
    };
  }

  async getAdmin(username) {
    const admin = await db.get(
      'SELECT id, username, display_name, avatar, is_active, must_change_password, last_login, created_at FROM admin_users WHERE username = ?',
      [username]
    );
    if (!admin) return null;
    return {
      id: admin.id,
      username: admin.username,
      displayName: admin.display_name,
      avatar: admin.avatar || null,
      isActive: !!admin.is_active,
      mustChangePassword: !!admin.must_change_password,
      lastLogin: admin.last_login,
      createdAt: admin.created_at,
    };
  }

  async changePassword(username, oldPassword, newPassword) {
    const admin = await db.get(
      'SELECT password_hash FROM admin_users WHERE username = ? AND is_active = true',
      [username]
    );
    if (!admin) throw new Error('Admin not found');

    const valid = await bcrypt.compare(oldPassword, admin.password_hash);
    if (!valid) throw new Error('Mật khẩu cũ không đúng');

    const hash = await bcrypt.hash(newPassword, SALT_ROUNDS);
    await db.run(
      'UPDATE admin_users SET password_hash = ?, must_change_password = false WHERE username = ?',
      [hash, username]
    );
    logger.info('AuthStore', `Password changed for: ${username}`);
  }

  async getAllAdmins() {
    const rows = await db.all(
      'SELECT id, username, display_name, is_active, last_login, created_at FROM admin_users ORDER BY id'
    );
    return rows.map(r => ({
      id: r.id,
      username: r.username,
      displayName: r.display_name,
      isActive: !!r.is_active,
      lastLogin: r.last_login,
      createdAt: r.created_at,
    }));
  }
}

module.exports = new AuthStore();
