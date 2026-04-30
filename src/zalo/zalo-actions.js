const logger = require('../logger');
const RateLimiter = require('./rate-limiter');

// Human-like action wrappers around zca-js API — SPEED OPTIMIZED
class ZaloActions {
  constructor(api, ThreadType, Reactions) {
    this.api = api;
    this.ThreadType = ThreadType;
    this.Reactions = Reactions;
    this.limiter = new RateLimiter({ maxPerMinute: 15, minDelayMs: 200, maxDelayMs: 600 });
    this.userNameCache = new Map();
    this.userCache = null; // injected by ZaloBot after init
  }

  // ─── Seen (fire-and-forget, no rate limit) ──────────
  markSeen(threadId, type) {
    this.api.sendSeenEvent(threadId, type).catch(() => {});
  }

  // ─── Typing indicator (no rate limit) ───────────────
  async showTyping(threadId, type, durationMs = 1000) {
    try {
      await this.api.sendTypingEvent(threadId, type);
      await this._sleep(durationMs);
    } catch (err) {
      logger.warn('ZaloActions', `sendTypingEvent failed: ${err.message}`);
    }
  }

  // ─── React to a message (DIRECT fire-and-forget, no rate limiter) ──
  reactHeart(message) {
    this.api.addReaction(this.Reactions.HEART, message).catch(() => {});
  }

  reactLike(message) {
    this.api.addReaction(this.Reactions.LIKE, message).catch(() => {});
  }

  // ─── Get display name (cache-first, no extra API call) ──
  async getDisplayName(userId) {
    // 1. In-memory cache (fastest)
    if (this.userNameCache.has(userId)) return this.userNameCache.get(userId);

    // 2. SQLite userCache (already fetched by bot listener)
    if (this.userCache) {
      const cached = this.userCache.getUser(userId);
      if (cached?.displayName) {
        this.userNameCache.set(userId, cached.displayName);
        return cached.displayName;
      }
    }

    // 3. Fallback: API call (rare — only if never seen before)
    try {
      const info = await this.api.getUserInfo(userId);
      let name = 'bạn';
      if (info && typeof info === 'object') {
        const userData = info[userId] || info.get?.(userId) || info;
        name = userData?.displayName || userData?.zaloName || userData?.name || 'bạn';
      }
      this.userNameCache.set(userId, name);
      return name;
    } catch (err) {
      logger.warn('ZaloActions', `getUserInfo failed: ${err.message}`);
      return 'bạn';
    }
  }

  // ─── Send text message (rate-limited — MUST wait) ───
  async sendText(text, threadId, type) {
    return this.limiter.enqueue(() =>
      this.api.sendMessage(text, threadId, type)
    );
  }

  // ─── Send styled message ────────────────────────────
  async sendStyled(msgContent, threadId, type) {
    return this.limiter.enqueue(() =>
      this.api.sendMessage(msgContent, threadId, type)
    );
  }

  // ─── Send link with preview ─────────────────────────
  async sendLink(linkUrl, threadId, type, msg = '') {
    return this.limiter.enqueue(() =>
      this.api.sendLink({ link: linkUrl, msg }, threadId, type)
    );
  }

  // ─── Send message with quote ────────────────────────
  async sendQuoteReply(text, originalMessage) {
    return this.limiter.enqueue(() =>
      this.api.sendMessage(
        { msg: text, quote: originalMessage },
        originalMessage.threadId,
        originalMessage.type
      )
    );
  }

  // ─── Accept friend request ──────────────────────────
  async acceptFriend(userId) {
    try {
      await this.api.acceptFriendRequest(userId);
      logger.info('ZaloActions', `✅ Accepted friend request from ${userId}`);
      return true;
    } catch (err) {
      logger.warn('ZaloActions', `acceptFriendRequest failed: ${err.message}`);
      return false;
    }
  }

  // ─── FAST human-like reply ──────────────────────────
  // Optimized: seen+react are fire-and-forget, typing is short, only send blocks
  async humanReply(message, replyText, { react = true, quote = false } = {}) {
    const { threadId, type } = message;

    // Step 1: Mark seen (fire-and-forget, instant)
    this.markSeen(threadId, type);

    // Step 2: React (fire-and-forget, goes to queue separately)
    if (react) {
      this.reactLike(message);
    }

    // Step 3: Show typing — FAST duration
    const typingDuration = Math.min(200 + replyText.length * 3, 800);
    await this.showTyping(threadId, type, typingDuration);

    // Step 4: Send reply (rate-limited, blocks until sent)
    if (quote) {
      return this.sendQuoteReply(replyText, message);
    }
    return this.sendText(replyText, threadId, type);
  }

  _sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
  }
}

module.exports = ZaloActions;
