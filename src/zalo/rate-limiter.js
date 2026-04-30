const logger = require('../logger');

// Priority: HIGH = send messages (must go through), LOW = reactions/seen (can skip if busy)
const PRIORITY = { HIGH: 0, LOW: 1 };

class RateLimiter {
  constructor({ maxPerMinute = 15, minDelayMs = 400, maxDelayMs = 1200 } = {}) {
    this.maxPerMinute = maxPerMinute;
    this.minDelayMs = minDelayMs;
    this.maxDelayMs = maxDelayMs;
    this.queue = [];
    this.processing = false;
    this.timestamps = [];
    this.lastActionTime = 0;
  }

  _randomDelay() {
    return this.minDelayMs + Math.random() * (this.maxDelayMs - this.minDelayMs);
  }

  _isRateLimited() {
    const oneMinuteAgo = Date.now() - 60_000;
    this.timestamps = this.timestamps.filter((t) => t > oneMinuteAgo);
    return this.timestamps.length >= this.maxPerMinute;
  }

  // HIGH priority — blocks until complete
  enqueue(fn) {
    return new Promise((resolve, reject) => {
      this.queue.push({ fn, resolve, reject, priority: PRIORITY.HIGH });
      this.queue.sort((a, b) => a.priority - b.priority);
      this._processQueue();
    });
  }

  // LOW priority — fire-and-forget, no blocking
  enqueueAsync(fn) {
    this.queue.push({
      fn,
      resolve: () => {},
      reject: (err) => logger.warn('RateLimiter', `Async action failed: ${err.message}`),
      priority: PRIORITY.LOW,
    });
    this.queue.sort((a, b) => a.priority - b.priority);
    this._processQueue();
  }

  async _processQueue() {
    if (this.processing || this.queue.length === 0) return;
    this.processing = true;

    while (this.queue.length > 0) {
      if (this._isRateLimited()) {
        // When rate limited, drop LOW priority items
        const lowIdx = this.queue.findIndex((q) => q.priority === PRIORITY.LOW);
        if (lowIdx !== -1) {
          const dropped = this.queue.splice(lowIdx, 1)[0];
          dropped.resolve();
          logger.warn('RateLimiter', 'Dropped LOW priority action (rate limited)');
          continue;
        }
        const waitTime = 4000;
        logger.warn('RateLimiter', `Rate limit (${this.maxPerMinute}/min). Wait ${waitTime / 1000}s...`);
        await this._sleep(waitTime);
        continue;
      }

      const item = this.queue.shift();

      // Smart delay: skip delay if first action in recent window
      const timeSinceLastAction = Date.now() - this.lastActionTime;
      if (timeSinceLastAction < this.minDelayMs) {
        const delay = item.priority === PRIORITY.HIGH
          ? Math.max(200, this.minDelayMs - timeSinceLastAction)
          : this._randomDelay();
        await this._sleep(delay);
      }

      try {
        const result = await item.fn();
        this.timestamps.push(Date.now());
        this.lastActionTime = Date.now();
        item.resolve(result);
      } catch (err) {
        item.reject(err);
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
