/**
 * Database Migrations — Initializes schema for both SQLite and PostgreSQL.
 *
 * Called once on server startup. Idempotent (CREATE IF NOT EXISTS).
 */

const logger = require('../logger');

const SQLITE_SCHEMA = `
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
    cached_at TEXT DEFAULT (datetime('now','localtime')),
    referrer_id TEXT DEFAULT '',
    referrer_name TEXT DEFAULT '',
    bank_name TEXT,
    bank_account TEXT,
    qr_code TEXT,
    total_commission REAL,
    total_refunded REAL,
    cashback_buyer_rate REAL DEFAULT 60,
    cashback_referrer_rate REAL DEFAULT 20,
    referrer_earn_rate REAL DEFAULT 20,
    is_special INTEGER DEFAULT 0
  );
  CREATE INDEX IF NOT EXISTS idx_users_msg_count ON users(message_count DESC);
  CREATE INDEX IF NOT EXISTS idx_users_last_seen ON users(last_seen DESC);

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
    item_id TEXT DEFAULT '',
    shop_id TEXT DEFAULT '',
    created_at TEXT DEFAULT (datetime('now','localtime'))
  );
  CREATE INDEX IF NOT EXISTS idx_convert_logs_user ON convert_logs(user_id);
  CREATE INDEX IF NOT EXISTS idx_convert_logs_time ON convert_logs(created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_convert_logs_status ON convert_logs(status);
  CREATE INDEX IF NOT EXISTS idx_convert_logs_item ON convert_logs(item_id);

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
    paid_orders TEXT DEFAULT NULL,
    created_at TEXT DEFAULT (datetime('now','localtime'))
  );
  CREATE INDEX IF NOT EXISTS idx_payouts_user ON payouts(user_id);
  CREATE INDEX IF NOT EXISTS idx_payouts_role ON payouts(role);
  CREATE INDEX IF NOT EXISTS idx_payouts_paid ON payouts(paid_at DESC);

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
    total_order_commission REAL DEFAULT 0,
    mcn_name TEXT DEFAULT '',
    mcn_contract TEXT DEFAULT '',
    mcn_fee_rate REAL DEFAULT 0,
    mcn_fee_amount REAL DEFAULT 0,
    agreed_commission_rate REAL DEFAULT 0,
    net_commission REAL DEFAULT 0,
    product_status TEXT DEFAULT '',
    product_note TEXT DEFAULT '',
    attribute_type TEXT DEFAULT '',
    buyer_status TEXT DEFAULT '',
    channel TEXT DEFAULT '',
    imported_at TEXT DEFAULT (datetime('now','localtime')),
    UNIQUE(order_id, item_id)
  );
  CREATE INDEX IF NOT EXISTS idx_orders_time ON orders(order_time DESC);
  CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(order_status);
  CREATE INDEX IF NOT EXISTS idx_orders_sub ON orders(sub_id1, sub_id2);
  CREATE INDEX IF NOT EXISTS idx_orders_item ON orders(item_id);
  CREATE INDEX IF NOT EXISTS idx_orders_shop ON orders(shop_id);

  CREATE TABLE IF NOT EXISTS product_images (
    item_id TEXT PRIMARY KEY,
    shop_id TEXT DEFAULT '',
    img_code TEXT NOT NULL,
    cached_at TEXT DEFAULT (datetime('now','localtime'))
  );

  -- New: Admin users
  CREATE TABLE IF NOT EXISTS admin_users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    display_name TEXT DEFAULT '',
    is_active INTEGER DEFAULT 1,
    must_change_password INTEGER DEFAULT 1,
    last_login TEXT,
    created_at TEXT DEFAULT (datetime('now','localtime'))
  );

  -- New: Audit logs
  CREATE TABLE IF NOT EXISTS audit_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    admin_username TEXT NOT NULL,
    action TEXT NOT NULL,
    resource_type TEXT NOT NULL,
    resource_id TEXT DEFAULT '',
    details TEXT DEFAULT '{}',
    ip_address TEXT DEFAULT '',
    created_at TEXT DEFAULT (datetime('now','localtime'))
  );
  CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs(created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_audit_admin ON audit_logs(admin_username);

  -- New: Stat reports (24h expiry)
  CREATE TABLE IF NOT EXISTS stat_reports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    token TEXT UNIQUE NOT NULL,
    user_id TEXT NOT NULL,
    data TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now','localtime'))
  );
  CREATE INDEX IF NOT EXISTS idx_report_token ON stat_reports(token);
  CREATE INDEX IF NOT EXISTS idx_report_expires ON stat_reports(expires_at);
`;

const PG_SCHEMA = `
  CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,
    thread_id TEXT NOT NULL,
    sender_id TEXT NOT NULL,
    sender_name TEXT DEFAULT '',
    content TEXT DEFAULT '',
    raw_type TEXT DEFAULT 'text',
    is_group BOOLEAN DEFAULT FALSE,
    received_at TIMESTAMPTZ NOT NULL,
    status TEXT DEFAULT 'received' CHECK(status IN ('received','processing','replied','failed','skipped')),
    reply_text TEXT,
    replied_at TIMESTAMPTZ,
    processing_time_ms INTEGER,
    error TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
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
    is_friend BOOLEAN DEFAULT FALSE,
    is_blocked BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT FALSE,
    is_active_pc BOOLEAN DEFAULT FALSE,
    is_active_web BOOLEAN DEFAULT FALSE,
    last_action_time BIGINT DEFAULT 0,
    account_status INTEGER DEFAULT 0,
    global_id TEXT DEFAULT '',
    message_count INTEGER DEFAULT 0,
    first_contact TIMESTAMPTZ,
    last_seen TIMESTAMPTZ,
    cached_at TIMESTAMPTZ DEFAULT NOW(),
    referrer_id TEXT DEFAULT '',
    referrer_name TEXT DEFAULT '',
    bank_name TEXT,
    bank_account TEXT,
    qr_code TEXT,
    total_commission REAL,
    total_refunded REAL,
    cashback_buyer_rate REAL DEFAULT 60,
    cashback_referrer_rate REAL DEFAULT 20,
    referrer_earn_rate REAL DEFAULT 20,
    is_special BOOLEAN DEFAULT FALSE
  );
  CREATE INDEX IF NOT EXISTS idx_users_msg_count ON users(message_count DESC);
  CREATE INDEX IF NOT EXISTS idx_users_last_seen ON users(last_seen DESC);

  CREATE TABLE IF NOT EXISTS convert_logs (
    id SERIAL PRIMARY KEY,
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
    item_id TEXT DEFAULT '',
    shop_id TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT NOW()
  );
  CREATE INDEX IF NOT EXISTS idx_convert_logs_user ON convert_logs(user_id);
  CREATE INDEX IF NOT EXISTS idx_convert_logs_time ON convert_logs(created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_convert_logs_status ON convert_logs(status);
  CREATE INDEX IF NOT EXISTS idx_convert_logs_item ON convert_logs(item_id);

  CREATE TABLE IF NOT EXISTS payouts (
    id SERIAL PRIMARY KEY,
    user_id TEXT NOT NULL,
    user_name TEXT DEFAULT '',
    role TEXT DEFAULT 'buyer' CHECK(role IN ('buyer','referrer')),
    amount REAL NOT NULL,
    payment_method TEXT DEFAULT '',
    bill_image TEXT DEFAULT '',
    admin_note TEXT DEFAULT '',
    status TEXT DEFAULT 'paid',
    paid_at TIMESTAMPTZ DEFAULT NOW(),
    paid_orders JSONB DEFAULT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
  );
  CREATE INDEX IF NOT EXISTS idx_payouts_user ON payouts(user_id);
  CREATE INDEX IF NOT EXISTS idx_payouts_role ON payouts(role);
  CREATE INDEX IF NOT EXISTS idx_payouts_paid ON payouts(paid_at DESC);

  CREATE TABLE IF NOT EXISTS orders (
    id SERIAL PRIMARY KEY,
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
    total_order_commission REAL DEFAULT 0,
    mcn_name TEXT DEFAULT '',
    mcn_contract TEXT DEFAULT '',
    mcn_fee_rate REAL DEFAULT 0,
    mcn_fee_amount REAL DEFAULT 0,
    agreed_commission_rate REAL DEFAULT 0,
    net_commission REAL DEFAULT 0,
    product_status TEXT DEFAULT '',
    product_note TEXT DEFAULT '',
    attribute_type TEXT DEFAULT '',
    buyer_status TEXT DEFAULT '',
    channel TEXT DEFAULT '',
    imported_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(order_id, item_id)
  );
  CREATE INDEX IF NOT EXISTS idx_orders_time ON orders(order_time DESC);
  CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(order_status);
  CREATE INDEX IF NOT EXISTS idx_orders_sub ON orders(sub_id1, sub_id2);
  CREATE INDEX IF NOT EXISTS idx_orders_item ON orders(item_id);
  CREATE INDEX IF NOT EXISTS idx_orders_shop ON orders(shop_id);

  CREATE TABLE IF NOT EXISTS product_images (
    item_id TEXT PRIMARY KEY,
    shop_id TEXT DEFAULT '',
    img_code TEXT NOT NULL,
    cached_at TIMESTAMPTZ DEFAULT NOW()
  );

  CREATE TABLE IF NOT EXISTS admin_users (
    id SERIAL PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    display_name TEXT DEFAULT '',
    is_active BOOLEAN DEFAULT TRUE,
    must_change_password BOOLEAN DEFAULT TRUE,
    last_login TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
  );

  CREATE TABLE IF NOT EXISTS audit_logs (
    id SERIAL PRIMARY KEY,
    admin_username TEXT NOT NULL,
    action TEXT NOT NULL,
    resource_type TEXT NOT NULL,
    resource_id TEXT DEFAULT '',
    details JSONB DEFAULT '{}',
    ip_address TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT NOW()
  );
  CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs(created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_audit_admin ON audit_logs(admin_username);

  CREATE TABLE IF NOT EXISTS stat_reports (
    id SERIAL PRIMARY KEY,
    token TEXT UNIQUE NOT NULL,
    user_id TEXT NOT NULL,
    data JSONB NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
  );
  CREATE INDEX IF NOT EXISTS idx_report_token ON stat_reports(token);
  CREATE INDEX IF NOT EXISTS idx_report_expires ON stat_reports(expires_at);
`;

async function runMigrations(db) {
  const schema = db.type === 'postgres' ? PG_SCHEMA : SQLITE_SCHEMA;

  if (db.type === 'postgres') {
    // PG: run each statement separately (PG doesn't support multi-statement exec well)
    const statements = schema
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0);

    for (const stmt of statements) {
      try {
        await db.exec(stmt);
      } catch (err) {
        // Ignore "already exists" errors
        if (!err.message.includes('already exists')) {
          logger.warn('Migrations', `Statement failed: ${err.message}`);
        }
      }
    }
  } else {
    // SQLite: exec supports multi-statement
    await db.exec(schema);
  }

  // Safe migration: Add paid_orders column if it doesn't exist
  try {
    if (db.type === 'postgres') {
      await db.exec(`ALTER TABLE payouts ADD COLUMN paid_orders JSONB DEFAULT NULL;`);
    } else {
      await db.exec(`ALTER TABLE payouts ADD COLUMN paid_orders TEXT DEFAULT NULL;`);
    }
  } catch (err) {
    // Ignore duplicate column errors
    if (!err.message.toLowerCase().includes('duplicate column') && !err.message.includes('already exists')) {
      logger.warn('Migrations', `Failed to add paid_orders column: ${err.message}`);
    }
  }

  // Safe migration: Add referrer_earn_rate column if it doesn't exist
  try {
    if (db.type === 'postgres') {
      await db.exec(`ALTER TABLE users ADD COLUMN IF NOT EXISTS referrer_earn_rate REAL DEFAULT 20;`);
    } else {
      await db.exec(`ALTER TABLE users ADD COLUMN referrer_earn_rate REAL DEFAULT 20;`);
    }
  } catch (err) {
    if (!err.message.toLowerCase().includes('duplicate column') && !err.message.toLowerCase().includes('already exists') && !err.message.toLowerCase().includes('duplicate column name')) {
      logger.warn('Migrations', `Failed to add referrer_earn_rate column: ${err.message}`);
    }
  }

  // Safe migration: Add is_special column if it doesn't exist
  try {
    if (db.type === 'postgres') {
      await db.exec(`ALTER TABLE users ADD COLUMN IF NOT EXISTS is_special BOOLEAN DEFAULT FALSE;`);
    } else {
      await db.exec(`ALTER TABLE users ADD COLUMN is_special INTEGER DEFAULT 0;`);
    }
  } catch (err) {
    if (!err.message.toLowerCase().includes('duplicate column') && !err.message.toLowerCase().includes('already exists') && !err.message.toLowerCase().includes('duplicate column name')) {
      logger.warn('Migrations', `Failed to add is_special column: ${err.message}`);
    }
  }

  // Safe: Resync PG sequences to prevent duplicate key errors after manual data imports
  if (db.type === 'postgres') {
    const seqTables = ['convert_logs', 'payouts', 'orders'];
    for (const table of seqTables) {
      try {
        await db.exec(`SELECT setval('${table}_id_seq', COALESCE((SELECT MAX(id) FROM ${table}), 0) + 1, false)`);
      } catch (e) { /* sequence may not exist for all tables */ }
    }
  }

  logger.info('Migrations', `Schema initialized (${db.type})`);
}

module.exports = { runMigrations };
