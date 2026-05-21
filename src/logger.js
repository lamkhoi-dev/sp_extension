const fs = require('fs');
const path = require('path');

const LOG_DIR = path.join(__dirname, '..', 'logs');
const MAX_LOG_DAYS = 7;

class Logger {
  constructor() {
    this.logs = [];
    this.maxInMemory = 500;
    this.subscribers = new Set();
    this._ensureLogDir();
    this._rotateOldLogs();
  }

  _ensureLogDir() {
    try { fs.mkdirSync(LOG_DIR, { recursive: true }); } catch {}
  }

  _getLogFile() {
    return path.join(LOG_DIR, `app-${new Date().toISOString().slice(0, 10)}.log`);
  }

  _rotateOldLogs() {
    try {
      const files = fs.readdirSync(LOG_DIR).filter(f => f.startsWith('app-') && f.endsWith('.log'));
      const cutoff = new Date(Date.now() - MAX_LOG_DAYS * 24 * 60 * 60 * 1000);

      for (const file of files) {
        const dateStr = file.replace('app-', '').replace('.log', '');
        const fileDate = new Date(dateStr);
        if (!isNaN(fileDate.getTime()) && fileDate < cutoff) {
          fs.unlinkSync(path.join(LOG_DIR, file));
        }
      }
    } catch {}

    // Schedule next rotation in 6 hours
    setTimeout(() => this._rotateOldLogs(), 6 * 60 * 60 * 1000).unref();
  }

  subscribe(callback) {
    this.subscribers.add(callback);
    return () => this.subscribers.delete(callback);
  }

  _broadcast(entry) {
    for (const cb of this.subscribers) {
      try { cb(entry); } catch {}
    }
  }

  _write(entry) {
    this.logs.push(entry);
    if (this.logs.length > this.maxInMemory) {
      this.logs = this.logs.slice(-this.maxInMemory);
    }

    const line = `[${entry.timestamp}] [${entry.level}] ${entry.category}: ${entry.message}\n`;

    // Async write — non-blocking
    fs.appendFile(this._getLogFile(), line, (err) => {
      if (err) console.error('[Logger] Write failed:', err.message);
    });

    this._broadcast(entry);
  }

  info(category, message, data = null) {
    const entry = { timestamp: new Date().toISOString(), level: 'INFO', category, message, data };
    this._write(entry);
    console.log(`\x1b[36m[INFO]\x1b[0m ${category}: ${message}`);
  }

  warn(category, message, data = null) {
    const entry = { timestamp: new Date().toISOString(), level: 'WARN', category, message, data };
    this._write(entry);
    console.log(`\x1b[33m[WARN]\x1b[0m ${category}: ${message}`);
  }

  error(category, message, data = null) {
    const entry = { timestamp: new Date().toISOString(), level: 'ERROR', category, message, data };
    this._write(entry);
    console.log(`\x1b[31m[ERROR]\x1b[0m ${category}: ${message}`);
  }

  request(method, url, status, duration, data = null) {
    const success = status >= 200 && status < 400;
    const entry = {
      timestamp: new Date().toISOString(),
      level: success ? 'INFO' : 'ERROR',
      category: 'API',
      message: `${method} ${url} → ${status} (${duration}ms)`,
      type: 'request',
      method, url, status, duration, data
    };
    this._write(entry);
  }

  getRecent(count = 50) {
    return this.logs.slice(-count);
  }
}

module.exports = new Logger();
