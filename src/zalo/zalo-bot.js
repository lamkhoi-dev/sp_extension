const fs = require('fs');
const path = require('path');
const logger = require('../logger');
const ZaloActions = require('./zalo-actions');
const ZaloCommands = require('./zalo-commands');

const SESSION_PATH = path.join(__dirname, '../../zalo-session.json');
const QR_PATH = path.join(__dirname, '../../public/zalo-qr.png');

class ZaloBot {
  constructor() {
    this.api = null;
    this.listener = null;
    this.actions = null;
    this.commands = null;
    this.ownId = null;
    this.status = 'offline'; // offline | qr_pending | online | error
    this.accountName = '';
    this.statusListeners = [];
    this._keepAliveInterval = null;
  }

  // Subscribe to status changes (for dashboard broadcasting)
  onStatusChange(fn) {
    this.statusListeners.push(fn);
    return () => {
      this.statusListeners = this.statusListeners.filter((f) => f !== fn);
    };
  }

  _emitStatus() {
    const data = this.getStatus();
    this.statusListeners.forEach((fn) => fn(data));
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
      // Dynamic import for ESM-only zca-js package
      const { Zalo, ThreadType, Reactions } = await import('zca-js');

      logger.info('ZaloBot', '🚀 Khởi tạo Zalo Bot...');
      this.status = 'qr_pending';
      this._emitStatus();

      const zalo = new Zalo({
        selfListen: false,
        checkUpdate: true,
        logging: true,
      });

      // Login with QR code
      logger.info('ZaloBot', '📱 Đang tạo mã QR... Vui lòng quét bằng Zalo trên điện thoại.');

      this.api = await zalo.loginQR({
        qrPath: QR_PATH,
      });

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

      // Save session cookie for potential later reuse
      try {
        const cookie = await this.api.getCookie();
        if (cookie) {
          fs.writeFileSync(SESSION_PATH, JSON.stringify(cookie, null, 2));
          logger.info('ZaloBot', '💾 Session đã lưu vào zalo-session.json');
        }
      } catch (err) {
        logger.warn('ZaloBot', `Could not save session: ${err.message}`);
      }

      // Setup actions & commands
      this.actions = new ZaloActions(this.api, ThreadType, Reactions);
      this.commands = new ZaloCommands(this.actions);

      // Setup listeners
      this.listener = this.api.listener;
      this._setupListeners(ThreadType);
      this.listener.start();

      // Keep-alive ping every 5 minutes
      this._keepAliveInterval = setInterval(() => {
        try {
          this.api.keepAlive?.();
        } catch (err) {
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
      // Skip own messages
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

      try {
        await this.commands.handleMessage(message, { isGroup });
      } catch (err) {
        logger.error('ZaloBot', `Message handler error: ${err.message}`);
      }
    });

    // ─── Group event listener ──────────────────────
    this.listener.on('group_event', async (event) => {
      logger.info('ZaloBot', `📋 Group event: ${JSON.stringify(event).slice(0, 100)}`);
    });

    // ─── Reaction listener ─────────────────────────
    this.listener.on('reaction', async (reaction) => {
      logger.info('ZaloBot', `💗 Reaction received: ${JSON.stringify(reaction).slice(0, 100)}`);
    });
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
