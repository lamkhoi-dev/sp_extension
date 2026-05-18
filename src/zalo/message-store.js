const db = require('../db');
const logger = require('../logger');

class MessageStore {
  async save(message, { isGroup = false } = {}) {
    const msgId = message.data?.msgId || message.data?.cliMsgId || `msg_${Date.now()}`;

    // Skip if already exists (dedup for old_messages replay)
    const exists = await db.get('SELECT 1 FROM messages WHERE id = ?', [msgId]);
    if (exists) return msgId;

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
      await db.runNamed(`
        INSERT INTO messages (id, thread_id, sender_id, sender_name, content, raw_type, is_group, received_at, status)
        VALUES (@id, @threadId, @senderId, @senderName, @content, @rawType, @isGroup, @receivedAt, 'received')
        ON CONFLICT(id) DO UPDATE SET
          content = @content,
          status = 'received'
      `, {
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

  async markProcessing(msgId) {
    try { await db.run(`UPDATE messages SET status = 'processing' WHERE id = ?`, [msgId]); } catch {}
  }

  async markReplied(msgId, replyText, processingTimeMs) {
    try {
      await db.run(
        `UPDATE messages SET status = 'replied', reply_text = ?, replied_at = ?, processing_time_ms = ? WHERE id = ?`,
        [(replyText || '').slice(0, 500), new Date().toISOString(), Math.round(processingTimeMs), msgId]
      );
    } catch (err) {
      logger.error('MessageStore', `markReplied failed: ${err.message}`);
    }
  }

  async markFailed(msgId, error, processingTimeMs = 0) {
    try {
      await db.run(
        `UPDATE messages SET status = 'failed', error = ?, replied_at = ?, processing_time_ms = ? WHERE id = ?`,
        [(error || 'Unknown error').slice(0, 300), new Date().toISOString(), Math.round(processingTimeMs), msgId]
      );
    } catch (err) {
      logger.error('MessageStore', `markFailed failed: ${err.message}`);
    }
  }

  async markSkipped(msgId) {
    try { await db.run(`UPDATE messages SET status = 'skipped' WHERE id = ?`, [msgId]); } catch {}
  }

  async getUnprocessed() {
    return db.all(`SELECT * FROM messages WHERE status IN ('received', 'processing') ORDER BY received_at ASC`);
  }

  async getRecent(count = 50, filter = 'all') {
    if (filter === 'all') {
      return db.all(`
        SELECT m.*, u.avatar, u.display_name as user_display_name
        FROM messages m
        LEFT JOIN users u ON m.sender_id = u.user_id
        ORDER BY m.received_at DESC LIMIT ?
      `, [count]);
    }
    return db.all(`
      SELECT m.*, u.avatar, u.display_name as user_display_name
      FROM messages m
      LEFT JOIN users u ON m.sender_id = u.user_id
      WHERE (? = 'dm' AND m.is_group = 0) OR (? = 'group' AND m.is_group = 1) OR (? = 'failed' AND m.status = 'failed')
      ORDER BY m.received_at DESC LIMIT ?
    `, [filter, filter, filter, count]);
  }

  async getStats() {
    const allTime = await db.get(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN status = 'replied' THEN 1 ELSE 0 END) as replied,
        SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed,
        SUM(CASE WHEN status = 'skipped' THEN 1 ELSE 0 END) as skipped,
        SUM(CASE WHEN status IN ('received', 'processing') THEN 1 ELSE 0 END) as pending,
        ROUND(AVG(CASE WHEN status = 'replied' THEN processing_time_ms END)) as avg_response_ms
      FROM messages
    `);
    const today = await db.get(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN status = 'replied' THEN 1 ELSE 0 END) as replied,
        SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed,
        ROUND(AVG(CASE WHEN status = 'replied' THEN processing_time_ms END)) as avg_response_ms
      FROM messages
      WHERE received_at >= ?
    `, [new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()]);
    return { allTime, today };
  }

  async getById(msgId) {
    return db.get('SELECT * FROM messages WHERE id = ?', [msgId]);
  }
}

module.exports = new MessageStore();
