#!/usr/bin/env node
/**
 * Full Staging Reset — Clears ALL transactional data, keeps Settings & Admins.
 *
 * Deletes: orders, convert_logs, payouts, users, messages,
 *          withdrawal_requests, stat_reports, link_redirects,
 *          link_click_events, product_images, audit_logs
 *
 * Keeps: system_settings (VPS config, commission rates)
 *        admin_users     (admin accounts & passwords)
 *
 * Usage: node scripts/reset-staging-full.js
 */

require('dotenv').config();
const { Pool } = require('pg');

const DB_URL = process.env.STAGING_DATABASE_URL;
if (!DB_URL) {
  console.error('❌ Missing STAGING_DATABASE_URL in .env');
  process.exit(1);
}
const dbUrl = DB_URL.replace(/[?&]sslmode=[^&]*/g, '').replace(/\?$/, '');
const pool = new Pool({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });

const TABLES = [
  'withdrawal_requests',
  'link_click_events',
  'link_redirects',
  'stat_reports',
  'audit_logs',
  'payouts',
  'orders',
  'convert_logs',
  'messages',
  'product_images',
  'users',
];

async function reset() {
  const client = await pool.connect();
  try {
    // Show current counts first
    console.log('📊 Current staging DB state:');
    for (const t of [...TABLES, 'system_settings', 'admin_users']) {
      try {
        const r = await client.query(`SELECT COUNT(*) as n FROM ${t}`);
        console.log(`   ${t.padEnd(25)} ${r.rows[0].n} rows`);
      } catch { console.log(`   ${t.padEnd(25)} (not found)`); }
    }

    console.log('\n⚠️  This will DELETE all data above EXCEPT system_settings and admin_users.');
    console.log('Press Ctrl+C within 3s to cancel...\n');
    await new Promise(r => setTimeout(r, 3000));

    await client.query('BEGIN');
    console.log('🧹 Resetting...\n');

    for (const table of TABLES) {
      try {
        const r = await client.query(`DELETE FROM ${table}`);
        console.log(`  ✅ ${table.padEnd(25)} ${r.rowCount} rows deleted`);
      } catch (err) {
        console.log(`  ⚠️  ${table.padEnd(25)} skipped: ${err.message}`);
      }
    }

    // Resync sequences
    const seqTables = ['orders', 'payouts', 'convert_logs', 'link_redirects', 'link_click_events', 'withdrawal_requests'];
    for (const t of seqTables) {
      try {
        await client.query(`SELECT setval('${t}_id_seq', 1, false)`);
      } catch {}
    }

    await client.query('COMMIT');
    console.log('\n✅ Staging full reset complete!');
    console.log('   system_settings and admin_users are untouched.\n');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Reset failed:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

reset();
