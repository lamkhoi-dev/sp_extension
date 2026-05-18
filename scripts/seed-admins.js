/**
 * Seed initial admin accounts.
 * Usage: node scripts/seed-admins.js
 *
 * Creates 4 admin accounts with default password "changeme123".
 * Idempotent — skips existing usernames.
 */

require('dotenv').config();
const db = require('../src/db');
const { runMigrations } = require('../src/db/migrations');
const authStore = require('../src/auth/auth-store');

const ADMINS = [
  { username: 'admin1', displayName: 'Admin 1' },
  { username: 'admin2', displayName: 'Admin 2' },
  { username: 'admin3', displayName: 'Admin 3' },
  { username: 'admin4', displayName: 'Admin 4' },
];

const DEFAULT_PASSWORD = 'changeme123';

async function seed() {
  await runMigrations(db);
  console.log('\n🌱 Seeding admin accounts...\n');

  for (const admin of ADMINS) {
    await authStore.createAdmin(admin.username, DEFAULT_PASSWORD, admin.displayName);
    console.log(`  ✅ ${admin.username} (${admin.displayName})`);
  }

  console.log(`\n📌 Default password: ${DEFAULT_PASSWORD}`);
  console.log('⚠️  Each admin must change password on first login.\n');
  process.exit(0);
}

seed().catch(err => {
  console.error('❌ Seed failed:', err);
  process.exit(1);
});
