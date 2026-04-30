const fs = require('fs');
const path = require('path');
const logger = require('../logger');
const ZaloActions = require('./zalo-actions');
const ZaloCommands = require('./zalo-commands');
const ConcurrentHandler = require('./concurrent-handler');
const messageStore = require('./message-store');
const userCache = require('./user-cache');

const SESSION_PATH = path.join(__dirname, '../../zalo-session.json');
const QR_PATH = path.join(__dirname, '../../public/zalo-qr.png');

class ZaloBot {
  constructor() {
    this.api = null;
    this.listener = null;
    this.actions = null;
    this.commands = null;
    this.concurrentHandler = new ConcurrentHandler();
    this.ownId = null;
    this.status = 'offline'; // offline | qr_pending | online | error
    this.accountName = '';
    this.statusListeners = [];
    this.messageListeners = []; // for dashboard real-time
    this._keepAliveInterval = null;
  }

  // Subscribe to status changes (for dashboard broadcasting)
  onStatusChange(fn) {
    this.statusListeners.push(fn);
    return () => { this.statusListeners = this.statusListeners.filter((f) => f !== fn); };
  }

  // Subscribe to new message events (for dashboard real-time)
  onMessageEvent(fn) {
    this.messageListeners.push(fn);
    return () => { this.messageListeners = this.messageListeners.filter((f) => f !== fn); };
  }

  _emitStatus() {
    const data = this.getStatus();
    this.statusListeners.forEach((fn) => fn(data));
  }

  _emitMessage(entry) {
    this.messageListeners.forEach((fn) => fn(entry));
  }

  getStatus() {
    return {
      status: this.status,
      accountName: this.accountName,
      ownId: this.ownId,
      qrAvailable: fs.existsSync(QR_PATH),
    };
  }

  async start() {
    try {
      const { Zalo, ThreadType, Reactions } = await import('zca-js');

      logger.info('ZaloBot', '🚀 Khởi tạo Zalo Bot...');
      this.status = 'qr_pending';
      this._emitStatus();

      const zalo = new Zalo({
        selfListen: false,
        checkUpdate: true,
        logging: true,
      });

      logger.info('ZaloBot', '📱 Đang tạo mã QR... Vui lòng quét bằng Zalo trên điện thoại.');

      this.api = await zalo.loginQR({ qrPath: QR_PATH });

      // Get own account info
      try {
        this.ownId = await this.api.getOwnId();
        const accountInfo = await this.api.fetchAccountInfo();
        this.accountName = accountInfo?.name || accountInfo?.displayName || `ID:${this.ownId}`;
      } catch (err) {
        logger.warn('ZaloBot', `Could not fetch account info: ${err.message}`);
        this.accountName = 'Zalo Bot';
      }

      this.status = 'online';
      logger.info('ZaloBot', `✅ Đăng nhập thành công! Account: ${this.accountName}`);
      this._emitStatus();

      // Save session cookie
      try {
        const cookie = await this.api.getCookie();
        if (cookie) {
          fs.writeFileSync(SESSION_PATH, JSON.stringify(cookie, null, 2));
          logger.info('ZaloBot', '💾 Session đã lưu vào zalo-session.json');
        }
      } catch (err) {
        logger.warn('ZaloBot', `Could not save session: ${err.message}`);
      }

      // Setup actions & commands with stores
      this.actions = new ZaloActions(this.api, ThreadType, Reactions);
      this.actions.userCache = userCache; // inject for getDisplayName cache-first
      this.commands = new ZaloCommands(this.actions, { messageStore, userCache });

      // Wire user cache API
      userCache.setApi(this.api);

      // Setup listeners
      this.listener = this.api.listener;
      this._setupListeners(ThreadType);
      this.listener.start();

      // Replay unprocessed messages from last session
      this._replayUnprocessed();

      // Keep-alive ping every 5 minutes
      this._keepAliveInterval = setInterval(() => {
        try { this.api.keepAlive?.(); } catch (err) {
          logger.warn('ZaloBot', `keepAlive failed: ${err.message}`);
        }
      }, 5 * 60 * 1000);

      logger.info('ZaloBot', '👂 Listener đang lắng nghe tin nhắn...');

    } catch (err) {
      this.status = 'error';
      logger.error('ZaloBot', `❌ Lỗi khởi tạo: ${err.message}`);
      this._emitStatus();
      throw err;
    }
  }

  _setupListeners(ThreadType) {
    // ─── Message listener ──────────────────────────
    this.listener.on('message', async (message) => {
      if (message.isSelf) return;

      const isGroup = message.type === ThreadType.Group;
      const senderUid = message.data?.uidFrom;
      const content = message.data?.content;
      let contentPreview = '[non-text]';
      if (typeof content === 'string') {
        contentPreview = content.slice(0, 50);
      } else if (content) {
        contentPreview = `[object: ${JSON.stringify(content).slice(0, 120)}]`;
      }

      logger.info('ZaloBot', `📩 ${isGroup ? 'Group' : 'DM'} [${message.threadId}] from ${senderUid}: ${contentPreview}`);

      // Save to message store FIRST
      const msgId = messageStore.save(message, { isGroup });

      // Record user (non-blocking profile fetch)
      const senderName = message.data?.dName || '';
      userCache.recordMessage(senderUid, senderName);
      userCache.fetchAndSave(senderUid).catch(() => {}); // async, non-blocking

      // Emit for dashboard
      const entry = messageStore.getById(msgId);
      if (entry) this._emitMessage(entry);

      // Process via concurrent handler — parallel across threads, sequential within same thread
      this.concurrentHandler.process(message.threadId, async () => {
        try {
          await this.commands.handleMessage(message, { isGroup, msgId });
          // Re-emit updated status after processing
          const updated = messageStore.getById(msgId);
          if (updated) this._emitMessage(updated);
        } catch (err) {
          logger.error('ZaloBot', `Message handler error: ${err.message}`);
        }
      });
    });

    // ─── Friend event listener ──────────────────────
    this.listener.on('friend_event', async (event) => {
      logger.info('ZaloBot', `👥 Friend event: type=${event.type} data=${JSON.stringify(event.data).slice(0, 100)}`);

      // Auto-accept friend requests (type 2 = REQUEST)
      if (event.type === 2 && event.data?.fromUid) {
        try {
          await this.actions?.acceptFriend(event.data.fromUid);
          await this.commands?.handleNewFriend(event.data.fromUid);
        } catch (err) {
          logger.warn('ZaloBot', `Friend request handling failed: ${err.message}`);
        }
      }
    });

    // ─── Group event listener ──────────────────────
    this.listener.on('group_event', async (event) => {
      logger.info('ZaloBot', `📋 Group event: ${JSON.stringify(event).slice(0, 100)}`);
    });

    // ─── Reaction listener ─────────────────────────
    this.listener.on('reaction', async (reaction) => {
      logger.info('ZaloBot', `💗 Reaction: ${JSON.stringify(reaction).slice(0, 100)}`);
    });

    // ─── Undo (message recall) listener ────────────
    this.listener.on('undo', async (data) => {
      logger.info('ZaloBot', `↩️ Undo: ${JSON.stringify(data).slice(0, 100)}`);
    });

    // ─── Old messages (catch-up after reconnect) ───
    this.listener.on('old_messages', async (messages, type) => {
      logger.info('ZaloBot', `📜 Old messages: ${messages.length} (type: ${type})`);
      for (const msg of messages) {
        if (msg.isSelf) continue;
        const isGroup = msg.type === ThreadType?.Group;
        messageStore.save(msg, { isGroup });
      }
    });
  }

  // Replay unprocessed messages from previous session
  _replayUnprocessed() {
    const unprocessed = messageStore.getUnprocessed();
    if (unprocessed.length === 0) return;

    logger.info('ZaloBot', `🔄 Replaying ${unprocessed.length} unprocessed message(s) from last session`);
    for (const msg of unprocessed) {
      // Mark as skipped — we can't properly replay without the original message object
      // But we log them so user can see what was missed
      messageStore.markSkipped(msg.id);
      logger.warn('ZaloBot', `⏭️ Skipped (no replay context): [${msg.sender_name}] "${msg.content.slice(0, 50)}"`);
    }
  }

  async stop() {
    if (this._keepAliveInterval) {
      clearInterval(this._keepAliveInterval);
      this._keepAliveInterval = null;
    }
    if (this.listener) {
      this.listener.stop?.();
    }
    this.status = 'offline';
    this.api = null;
    this.listener = null;
    this._emitStatus();
    logger.info('ZaloBot', '🛑 Zalo Bot stopped.');
  }
}

module.exports = ZaloBot;
