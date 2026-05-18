/**
 * Reset payout history — clears all payment records.
 * Keeps: user info, referrer relationships, personal data.
 * Clears: payouts table (all payment history).
 *
 * Usage: node scripts/reset-payouts.js
 */
const path = require('path');
process.env.DB_PATH = process.env.DB_PATH || path.join(__dirname, '..', 'data', 'database.sqlite');

const db = require('../src/db');

async function run() {
  console.log('⚠️  Resetting payout history...\n');

  const before = await db.get('SELECT COUNT(*) as count FROM payouts');
  console.log(`  payouts records: ${before.count}`);

  await db.run('DELETE FROM payouts');

  console.log('\n✅ Done — all payout history cleared.');
  console.log('   User info & referrer relationships are untouched.');
  process.exit(0);
}

run().catch(err => { console.error('❌', err.message); process.exit(1); });
