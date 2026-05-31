#!/bin/bash
# scripts/init-staging-db.sh
# Khởi tạo DB staging mới trên Aiven:
#   1. Chạy migration tạo toàn bộ schema (trống)
#   2. Export admin_users từ DB cũ
#   3. Import admin_users vào DB mới
#
# Usage:
#   OLD_DB_URL="postgres://..." NEW_DB_URL="postgres://..." bash scripts/init-staging-db.sh

set -e

OLD_DB_URL="${OLD_DB_URL:-}"
NEW_DB_URL="${NEW_DB_URL:-}"

if [ -z "$OLD_DB_URL" ] || [ -z "$NEW_DB_URL" ]; then
  echo "❌ Thiếu biến môi trường."
  echo "   OLD_DB_URL=<production-db-url> NEW_DB_URL=<staging-db-url> bash $0"
  exit 1
fi

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🗄️  DB Staging Init Script"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# ── 1. Chạy migrations tạo schema trên DB mới ──────────────────────────────
echo ""
echo "📐 Bước 1/3: Tạo schema trên DB mới..."
DATABASE_URL="$NEW_DB_URL" node -e "
  process.env.DATABASE_URL = process.env.DATABASE_URL;
  const PgAdapter = require('./src/db/pg-adapter');
  const { runMigrations } = require('./src/db/migrations');
  const db = new PgAdapter(process.env.DATABASE_URL);
  runMigrations(db)
    .then(() => { console.log('  ✅ Schema đã tạo xong.'); process.exit(0); })
    .catch(e => { console.error('  ❌ Migration thất bại:', e.message); process.exit(1); });
"

# ── 2. Export admin_users từ DB cũ ─────────────────────────────────────────
echo ""
echo "📤 Bước 2/3: Export admin_users từ DB cũ..."
pg_dump "$OLD_DB_URL" \
  --table=admin_users \
  --data-only \
  --column-inserts \
  --no-owner \
  --no-privileges \
  -f /tmp/admin_users_export.sql

echo "  ✅ Export xong → /tmp/admin_users_export.sql"
echo "  📋 Preview:"
cat /tmp/admin_users_export.sql | grep "^INSERT" | head -5

# ── 3. Import admin_users vào DB mới ───────────────────────────────────────
echo ""
echo "📥 Bước 3/3: Import admin_users vào DB mới..."
psql "$NEW_DB_URL" -f /tmp/admin_users_export.sql
echo "  ✅ Import xong."

# ── Verify ──────────────────────────────────────────────────────────────────
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🔍 Verify:"
echo ""
echo "  [admin_users] Đã import:"
psql "$NEW_DB_URL" -c "SELECT id, username, display_name, is_active FROM admin_users;"

echo ""
echo "  [users] Phải = 0:"
psql "$NEW_DB_URL" -c "SELECT COUNT(*) AS users_count FROM users;"

echo ""
echo "  [orders] Phải = 0:"
psql "$NEW_DB_URL" -c "SELECT COUNT(*) AS orders_count FROM orders;"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ Hoàn tất! DB staging sẵn sàng."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "  .env staging cần set:"
echo "  DATABASE_URL=$NEW_DB_URL"
