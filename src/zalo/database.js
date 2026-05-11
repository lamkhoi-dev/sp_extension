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
    created_at TEXT DEFAULT (datetime('now','localtime'))
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
    cached_at TEXT DEFAULT (datetime('now','localtime'))
  );

  CREATE INDEX IF NOT EXISTS idx_users_msg_count ON users(message_count DESC);
  CREATE INDEX IF NOT EXISTS idx_users_last_seen ON users(last_seen DESC);
`);

// ─── Migration: Add referrer columns to users ──────────
try {
  db.exec(`ALTER TABLE users ADD COLUMN referrer_id TEXT DEFAULT ''`);
} catch (e) { /* column already exists */ }
try {
  db.exec(`ALTER TABLE users ADD COLUMN referrer_name TEXT DEFAULT ''`);
} catch (e) { /* column already exists */ }
try {
  db.exec(`ALTER TABLE users ADD COLUMN bank_name TEXT`);
} catch (e) { /* column already exists */ }
try {
  db.exec(`ALTER TABLE users ADD COLUMN bank_account TEXT`);
} catch (e) { /* column already exists */ }
try {
  db.exec(`ALTER TABLE users ADD COLUMN qr_code TEXT`);
} catch (e) { /* column already exists */ }
try {
  db.exec(`ALTER TABLE users ADD COLUMN total_commission REAL`);
} catch (e) { /* column already exists */ }
try {
  db.exec(`ALTER TABLE users ADD COLUMN total_refunded REAL`);
} catch (e) { /* column already exists */ }
try {
  db.exec(`ALTER TABLE users ADD COLUMN cashback_buyer_rate REAL DEFAULT 40`);
} catch (e) { /* column already exists */ }
try {
  db.exec(`ALTER TABLE users ADD COLUMN cashback_referrer_rate REAL DEFAULT 30`);
} catch (e) { /* column already exists */ }

// ─── Convert Logs table ────────────────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS convert_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    user_name TEXT DEFAULT '',
    original_link TEXT NOT NULL,
    affiliate_link TEXT DEFAULT '',
    short_link TEXT DEFAULT '',
    product_name TEXT DEFAULT '',
    commission_rate REAL DEFAULT 0,
    commission_amount REAL DEFAULT 0,
    price REAL DEFAULT 0,
    source TEXT DEFAULT 'shopee',
    sub_id1 TEXT DEFAULT '',
    sub_id2 TEXT DEFAULT '',
    sub_id3 TEXT DEFAULT '',
    status TEXT DEFAULT 'success',
    error_message TEXT DEFAULT '',
    created_at TEXT DEFAULT (datetime('now','localtime'))
  );

  CREATE INDEX IF NOT EXISTS idx_convert_logs_user ON convert_logs(user_id);
  CREATE INDEX IF NOT EXISTS idx_convert_logs_time ON convert_logs(created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_convert_logs_status ON convert_logs(status);
`);

// ─── Migration: Add item_id/shop_id to convert_logs ────
try {
  db.exec(`ALTER TABLE convert_logs ADD COLUMN item_id TEXT DEFAULT ''`);
} catch (e) { /* column already exists */ }
try {
  db.exec(`ALTER TABLE convert_logs ADD COLUMN shop_id TEXT DEFAULT ''`);
} catch (e) { /* column already exists */ }
try {
  db.exec(`CREATE INDEX IF NOT EXISTS idx_convert_logs_item ON convert_logs(item_id)`);
} catch (e) { /* index already exists */ }

// ─── Payouts table ─────────────────────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS payouts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    user_name TEXT DEFAULT '',
    role TEXT DEFAULT 'buyer' CHECK(role IN ('buyer','referrer')),
    amount REAL NOT NULL,
    payment_method TEXT DEFAULT '',
    bill_image TEXT DEFAULT '',
    admin_note TEXT DEFAULT '',
    status TEXT DEFAULT 'paid',
    paid_at TEXT DEFAULT (datetime('now','localtime')),
    created_at TEXT DEFAULT (datetime('now','localtime'))
  );

  CREATE INDEX IF NOT EXISTS idx_payouts_user ON payouts(user_id);
  CREATE INDEX IF NOT EXISTS idx_payouts_role ON payouts(role);
  CREATE INDEX IF NOT EXISTS idx_payouts_paid ON payouts(paid_at DESC);
`);

// ─── Orders table — mirrors Shopee CSV (47 cols) ───────
db.exec(`
  CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id TEXT NOT NULL,
    order_status TEXT DEFAULT '',
    checkout_id TEXT DEFAULT '',
    order_time TEXT DEFAULT '',
    complete_time TEXT DEFAULT '',
    click_time TEXT DEFAULT '',
    shop_name TEXT DEFAULT '',
    shop_id TEXT DEFAULT '',
    shop_type TEXT DEFAULT '',
    item_id TEXT DEFAULT '',
    item_name TEXT DEFAULT '',
    model_id TEXT DEFAULT '',
    product_type TEXT DEFAULT '',
    promotion_id TEXT DEFAULT '',
    category_l1 TEXT DEFAULT '',
    category_l2 TEXT DEFAULT '',
    category_l3 TEXT DEFAULT '',
    price REAL DEFAULT 0,
    quantity INTEGER DEFAULT 0,
    commission_type TEXT DEFAULT '',
    campaign_partner TEXT DEFAULT '',
    order_value REAL DEFAULT 0,
    refund_amount REAL DEFAULT 0,
    shopee_product_commission_rate REAL DEFAULT 0,
    shopee_product_commission REAL DEFAULT 0,
    seller_product_commission_rate REAL DEFAULT 0,
    xtra_product_commission REAL DEFAULT 0,
    total_product_commission REAL DEFAULT 0,
    order_commission REAL DEFAULT 0,
    order_bonus REAL DEFAULT 0,
    shopee_product_commission_rate_new REAL DEFAULT 0,
    shopee_product_commission_new REAL DEFAULT 0,
    seller_product_commission_rate_new REAL DEFAULT 0,
    xtra_product_commission_new REAL DEFAULT 0,
    total_product_commission_new REAL DEFAULT 0,
    order_commission_new REAL DEFAULT 0,
    order_bonus_new REAL DEFAULT 0,
    buyer_device TEXT DEFAULT '',
    utm_source TEXT DEFAULT '',
    utm_content TEXT DEFAULT '',
    click_source TEXT DEFAULT '',
    utm_campaign TEXT DEFAULT '',
    traffic_source TEXT DEFAULT '',
    sub_id1 TEXT DEFAULT '',
    sub_id2 TEXT DEFAULT '',
    sub_id3 TEXT DEFAULT '',
    sub_id4 TEXT DEFAULT '',
    sub_id5 TEXT DEFAULT '',
    imported_at TEXT DEFAULT (datetime('now','localtime')),
    UNIQUE(order_id, item_id)
  );

  CREATE INDEX IF NOT EXISTS idx_orders_time ON orders(order_time DESC);
  CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(order_status);
  CREATE INDEX IF NOT EXISTS idx_orders_sub ON orders(sub_id1, sub_id2);
  CREATE INDEX IF NOT EXISTS idx_orders_item ON orders(item_id);
  CREATE INDEX IF NOT EXISTS idx_orders_shop ON orders(shop_id);
`);

// ─── Migration: Add missing order columns (47-col CSV) ──
const orderMigrations = [
  'total_order_commission REAL DEFAULT 0',
  'mcn_name TEXT DEFAULT ""',
  'mcn_contract TEXT DEFAULT ""',
  'mcn_fee_rate REAL DEFAULT 0',
  'mcn_fee_amount REAL DEFAULT 0',
  'agreed_commission_rate REAL DEFAULT 0',
  'net_commission REAL DEFAULT 0',
  'product_status TEXT DEFAULT ""',
  'product_note TEXT DEFAULT ""',
  'attribute_type TEXT DEFAULT ""',
  'buyer_status TEXT DEFAULT ""',
  'channel TEXT DEFAULT ""',
];
for (const col of orderMigrations) {
  try { db.exec(`ALTER TABLE orders ADD COLUMN ${col}`); } catch (e) { /* exists */ }
}

// ─── Product Images cache (img_code from Shopee API) ────
db.exec(`
  CREATE TABLE IF NOT EXISTS product_images (
    item_id TEXT PRIMARY KEY,
    shop_id TEXT DEFAULT '',
    img_code TEXT NOT NULL,
    cached_at TEXT DEFAULT (datetime('now','localtime'))
  );
`);

module.exports = db;
