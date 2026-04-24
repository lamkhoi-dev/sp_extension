const logger = require('./logger');

class TokenManager {
  constructor() {
    this.resetIntervalMs = 2 * 60 * 60 * 1000; // 2 hours default
    this.resetTimer = null;
    this.lastReset = null;
    this.manualOverrides = {};
    this.browserRef = null;
    this.subscribers = new Set();
  }

  subscribe(callback) {
    this.subscribers.add(callback);
    return () => this.subscribers.delete(callback);
  }

  _broadcast() {
    const status = this.getStatus();
    for (const cb of this.subscribers) {
      try { cb(status); } catch {}
    }
  }

  setBrowserRef(browserManager) {
    this.browserRef = browserManager;
  }

  startAutoReset() {
    this.stopAutoReset();
    this.lastReset = Date.now();
    this.resetTimer = setInterval(() => {
      logger.info('TokenManager', `Auto-reset triggered (interval: ${this.resetIntervalMs / 60000}min)`);
      this.forceReset();
    }, this.resetIntervalMs);
    logger.info('TokenManager', `Auto-reset started: every ${this.resetIntervalMs / 60000} minutes`);
    this._broadcast();
  }

  stopAutoReset() {
    if (this.resetTimer) {
      clearInterval(this.resetTimer);
      this.resetTimer = null;
    }
  }

  setResetInterval(minutes) {
    this.resetIntervalMs = minutes * 60 * 1000;
    logger.info('TokenManager', `Reset interval changed to ${minutes} minutes`);
    if (this.resetTimer) {
      this.startAutoReset();
    }
    this._broadcast();
  }

  setManualOverrides(headers, rawCurl = null) {
    this.manualOverrides = { ...this.manualOverrides, ...headers };
    if (rawCurl) this.rawCurl = rawCurl;
    logger.info('TokenManager', `Manual overrides set: ${Object.keys(headers).join(', ')}`);
    this._broadcast();
  }

  getRawCurl() {
    return this.rawCurl;
  }

  clearManualOverrides() {
    this.manualOverrides = {};
    logger.info('TokenManager', 'Manual overrides cleared');
    this._broadcast();
  }

  getManualOverrides() {
    return this.manualOverrides;
  }

  async forceReset() {
    logger.info('TokenManager', 'Force reset initiated...');
    if (this.browserRef) {
      try {
        await this.browserRef.reloadPages();
        this.lastReset = Date.now();
        logger.info('TokenManager', 'Force reset complete — pages reloaded');
      } catch (err) {
        logger.error('TokenManager', `Force reset failed: ${err.message}`);
      }
    } else {
      logger.warn('TokenManager', 'No browser reference — cannot reset');
    }
    this._broadcast();
  }

  getStatus() {
    const now = Date.now();
    const nextReset = this.lastReset ? this.lastReset + this.resetIntervalMs : null;
    const timeUntilReset = nextReset ? Math.max(0, nextReset - now) : null;

    return {
      autoResetEnabled: !!this.resetTimer,
      resetIntervalMinutes: this.resetIntervalMs / 60000,
      lastReset: this.lastReset ? new Date(this.lastReset).toISOString() : null,
      nextReset: nextReset ? new Date(nextReset).toISOString() : null,
      timeUntilResetMs: timeUntilReset,
      timeUntilResetFormatted: timeUntilReset ? formatDuration(timeUntilReset) : null,
      manualOverrides: Object.keys(this.manualOverrides),
      hasManualOverrides: Object.keys(this.manualOverrides).length > 0,
    };
  }

  parseCurl(curlString) {
    const headers = {};
    const headerRegex = /-H\s+'([^:]+):\s*([^']+)'/g;
    let match;
    while ((match = headerRegex.exec(curlString)) !== null) {
      headers[match[1].trim()] = match[2].trim();
    }

    const cookieMatch = curlString.match(/-b\s+'([^']+)'/);
    if (cookieMatch) {
      headers['cookie'] = cookieMatch[1];
    }

    logger.info('TokenManager', `Parsed cURL: ${Object.keys(headers).length} headers extracted`);
    return headers;
  }
}

function formatDuration(ms) {
  const hours = Math.floor(ms / 3600000);
  const minutes = Math.floor((ms % 3600000) / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}

module.exports = new TokenManager();
