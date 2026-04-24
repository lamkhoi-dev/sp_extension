const fs = require('fs');
const path = require('path');

class Logger {
  constructor() {
    this.logs = [];
    this.maxInMemory = 500;
    this.logFile = path.join(__dirname, '..', 'logs', `app-${new Date().toISOString().slice(0, 10)}.log`);
    this.subscribers = new Set();
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
    fs.appendFileSync(this.logFile, line);
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
