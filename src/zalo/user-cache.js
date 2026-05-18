const db = require('../db');
const logger = require('../logger');

const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

class UserCache {
  constructor() {
    this._api = null;
  }

  setApi(api) {
    this._api = api;
  }

  async getOrFetch(userId) {
    const cached = await db.get('SELECT * FROM users WHERE user_id = ?', [userId]);

    if (cached && cached.cached_at) {
      const age = Date.now() - new Date(cached.cached_at + 'Z').getTime();
      if (age < CACHE_TTL_MS) {
        return this._formatUser(cached);
      }
    }

    if (this._api) {
      try {
        const info = await this._api.getUserInfo(userId);
        if (info && info.changed_profiles && info.changed_profiles[userId]) {
          return await this._saveProfile(userId, info.changed_profiles[userId]);
        }
      } catch (err) {
        logger.warn('UserCache', `getUserInfo(${userId}) failed: ${err.message}`);
      }
    }

    if (cached) return this._formatUser(cached);
    return this._createMinimal(userId);
  }

  async recordMessage(userId, displayName = '') {
    const now = new Date().toISOString();
    try {
      await db.run(`
        INSERT INTO users (user_id, display_name, message_count, first_contact, last_seen, cached_at)
        VALUES (?, ?, 1, ?, ?, ?)
        ON CONFLICT(user_id) DO UPDATE SET
          display_name = CASE WHEN "users".display_name = '' THEN EXCLUDED.display_name ELSE "users".display_name END,
          message_count = "users".message_count + 1,
          last_seen = EXCLUDED.last_seen
      `, [userId, displayName, now, now, now]);
    } catch (err) {
      logger.warn('UserCache', `recordMessage failed: ${err.message}`);
    }
  }

  async fetchAndSave(userId) {
    if (!this._api) return null;
    try {
      const info = await this._api.getUserInfo(userId);
      if (info && info.changed_profiles && info.changed_profiles[userId]) {
        return await this._saveProfile(userId, info.changed_profiles[userId]);
      }
    } catch (err) {
      logger.warn('UserCache', `fetchAndSave(${userId}) failed: ${err.message}`);
    }
    return null;
  }

  async _saveProfile(userId, profile) {
    const data = {
      userId,
      displayName: profile.displayName || profile.zaloName || '',
      zaloName: profile.zaloName || '',
      avatar: profile.avatar || '',
      cover: profile.cover || '',
      gender: profile.gender ?? 2,
      dob: profile.sdob || String(profile.dob || ''),
      phoneNumber: profile.phoneNumber || '',
      statusText: profile.status || '',
      isFriend: profile.isFr ?? 0,
      isBlocked: profile.isBlocked ?? 0,
      isActive: profile.isActive ?? 0,
      isActivePc: profile.isActivePC ?? 0,
      isActiveWeb: profile.isActiveWeb ?? 0,
      lastActionTime: profile.lastActionTime || 0,
      accountStatus: profile.accountStatus || 0,
      globalId: profile.globalId || '',
    };

    try {
      const now = new Date().toISOString();
      data.firstContact = now;
      data.lastSeen = now;
      data.cachedAt = now;
      await db.runNamed(`
        INSERT INTO users (user_id, display_name, zalo_name, avatar, cover, gender, dob, phone_number, status_text, is_friend, is_blocked, is_active, is_active_pc, is_active_web, last_action_time, account_status, global_id, message_count, first_contact, last_seen, cached_at)
        VALUES (@userId, @displayName, @zaloName, @avatar, @cover, @gender, @dob, @phoneNumber, @statusText, @isFriend, @isBlocked, @isActive, @isActivePc, @isActiveWeb, @lastActionTime, @accountStatus, @globalId, 1, @firstContact, @lastSeen, @cachedAt)
        ON CONFLICT(user_id) DO UPDATE SET
          display_name = EXCLUDED.display_name,
          zalo_name = EXCLUDED.zalo_name,
          avatar = EXCLUDED.avatar,
          cover = EXCLUDED.cover,
          gender = EXCLUDED.gender,
          dob = EXCLUDED.dob,
          phone_number = EXCLUDED.phone_number,
          status_text = EXCLUDED.status_text,
          is_friend = EXCLUDED.is_friend,
          is_blocked = EXCLUDED.is_blocked,
          is_active = EXCLUDED.is_active,
          is_active_pc = EXCLUDED.is_active_pc,
          is_active_web = EXCLUDED.is_active_web,
          last_action_time = EXCLUDED.last_action_time,
          account_status = EXCLUDED.account_status,
          global_id = EXCLUDED.global_id,
          message_count = "users".message_count + 1,
          last_seen = EXCLUDED.last_seen,
          cached_at = EXCLUDED.cached_at
      `, data);
      logger.info('UserCache', `Cached profile: ${data.displayName} (${userId})`);
    } catch (err) {
      logger.error('UserCache', `Save profile failed: ${err.message}`);
    }

    return this._formatUser({ ...data, message_count: 1 });
  }

  _createMinimal(userId) {
    return {
      userId,
      displayName: 'Unknown',
      zaloName: '',
      avatar: '',
      gender: 2,
      phoneNumber: '',
      statusText: '',
      isFriend: false,
      messageCount: 0,
    };
  }

  _formatUser(row) {
    return {
      userId: row.user_id || row.userId,
      displayName: row.display_name || row.displayName || '',
      zaloName: row.zalo_name || row.zaloName || '',
      avatar: row.avatar || '',
      cover: row.cover || '',
      gender: row.gender ?? 2,
      dob: row.dob || '',
      phoneNumber: row.phone_number || row.phoneNumber || '',
      statusText: row.status_text || row.statusText || '',
      isFriend: !!(row.is_friend || row.isFriend),
      isBlocked: !!(row.is_blocked || row.isBlocked),
      isActive: !!(row.is_active || row.isActive),
      isActivePc: !!(row.is_active_pc || row.isActivePc),
      isActiveWeb: !!(row.is_active_web || row.isActiveWeb),
      messageCount: row.message_count || 0,
      firstContact: row.first_contact || null,
      lastSeen: row.last_seen || null,
      cachedAt: row.cached_at || null,
      referrerId: row.referrer_id || '',
      referrerName: row.referrer_name || '',
      bankName: row.bank_name || null,
      bankAccount: row.bank_account || null,
      qrCode: row.qr_code || null,
      totalCommission: row.total_commission || null,
      totalRefunded: row.total_refunded || null,
      cashbackBuyerRate: row.cashback_buyer_rate ?? 60,
      cashbackReferrerRate: row.cashback_referrer_rate ?? 20,
    };
  }

  async setReferrer(userId, referrerId, referrerName = '') {
    try {
      await db.run('UPDATE users SET referrer_id = ?, referrer_name = ? WHERE user_id = ?', [referrerId, referrerName, userId]);
      logger.info('UserCache', `Set referrer: ${userId} → invited by ${referrerId} (${referrerName})`);
    } catch (err) {
      logger.warn('UserCache', `setReferrer failed: ${err.message}`);
    }
  }

  async getReferrer(userId) {
    const row = await db.get('SELECT referrer_id, referrer_name FROM users WHERE user_id = ?', [userId]);
    return row ? { referrerId: row.referrer_id, referrerName: row.referrer_name } : null;
  }

  async getAll() {
    const rows = await db.all('SELECT * FROM users ORDER BY last_seen DESC');
    return rows.map((r) => this._formatUser(r));
  }

  async getAllPaginated(limit = 50, offset = 0) {
    const rows = await db.all('SELECT * FROM users ORDER BY last_seen DESC LIMIT ? OFFSET ?', [limit, offset]);
    return rows.map((r) => this._formatUser(r));
  }

  async search(query, limit = 20) {
    const q = `%${query}%`;
    const rows = await db.all(
      'SELECT * FROM users WHERE display_name LIKE ? OR zalo_name LIKE ? OR user_id LIKE ? ORDER BY last_seen DESC LIMIT ?',
      [q, q, q, limit]
    );
    return rows.map((r) => this._formatUser(r));
  }

  async getTopUsers(count = 10) {
    const rows = await db.all('SELECT * FROM users ORDER BY message_count DESC LIMIT ?', [count]);
    return rows.map((r) => this._formatUser(r));
  }

  async getUser(userId) {
    const row = await db.get('SELECT * FROM users WHERE user_id = ?', [userId]);
    return row ? this._formatUser(row) : null;
  }

  async getUserCount() {
    const row = await db.get('SELECT COUNT(*) as count FROM users');
    return row.count;
  }

  async updateBankInfo(userId, bankName, bankAccount, qrCode) {
    try {
      await db.run('UPDATE users SET bank_name = ?, bank_account = ?, qr_code = ? WHERE user_id = ?', [bankName, bankAccount, qrCode, userId]);
      return true;
    } catch (err) {
      logger.error('UserCache', `updateBankInfo failed: ${err.message}`);
      return false;
    }
  }
}

module.exports = new UserCache();
