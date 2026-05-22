const db = require('../db');
const logger = require('../logger');
const crypto = require('crypto');

// ─────────────────────────────────────────────────────────
// LRU Cache — O(1) get/set with Map insertion-order trick
// ─────────────────────────────────────────────────────────
class LRUCache {
  constructor(maxSize = 500) {
    this.maxSize = maxSize;
    this.cache = new Map();
  }

  get(key) {
    if (!this.cache.has(key)) return undefined;
    const entry = this.cache.get(key);
    // Evict if expired
    if (entry.expiresAt && Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return undefined;
    }
    // Move to end (most-recently-used)
    this.cache.delete(key);
    this.cache.set(key, entry);
    return entry.value;
  }

  set(key, value, ttlMs) {
    // Evict oldest entry if at capacity
    if (this.cache.size >= this.maxSize) {
      const oldestKey = this.cache.keys().next().value;
      this.cache.delete(oldestKey);
    }
    this.cache.set(key, {
      value,
      expiresAt: ttlMs ? Date.now() + ttlMs : null,
    });
  }

  delete(key) {
    this.cache.delete(key);
  }

  get size() {
    return this.cache.size;
  }
}

// Singleton cache — shared across all requests
const tokenCache = new LRUCache(500);

// ─────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────

/** Generate a short URL-safe token — no external dependencies */
function generateToken(length = 8) {
  return crypto.randomBytes(Math.ceil(length * 0.75)).toString('base64url').slice(0, length);
}

/** Parse User-Agent into device/os/browser (no external libs) */
function parseUA(ua = '') {
  if (!ua) return { deviceType: 'unknown', osName: 'unknown', browserName: 'unknown' };

  const s = ua.toLowerCase();

  // Device type
  let deviceType = 'desktop';
  if (/bot|crawler|spider|slurp|bingbot|googlebot|facebookexternalhit/i.test(ua)) {
    deviceType = 'bot';
  } else if (/tablet|ipad|kindle|silk|playbook/i.test(s)) {
    deviceType = 'tablet';
  } else if (/mobile|android.*mobi|iphone|ipod|windows phone|opera mini|blackberry|samsung|xiaomi|oppo|vivo/i.test(s)) {
    deviceType = 'mobile';
  }

  // OS
  let osName = 'unknown';
  if (/iphone os ([\d_]+)/i.test(ua)) {
    osName = `iOS ${ua.match(/iphone os ([\d_]+)/i)[1].replace(/_/g, '.')}`;
  } else if (/ipad.*os ([\d_]+)/i.test(ua)) {
    osName = `iPadOS ${ua.match(/os ([\d_]+)/i)[1].replace(/_/g, '.')}`;
  } else if (/android ([\d.]+)/i.test(ua)) {
    osName = `Android ${ua.match(/android ([\d.]+)/i)[1]}`;
  } else if (/windows nt ([\d.]+)/i.test(ua)) {
    const ntMap = { '10.0': '10/11', '6.3': '8.1', '6.2': '8', '6.1': '7', '6.0': 'Vista', '5.1': 'XP' };
    const ver = ua.match(/windows nt ([\d.]+)/i)[1];
    osName = `Windows ${ntMap[ver] || ver}`;
  } else if (/mac os x ([\d_]+)/i.test(ua)) {
    osName = `macOS ${ua.match(/mac os x ([\d_]+)/i)[1].replace(/_/g, '.')}`;
  } else if (/linux/i.test(s)) {
    osName = 'Linux';
  }

  // Browser — specific first, generic last
  let browserName = 'unknown';
  if (/zalo/i.test(ua)) {
    browserName = 'Zalo WebView';
  } else if (/fban|fbav|fbios/i.test(ua)) {
    browserName = 'Facebook App';
  } else if (/edg\/([\d.]+)/i.test(ua)) {
    browserName = `Edge ${ua.match(/edg\/([\d.]+)/i)[1].split('.')[0]}`;
  } else if (/opr\/([\d.]+)|opera\/([\d.]+)/i.test(ua)) {
    const m = ua.match(/opr\/([\d.]+)/i) || ua.match(/opera\/([\d.]+)/i);
    browserName = `Opera ${m[1].split('.')[0]}`;
  } else if (/chrome\/([\d.]+)/i.test(ua) && !/chromium/i.test(ua)) {
    browserName = `Chrome ${ua.match(/chrome\/([\d.]+)/i)[1].split('.')[0]}`;
  } else if (/firefox\/([\d.]+)/i.test(ua)) {
    browserName = `Firefox ${ua.match(/firefox\/([\d.]+)/i)[1].split('.')[0]}`;
  } else if (/safari\/([\d.]+)/i.test(ua) && !/chrome/i.test(ua)) {
    browserName = 'Safari';
  } else if (/msie ([\d.]+)|trident.*rv:([\d.]+)/i.test(ua)) {
    browserName = 'Internet Explorer';
  } else if (/crios\/([\d.]+)/i.test(ua)) {
    browserName = `Chrome iOS ${ua.match(/crios\/([\d.]+)/i)[1].split('.')[0]}`;
  }

  return { deviceType, osName, browserName };
}

// ─────────────────────────────────────────────────────────
// Store
// ─────────────────────────────────────────────────────────
const linkRedirectStore = {
  /**
   * Create a new short redirect link.
   * Returns { token, shortUrl }.
   */
  async create({ affiliateLink, userId = '', userName = '', itemId = '', productName = '', convertLogId = null }) {
    const token = generateToken(8);
    const serverUrl = process.env.SERVER_URL || '';

    // 30-day expiry
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);
    const expiresAtStr = expiresAt.toISOString();

    await db.runNamed(`
      INSERT INTO link_redirects
        (token, convert_log_id, affiliate_link, user_id, user_name, item_id, product_name, expires_at)
      VALUES
        (@token, @convertLogId, @affiliateLink, @userId, @userName, @itemId, @productName, @expiresAt)
    `, { token, convertLogId, affiliateLink, userId, userName, itemId, productName, expiresAt: expiresAtStr });

    // Warm the cache immediately so next click is a HIT
    const ttlMs = expiresAt.getTime() - Date.now();
    const row = { token, affiliate_link: affiliateLink, expires_at: expiresAtStr, id: null, click_count: 0 };
    tokenCache.set(token, row, ttlMs);

    logger.info('LinkRedirect', `Created token=${token} user=${userId}`);
    return { token, shortUrl: `${serverUrl}/go/${token}` };
  },

  /**
   * Lookup a redirect by token.
   * Returns null if not found or expired.
   *
   * PERF: Cache-first — DB only on miss. Expiry enforced in SQL.
   */
  async getByToken(token) {
    // 1. Cache hit
    const cached = tokenCache.get(token);
    if (cached !== undefined) return cached;

    // 2. Cache miss → DB (expiry enforced in SQL to use index)
    const now = new Date().toISOString();
    const row = await db.get(
      'SELECT * FROM link_redirects WHERE token = ? AND expires_at > ?',
      [token, now]
    );

    if (!row) {
      // Cache negative result for 60s to prevent DB hammering on invalid tokens
      tokenCache.set(token, null, 60_000);
      return null;
    }

    // Populate cache for future hits
    const ttlMs = new Date(row.expires_at).getTime() - Date.now();
    tokenCache.set(token, row, Math.max(ttlMs, 0));

    return row;
  },

  /**
   * Record a click event and increment click_count atomically.
   * Called fire-and-forget from the route — never awaited on hot path.
   */
  async recordClick(token, redirectId, { ip = '', userAgent = '', referer = '', acceptLanguage = '' } = {}) {
    const { deviceType, osName, browserName } = parseUA(userAgent);

    // Both writes in a single round-trip transaction where possible
    await db.runNamed(`
      INSERT INTO link_click_events
        (token, redirect_id, ip_address, user_agent, device_type, os_name, browser_name, referer, accept_language)
      VALUES
        (@token, @redirectId, @ip, @userAgent, @deviceType, @osName, @browserName, @referer, @acceptLanguage)
    `, { token, redirectId, ip, userAgent, deviceType, osName, browserName, referer, acceptLanguage });

    await db.run(
      'UPDATE link_redirects SET click_count = click_count + 1 WHERE token = ?',
      [token]
    );
  },

  /** Get click events for a token (admin detail view) */
  async getClicksByToken(token, limit = 100) {
    return db.all(
      'SELECT * FROM link_click_events WHERE token = ? ORDER BY clicked_at DESC LIMIT ?',
      [token, limit]
    );
  },

  /** Get all redirects created by a user */
  async getByUser(userId, limit = 50) {
    return db.all(
      'SELECT * FROM link_redirects WHERE user_id = ? ORDER BY created_at DESC LIMIT ?',
      [userId, limit]
    );
  },

  /** Back-link a redirect token to its convert_log row (fire-and-forget safe) */
  async linkToConvertLog(token, convertLogId) {
    await db.run(
      'UPDATE link_redirects SET convert_log_id = ? WHERE token = ?',
      [convertLogId, token]
    );
  },

  /** Aggregate stats for dashboard */
  async getStats() {
    return db.get(`
      SELECT
        COUNT(*)              AS total_links,
        SUM(click_count)      AS total_clicks,
        COUNT(DISTINCT user_id) AS unique_users
      FROM link_redirects
      WHERE expires_at > ?
    `, [new Date().toISOString()]);
  },

  /**
   * Cleanup: delete expired rows older than `graceDays` days.
   * Returns counts of deleted rows.
   */
  async cleanupExpired(graceDays = 7) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - graceDays);
    const cutoffStr = cutoff.toISOString();

    // Delete orphaned click events first (FK-safe without CASCADE)
    const clickResult = await db.run(`
      DELETE FROM link_click_events
      WHERE token IN (
        SELECT token FROM link_redirects WHERE expires_at < ?
      )
    `, [cutoffStr]);

    const linkResult = await db.run(
      'DELETE FROM link_redirects WHERE expires_at < ?',
      [cutoffStr]
    );

    const deletedLinks = linkResult?.changes ?? 0;
    const deletedClicks = clickResult?.changes ?? 0;

    // Clear any stale cache entries for deleted tokens
    if (deletedLinks > 0) {
      // Full cache clear is safe here — it runs at 3AM off-peak
      tokenCache.cache.clear();
    }

    return { deletedLinks, deletedClicks };
  },

  // Expose cache for monitoring/diagnostics
  get _cacheSize() { return tokenCache.size; },
};

module.exports = linkRedirectStore;
module.exports._parseUA = parseUA;
module.exports._tokenCache = tokenCache;
