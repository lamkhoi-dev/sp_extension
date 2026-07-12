const fs = require('fs');
const path = require('path');
const logger = require('../logger');
const ZaloActions = require('./zalo-actions');
const ZaloCommands = require('./zalo-commands');
const ConcurrentHandler = require('./concurrent-handler');
const messageStore = require('./message-store');
const userCache = require('./user-cache');

const SESSION_PATH = process.env.ZALO_SESSION_PATH
  ? path.resolve(process.env.ZALO_SESSION_PATH)
  : path.join(__dirname, '../../zalo-session.json');
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
    this._broadcastTimeout = null;
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
      this.startDailyBroadcast();

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
      // retryOnClose → zca-js tự kết nối lại (có backoff + xoay endpoint) khi
      // WebSocket rớt vì mạng chập chờn, thay vì chết luôn cho tới lần restart.
      this.listener.start({ retryOnClose: true });

      // Replay unprocessed messages from last session
      this._replayUnprocessed();

      // Keep-alive ping every 5 minutes.
      // keepAlive() is ASYNC — a sync try/catch can't catch its promise
      // rejection, so a transient "fetch failed" used to bubble up as an
      // unhandledRejection (and spam alert mail). Catch the promise instead.
      this._keepAliveInterval = setInterval(() => {
        Promise.resolve(this.api?.keepAlive?.()).catch((err) => {
          logger.warn('ZaloBot', `keepAlive failed (ignored, transient): ${err.message}`);
        });
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
    // ─── Connection lifecycle ──────────────────────
    // Zalo's WebSocket drops on flaky networks. Reconnect is handled by
    // start({ retryOnClose: true }); here we just log + reflect status.
    // The 'error' listener is MANDATORY: an EventEmitter with no 'error'
    // handler THROWS when 'error' is emitted → would crash the whole process
    // on a transient blip. We swallow transient WS errors (they auto-retry).
    this.listener.on('connected', () => {
      if (this.status !== 'online') {
        this.status = 'online';
        this._emitStatus();
      }
      logger.info('ZaloBot', '🔌 Listener connected');
    });
    this.listener.on('disconnected', (code, reason) => {
      logger.warn('ZaloBot', `🔌 Listener disconnected (code=${code}${reason ? ' ' + reason : ''}) — đang tự kết nối lại...`);
    });
    this.listener.on('closed', (code, reason) => {
      this.status = 'error';
      this._emitStatus();
      logger.error('ZaloBot', `🔌 Listener đóng hẳn (code=${code}${reason ? ' ' + reason : ''}) — có thể cần quét lại QR.`);
    });
    this.listener.on('error', (err) => {
      let msg;
      try { msg = err?.message || err?.error?.message || JSON.stringify(err).slice(0, 200); }
      catch { msg = String(err); }
      logger.warn('ZaloBot', `🔌 Listener error (bỏ qua, sẽ tự retry): ${msg}`);
    });

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
      let msgId;
      try {
        msgId = await messageStore.save(message, { isGroup });
      } catch (err) {
        logger.error('ZaloBot', `MessageStore.save failed: ${err.message}`);
      }

      // Record user (non-blocking profile fetch)
      const senderName = message.data?.dName || '';
      userCache.recordMessage(senderUid, senderName).catch(() => {});
      userCache.fetchAndSave(senderUid).catch(() => {}); // async, non-blocking

      // Emit for dashboard
      if (msgId) {
        const entry = await messageStore.getById(msgId).catch(() => null);
        if (entry) this._emitMessage(entry);
      }

      // Process via concurrent handler — parallel across threads, sequential within same thread
      this.concurrentHandler.process(message.threadId, async () => {
        try {
          await this.commands.handleMessage(message, { isGroup, msgId });
          // Re-emit updated status after processing
          const updated = await messageStore.getById(msgId);
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
      logger.info('ZaloBot', `📋 Group event: ${JSON.stringify(event).slice(0, 1000)}`);

      try {
        const data = event.data || event;
        const eventType = event.type || event.act || data.type || data.act || '';

        // Only handle join/invite events
        if (!['join', 'invite'].includes(eventType)) return;

        // Resolve inviter: sourceId is who invited them
        const inviterUid = data.sourceId
          || data.updateMembers?.inviterUid
          || data.inviterUid
          || data.actorId;

        // Resolve invited members from various possible formats
        let invitedMembers = [];

        if (data.updateMembers) {
          const um = data.updateMembers;
          if (Array.isArray(um.members)) {
            invitedMembers = um.members;
          } else if (Array.isArray(um)) {
            invitedMembers = um;
          }
        }
        if (invitedMembers.length === 0 && Array.isArray(data.invitedUids)) {
          invitedMembers = data.invitedUids;
        }
        if (invitedMembers.length === 0 && Array.isArray(data.memberIds)) {
          invitedMembers = data.memberIds;
        }

        logger.info('ZaloBot', `👥 Join event parsed — inviter: ${inviterUid}, members: ${JSON.stringify(invitedMembers).slice(0, 300)}`);

        if (inviterUid && invitedMembers.length > 0) {
          // Resolve inviter name
          const inviterProfile = await this.actions?.getDisplayName?.(inviterUid) || '';
          const inviterName = typeof inviterProfile === 'string' ? inviterProfile : (inviterProfile?.displayName || '');
          logger.info('ZaloBot', `👥 Referrer resolved: ${inviterUid} (${inviterName}) invited ${invitedMembers.length} member(s)`);

          // ── Also register the inviter themselves ──────────────────────
          // (A may never have messaged the bot; this ensures they appear in DB)
          if (inviterUid !== this.ownId) {
            await userCache.recordMessage(inviterUid, inviterName);
            userCache.fetchAndSave(inviterUid).catch(() => {});
            logger.info('ZaloBot', `✅ Inviter registered: ${inviterUid} (${inviterName})`);
          }

          // Collect valid new member IDs/names for the welcome message
          const newMembersList = [];

          for (const uid of invitedMembers) {
            const memberId = typeof uid === 'string' ? uid
              : (uid.id || uid.uid || uid.userId || String(uid));
            const memberName = typeof uid === 'object' ? (uid.dName || uid.displayName || uid.name || '') : '';

            if (memberId && memberId !== inviterUid && memberId !== this.ownId) {
              await userCache.recordMessage(memberId, memberName);
              await userCache.setReferrer(memberId, inviterUid, inviterName);
              logger.info('ZaloBot', `✅ Referrer saved: ${memberId} (${memberName}) → invited by ${inviterUid} (${inviterName})`);
              userCache.fetchAndSave(memberId).catch(() => {});
              newMembersList.push({ id: memberId, name: memberName });
            }
          }

          // Schedule welcome message 6 minutes after join event
          if (newMembersList.length > 0) {
            const threadId = data.groupId || event.threadId || data.threadId || '';
            const threadType = this.actions?.ThreadType?.Group ?? 1;
            const DELAY_MS = 6 * 60 * 1000; // 6 minutes

            logger.info('ZaloBot', `⏰ Scheduling welcome message in 6min for ${newMembersList.length} member(s) in thread ${threadId}`);

            setTimeout(async () => {
              try {
                // Re-fetch names in case profile loaded by now
                const resolvedMembers = await Promise.all(
                  newMembersList.map(async (m) => {
                    const profile = await this.actions?.getDisplayName?.(m.id).catch(() => null);
                    const name = (typeof profile === 'string' ? profile : profile?.displayName) || m.name || m.id;
                    return { id: m.id, name };
                  })
                );

                // Build @mention string for each member
                const mentionTags = resolvedMembers.map(m => `@${m.name}`).join(' ');
                const msg = `${mentionTags} Anh/chị đọc kĩ tin nhắn đã ghim phía trên để nắm rõ cách hoàn tiền nhé ❤️`;

                // Build mention metadata (each mention offset in the string)
                const mentions = [];
                let pos = 0;
                for (const m of resolvedMembers) {
                  const tag = `@${m.name}`;
                  mentions.push({ pos, uid: m.id, len: tag.length });
                  pos += tag.length + 1; // +1 for the space
                }

                await this.actions.sendStyled({ msg, mentions }, threadId, threadType);
                logger.info('ZaloBot', `✅ Welcome message sent to ${resolvedMembers.length} member(s) in thread ${threadId}`);
              } catch (err) {
                logger.warn('ZaloBot', `Welcome message failed: ${err.message}`);
              }
            }, DELAY_MS);
          }
        } else {
          logger.warn('ZaloBot', `⚠️ Join event but could not resolve inviter or members`);
        }
      } catch (err) {
        logger.warn('ZaloBot', `Group event handling error: ${err.message}`);
      }
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
        await messageStore.save(msg, { isGroup });
      }
    });
  }

  // Replay unprocessed messages from previous session
  async _replayUnprocessed() {
    const unprocessed = await messageStore.getUnprocessed();
    if (unprocessed.length === 0) return;

    logger.info('ZaloBot', `🔄 Replaying ${unprocessed.length} unprocessed message(s) from last session`);
    for (const msg of unprocessed) {
      // Mark as skipped — we can't properly replay without the original message object
      // But we log them so user can see what was missed
      await messageStore.markSkipped(msg.id);
      logger.warn('ZaloBot', `⏭️ Skipped (no replay context): [${msg.sender_name}] "${msg.content.slice(0, 50)}"`);
    }
  }

  // ─── Daily 8PM VN broadcast to all active groups ──────
  // TEST_RECIPIENT: send to this DM first before groups (set to null to disable)
  // Set to null when ready for production broadcast
  static get BROADCAST_TEST_UID() { return '6925778586172347745'; } // Nguyễn Thái An

  startDailyBroadcast() {
    if (this._broadcastTimeout) clearTimeout(this._broadcastTimeout);

    const scheduleNext = () => {
      // Next 20:00 Vietnam time (UTC+7 = 13:00 UTC)
      const now = new Date();
      const next = new Date(now);
      next.setUTCHours(13, 0, 0, 0);
      if (next <= now) next.setUTCDate(next.getUTCDate() + 1);

      const msUntil = next - now;
      const nextVN = new Date(next.getTime() + 7 * 3600 * 1000);
      logger.info('ZaloBot', `📅 [Broadcast] Scheduled → ${nextVN.toISOString().replace('T',' ').slice(0,19)} VN (in ${Math.round(msUntil/60000)}m)`);

      this._broadcastTimeout = setTimeout(async () => {
        await this._sendDailyBroadcast();
        scheduleNext();
      }, msUntil);
    };

    scheduleNext();
  }

  async _sendDailyBroadcast() {
    const nowVN = new Date(Date.now() + 7 * 3600 * 1000).toISOString().replace('T',' ').slice(0,19);
    logger.info('ZaloBot', `📢 [Broadcast] START — ${nowVN} VN`);

    if (!this.actions || this.status !== 'online') {
      logger.warn('ZaloBot', `📢 [Broadcast] SKIPPED — bot status: ${this.status}`);
      return;
    }

    const msg =
`🔴 THÔNG BÁO THỐNG KÊ HOA HỒNG & TIỀN HOÀN TỪ SHOPEE

⏰ Dữ liệu được cập nhật tự động vào 20:00 mỗi ngày.

🤖 Vui lòng nhắn trực tiếp với bot Hoàn Tiền để tra cứu:

💰 Rút tiền: /ruttien
📊 Xem thống kê: /thongke

📦 Xem chi tiết đơn hàng:
https://cashback-shopee.vercel.app/baocao.html

✨ Mọi thông tin về hoa hồng, tiền hoàn và lịch sử đơn hàng đều được cập nhật nhanh chóng ngay trên bot Hoàn Tiền.`;

    const testUid = ZaloBot.BROADCAST_TEST_UID;

    // ── STEP 1: Send to test DM first ──────────────────
    if (testUid) {
      logger.info('ZaloBot', `📢 [Broadcast] TEST → DM to ${testUid}`);
      try {
        await this.actions.sendText(`🧪 [TEST BROADCAST ${nowVN} VN]\n\n${msg}`, testUid, 0);
        logger.info('ZaloBot', `📢 [Broadcast] TEST DM sent ✅`);
      } catch (err) {
        logger.error('ZaloBot', `📢 [Broadcast] TEST DM failed: ${err.message}`);
      }
      // Wait 3s to confirm test message looks good before group broadcast
      await new Promise(r => setTimeout(r, 3000));
    }

    // ── STEP 2: Broadcast to all active groups ──────────
    const db = require('../db');
    const groups = await db.all(`
      SELECT DISTINCT thread_id
      FROM messages
      WHERE is_group = true
        AND received_at >= NOW() - INTERVAL '30 days'
    `);

    logger.info('ZaloBot', `📢 [Broadcast] Found ${groups.length} active groups`);

    if (groups.length === 0) {
      logger.warn('ZaloBot', '📢 [Broadcast] No active groups — skipping group broadcast');
      return;
    }

    let sent = 0, failed = 0;
    for (const { thread_id } of groups) {
      try {
        await this.actions.sendText(msg, thread_id, 1);
        sent++;
        logger.info('ZaloBot', `📢 [Broadcast] ✅ Sent to group ${thread_id}`);
        await new Promise(r => setTimeout(r, 1500));
      } catch (err) {
        failed++;
        logger.error('ZaloBot', `📢 [Broadcast] ❌ Group ${thread_id}: ${err.message}`);
      }
    }

    const doneVN = new Date(Date.now() + 7 * 3600 * 1000).toISOString().replace('T',' ').slice(0,19);
    logger.info('ZaloBot', `📢 [Broadcast] DONE ${doneVN} VN — groups: ${sent} sent, ${failed} failed`);
  }

  async stop() {
    if (this._keepAliveInterval) {
      clearInterval(this._keepAliveInterval);
      this._keepAliveInterval = null;
    }
    if (this._broadcastTimeout) {
      clearTimeout(this._broadcastTimeout);
      this._broadcastTimeout = null;
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
