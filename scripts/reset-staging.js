#!/usr/bin/env node
/**
 * Reset Staging Orders — Clears all seed data from staging DB.
 *
 * Usage: node scripts/reset-staging.js
 *
 * Deletes:
 * - All orders with order_id starting with 'SEED'
 * - All convert_logs for seed users
 * - All payouts for seed users
 * - All seed users (seed_user_*)
 *
 * Safe: Only touches seed_* prefixed data.
 */

require('dotenv').config();
const { Pool } = require('pg');

const DB_URL = process.env.STAGING_DATABASE_URL;
if (!DB_URL) {
  console.error('❌ Missing STAGING_DATABASE_URL in .env');
  process.exit(1);
}
let dbUrl = DB_URL.replace(/[?&]sslmode=[^&]*/g, '');
if (dbUrl.includes('?') && dbUrl.endsWith('?')) dbUrl = dbUrl.slice(0, -1);

const pool = new Pool({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });

const SEED_USER_IDS = [
  'seed_user_a', 'seed_user_b', 'seed_user_c', 'seed_user_d', 'seed_user_e',
];

async function reset() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    console.log('🧹 Resetting staging seed data...\n');

    // 1. Delete seed orders
    const r1 = await client.query(`DELETE FROM orders WHERE order_id LIKE 'SEED%'`);
    console.log(`  🗑️  Orders:      ${r1.rowCount} deleted`);

    // 2. Delete convert_logs for seed users
    const placeholders = SEED_USER_IDS.map((_, i) => `$${i + 1}`).join(',');
    const r2 = await client.query(`DELETE FROM convert_logs WHERE user_id IN (${placeholders})`, SEED_USER_IDS);
    console.log(`  🗑️  ConvertLogs: ${r2.rowCount} deleted`);

    // 3. Delete payouts for seed users
    const r3 = await client.query(`DELETE FROM payouts WHERE user_id IN (${placeholders})`, SEED_USER_IDS);
    console.log(`  🗑️  Payouts:     ${r3.rowCount} deleted`);

    // 4. Delete seed users
    const r4 = await client.query(`DELETE FROM users WHERE user_id IN (${placeholders})`, SEED_USER_IDS);
    console.log(`  🗑️  Users:       ${r4.rowCount} deleted`);

    await client.query('COMMIT');
    console.log('\n✅ Staging reset complete!\n');
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
