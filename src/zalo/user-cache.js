const db = require('./database');
const logger = require('../logger');

const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

const stmts = {
  upsert: db.prepare(`
    INSERT INTO users (user_id, display_name, zalo_name, avatar, cover, gender, dob, phone_number, status_text, is_friend, is_blocked, is_active, is_active_pc, is_active_web, last_action_time, account_status, global_id, message_count, first_contact, last_seen, cached_at)
    VALUES (@userId, @displayName, @zaloName, @avatar, @cover, @gender, @dob, @phoneNumber, @statusText, @isFriend, @isBlocked, @isActive, @isActivePc, @isActiveWeb, @lastActionTime, @accountStatus, @globalId, 1, datetime('now'), datetime('now'), datetime('now'))
    ON CONFLICT(user_id) DO UPDATE SET
      display_name = @displayName,
      zalo_name = @zaloName,
      avatar = @avatar,
      cover = @cover,
      gender = @gender,
      dob = @dob,
      phone_number = @phoneNumber,
      status_text = @statusText,
      is_friend = @isFriend,
      is_blocked = @isBlocked,
      is_active = @isActive,
      is_active_pc = @isActivePc,
      is_active_web = @isActiveWeb,
      last_action_time = @lastActionTime,
      account_status = @accountStatus,
      global_id = @globalId,
      message_count = message_count + 1,
      last_seen = datetime('now'),
      cached_at = datetime('now')
  `),

  getById: db.prepare(`SELECT * FROM users WHERE user_id = ?`),

  incrementCount: db.prepare(`
    UPDATE users SET message_count = message_count + 1, last_seen = datetime('now') WHERE user_id = ?
  `),

  updateLastSeen: db.prepare(`UPDATE users SET last_seen = datetime('now') WHERE user_id = ?`),

  getAll: db.prepare(`SELECT * FROM users ORDER BY last_seen DESC`),

  getTopUsers: db.prepare(`SELECT * FROM users ORDER BY message_count DESC LIMIT ?`),

  getCount: db.prepare(`SELECT COUNT(*) as count FROM users`),

  setBasicInfo: db.prepare(`
    INSERT INTO users (user_id, display_name, message_count, first_contact, last_seen, cached_at)
    VALUES (?, ?, 1, datetime('now'), datetime('now'), '')
    ON CONFLICT(user_id) DO UPDATE SET
      display_name = CASE WHEN display_name = '' THEN excluded.display_name ELSE display_name END,
      message_count = message_count + 1,
      last_seen = datetime('now')
  `),
};

class UserCache {
  constructor() {
    this._api = null;
  }

  // Set the zca-js API reference (called after login)
  setApi(api) {
    this._api = api;
  }

  // Get user from cache, or fetch from API if expired/missing
  async getOrFetch(userId) {
    const cached = stmts.getById.get(userId);

    // Return cache if fresh enough
    if (cached && cached.cached_at) {
      const age = Date.now() - new Date(cached.cached_at + 'Z').getTime();
      if (age < CACHE_TTL_MS) {
        return this._formatUser(cached);
      }
    }

    // Fetch from API
    if (this._api) {
      try {
        const info = await this._api.getUserInfo(userId);
        if (info && info.changed_profiles && info.changed_profiles[userId]) {
          const profile = info.changed_profiles[userId];
          return this._saveProfile(userId, profile);
        }
      } catch (err) {
        logger.warn('UserCache', `getUserInfo(${userId}) failed: ${err.message}`);
      }
    }

    // Return whatever we have in cache, or create minimal entry
    if (cached) {
      return this._formatUser(cached);
    }

    return this._createMinimal(userId);
  }

  // Quick record — just save display name from message, no API call
  recordMessage(userId, displayName = '') {
    try {
      stmts.setBasicInfo.run(userId, displayName);
    } catch (err) {
      logger.warn('UserCache', `recordMessage failed: ${err.message}`);
    }
  }

  // Fetch and save full profile from API (async, non-blocking)
  async fetchAndSave(userId) {
    if (!this._api) return null;
    try {
      const info = await this._api.getUserInfo(userId);
      if (info && info.changed_profiles && info.changed_profiles[userId]) {
        return this._saveProfile(userId, info.changed_profiles[userId]);
      }
    } catch (err) {
      logger.warn('UserCache', `fetchAndSave(${userId}) failed: ${err.message}`);
    }
    return null;
  }

  _saveProfile(userId, profile) {
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
      stmts.upsert.run(data);
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
    };
  }

  // Dashboard queries
  getAll() {
    return stmts.getAll.all().map((r) => this._formatUser(r));
  }

  getTopUsers(count = 10) {
    return stmts.getTopUsers.all(count).map((r) => this._formatUser(r));
  }

  getUser(userId) {
    const row = stmts.getById.get(userId);
    return row ? this._formatUser(row) : null;
  }

  getUserCount() {
    return stmts.getCount.get().count;
  }
}

module.exports = new UserCache();
