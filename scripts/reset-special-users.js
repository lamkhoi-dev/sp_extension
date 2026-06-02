/**
 * Reset special/custom users back to normal defaults.
 *
 * Defaults:
 *   commission_mode    = 'normal'
 *   custom_rate        = 0
 *   is_special         = false
 *   referrer_earn_rate = 20   (F1 rate)
 *   cashback_buyer_rate= 60   (legacy field — kept in sync)
 *
 * Usage:
 *   node scripts/reset-special-users.js          # dry run (shows what will change)
 *   node scripts/reset-special-users.js --apply  # actually apply
 */

require('dotenv').config();
const db = require('../src/db');

const DRY_RUN = !process.argv.includes('--apply');

async function main() {
  const rows = await db.all(`
    SELECT user_id, display_name, commission_mode, custom_rate, is_special,
           referrer_earn_rate, cashback_buyer_rate
    FROM users
    WHERE is_special = true
       OR commission_mode = 'custom'
       OR referrer_earn_rate != 20
       OR cashback_buyer_rate != 60
    ORDER BY display_name
  `);

  if (rows.length === 0) {
    console.log('✅ Không có user nào cần reset.');
    process.exit(0);
  }

  console.log(`\n${DRY_RUN ? '[DRY RUN]' : '[APPLY]'} ${rows.length} user sẽ bị reset:\n`);
  console.log('  ' + ['User ID'.padEnd(22), 'Tên'.padEnd(20), 'mode'.padEnd(8), 'custom%'.padEnd(9), 'special'.padEnd(8), 'ref_rate'.padEnd(9), 'buyer_rate'].join('│ '));
  console.log('  ' + '-'.repeat(100));
  for (const r of rows) {
    console.log('  ' + [
      String(r.user_id).padEnd(22),
      String(r.display_name || '--').padEnd(20),
      String(r.commission_mode || '--').padEnd(8),
      String(r.custom_rate ?? '--').padEnd(9),
      String(r.is_special).padEnd(8),
      String(r.referrer_earn_rate ?? '--').padEnd(9),
      String(r.cashback_buyer_rate ?? '--'),
    ].join('│ '));
  }

  if (DRY_RUN) {
    console.log('\n⚠️  Dry run — không có gì thay đổi.');
    console.log('   Chạy với --apply để thực hiện:\n');
    console.log('   node scripts/reset-special-users.js --apply\n');
    process.exit(0);
  }

  // Apply reset
  const ids = rows.map(r => r.user_id);
  const placeholders = ids.map((_, i) => `$${i + 1}`).join(',');
  await db.run(`
    UPDATE users
    SET commission_mode     = 'normal',
        custom_rate         = 0,
        is_special          = false,
        referrer_earn_rate  = 20,
        cashback_buyer_rate = 60,
        cashback_referrer_rate = 20
    WHERE user_id IN (${placeholders})
  `, ids);

  console.log(`\n✅ Đã reset ${ids.length} user về mặc định.`);

  // Verify
  const after = await db.all(`
    SELECT user_id, display_name, commission_mode, custom_rate, is_special,
           referrer_earn_rate, cashback_buyer_rate
    FROM users WHERE user_id IN (${placeholders})
    ORDER BY display_name
  `, ids);

  console.log('\nKiểm tra sau reset:');
  for (const r of after) {
    const ok = r.commission_mode === 'normal' && !r.is_special && r.referrer_earn_rate == 20 && r.cashback_buyer_rate == 60;
    console.log(`  ${ok ? '✓' : '✗'} ${r.display_name} — mode=${r.commission_mode}, special=${r.is_special}, ref_rate=${r.referrer_earn_rate}, buyer_rate=${r.cashback_buyer_rate}`);
  }

  process.exit(0);
}

main().catch(err => {
  console.error('❌ Lỗi:', err.message);
  process.exit(1);
});
