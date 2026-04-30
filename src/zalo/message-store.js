const db = require('./database');
const logger = require('../logger');

// Prepared statements for performance
const stmts = {
  insert: db.prepare(`
    INSERT OR REPLACE INTO messages (id, thread_id, sender_id, sender_name, content, raw_type, is_group, received_at, status)
    VALUES (@id, @threadId, @senderId, @senderName, @content, @rawType, @isGroup, @receivedAt, 'received')
  `),

  markProcessing: db.prepare(`UPDATE messages SET status = 'processing' WHERE id = ?`),

  markReplied: db.prepare(`
    UPDATE messages SET status = 'replied', reply_text = ?, replied_at = datetime('now'), processing_time_ms = ?
    WHERE id = ?
  `),

  markFailed: db.prepare(`
    UPDATE messages SET status = 'failed', error = ?, replied_at = datetime('now'), processing_time_ms = ?
    WHERE id = ?
  `),

  markSkipped: db.prepare(`UPDATE messages SET status = 'skipped' WHERE id = ?`),

  getUnprocessed: db.prepare(`
    SELECT * FROM messages WHERE status IN ('received', 'processing') ORDER BY received_at ASC
  `),

  getRecent: db.prepare(`
    SELECT m.*, u.avatar, u.display_name as user_display_name
    FROM messages m
    LEFT JOIN users u ON m.sender_id = u.user_id
    ORDER BY m.received_at DESC LIMIT ?
  `),

  getRecentFiltered: db.prepare(`
    SELECT m.*, u.avatar, u.display_name as user_display_name
    FROM messages m
    LEFT JOIN users u ON m.sender_id = u.user_id
    WHERE (? = 'all' OR (? = 'dm' AND m.is_group = 0) OR (? = 'group' AND m.is_group = 1) OR (? = 'failed' AND m.status = 'failed'))
    ORDER BY m.received_at DESC LIMIT ?
  `),

  getById: db.prepare(`SELECT * FROM messages WHERE id = ?`),

  getStats: db.prepare(`
    SELECT
      COUNT(*) as total,
      SUM(CASE WHEN status = 'replied' THEN 1 ELSE 0 END) as replied,
      SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed,
      SUM(CASE WHEN status = 'skipped' THEN 1 ELSE 0 END) as skipped,
      SUM(CASE WHEN status IN ('received', 'processing') THEN 1 ELSE 0 END) as pending,
      ROUND(AVG(CASE WHEN status = 'replied' THEN processing_time_ms END)) as avg_response_ms
    FROM messages
  `),

  getStatsToday: db.prepare(`
    SELECT
      COUNT(*) as total,
      SUM(CASE WHEN status = 'replied' THEN 1 ELSE 0 END) as replied,
      SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed,
      ROUND(AVG(CASE WHEN status = 'replied' THEN processing_time_ms END)) as avg_response_ms
    FROM messages
    WHERE received_at >= datetime('now', '-1 day')
  `),

  exists: db.prepare(`SELECT 1 FROM messages WHERE id = ?`),
};

class MessageStore {
  save(message, { isGroup = false } = {}) {
    const msgId = message.data?.msgId || message.data?.cliMsgId || `msg_${Date.now()}`;

    // Skip if already exists (dedup for old_messages replay)
    if (stmts.exists.get(msgId)) return msgId;

    const senderName = message.data?.dName || '';
    const content = message.data?.content;
    let textContent = '';
    let rawType = 'text';

    if (typeof content === 'string') {
      textContent = content;
    } else if (content && typeof content === 'object') {
      rawType = content.type || 'attachment';
      textContent = content.href || content.msg || content.text || JSON.stringify(content).slice(0, 200);
    }

    try {
      stmts.insert.run({
        id: msgId,
        threadId: message.threadId || '',
        senderId: message.data?.uidFrom || '',
        senderName,
        content: textContent.slice(0, 500),
        rawType,
        isGroup: isGroup ? 1 : 0,
        receivedAt: new Date().toISOString(),
      });
    } catch (err) {
      logger.error('MessageStore', `Save failed: ${err.message}`);
    }

    return msgId;
  }

  markProcessing(msgId) {
    try { stmts.markProcessing.run(msgId); } catch {}
  }

  markReplied(msgId, replyText, processingTimeMs) {
    try {
      stmts.markReplied.run(
        (replyText || '').slice(0, 500),
        Math.round(processingTimeMs),
        msgId
      );
    } catch (err) {
      logger.error('MessageStore', `markReplied failed: ${err.message}`);
    }
  }

  markFailed(msgId, error, processingTimeMs = 0) {
    try {
      stmts.markFailed.run(
        (error || 'Unknown error').slice(0, 300),
        Math.round(processingTimeMs),
        msgId
      );
    } catch (err) {
      logger.error('MessageStore', `markFailed failed: ${err.message}`);
    }
  }

  markSkipped(msgId) {
    try { stmts.markSkipped.run(msgId); } catch {}
  }

  getUnprocessed() {
    return stmts.getUnprocessed.all();
  }

  getRecent(count = 50, filter = 'all') {
    if (filter === 'all') {
      return stmts.getRecent.all(count);
    }
    return stmts.getRecentFiltered.all(filter, filter, filter, filter, count);
  }

  getStats() {
    const allTime = stmts.getStats.get();
    const today = stmts.getStatsToday.get();
    return { allTime, today };
  }

  getById(msgId) {
    return stmts.getById.get(msgId);
  }
}

module.exports = new MessageStore();
