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
  constructor(actions, { messageStore, userCache } = {}) {
    this.actions = actions;
    this.messageStore = messageStore;
    this.userCache = userCache;
  }

  // Extract text from Zalo message content (string, object, or link)
  _extractText(content) {
    if (!content) return null;
    if (typeof content === 'string') return content.trim();

    if (typeof content === 'object') {
      if (content.href) return content.href;
      if (content.url) return content.url;
      if (content.msg && typeof content.msg === 'string') return content.msg.trim();
      if (content.text && typeof content.text === 'string') return content.text.trim();
      if (content.content && typeof content.content === 'string') return content.content.trim();

      const str = JSON.stringify(content);
      const urlMatch = str.match(/(https?:\/\/[^\s"',}]+shopee[^\s"',}]*)/i);
      if (urlMatch) return urlMatch[1];

      logger.warn('ZaloCommands', `Unknown content format: ${str.slice(0, 150)}`);
      return null;
    }
    return null;
  }

  _extractShopeeUrl(text) {
    const match = text.match(/(https?:\/\/[^\s]*shopee[^\s]*)/i);
    return match ? match[1] : null;
  }

  async handleMessage(message, { isGroup = false, msgId = null } = {}) {
    const rawContent = message.data?.content;
    const text = this._extractText(rawContent);
    if (!text) return;

    const startTime = Date.now();
    logger.info('ZaloCommands', `Parsed text: "${text.slice(0, 80)}" [${isGroup ? 'Group' : 'DM'}]`);

    // Mark processing in store
    if (msgId && this.messageStore) {
      this.messageStore.markProcessing(msgId);
    }

    try {
      let replyText = null;

      // ─── Command routing ──────────────────────────
      if (text === '/help') {
        replyText = HELP_TEXT;
        await this.actions.humanReply(message, replyText, { react: false });
      } else if (text === '/status') {
        replyText = await this._buildStatusText();
        await this.actions.humanReply(message, replyText, { react: false });
      } else if (text.startsWith('/search ')) {
        const keyword = text.slice(8).trim();
        if (!keyword) {
          replyText = '⚠️ Vui lòng nhập tên sản phẩm.\nVí dụ: /search Bông mút rửa mặt';
          await this.actions.humanReply(message, replyText, { react: false });
        } else {
          replyText = await this._handleSearch(message, keyword);
        }
      } else if (text.startsWith('/link ')) {
        const parts = text.slice(6).trim().split(/\s+/);
        const url = parts[0];
        if (!url) {
          replyText = '⚠️ Vui lòng nhập URL.\nVí dụ: /link https://shopee.vn/product/...';
          await this.actions.humanReply(message, replyText, { react: false });
        } else {
          replyText = await this._handleLink(message, url, { subId1: parts[1] || '', subId2: parts[2] || '' });
        }
      } else {
        // Auto-detect Shopee link
        const detectedUrl = this._extractShopeeUrl(text);
        if (detectedUrl) {
          replyText = await this._handleLink(message, detectedUrl, {});
        } else if (text.startsWith('/')) {
          replyText = `❓ Lệnh không hợp lệ: ${text.split(' ')[0]}\nGõ /help để xem danh sách lệnh.`;
          await this.actions.humanReply(message, replyText, { react: false });
        } else if (isGroup) {
          // Skip generic text in groups
          if (msgId && this.messageStore) this.messageStore.markSkipped(msgId);
          return;
        } else {
          replyText = GENERIC_REPLY;
          await this.actions.humanReply(message, replyText, { react: false });
        }
      }

      // Mark replied in store
      const elapsed = Date.now() - startTime;
      if (msgId && this.messageStore && replyText) {
        this.messageStore.markReplied(msgId, replyText, elapsed);
      }

    } catch (err) {
      logger.error('ZaloCommands', `Error handling message: ${err.message}`);
      const elapsed = Date.now() - startTime;
      if (msgId && this.messageStore) {
        this.messageStore.markFailed(msgId, err.message, elapsed);
      }
      try {
        await this.actions.sendText(`❌ Lỗi xử lý: ${err.message}`, message.threadId, message.type);
      } catch {}
    }
  }

  async handleNewFriend(userId) {
    const name = await this.actions.getDisplayName(userId);
    logger.info('ZaloCommands', `New friend: ${name} (${userId})`);
    await this.actions.sendText(WELCOME_NEW_FRIEND(name), userId);
  }

  // ─── Individual handlers ────────────────────────────

  async _buildStatusText() {
    const extConnected = !!ShopeeAPI.sendToExtension;
    const icon = extConnected ? '🟢' : '🔴';
    let status = `📊 Trạng thái hệ thống\n\n`;
    status += `${icon} Extension: ${extConnected ? 'Đã kết nối' : 'Chưa kết nối'}\n`;
    status += `🤖 Zalo Bot: 🟢 Online\n`;
    status += `📨 Hàng đợi: ${this.actions.limiter.pending} tin nhắn\n`;
    if (this.messageStore) {
      const stats = this.messageStore.getStats();
      status += `\n📈 Thống kê hôm nay:\n`;
      status += `  Tổng tin: ${stats.today.total}\n`;
      status += `  Đã xử lý: ${stats.today.replied}\n`;
      status += `  Thất bại: ${stats.today.failed}\n`;
      status += `  TB phản hồi: ${stats.today.avg_response_ms || '--'}ms\n`;
    }
    return status;
  }

  async _handleSearch(message, keyword) {
    const senderName = await this.actions.getDisplayName(message.data?.uidFrom || message.threadId);
    logger.info('ZaloCommands', `[${senderName}] Search: "${keyword}"`);

    this.actions.markSeen(message.threadId, message.type);
    this.actions.reactLike(message);

    const [, result] = await Promise.all([
      this.actions.showTyping(message.threadId, message.type, 300),
      shopee.searchProduct(keyword),
    ]);

    if (!result.success) {
      const errText = `❌ Lỗi tìm kiếm: ${result.error}\n\n💡 Kiểm tra tab Shopee Affiliate và Extension đã kết nối.`;
      await this.actions.sendText(errText, message.threadId, message.type);
      return errText;
    }

    if (!result.items || result.items.length === 0) {
      const noResult = `🔍 Không tìm thấy sản phẩm nào cho: "${keyword}"`;
      await this.actions.sendText(noResult, message.threadId, message.type);
      return noResult;
    }

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

    await this.actions.sendText(reply, message.threadId, message.type);
    return reply;
  }

  async _handleLink(message, url, subIds) {
    const senderName = await this.actions.getDisplayName(message.data?.uidFrom || message.threadId);
    const parsed = shopee.parseShopeeLink(url);
    if (!parsed) {
      const errText = '⚠️ URL không phải link Shopee hợp lệ.\nHỗ trợ: shopee.vn/product/..., s.shopee.vn/..., shopee.vn/ten-sp-i.xxx.xxx';
      await this.actions.humanReply(message, errText, { react: false });
      return errText;
    }

    logger.info('ZaloCommands', `[${senderName}] Convert link: ${url.slice(0, 60)}...`);

    this.actions.markSeen(message.threadId, message.type);
    this.actions.reactHeart(message);

    const [, result] = await Promise.all([
      this.actions.showTyping(message.threadId, message.type, 400),
      shopee.convertLink(url, subIds),
    ]);

    if (!result.success) {
      const errText = `❌ Lỗi tạo affiliate link: ${result.error}`;
      await this.actions.sendText(errText, message.threadId, message.type);
      return errText;
    }

    const replyText = `✅ Affiliate link:\n🔗 ${result.shortLink}`;
    await this.actions.sendText(replyText, message.threadId, message.type);
    return replyText;
  }
}

module.exports = ZaloCommands;
