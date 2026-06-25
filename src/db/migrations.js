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
    is_special INTEGER DEFAULT 0,
    custom_rate REAL DEFAULT 0
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
    UNIQUE(order_id, item_id, model_id)
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
    avatar TEXT DEFAULT NULL,
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

  -- New: Redirect short links
  CREATE TABLE IF NOT EXISTS link_redirects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    token TEXT UNIQUE NOT NULL,
    convert_log_id INTEGER DEFAULT NULL,
    affiliate_link TEXT NOT NULL,
    user_id TEXT DEFAULT '',
    user_name TEXT DEFAULT '',
    item_id TEXT DEFAULT '',
    product_name TEXT DEFAULT '',
    click_count INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now','localtime')),
    expires_at TEXT NOT NULL
  );
  -- Composite index: covers the hot-path query WHERE token = ? AND expires_at > ?
  CREATE INDEX IF NOT EXISTS idx_redirect_token_expiry ON link_redirects(token, expires_at);
  CREATE INDEX IF NOT EXISTS idx_redirect_user ON link_redirects(user_id);

  -- New: Click events for redirect tracking
  CREATE TABLE IF NOT EXISTS link_click_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    token TEXT NOT NULL,
    redirect_id INTEGER DEFAULT NULL,
    ip_address TEXT DEFAULT '',
    user_agent TEXT DEFAULT '',
    device_type TEXT DEFAULT '',
    os_name TEXT DEFAULT '',
    browser_name TEXT DEFAULT '',
    referer TEXT DEFAULT '',
    accept_language TEXT DEFAULT '',
    clicked_at TEXT DEFAULT (datetime('now','localtime'))
  );
  CREATE INDEX IF NOT EXISTS idx_clicks_token ON link_click_events(token);
  CREATE INDEX IF NOT EXISTS idx_clicks_time ON link_click_events(clicked_at DESC);

  -- Cash Flow: transaction categories (per type)
  CREATE TABLE IF NOT EXISTS cashflow_categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    color TEXT DEFAULT '#6b7280',
    type TEXT DEFAULT 'expense' CHECK(type IN ('income','cashback','expense')),
    is_active INTEGER DEFAULT 1,
    created_by TEXT DEFAULT '',
    created_at TEXT DEFAULT (datetime('now','localtime')),
    UNIQUE(name, type)
  );
  CREATE INDEX IF NOT EXISTS idx_cashflow_cat_type ON cashflow_categories(type);

  -- Cash Flow: fund ledger (income / cashback / expense)
  CREATE TABLE IF NOT EXISTS cashflow_transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type TEXT NOT NULL CHECK(type IN ('income','cashback','expense')),
    amount REAL NOT NULL,
    category_id INTEGER DEFAULT NULL,
    description TEXT DEFAULT '',
    counterparty TEXT DEFAULT '',
    user_id TEXT DEFAULT '',
    reference_payout_id INTEGER UNIQUE DEFAULT NULL,
    receipt_image TEXT DEFAULT '',
    occurred_at TEXT DEFAULT (datetime('now','localtime')),
    created_by TEXT NOT NULL DEFAULT '',
    created_at TEXT DEFAULT (datetime('now','localtime'))
  );
  CREATE INDEX IF NOT EXISTS idx_cashflow_tx_type ON cashflow_transactions(type);
  CREATE INDEX IF NOT EXISTS idx_cashflow_tx_occurred ON cashflow_transactions(occurred_at DESC);
  CREATE INDEX IF NOT EXISTS idx_cashflow_tx_payout ON cashflow_transactions(reference_payout_id);
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
    UNIQUE(order_id, item_id, model_id)
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
    avatar TEXT DEFAULT NULL,
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

  -- New: Redirect short links
  CREATE TABLE IF NOT EXISTS link_redirects (
    id SERIAL PRIMARY KEY,
    token TEXT UNIQUE NOT NULL,
    convert_log_id INTEGER DEFAULT NULL,
    affiliate_link TEXT NOT NULL,
    user_id TEXT DEFAULT '',
    user_name TEXT DEFAULT '',
    item_id TEXT DEFAULT '',
    product_name TEXT DEFAULT '',
    click_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL
  );
  -- Composite index: covers the hot-path query WHERE token = ? AND expires_at > ?
  CREATE INDEX IF NOT EXISTS idx_redirect_token_expiry ON link_redirects(token, expires_at);
  CREATE INDEX IF NOT EXISTS idx_redirect_user ON link_redirects(user_id);

  -- New: Click events for redirect tracking
  CREATE TABLE IF NOT EXISTS link_click_events (
    id SERIAL PRIMARY KEY,
    token TEXT NOT NULL,
    redirect_id INTEGER DEFAULT NULL,
    ip_address TEXT DEFAULT '',
    user_agent TEXT DEFAULT '',
    device_type TEXT DEFAULT '',
    os_name TEXT DEFAULT '',
    browser_name TEXT DEFAULT '',
    referer TEXT DEFAULT '',
    accept_language TEXT DEFAULT '',
    clicked_at TIMESTAMPTZ DEFAULT NOW()
  );
  CREATE INDEX IF NOT EXISTS idx_clicks_token ON link_click_events(token);
  CREATE INDEX IF NOT EXISTS idx_clicks_time ON link_click_events(clicked_at DESC);

  -- System settings (key-value store for VPS expiry, etc.)
  CREATE TABLE IF NOT EXISTS system_settings (
    key TEXT PRIMARY KEY,
    value JSONB DEFAULT '{}',
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    updated_by TEXT DEFAULT ''
  );

  -- Cash Flow: transaction categories (per type)
  CREATE TABLE IF NOT EXISTS cashflow_categories (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    color TEXT DEFAULT '#6b7280',
    type TEXT DEFAULT 'expense' CHECK(type IN ('income','cashback','expense')),
    is_active BOOLEAN DEFAULT TRUE,
    created_by TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(name, type)
  );
  CREATE INDEX IF NOT EXISTS idx_cashflow_cat_type ON cashflow_categories(type);

  -- Cash Flow: fund ledger (income / cashback / expense)
  CREATE TABLE IF NOT EXISTS cashflow_transactions (
    id SERIAL PRIMARY KEY,
    type TEXT NOT NULL CHECK(type IN ('income','cashback','expense')),
    amount REAL NOT NULL,
    category_id INTEGER DEFAULT NULL,
    description TEXT DEFAULT '',
    counterparty TEXT DEFAULT '',
    user_id TEXT DEFAULT '',
    reference_payout_id INTEGER UNIQUE DEFAULT NULL,
    receipt_image TEXT DEFAULT '',
    occurred_at TIMESTAMPTZ DEFAULT NOW(),
    created_by TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT NOW()
  );
  CREATE INDEX IF NOT EXISTS idx_cashflow_tx_type ON cashflow_transactions(type);
  CREATE INDEX IF NOT EXISTS idx_cashflow_tx_occurred ON cashflow_transactions(occurred_at DESC);
  CREATE INDEX IF NOT EXISTS idx_cashflow_tx_payout ON cashflow_transactions(reference_payout_id);
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
      await db.exec(`ALTER TABLE users ADD COLUMN referrer_earn_rate REAL DEFAULT 20;`);
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
      await db.exec(`ALTER TABLE users ADD COLUMN is_special BOOLEAN DEFAULT FALSE;`);
    } else {
      await db.exec(`ALTER TABLE users ADD COLUMN is_special INTEGER DEFAULT 0;`);
    }
  } catch (err) {
    if (!err.message.toLowerCase().includes('duplicate column') && !err.message.toLowerCase().includes('already exists') && !err.message.toLowerCase().includes('duplicate column name')) {
      logger.warn('Migrations', `Failed to add is_special column: ${err.message}`);
    }
  }

  // Safe migration: Add redirect_token column to convert_logs
  try {
    if (db.type === 'postgres') {
      await db.exec(`ALTER TABLE convert_logs ADD COLUMN redirect_token TEXT DEFAULT '';`);
    } else {
      await db.exec(`ALTER TABLE convert_logs ADD COLUMN redirect_token TEXT DEFAULT '';`);
    }
  } catch (err) {
    if (!err.message.toLowerCase().includes('duplicate column') && !err.message.toLowerCase().includes('already exists') && !err.message.toLowerCase().includes('duplicate column name')) {
      logger.warn('Migrations', `Failed to add redirect_token column: ${err.message}`);
    }
  }

  // Safe migration: Add custom_rate column for F1 CTV custom commission
  try {
    if (db.type === 'postgres') {
      await db.exec(`ALTER TABLE users ADD COLUMN custom_rate REAL DEFAULT 0;`);
    } else {
      await db.exec(`ALTER TABLE users ADD COLUMN custom_rate REAL DEFAULT 0;`);
    }
  } catch (err) {
    if (!err.message.toLowerCase().includes('duplicate column') && !err.message.toLowerCase().includes('already exists') && !err.message.toLowerCase().includes('duplicate column name')) {
      logger.warn('Migrations', `Failed to add custom_rate column: ${err.message}`);
    }
  }

  // Safe migration: Add sub_id4 column to convert_logs (for from_custom tracking)
  try {
    if (db.type === 'postgres') {
      await db.exec(`ALTER TABLE convert_logs ADD COLUMN sub_id4 TEXT DEFAULT '';`);
    } else {
      await db.exec(`ALTER TABLE convert_logs ADD COLUMN sub_id4 TEXT DEFAULT '';`);
    }
  } catch (err) {
    if (!err.message.toLowerCase().includes('duplicate column') && !err.message.toLowerCase().includes('already exists') && !err.message.toLowerCase().includes('duplicate column name')) {
      logger.warn('Migrations', `Failed to add sub_id4 column to convert_logs: ${err.message}`);
    }
  }

  // Safe migration: Add commission_mode column for multi-level F0-F3 system
  try {
    if (db.type === 'postgres') {
      await db.exec(`ALTER TABLE users ADD COLUMN commission_mode TEXT DEFAULT 'normal';`);
    } else {
      await db.exec(`ALTER TABLE users ADD COLUMN commission_mode TEXT DEFAULT 'normal';`);
    }
  } catch (err) {
    if (!err.message.toLowerCase().includes('duplicate column') && !err.message.toLowerCase().includes('already exists') && !err.message.toLowerCase().includes('duplicate column name')) {
      logger.warn('Migrations', `Failed to add commission_mode column: ${err.message}`);
    }
  }

  // Safe migration: Update payouts role constraint for F0-F3 system
  if (db.type === 'postgres') {
    try {
      await db.exec(`ALTER TABLE payouts DROP CONSTRAINT IF EXISTS payouts_role_check;`);
      await db.exec(`ALTER TABLE payouts ADD CONSTRAINT payouts_role_check CHECK(role IN ('buyer','referrer','f0','f1','f2','f3','custom','combined'));`);
    } catch (err) {
      if (!err.message.includes('already exists')) {
        logger.warn('Migrations', `Failed to update payouts role constraint: ${err.message}`);
      }
    }
  }

  // Safe migration: Add avatar column to admin_users
  try {
    if (db.type === 'postgres') {
      await db.exec(`ALTER TABLE admin_users ADD COLUMN avatar TEXT DEFAULT NULL;`);
    } else {
      await db.exec(`ALTER TABLE admin_users ADD COLUMN avatar TEXT DEFAULT NULL;`);
    }
  } catch (err) {
    if (!err.message.toLowerCase().includes('duplicate column') && !err.message.toLowerCase().includes('already exists') && !err.message.toLowerCase().includes('duplicate column name')) {
      logger.warn('Migrations', `Failed to add avatar column to admin_users: ${err.message}`);
    }
  }

  // Safe migration: Add bank_account_holder column to users (for /ruttien)
  try {
    if (db.type === 'postgres') {
      await db.exec(`ALTER TABLE users ADD COLUMN bank_account_holder TEXT DEFAULT '';`);
    } else {
      await db.exec(`ALTER TABLE users ADD COLUMN bank_account_holder TEXT DEFAULT '';`);
    }
  } catch (err) {
    if (!err.message.toLowerCase().includes('duplicate column') && !err.message.toLowerCase().includes('already exists') && !err.message.toLowerCase().includes('duplicate column name')) {
      logger.warn('Migrations', `Failed to add bank_account_holder column: ${err.message}`);
    }
  }

  // Safe migration: withdrawal_requests table (created by /ruttien command)
  try {
    if (db.type === 'postgres') {
      await db.exec(`
        CREATE TABLE IF NOT EXISTS withdrawal_requests (
          id SERIAL PRIMARY KEY,
          user_id TEXT NOT NULL,
          user_name TEXT DEFAULT '',
          amount REAL NOT NULL,
          breakdown JSONB DEFAULT '{}',
          bank_name TEXT DEFAULT '',
          bank_account TEXT DEFAULT '',
          account_holder TEXT DEFAULT '',
          status TEXT DEFAULT 'pending' CHECK(status IN ('pending','paid','rejected','cancelled')),
          admin_note TEXT DEFAULT '',
          payout_id INTEGER DEFAULT NULL,
          requested_at TIMESTAMPTZ DEFAULT NOW(),
          processed_at TIMESTAMPTZ,
          processed_by TEXT DEFAULT ''
        )
      `);
      await db.exec(`CREATE INDEX IF NOT EXISTS idx_withdrawal_user ON withdrawal_requests(user_id);`);
      await db.exec(`CREATE INDEX IF NOT EXISTS idx_withdrawal_status ON withdrawal_requests(status);`);
      await db.exec(`CREATE INDEX IF NOT EXISTS idx_withdrawal_requested ON withdrawal_requests(requested_at DESC);`);
    } else {
      await db.exec(`
        CREATE TABLE IF NOT EXISTS withdrawal_requests (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id TEXT NOT NULL,
          user_name TEXT DEFAULT '',
          amount REAL NOT NULL,
          breakdown TEXT DEFAULT '{}',
          bank_name TEXT DEFAULT '',
          bank_account TEXT DEFAULT '',
          account_holder TEXT DEFAULT '',
          status TEXT DEFAULT 'pending' CHECK(status IN ('pending','paid','rejected','cancelled')),
          admin_note TEXT DEFAULT '',
          payout_id INTEGER DEFAULT NULL,
          requested_at TEXT DEFAULT (datetime('now','localtime')),
          processed_at TEXT,
          processed_by TEXT DEFAULT ''
        );
        CREATE INDEX IF NOT EXISTS idx_withdrawal_user ON withdrawal_requests(user_id);
        CREATE INDEX IF NOT EXISTS idx_withdrawal_status ON withdrawal_requests(status);
        CREATE INDEX IF NOT EXISTS idx_withdrawal_requested ON withdrawal_requests(requested_at DESC);
      `);
    }
  } catch (err) {
    if (!err.message.toLowerCase().includes('already exists')) {
      logger.warn('Migrations', `Failed to create withdrawal_requests table: ${err.message}`);
    }
  }

  // Safe migration: orders UNIQUE constraint (order_id, item_id) → (order_id, item_id, model_id)
  // Shopee CSV can have 2 rows with same item_id but different model_id (product variants).
  // Old constraint collapsed them into 1 row, losing commission data.
  if (db.type === 'postgres') {
    try {
      // Drop old 2-col unique constraint (auto-named) if it exists
      await db.exec(`ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_order_id_item_id_key;`);
      // Add new 3-col unique constraint
      await db.exec(`
        DO $$ BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM pg_constraint WHERE conname = 'orders_order_item_model_key'
          ) THEN
            ALTER TABLE orders ADD CONSTRAINT orders_order_item_model_key UNIQUE(order_id, item_id, model_id);
          END IF;
        END $$;
      `);
    } catch (err) {
      logger.warn('Migrations', `Failed to update orders unique constraint: ${err.message}`);
    }
  }

  // Safe: Resync PG sequences to prevent duplicate key errors after manual data imports

  if (db.type === 'postgres') {
    const seqTables = ['convert_logs', 'payouts', 'orders', 'link_redirects', 'link_click_events', 'withdrawal_requests'];
    for (const table of seqTables) {
      try {
        await db.exec(`SELECT setval('${table}_id_seq', COALESCE((SELECT MAX(id) FROM ${table}), 0) + 1, false)`);
      } catch (e) { /* sequence may not exist for all tables */ }
    }
  }

  // Safe migration: seed default cashflow categories (idempotent)
  try {
    const defaultCats = [
      ['Hoa hồng Shopee', '#10b981', 'income'],
      ['Hoàn tiền', '#f59e0b', 'cashback'],
      ['Vận hành', '#ef4444', 'expense'],
      ['Marketing', '#8b5cf6', 'expense'],
      ['Khác', '#6b7280', 'expense'],
    ];
    for (const [name, color, type] of defaultCats) {
      if (db.type === 'postgres') {
        await db.run(
          `INSERT INTO cashflow_categories (name, color, type, created_by)
           VALUES ($1, $2, $3, 'system') ON CONFLICT (name, type) DO NOTHING`,
          [name, color, type]
        );
      } else {
        await db.run(
          `INSERT OR IGNORE INTO cashflow_categories (name, color, type, created_by)
           VALUES (?, ?, ?, 'system')`,
          [name, color, type]
        );
      }
    }
  } catch (err) {
    logger.warn('Migrations', `Failed to seed cashflow categories: ${err.message}`);
  }

  logger.info('Migrations', `Schema initialized (${db.type})`);
}

module.exports = { runMigrations };
