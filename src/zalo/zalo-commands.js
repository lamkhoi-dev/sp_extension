const logger = require('../logger');
const ShopeeAPI = require('../shopee-api');
const convertLogStore = require('../api/convert-log-store');
const reportGenerator = require('../stats/report-generator');
const reportStore = require('../stats/report-store');
const { sendMail } = require('../utils/mailer');
const linkRedirectStore = require('../api/link-redirect-store');
const withdrawalStore = require('../api/withdrawal-store');
const commissionRatesStore = require('../api/commission-rates-store');


const shopee = new ShopeeAPI();

function formatVND(val) {
  if (!val && val !== 0) return '0đ';
  return new Intl.NumberFormat('vi-VN').format(Math.round(val)) + 'đ';
}

const HELP_TEXT = `🤖 Shopee Affiliate Bot

Chào mừng bạn đến với hệ thống quản lý Affiliate!

/thongke
Tra cứu báo cáo đơn hàng, doanh thu và hoa hồng theo thời gian thực.

/ruttien
Gửi yêu cầu rút hoa hồng và theo dõi doanh thu tích lũy.

━━━━━━━━━━━━━━━

🏆 Bảng xếp hạng thành viên
https://cashback-shopee.vercel.app/ranking.html

📈 Báo cáo thống kê đơn hàng
https://cashback-shopee.vercel.app/baocao.html

✨ Theo dõi hiệu suất bán hàng và tối ưu thu nhập Affiliate của bạn mỗi ngày!`;

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
      } else if (text === '/ruttien' || text.startsWith('/ruttien ')) {
        if (isGroup) {
          replyText = '⚠️ Lệnh /ruttien chỉ dùng trong tin nhắn riêng để bảo mật thông tin tài khoản.';
          await this.actions.humanReply(message, replyText, { react: false });
        } else {
          replyText = await this._handleRuttien(message, text);
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
      } else if (text.startsWith('/custom')) {
        if (isGroup) {
          replyText = '⚠️ Lệnh /custom chỉ dùng trong tin nhắn riêng.';
          await this.actions.humanReply(message, replyText, { react: false });
        } else {
          replyText = await this._handleCustom(message, text);
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

      const s = data.summary;
      const isCustom = data.user.isCustomMode;
      const f0Rate = data.user.f0Rate;
      const rates = data.rates;

      // ─ Buyer block (luôn show) ─
      const buyerBlock = `🛒 Mua hàng (${isCustom ? 'Custom' : 'F0'} ${f0Rate}%)
   Đơn: ${s.totalOrders} • Raw: ${formatVND(s.totalNetCommission)}
   Bạn nhận: ${formatVND(s.totalBuyerCashback)}
   Đã trả: ${formatVND(s.totalPaidAsBuyer)}
   Chờ trả: ${formatVND(s.pendingBuyerPayment)}`;

      // ─ Referrer block (chỉ show nếu có downline) ─
      const referrerBlock = (s.ctvCount > 0)
        ? `\n\n👥 Thu nhập từ CTV (${s.ctvCount} F1 trực tiếp)
   F1 (×${rates.f1}%): ${formatVND(s.totalF1Earnings)}
   F2 (×${rates.f2}%): ${formatVND(s.totalF2Earnings)}
   F3 (×${rates.f3}%): ${formatVND(s.totalF3Earnings)}
   Tổng: ${formatVND(s.totalReferrerEarnings)}`
        : '';

      // ─ Custom block (chỉ show nếu có) ─
      const customBlock = s.hasCustomOrders
        ? `\n\n🎯 Đơn Custom (F1 — bạn gửi cho khách)
   Tỷ lệ ${s.customRate}% • ${s.totalCustomOrders} đơn • ${s.uniqueF2Count} khách
   Bạn nhận: ${formatVND(s.totalCustomCashback)}
   Đã trả: ${formatVND(s.totalCustomPaid)}
   Chờ trả: ${formatVND(s.pendingCustomPayment)}`
        : '';

      const replyText =
`📊 Thống kê — ${data.user.displayName}

${buyerBlock}${referrerBlock}${customBlock}

🔗 Chi tiết & sơ đồ CTV:
${reportUrl}

⏰ Link hiệu lực 24 giờ`;

      await this.actions.humanReply(message, replyText, { react: false });
      return replyText;
    } catch (err) {
      logger.error('ZaloCommands', `Thongke failed for ${senderUid}: ${err.message}`);
      const errText = '❌ Không thể tạo thống kê. Vui lòng thử lại sau.';
      await this.actions.humanReply(message, errText, { react: false });
      return errText;
    }
  }

  async _handleRuttien(message, text) {
    const senderUid = message.data?.uidFrom || message.data?.fromUid;
    if (!senderUid) {
      const errText = '❌ Không xác định được user.';
      await this.actions.humanReply(message, errText, { react: false });
      return errText;
    }

    const senderName = await this.actions.getDisplayName(senderUid);
    const parsed = withdrawalStore.parseRuttienArgs(text);

    // ─── Handle parse errors ─────────────────────────
    if (parsed.ok === false) {
      const guide = this._buildRuttienGuide();
      let errLine;
      switch (parsed.error) {
        case 'syntax':
          errLine = '⚠️ Cú pháp chưa đủ. Cần 3 phần: ngân hàng, số TK, tên chủ TK.';
          break;
        case 'unknown_bank':
          errLine = `⚠️ Không nhận diện được ngân hàng "${parsed.value}". Vui lòng dùng mã ở danh sách bên dưới.`;
          break;
        case 'bad_account':
          errLine = '⚠️ Số tài khoản không hợp lệ (chỉ gồm chữ số).';
          break;
        case 'bad_holder':
          errLine = '⚠️ Tên chủ tài khoản quá ngắn. Vui lòng nhập đầy đủ.';
          break;
        default:
          errLine = '⚠️ Lệnh không hợp lệ.';
      }
      const errText = `${errLine}\n\n${guide}`;
      await this.actions.humanReply(message, errText, { react: false });
      return errText;
    }

    try {
      // ─── Check existing pending request ──────────────
      const existing = await withdrawalStore.getActivePendingByUser(senderUid);
      if (existing) {
        const requestedAt = existing.requested_at
          ? new Date(existing.requested_at).toLocaleString('vi-VN')
          : '--';
        const existsText = `⏳ Bạn đã có yêu cầu rút tiền đang chờ xử lý:

💰 Số tiền: ${formatVND(existing.amount)}
🏦 ${withdrawalStore.bankDisplayName(existing.bank_name)} • ${existing.bank_account}
👤 ${existing.account_holder || '--'}
📅 Gửi lúc: ${requestedAt}

Hệ thống sẽ thanh toán trong thời gian sớm nhất. Vui lòng đợi nhé!`;
        await this.actions.humanReply(message, existsText, { react: false });
        return existsText;
      }

      // ─── Resolve bank info (from args or stored) ─────
      let bankCode, accountNumber, accountHolder;
      let bankInfoSource;
      if (parsed.ok === true) {
        // User provided new info → update users table
        bankCode = parsed.bankCode;
        accountNumber = parsed.accountNumber;
        accountHolder = parsed.accountHolder;
        await withdrawalStore.updateUserBankInfo(senderUid, { bankCode, accountNumber, accountHolder });
        bankInfoSource = 'new';
      } else {
        // parsed.ok === 'no_args' — load from DB
        const info = await withdrawalStore.getUserBankInfo(senderUid);
        if (!info || !info.bank_name || !info.bank_account) {
          const guide = this._buildRuttienGuide();
          const noInfoText = `💳 Đăng ký rút tiền\n\nBạn chưa có thông tin tài khoản ngân hàng.\n\n${guide}`;
          await this.actions.humanReply(message, noInfoText, { react: false });
          return noInfoText;
        }
        bankCode = info.bank_name;
        accountNumber = info.bank_account;
        accountHolder = info.bank_account_holder || info.display_name || info.zalo_name || senderName;
        bankInfoSource = 'stored';
      }

      // ─── Compute withdrawable amount ─────────────────
      const pending = await withdrawalStore.computeUserPending(senderUid);
      if (pending.total <= 0) {
        const updateNote = bankInfoSource === 'new'
          ? '\n\n✅ Đã cập nhật thông tin tài khoản của bạn.'
          : '';
        const noAmountText = `📭 Bạn hiện chưa có hoa hồng nào sẵn sàng rút.

Có thể do:
• Chưa có đơn nào "Hoàn thành"
• Hoặc đã thanh toán hết

Gửi /thongke để xem chi tiết.${updateNote}`;
        await this.actions.humanReply(message, noAmountText, { react: false });
        return noAmountText;
      }

      // ─── Create the request ──────────────────────────
      const requestId = await withdrawalStore.createRequest({
        userId: senderUid,
        userName: senderName,
        amount: pending.total,
        breakdown: pending.breakdown,
        bankCode,
        accountNumber,
        accountHolder,
      });

      if (!requestId) {
        const errText = '❌ Hệ thống gặp lỗi khi tạo yêu cầu. Vui lòng thử lại sau.';
        await this.actions.humanReply(message, errText, { react: false });
        return errText;
      }

      // ─── Notify admin via email (best-effort, non-blocking) ─
      const adminEmails = process.env.NOTIFY_EMAILS;
      if (adminEmails) {
        const breakdownLines = Object.entries(pending.breakdown)
          .filter(([, v]) => v > 0)
          .map(([k, v]) => `  - ${k.toUpperCase()}: ${formatVND(v)}`)
          .join('\n');
        const subject = `[Rút tiền] ${senderName} yêu cầu ${formatVND(pending.total)}`;
        const body = `User vừa gửi yêu cầu rút tiền:

- Tên: ${senderName}
- ID Zalo: ${senderUid}
- Số tiền: ${formatVND(pending.total)}
- Ngân hàng: ${withdrawalStore.bankDisplayName(bankCode)} (${bankCode})
- Số TK: ${accountNumber}
- Chủ TK: ${accountHolder}
- Request ID: ${requestId}
- Thời gian: ${new Date().toLocaleString('vi-VN')}

Breakdown:
${breakdownLines || '  (không có chi tiết)'}

Vào trang Admin → Payouts để xử lý.`;
        sendMail(adminEmails, subject, body).catch(e => logger.error('Mailer', `Withdrawal notify failed: ${e.message}`));
      }

      // ─── Build success reply ─────────────────────────
      const breakdownBlock = Object.entries(pending.breakdown)
        .filter(([, v]) => v > 0)
        .map(([k, v]) => `   ${k.toUpperCase()}: ${formatVND(v)}`)
        .join('\n');
      const updateNote = bankInfoSource === 'new'
        ? '\n\n✅ Thông tin tài khoản đã được cập nhật.'
        : '';
      const replyText = `✅ Đã ghi nhận yêu cầu rút tiền!

💰 Số tiền: ${formatVND(pending.total)}
${breakdownBlock}

🏦 ${withdrawalStore.bankDisplayName(bankCode)} • ${accountNumber}
👤 ${accountHolder}

⏳ Hệ thống sẽ thanh toán trong thời gian sớm nhất.${updateNote}

💡 Gửi /thongke để xem lịch sử chi tiết.`;

      await this.actions.humanReply(message, replyText, { react: false });
      logger.info('ZaloCommands', `Withdrawal request #${requestId}: ${senderName} (${senderUid}) requested ${pending.total}đ to ${bankCode}:${accountNumber}`);
      return replyText;
    } catch (err) {
      logger.error('ZaloCommands', `_handleRuttien failed for ${senderUid}: ${err.stack || err.message}`);
      const errText = '❌ Hệ thống gặp lỗi. Vui lòng thử lại sau ít phút.';
      await this.actions.humanReply(message, errText, { react: false });
      return errText;
    }
  }

  _buildRuttienGuide() {
    return `📌 Cú pháp lệnh /ruttien:

/ruttien <NGÂN_HÀNG> <SỐ_TK> <TÊN_CHỦ_TK>

Ví dụ:
• /ruttien VCB 1234567890 NGUYEN VAN A
• /ruttien Techcombank 9876543210 TRAN THI B
• /ruttien MBBank 123456789012 LE VAN C

🏦 Ngân hàng hỗ trợ (gõ mã hoặc tên):
VCB (Vietcombank) · ICB (VietinBank) · BIDV · VBA (Agribank) · TCB (Techcombank) · MB (MBBank) · ACB · VPB (VPBank) · TPB (TPBank) · STB (Sacombank) · HDB · VIB · SHB · EIB (Eximbank) · MSB · OCB · LPB (LPBank) · SeABank · ABBank · SCB · MoMo · CAKE · Timo · ...

📝 Lưu ý:
• Tên chủ TK ghi như trên thẻ ngân hàng (KHÔNG dấu, IN HOA)
• Số TK đúng để tránh chuyển nhầm
• Sau khi đăng ký, hệ thống tự ghi nhận yêu cầu rút hoa hồng hiện có

🔁 Nếu đã đăng ký, lần sau chỉ cần gõ /ruttien là đủ.`;
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
      const rates = await commissionRatesStore.getRates();
      // User actually receives F0% of the gross commission
      const userAmount = result.commissionAmount > 0
        ? Math.round(result.commissionAmount * rates.f0 / 100)
        : 0;
      // Effective rate user receives = commission% × F0% (rounded to 2 decimal)
      const userRate = result.commission > 0
        ? Math.round(result.commission * rates.f0) / 100
        : 0;
      const amountFmt = userAmount > 0
        ? `~${new Intl.NumberFormat('vi-VN').format(userAmount)}đ`
        : '';
      const commissionLine = amountFmt
        ? `💰 Hoa hồng đơn hàng: ${userRate}% (${amountFmt})`
        : `💰 Hoa hồng đơn hàng: ${userRate}%`;

      const zaloGroupLink = process.env.ZALO_GROUP_LINK || 'https://zalo.me/g/3othppdezfzvxqthz7sg';

      const msg = `${mentionTag} ✅ Em gửi link ạ!\n\n` +
        `✨ Link hoàn tiền:\n${linkToShow}\n\n` +
        `${commissionLine}\n\n` +
        `⚠️ Lưu ý:\n` +
        `1.Không xem VIDEO/LIVE sau khi click link\n` +
        `2.Xóa sản phẩm khỏi giỏ hàng nếu đã thêm trước đó\n` +
        `3.Xác nhận "Đã nhận được hàng" khi đơn giao thành công\n\n` +
        `🚀 Kiếm thêm hoa hồng khi giới thiệu bạn bè:\n` +
        `🌹 F1: ${rates.f1}% hoa hồng\n` +
        `🌹 F2: ${rates.f2}% hoa hồng\n` +
        `🌹 F3: ${rates.f3}% hoa hồng\n\n` +
        `🎯 Tham gia ngay:\n` +
        `👉 ${zaloGroupLink}\n\n` +
        `✅ Chỉ cần mời bạn bè vào nhóm, hệ thống sẽ tự động ghi nhận và chia hoa hồng khi có đơn hàng phát sinh.`;

      const msgContent = {
        msg,
        mentions: [{
          pos: 0, // @mention starts at position 0
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

  async _handleCustom(message, text) {
    const senderUid = message.data?.uidFrom || message.threadId;
    const senderName = await this.actions.getDisplayName(senderUid);

    // Parse: /custom <url> <phone>
    const CUSTOM_GUIDE = `📌 Cú pháp lệnh /custom:\n\n` +
      `/custom <link_shopee> <số_điện_thoại>\n\n` +
      `Ví dụ:\n/custom https://shopee.vn/product/... 0912345678\n\n` +
      `⚠️ Lưu ý:\n- Link phải là link sản phẩm Shopee hợp lệ\n- Số điện thoại 10-11 chữ số bắt đầu bằng 0`;

    // Strip /custom prefix, then split by whitespace
    const body = text.slice('/custom'.length).trim();
    if (!body) {
      await this.actions.humanReply(message, CUSTOM_GUIDE, { react: false });
      return CUSTOM_GUIDE;
    }

    // Extract URL (first http(s) sequence) and phone (last token matching phone pattern)
    const urlMatch = body.match(/(https?:\/\/\S+)/i);
    const phoneMatch = body.match(/\b(0[0-9]{8,10})\b/);

    if (!urlMatch || !phoneMatch) {
      const errGuide = `⚠️ Thiếu thông tin. Vui lòng nhập đầy đủ:\n\n` + CUSTOM_GUIDE;
      await this.actions.humanReply(message, errGuide, { react: false });
      return errGuide;
    }

    const url = urlMatch[1];
    const phone = phoneMatch[1];

    const parsed = shopee.parseShopeeLink(url);
    if (!parsed) {
      const errText = '⚠️ URL không phải link Shopee hợp lệ.\nHỗ trợ: shopee.vn/product/..., s.shopee.vn/..., shopee.vn/ten-sp-i.xxx.xxx';
      await this.actions.humanReply(message, errText, { react: false });
      return errText;
    }

    logger.info('ZaloCommands', `[${senderName}] Custom link: ${url.slice(0, 60)}... phone=${phone}`);

    this.actions.markSeen(message.threadId, message.type);
    this.actions.reactHeart(message);
    this.actions.fireTyping(message.threadId, message.type);

    try {
      // sub1 = F1 (người nhắn), sub2 = SĐT khách (F2), sub4 = from_custom
      const result = await shopee.checkAndConvert(url, {
        sub1: senderUid,
        sub2: phone,
        sub4: 'custom',
      });

      // No commission
      if (result.noCommission) {
        await convertLogStore.save({
          userId: senderUid, userName: senderName,
          originalLink: url, status: 'no_commission',
          subId1: senderUid, subId2: phone, subId4: 'custom',
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
          subId1: senderUid, subId2: phone, subId4: 'custom',
        });
        const errText = `Hệ thống hiện tại đang quá tải, vui lòng thử lại sau ít phút`;
        await this.actions.sendText(errText, message.threadId, message.type);
        return errText;
      }

      // Save convert log
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
        subId2: phone,
        subId3: String(result.commission || ''),
        subId4: 'custom',
        status: 'success',
        itemId: result.itemId || parsedIds?.itemId || '',
        shopId: result.shopId || parsedIds?.shopId || '',
      });

      // Build short redirect link
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
          if (logId && token) {
            setImmediate(() => {
              convertLogStore.updateRedirectToken(logId, token).catch(() => {});
            });
          }
        } catch (redirectErr) {
          logger.warn('ZaloCommands', `Custom short link failed, using original: ${redirectErr.message}`);
        }
      }

      // Reply
      const mentionTag = `@${senderName}`;
      let commissionText = `${result.commission}%`;
      if (result.commissionAmount > 0) {
        commissionText += ` (~${new Intl.NumberFormat('vi-VN').format(result.commissionAmount)}đ)`;
      }
      const msg = `${mentionTag} ✅ Link tuỳ chỉnh đã tạo!\n\n` +
        `📱 Khách: ${phone}\n` +
        `✨ Link hoàn tiền:\n${linkToShow}\n` +
        `💰 Hoa hồng ước tính: ${commissionText}\n\n` +
        `⚠️ Lưu ý:\n` +
        `1. Không xem VIDEO/LIVE sau khi click link\n` +
        `2. Hãy xóa giỏ hàng nếu đã thêm trước đó\n` +
        `3. Vui lòng xác nhận "Đã nhận được hàng" trên Shopee khi đơn đã giao thành công\n\n` +
        `🔔 Gửi link cho khách và nhắc đặt hàng trong hôm nay nhé 🎉`;

      const msgContent = {
        msg,
        mentions: [{ pos: 0, uid: senderUid, len: mentionTag.length }],
      };

      await this.actions.sendStyled(msgContent, message.threadId, message.type);
      return msg;
    } catch (err) {
      logger.error('ZaloCommands', `Error in /custom for ${senderUid}: ${err.message}`);
      await convertLogStore.save({
        userId: senderUid, userName: senderName,
        originalLink: url, status: 'error', errorMessage: err.message,
        subId1: senderUid, subId4: 'custom',
      }).catch(e => logger.error(`[DB] Error saving custom error log: ${e.message}`));
      const errText = `Hệ thống hiện tại đang quá tải, vui lòng thử lại sau ít phút`;
      await this.actions.sendText(errText, message.threadId, message.type);
      return errText;
    }
  }
}

module.exports = ZaloCommands;
