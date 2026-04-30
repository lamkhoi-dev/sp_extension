const logger = require('../logger');

// Anti-ban rate limiter with priority levels
// Priority: HIGH = send messages (must go through), LOW = reactions/seen (can skip if busy)
class RateLimiter {
  constructor({ maxPerMinute = 12, minDelayMs = 600, maxDelayMs = 1500 } = {}) {
    this.maxPerMinute = maxPerMinute;
    this.minDelayMs = minDelayMs;
    this.maxDelayMs = maxDelayMs;
    this.queue = [];
    this.processing = false;
    this.timestamps = [];
  }

  _randomDelay() {
    return this.minDelayMs + Math.random() * (this.maxDelayMs - this.minDelayMs);
  }

  _isRateLimited() {
    const oneMinuteAgo = Date.now() - 60_000;
    this.timestamps = this.timestamps.filter((t) => t > oneMinuteAgo);
    return this.timestamps.length >= this.maxPerMinute;
  }

  enqueue(fn) {
    return new Promise((resolve, reject) => {
      this.queue.push({ fn, resolve, reject });
      this._processQueue();
    });
  }

  // Fire-and-forget: enqueue but don't block caller
  enqueueAsync(fn) {
    this.queue.push({
      fn,
      resolve: () => {},
      reject: (err) => logger.warn('RateLimiter', `Async action failed: ${err.message}`),
    });
    this._processQueue();
  }

  async _processQueue() {
    if (this.processing || this.queue.length === 0) return;
    this.processing = true;

    while (this.queue.length > 0) {
      if (this._isRateLimited()) {
        const waitTime = 5000;
        logger.warn('RateLimiter', `Rate limit (${this.maxPerMinute}/min). Wait ${waitTime / 1000}s...`);
        await this._sleep(waitTime);
        continue;
      }

      const { fn, resolve, reject } = this.queue.shift();
      const delay = this._randomDelay();

      await this._sleep(delay);

      try {
        const result = await fn();
        this.timestamps.push(Date.now());
        resolve(result);
      } catch (err) {
        reject(err);
      }
    }

    this.processing = false;
  }

  _sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
  }

  get pending() {
    return this.queue.length;
  }
}

module.exports = RateLimiter;
