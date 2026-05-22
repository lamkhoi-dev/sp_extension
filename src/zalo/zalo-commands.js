const logger = require('../logger');
const ShopeeAPI = require('../shopee-api');
const convertLogStore = require('../api/convert-log-store');
const reportGenerator = require('../stats/report-generator');
const reportStore = require('../stats/report-store');
const { sendMail } = require('../utils/mailer');
const linkRedirectStore = require('../api/link-redirect-store');


const shopee = new ShopeeAPI();

function formatVND(val) {
  if (!val && val !== 0) return '0đ';
  return new Intl.NumberFormat('vi-VN').format(Math.round(val)) + 'đ';
}

const HELP_TEXT = `🤖 Shopee Affiliate Bot

Xin chào! Gửi link Shopee hoặc tên sản phẩm, tôi sẽ tạo affiliate link cho bạn.

📌 Các lệnh:
/link <URL shopee> — Tạo affiliate link
/link <URL> <sub_id> — Tạo link có Sub ID
/search <tên SP> — Tìm sản phẩm
/thongke — Xem thống kê cá nhân (chat riêng)
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

  // Extract product name hint from Zalo link preview description
  // Zalo sends: {"description":"Mua {PRODUCT NAME} giá tốt..."}
  _extractProductHint(content) {
    if (!content || typeof content !== 'object') return null;
    const desc = content.description || content.desc;
    if (!desc || typeof desc !== 'string') return null;
    // Format: "Mua {product name} giá t..." → extract product name
    const match = desc.match(/^Mua\s+(.+?)\s+giá/i);
    if (match) {
      logger.info('ZaloCommands', `Product hint from Zalo preview: "${match[1].slice(0, 50)}"`);
      return match[1].trim();
    }
    // Fallback: use full description as hint (trim common prefixes)
    return desc.replace(/^Mua\s+/i, '').slice(0, 100).trim() || null;
  }

  _extractShopeeUrl(text) {
    const match = text.match(/(https?:\/\/[^\s]*(?:shopee|shp\.ee)[^\s]*)/i);
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
      await this.messageStore.markProcessing(msgId);
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
      } else if (text === '/thongke') {
        if (isGroup) {
          replyText = '⚠️ Lệnh /thongke chỉ dùng trong tin nhắn riêng.';
          await this.actions.humanReply(message, replyText, { react: false });
        } else {
          replyText = await this._handleThongke(message);
        }
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
          // Extract product name hint from Zalo link preview
          const productHint = this._extractProductHint(rawContent);
          replyText = await this._handleLink(message, detectedUrl, {}, productHint);
        } else if (text.startsWith('/')) {
          replyText = `❓ Lệnh không hợp lệ: ${text.split(' ')[0]}\nGõ /help để xem danh sách lệnh.`;
          await this.actions.humanReply(message, replyText, { react: false });
        } else if (isGroup) {
          // Skip generic text in groups
          if (msgId && this.messageStore) await this.messageStore.markSkipped(msgId);
          return;
        } else {
          replyText = GENERIC_REPLY;
          await this.actions.humanReply(message, replyText, { react: false });
        }
      }

      // Mark replied in store
      const elapsed = Date.now() - startTime;
      if (msgId && this.messageStore && replyText) {
        await this.messageStore.markReplied(msgId, replyText, elapsed);
      }

    } catch (err) {
      logger.error('ZaloCommands', `Error handling message: ${err.message}`);
      const elapsed = Date.now() - startTime;
      if (msgId && this.messageStore) {
        await this.messageStore.markFailed(msgId, err.message, elapsed);
      }
      // Send error log to administrator emails via sendMail
      const emails = process.env.NOTIFY_EMAILS;
      if (emails) {
        const subject = `[Lỗi Hệ Thống] Bot Shopee Affiliate - ${message.data?.fromUid || message.data?.uidFrom || 'Unknown'}`;
        const mailBody = `Thông tin lỗi xử lý tin nhắn:
- User ID: ${message.data?.fromUid || message.data?.uidFrom || 'Unknown'}
- Nội dung tin nhắn: ${text || 'N/A'}
- Lỗi chi tiết: ${err.stack || err.message}
- Thời gian: ${new Date().toLocaleString('vi-VN')}`;
        sendMail(emails, subject, mailBody).catch(e => logger.error(`[Mailer] Error notifying error: ${e.message}`));
      }
      try {
        await this.actions.sendText(`Hệ thống hiện tại đang quá tải, vui lòng thử lại sau ít phút`, message.threadId, message.type);
      } catch {}
    }
  }

  async handleNewFriend(userId) {
    const name = await this.actions.getDisplayName(userId);
    logger.info('ZaloCommands', `New friend: ${name} (${userId})`);
    await this.actions.sendText(WELCOME_NEW_FRIEND(name), userId);
  }

  // ─── Individual handlers ────────────────────────────

  async _handleThongke(message) {
    const senderUid = message.data?.uidFrom || message.data?.fromUid;
    if (!senderUid) {
      await this.actions.humanReply(message, '❌ Không xác định được user.', { react: false });
      return '❌ Không xác định được user.';
    }

    try {
      await this.actions.humanReply(message, '⏳ Đang tạo thống kê...', { react: false });

      const data = await reportGenerator.generateReport(senderUid);
      const token = await reportStore.createReport(senderUid, data);

      const serverUrl = process.env.SERVER_URL || 'http://localhost:3456';
      const reportUrl = `${serverUrl}/s/${token}`;

      const replyText = `📊 Thống kê của bạn:\n\n` +
        `👤 ${data.user.displayName}\n` +
        `💰 Tổng hoa hồng: ${formatVND(data.summary.totalNetCommission)}\n` +
        `✅ Đã hoàn: ${formatVND(data.summary.totalPaid)}\n` +
        `⏳ Chờ hoàn: ${formatVND(data.summary.pendingPayment)}\n` +
        `📦 ${data.summary.totalOrders} đơn • ${data.summary.totalLinks} link\n\n` +
        `🔗 Xem chi tiết:\n${reportUrl}\n\n` +
        `⏰ Link có hiệu lực 24 giờ`;

      await this.actions.humanReply(message, replyText, { react: false });
      return replyText;
    } catch (err) {
      logger.error('ZaloCommands', `Thongke failed for ${senderUid}: ${err.message}`);
      const errText = '❌ Không thể tạo thống kê. Vui lòng thử lại sau.';
      await this.actions.humanReply(message, errText, { react: false });
      return errText;
    }
  }

  async _buildStatusText() {
    const mode = process.env.LINK_MODE || 'direct';
    const extConnected = !!ShopeeAPI.sendToExtension;
    let icon, extStatus;
    if (mode === 'direct') {
      icon = '🟢';
      extStatus = 'Direct Mode (headless)';
    } else {
      icon = extConnected ? '🟢' : '🔴';
      extStatus = extConnected ? 'Đã kết nối' : 'Chưa kết nối';
    }
    let status = `📊 Trạng thái hệ thống\n\n`;
    status += `🔧 Mode: ${mode.toUpperCase()}\n`;
    status += `${icon} Extension: ${extStatus}\n`;
    status += `🤖 Zalo Bot: 🟢 Online\n`;
    status += `📨 Hàng đợi: ${this.actions.limiter.pending} tin nhắn\n`;
    if (this.messageStore) {
      const stats = await this.messageStore.getStats();
      status += `\n📈 Thống kê hôm nay:\n`;
      status += `  Tổng tin: ${stats.today?.total || 0}\n`;
      status += `  Đã xử lý: ${stats.today?.replied || 0}\n`;
      status += `  Thất bại: ${stats.today?.failed || 0}\n`;
      status += `  TB phản hồi: ${stats.today?.avg_response_ms || '--'}ms\n`;
    }
    return status;
  }

  async _handleSearch(message, keyword) {
    const senderName = await this.actions.getDisplayName(message.data?.uidFrom || message.threadId);
    logger.info('ZaloCommands', `[${senderName}] Search: "${keyword}"`);

    this.actions.markSeen(message.threadId, message.type);
    this.actions.reactLike(message);
    this.actions.fireTyping(message.threadId, message.type);

    const result = await shopee.searchProduct(keyword);

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

  async _handleLink(message, url, subIds, productHint = null) {
    const senderUid = message.data?.uidFrom || message.threadId;
    const senderName = await this.actions.getDisplayName(senderUid);
    const parsed = shopee.parseShopeeLink(url);
    if (!parsed) {
      const errText = '⚠️ URL không phải link Shopee hợp lệ.\nHỗ trợ: shopee.vn/product/..., s.shopee.vn/..., shopee.vn/ten-sp-i.xxx.xxx';
      await this.actions.humanReply(message, errText, { react: false });
      return errText;
    }

    logger.info('ZaloCommands', `[${senderName}] Check & Convert: ${url.slice(0, 60)}...`);

    this.actions.markSeen(message.threadId, message.type);
    this.actions.reactHeart(message);
    this.actions.fireTyping(message.threadId, message.type);

    // Build SubIDs: sub1=buyer, sub2=referrer, sub3=commission rate
    try {
      const referrer = await this.userCache?.getReferrer?.(senderUid);
      const enrichedSubIds = {
        sub1: senderUid,
        sub2: referrer?.referrerId || subIds.subId2 || '',
        sub3: subIds.subId3 || '',
        ...subIds,
      };

      const result = await shopee.checkAndConvert(url, enrichedSubIds, productHint);

      // No commission
      if (result.noCommission) {
        await convertLogStore.save({
          userId: senderUid, userName: senderName,
          originalLink: url, status: 'no_commission',
          subId1: senderUid, subId2: enrichedSubIds.sub2,
        });
        const noCommText = '❌ Sản phẩm không có hoàn tiền.';
        await this.actions.sendText(noCommText, message.threadId, message.type);
        return noCommText;
      }

      // Error
      if (!result.success) {
        await convertLogStore.save({
          userId: senderUid, userName: senderName,
          originalLink: url, status: 'error', errorMessage: result.error,
          subId1: senderUid, subId2: enrichedSubIds.sub2,
        });

        // Send error log to administrator emails via sendMail
        const emails = process.env.NOTIFY_EMAILS;
        if (emails) {
          const subject = `[Lỗi Hệ Thống] Bot Shopee Affiliate - ${senderName || senderUid}`;
          const mailBody = `Thông tin lỗi convert link Shopee:
- User: ${senderName} (ID: ${senderUid})
- Link gốc: ${url}
- Lỗi chi tiết: ${result.error}
- Thời gian: ${new Date().toLocaleString('vi-VN')}`;
          sendMail(emails, subject, mailBody).catch(e => logger.error(`[Mailer] Error notifying error: ${e.message}`));
        }

        const errText = `Hệ thống hiện tại đang quá tải, vui lòng thử lại sau ít phút`;
        await this.actions.sendText(errText, message.threadId, message.type);
        return errText;
      }

      // Save convert log first to get the ID
      const parsedIds = shopee.parseShopeeLink(result.originalLink || url);
      const logId = await convertLogStore.save({
        userId: senderUid,
        userName: senderName,
        originalLink: url,
        affiliateLink: result.longLink || result.affiliateLink || '',
        shortLink: result.shortLink || result.affiliateLink || '',
        productName: result.productName || '',
        commissionRate: result.commission || 0,
        commissionAmount: result.commissionAmount || 0,
        price: result.price || 0,
        source: result.source || 'shopee',
        subId1: senderUid,
        subId2: enrichedSubIds.sub2,
        subId3: String(result.commission || ''),
        status: 'success',
        itemId: result.itemId || parsedIds?.itemId || '',
        shopId: result.shopId || parsedIds?.shopId || '',
      });

      // Build short redirect link (if SERVER_URL is configured)
      const serverUrl = process.env.SERVER_URL || '';
      let linkToShow = result.shortLink || result.affiliateLink;
      if (serverUrl && (result.longLink || result.affiliateLink)) {
        try {
          const affiliateLink = result.longLink || result.affiliateLink;
          const { token, shortUrl } = await linkRedirectStore.create({
            affiliateLink,
            userId: senderUid,
            userName: senderName,
            itemId: result.itemId || parsedIds?.itemId || '',
            productName: result.productName || '',
            convertLogId: logId || null,
          });
          linkToShow = shortUrl;
          // Back-link token → convert_log (admin-only, non-blocking)
          if (logId && token) {
            setImmediate(() => {
              convertLogStore.updateRedirectToken(logId, token).catch(() => {});
            });
          }
        } catch (redirectErr) {
          logger.warn('ZaloCommands', `Short link creation failed, using original: ${redirectErr.message}`);
          // fallback — keep linkToShow as-is
        }
      }

      // Build reply with @mention
      const mentionTag = `@${senderName}`;
      let commissionText = `${result.commission}%`;
      if (result.commissionAmount > 0) {
        commissionText += ` (~${new Intl.NumberFormat('vi-VN').format(result.commissionAmount)}đ)`;
      }
      const msg = `✅ ${mentionTag}\n🔗 ${linkToShow}\n🏷️ Hoa hồng: ${commissionText}`;

      const msgContent = {
        msg,
        mentions: [{
          pos: 2, // after "✅ "
          uid: senderUid,
          len: mentionTag.length,
        }],
      };

      await this.actions.sendStyled(msgContent, message.threadId, message.type);
      return msg;
    } catch (err) {
      logger.error('ZaloCommands', `Error converting link for ${senderUid}: ${err.message}`);
      
      await convertLogStore.save({
        userId: senderUid, userName: senderName,
        originalLink: url, status: 'error', errorMessage: err.message,
        subId1: senderUid,
      }).catch(e => logger.error(`[DB] Error saving error log: ${e.message}`));

      // Send error log to administrator emails via sendMail
      const emails = process.env.NOTIFY_EMAILS;
      if (emails) {
        const subject = `[Lỗi Hệ Thống] Bot Shopee Affiliate - ${senderName || senderUid}`;
        const mailBody = `Thông tin lỗi convert link Shopee (Exception):
- User: ${senderName} (ID: ${senderUid})
- Link gốc: ${url}
- Lỗi chi tiết: ${err.stack || err.message}
- Thời gian: ${new Date().toLocaleString('vi-VN')}`;
        sendMail(emails, subject, mailBody).catch(e => logger.error(`[Mailer] Error notifying error: ${e.message}`));
      }

      const errText = `Hệ thống hiện tại đang quá tải, vui lòng thử lại sau ít phút`;
      await this.actions.sendText(errText, message.threadId, message.type);
      return errText;
    }
  }
}

module.exports = ZaloCommands;
