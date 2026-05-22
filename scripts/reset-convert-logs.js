#!/usr/bin/env node
/**
 * Reset all convert logs (link conversion history).
 * Usage: node scripts/reset-convert-logs.js
 */
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const db = require('../src/db');

async function main() {
  console.log('⚠️  Resetting convert logs...\n');

  const logCount = await db.get('SELECT COUNT(*) as cnt FROM convert_logs');
  console.log(`  🔗 Convert logs to delete: ${logCount?.cnt || 0}`);

  await db.run('DELETE FROM convert_logs');

  console.log('\n✅ Done! Convert logs cleared.');
  console.log('   → Lịch sử convert link đã được xóa sạch.');
  process.exit(0);
}

main().catch(err => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
