#!/usr/bin/env node
/**
 * Reset all orders data (including payouts).
 * Usage: node scripts/reset-orders.js
 */
const db = require('../src/db');

async function main() {
  console.log('⚠️  Resetting orders & payouts...\n');

  const orderCount = await db.get('SELECT COUNT(*) as cnt FROM orders');
  const payoutCount = await db.get('SELECT COUNT(*) as cnt FROM payouts');

  console.log(`  📦 Orders to delete: ${orderCount?.cnt || 0}`);
  console.log(`  💰 Payouts to delete: ${payoutCount?.cnt || 0}`);

  await db.run('DELETE FROM orders');
  await db.run('DELETE FROM payouts');

  console.log('\n✅ Done! Orders & Payouts cleared.');
  console.log('   → Import đơn mới từ Shopee CSV qua Admin Dashboard.');
  process.exit(0);
}

main().catch(err => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
