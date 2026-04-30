const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DATA_DIR = path.join(__dirname, '../../data');
const DB_PATH = path.join(DATA_DIR, 'zalo-bot.db');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const db = new Database(DB_PATH);

// Enable WAL mode for better concurrent read/write performance
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// ─── Schema ─────────────────────────────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,
    thread_id TEXT NOT NULL,
    sender_id TEXT NOT NULL,
    sender_name TEXT DEFAULT '',
    content TEXT DEFAULT '',
    raw_type TEXT DEFAULT 'text',
    is_group INTEGER DEFAULT 0,
    received_at TEXT NOT NULL,
    status TEXT DEFAULT 'received' CHECK(status IN ('received','processing','replied','failed','skipped')),
    reply_text TEXT,
    replied_at TEXT,
    processing_time_ms INTEGER,
    error TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_messages_status ON messages(status);
  CREATE INDEX IF NOT EXISTS idx_messages_thread ON messages(thread_id);
  CREATE INDEX IF NOT EXISTS idx_messages_sender ON messages(sender_id);
  CREATE INDEX IF NOT EXISTS idx_messages_received ON messages(received_at DESC);

  CREATE TABLE IF NOT EXISTS users (
    user_id TEXT PRIMARY KEY,
    display_name TEXT DEFAULT '',
    zalo_name TEXT DEFAULT '',
    avatar TEXT DEFAULT '',
    cover TEXT DEFAULT '',
    gender INTEGER DEFAULT 2,
    dob TEXT DEFAULT '',
    phone_number TEXT DEFAULT '',
    status_text TEXT DEFAULT '',
    is_friend INTEGER DEFAULT 0,
    is_blocked INTEGER DEFAULT 0,
    is_active INTEGER DEFAULT 0,
    is_active_pc INTEGER DEFAULT 0,
    is_active_web INTEGER DEFAULT 0,
    last_action_time INTEGER DEFAULT 0,
    account_status INTEGER DEFAULT 0,
    global_id TEXT DEFAULT '',
    message_count INTEGER DEFAULT 0,
    first_contact TEXT,
    last_seen TEXT,
    cached_at TEXT DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_users_msg_count ON users(message_count DESC);
  CREATE INDEX IF NOT EXISTS idx_users_last_seen ON users(last_seen DESC);
`);

module.exports = db;
