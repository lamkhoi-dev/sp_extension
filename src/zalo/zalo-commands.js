const logger = require('../logger');
const ShopeeAPI = require('../shopee-api');

const shopee = new ShopeeAPI();

const HELP_TEXT = `🤖 Shopee Affiliate Bot

Xin chào! Gửi link Shopee hoặc tên sản phẩm, tôi sẽ tạo affiliate link cho bạn.

📌 Các lệnh:
/link <URL shopee> — Tạo affiliate link
/link <URL> <sub_id> — Tạo link có Sub ID
/search <tên SP> — Tìm sản phẩm
/status — Xem trạng thái hệ thống
/help — Hiển thị hướng dẫn

💡 Ví dụ:
/search Bông mút rửa mặt
/link https://shopee.vn/product/1391725226/26326757902
/link https://s.shopee.vn/qfmqIMWXN tele_bot`;

const WELCOME_NEW_FRIEND = (name) =>
  `👋 Chào ${name}!\n\nCảm ơn bạn đã kết bạn. Tôi là bot tạo affiliate link Shopee tự động.\n\nGõ /help để xem hướng dẫn nhé!`;

const GENERIC_REPLY = `💡 Gửi /help để xem hướng dẫn sử dụng bot.\n\nHoặc gửi trực tiếp link Shopee để lấy affiliate link nhé!`;

class ZaloCommands {
  constructor(actions) {
    this.actions = actions;
  }

  // Extract text from Zalo message content (can be string, object, or link)
  _extractText(content) {
    if (!content) return null;

    // Plain text message
    if (typeof content === 'string') return content.trim();

    // Object content — Zalo wraps URLs and rich content as objects
    if (typeof content === 'object') {
      // Link message: { href: "...", params: {...} }
      if (content.href) return content.href;
      
      // Some formats use 'url'
      if (content.url) return content.url;

      // Message with msg property: { msg: "text", ... }
      if (content.msg && typeof content.msg === 'string') return content.msg.trim();

      // Content with text property
      if (content.text && typeof content.text === 'string') return content.text.trim();

      // Content with content property (nested)
      if (content.content && typeof content.content === 'string') return content.content.trim();

      // Stringify and try to find URLs
      const str = JSON.stringify(content);
      const urlMatch = str.match(/(https?:\/\/[^\s"',}]+shopee[^\s"',}]*)/i);
      if (urlMatch) return urlMatch[1];

      logger.warn('ZaloCommands', `Unknown content format: ${str.slice(0, 150)}`);
      return null;
    }

    return null;
  }

  // Detect if raw text contains a Shopee link (auto-detect without /link prefix)
  _extractShopeeUrl(text) {
    const match = text.match(/(https?:\/\/[^\s]*shopee[^\s]*)/i);
    return match ? match[1] : null;
  }

  async handleMessage(message, { isGroup = false } = {}) {
    const rawContent = message.data?.content;
    
    // Extract text from different content types
    const text = this._extractText(rawContent);
    if (!text) return;

    logger.info('ZaloCommands', `Parsed text: "${text.slice(0, 80)}" [${isGroup ? 'Group' : 'DM'}]`);

    try {
      // ─── Command routing ──────────────────────────
      if (text === '/help') {
        return this._replyHelp(message);
      }

      if (text === '/status') {
        return this._replyStatus(message);
      }

      if (text.startsWith('/search ')) {
        const keyword = text.slice(8).trim();
        if (!keyword) {
          return this.actions.humanReply(message, '⚠️ Vui lòng nhập tên sản phẩm.\nVí dụ: /search Bông mút rửa mặt', { react: false });
        }
        return this._handleSearch(message, keyword);
      }

      if (text.startsWith('/link ')) {
        const parts = text.slice(6).trim().split(/\s+/);
        const url = parts[0];
        const subId1 = parts[1] || '';
        const subId2 = parts[2] || '';
        if (!url) {
          return this.actions.humanReply(message, '⚠️ Vui lòng nhập URL.\nVí dụ: /link https://shopee.vn/product/...', { react: false });
        }
        return this._handleLink(message, url, { subId1, subId2 });
      }

      // ─── Auto-detect Shopee link in plain text ────
      const detectedUrl = this._extractShopeeUrl(text);
      if (detectedUrl) {
        return this._handleLink(message, detectedUrl, {});
      }

      // ─── Unknown /command ──────────────────────────
      if (text.startsWith('/')) {
        return this.actions.humanReply(
          message,
          `❓ Lệnh không hợp lệ: ${text.split(' ')[0]}\nGõ /help để xem danh sách lệnh.`,
          { react: false }
        );
      }

      // ─── Generic text ──────────────────────────────
      // In GROUPS: ignore generic text (don't spam)
      // In DMs: reply with guide
      if (isGroup) return;
      return this.actions.humanReply(message, GENERIC_REPLY, { react: false });

    } catch (err) {
      logger.error('ZaloCommands', `Error handling message: ${err.message}`);
      await this.actions.sendText(`❌ Lỗi xử lý: ${err.message}`, message.threadId, message.type);
    }
  }

  async handleNewFriend(userId) {
    const name = await this.actions.getDisplayName(userId);
    logger.info('ZaloCommands', `New friend: ${name} (${userId})`);
    // Send welcome via DM (ThreadType.User is default)
    await this.actions.sendText(WELCOME_NEW_FRIEND(name), userId);
  }

  // ─── Individual handlers ────────────────────────────

  async _replyHelp(message) {
    await this.actions.humanReply(message, HELP_TEXT, { react: false, quote: false });
  }

  async _replyStatus(message) {
    const extConnected = !!ShopeeAPI.sendToExtension;
    const icon = extConnected ? '🟢' : '🔴';

    let status = `📊 Trạng thái hệ thống\n\n`;
    status += `${icon} Extension: ${extConnected ? 'Đã kết nối' : 'Chưa kết nối'}\n`;
    status += `🤖 Zalo Bot: 🟢 Online\n`;
    status += `📨 Hàng đợi: ${this.actions.limiter.pending} tin nhắn\n`;

    await this.actions.humanReply(message, status, { react: false });
  }

  async _handleSearch(message, keyword) {
    const senderName = await this.actions.getDisplayName(message.data?.uidFrom || message.threadId);
    logger.info('ZaloCommands', `[${senderName}] Search: "${keyword}"`);

    // Fire-and-forget: seen + react (instant, no blocking)
    this.actions.markSeen(message.threadId, message.type);
    this.actions.reactLike(message);

    // Run typing + Shopee search IN PARALLEL
    const [, result] = await Promise.all([
      this.actions.showTyping(message.threadId, message.type, 1000),
      shopee.searchProduct(keyword),
    ]);

    if (!result.success) {
      return this.actions.sendText(
        `❌ Lỗi tìm kiếm: ${result.error}\n\n💡 Kiểm tra tab Shopee Affiliate và Extension đã kết nối.`,
        message.threadId, message.type
      );
    }

    if (!result.items || result.items.length === 0) {
      return this.actions.sendText(
        `🔍 Không tìm thấy sản phẩm nào cho: "${keyword}"`,
        message.threadId, message.type
      );
    }

    // Format top results
    let reply = `🔍 Kết quả cho "${keyword}" (${result.totalCount} sản phẩm):\n\n`;
    const items = result.items.slice(0, 5);
    items.forEach((item, i) => {
      reply += `${i + 1}. ${item.name || item.title || 'Sản phẩm'}\n`;
      if (item.price) reply += `   💰 ${item.price}\n`;
      if (item.commission) reply += `   🏷️ Hoa hồng: ${item.commission}\n`;
      if (item.url || item.link) reply += `   🔗 ${item.url || item.link}\n`;
      reply += '\n';
    });
    reply += `💡 Gửi /link <URL> để tạo affiliate link.`;

    return this.actions.sendText(reply, message.threadId, message.type);
  }

  async _handleLink(message, url, subIds) {
    const senderName = await this.actions.getDisplayName(message.data?.uidFrom || message.threadId);

    // Validate it's a Shopee URL
    const parsed = shopee.parseShopeeLink(url);
    if (!parsed) {
      return this.actions.humanReply(message,
        '⚠️ URL không phải link Shopee hợp lệ.\nHỗ trợ: shopee.vn/product/..., s.shopee.vn/..., shopee.vn/ten-sp-i.xxx.xxx',
        { react: false }
      );
    }

    logger.info('ZaloCommands', `[${senderName}] Convert link: ${url.slice(0, 60)}...`);

    // Fire-and-forget: seen + react (instant)
    this.actions.markSeen(message.threadId, message.type);
    this.actions.reactHeart(message);

    // Run typing + link conversion IN PARALLEL
    const [, result] = await Promise.all([
      this.actions.showTyping(message.threadId, message.type, 1500),
      shopee.convertLink(url, subIds),
    ]);

    if (!result.success) {
      return this.actions.sendText(
        `❌ Lỗi tạo affiliate link: ${result.error}`,
        message.threadId, message.type
      );
    }

    // Send affiliate link (single message, no extra sendLink)
    const replyText = `✅ Affiliate link:\n🔗 ${result.shortLink}`;
    return this.actions.sendText(replyText, message.threadId, message.type);
  }
}

module.exports = ZaloCommands;
