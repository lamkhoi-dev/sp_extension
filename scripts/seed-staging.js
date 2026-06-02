#!/usr/bin/env node
/**
 * Seed Staging — Insert 10 demo orders with full F0-F3 chain.
 *
 * Usage: node scripts/seed-staging.js
 *
 * Creates:
 * - 5 users (A→B→C→D + E as custom)
 * - 10 orders across F0/F1/F2/F3/Custom branches
 * - Matching convert_logs for order-log JOIN
 */

require('dotenv').config();
const { Pool } = require('pg');

const DB_URL = process.env.STAGING_DATABASE_URL;
if (!DB_URL) {
  console.error('❌ Missing STAGING_DATABASE_URL in .env');
  process.exit(1);
}
// Strip sslmode from URL (handled by ssl config below)
let dbUrl = DB_URL.replace(/[?&]sslmode=[^&]*/g, '');
if (dbUrl.includes('?') && dbUrl.endsWith('?')) dbUrl = dbUrl.slice(0, -1);

const pool = new Pool({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });

// ─── User Chain: D → C → B → A (referrer chain) ───
// A mua → F0 = A, F1 = B (referrer), F2 = C, F3 = D
// B mua → F0 = B, F1 = C, F2 = D
// E = Custom mode user
const USERS = [
  { user_id: 'seed_user_d', display_name: 'Đạt (F3 gốc)', referrer_id: '', commission_mode: 'normal', custom_rate: 0 },
  { user_id: 'seed_user_c', display_name: 'Chi (F2)', referrer_id: 'seed_user_d', commission_mode: 'normal', custom_rate: 0 },
  { user_id: 'seed_user_b', display_name: 'Bình (F1)', referrer_id: 'seed_user_c', commission_mode: 'normal', custom_rate: 0 },
  { user_id: 'seed_user_a', display_name: 'An (Buyer)', referrer_id: 'seed_user_b', commission_mode: 'normal', custom_rate: 0 },
  { user_id: 'seed_user_e', display_name: 'Elly (Custom)', referrer_id: '', commission_mode: 'custom', custom_rate: 55 },
];

const now = new Date();
const fmt = (d) => d.toISOString().replace('T', ' ').slice(0, 19);
const daysAgo = (n) => { const d = new Date(now); d.setDate(d.getDate() - n); return fmt(d); };

// ─── 10 Orders ───
// nc = net_commission, shopeeRate = % shopee commission
// order_value = price * qty
const ORDERS = [
  // An's orders — full chain: F0=An, F1=Bình, F2=Chi, F3=Đạt
  { oid: 'SEED001', iid: 'ITEM001', sub1: 'seed_user_a', sub4: '', name: 'Áo thun nam Nike Dri-FIT', shop: 'Nike Official', shopType: 'Mall', price: 850000, shopeeRate: 5, status: 'Hoàn thành', time: daysAgo(2), ctime: daysAgo(1) },
  { oid: 'SEED002', iid: 'ITEM002', sub1: 'seed_user_a', sub4: '', name: 'Tai nghe Bluetooth Sony WF-1000XM5', shop: 'Sony Official', shopType: 'Mall', price: 5990000, shopeeRate: 5, status: 'Hoàn thành', time: daysAgo(5), ctime: daysAgo(3) },
  { oid: 'SEED003', iid: 'ITEM003', sub1: 'seed_user_a', sub4: '', name: 'Bàn phím cơ Keychron K8 Pro', shop: 'Keychron Store', shopType: 'Preferred', price: 2490000, shopeeRate: 8, status: 'Đang giao', time: daysAgo(1), ctime: '' },
  { oid: 'SEED004', iid: 'ITEM004', sub1: 'seed_user_a', sub4: '', name: 'Kem chống nắng Anessa 60ml', shop: 'Anessa Beauty', shopType: 'Mall', price: 420000, shopeeRate: 15, status: 'Chờ xác nhận', time: daysAgo(0), ctime: '' },

  // Bình's orders — chain: F0=Bình, F1=Chi, F2=Đạt (no F3)
  { oid: 'SEED005', iid: 'ITEM005', sub1: 'seed_user_b', sub4: '', name: 'Giày chạy bộ Adidas Ultraboost', shop: 'Adidas Official', shopType: 'Mall', price: 3200000, shopeeRate: 5, status: 'Hoàn thành', time: daysAgo(4), ctime: daysAgo(2) },
  { oid: 'SEED006', iid: 'ITEM006', sub1: 'seed_user_b', sub4: '', name: 'Balo laptop Xiaomi Mi 26L', shop: 'Xiaomi Store', shopType: 'Preferred', price: 650000, shopeeRate: 7, status: 'Đang giao', time: daysAgo(1), ctime: '' },
  { oid: 'SEED007', iid: 'ITEM007', sub1: 'seed_user_b', sub4: '', name: 'Sạc dự phòng Anker 20000mAh', shop: 'Anker VN', shopType: 'Normal', price: 790000, shopeeRate: 10, status: 'Hoàn thành', time: daysAgo(7), ctime: daysAgo(5) },

  // Chi's order — chain: F0=Chi, F1=Đạt (no F2/F3)
  { oid: 'SEED008', iid: 'ITEM008', sub1: 'seed_user_c', sub4: '', name: 'Nồi chiên không dầu Philips 6.2L', shop: 'Philips Home', shopType: 'Mall', price: 2890000, shopeeRate: 5, status: 'Hoàn thành', time: daysAgo(3), ctime: daysAgo(1) },

  // Elly's custom orders — no chain, sub_id4 = 'custom'
  { oid: 'SEED009', iid: 'ITEM009', sub1: 'seed_user_e', sub4: 'custom', name: 'Son MAC Ruby Woo', shop: 'MAC Cosmetics', shopType: 'Mall', price: 550000, shopeeRate: 15, status: 'Hoàn thành', time: daysAgo(2), ctime: daysAgo(1) },
  { oid: 'SEED010', iid: 'ITEM010', sub1: 'seed_user_e', sub4: 'custom', name: 'Nước hoa Chanel Coco 50ml', shop: 'Chanel Beauty VN', shopType: 'Mall', price: 3200000, shopeeRate: 5, status: 'Đang giao', time: daysAgo(0), ctime: '' },
];

async function seed() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    console.log('🌱 Seeding staging database...\n');

    // 1. Upsert users
    for (const u of USERS) {
      await client.query(`
        INSERT INTO users (user_id, display_name, referrer_id, referrer_name, commission_mode, custom_rate, cashback_buyer_rate, cashback_referrer_rate)
        VALUES ($1, $2, $3, $4, $5, $6, 40, 20)
        ON CONFLICT (user_id) DO UPDATE SET
          display_name = EXCLUDED.display_name,
          referrer_id = EXCLUDED.referrer_id,
          referrer_name = EXCLUDED.referrer_name,
          commission_mode = EXCLUDED.commission_mode,
          custom_rate = EXCLUDED.custom_rate
      `, [u.user_id, u.display_name, u.referrer_id, u.referrer_id ? USERS.find(x => x.user_id === u.referrer_id)?.display_name || '' : '', u.commission_mode, u.custom_rate]);
      console.log(`  ✅ User: ${u.display_name} (${u.user_id}) | ref: ${u.referrer_id || '—'} | mode: ${u.commission_mode}`);
    }

    // 2. Insert orders + convert_logs
    console.log('');
    for (const o of ORDERS) {
      // Compute commission fields (like real Shopee data)
      const orderValue = o.price;
      const shopeeComm = Math.round(orderValue * o.shopeeRate / 100);
      const totalProductComm = shopeeComm;
      const netComm = totalProductComm; // net_commission = total after MCN fees (0 here)

      // Insert order with full commission data
      await client.query(`
        INSERT INTO orders (
          order_id, item_id, item_name, shop_name, shop_type, price, quantity,
          order_value, shopee_product_commission_rate, shopee_product_commission,
          total_product_commission, total_order_commission, net_commission,
          order_status, order_time, complete_time, click_time,
          sub_id1, sub_id2, sub_id3, sub_id4, sub_id5,
          commission_type, channel, imported_at
        )
        VALUES (
          $1, $2, $3, $4, $5, $6, 1,
          $6, $7, $8,
          $8, $8, $8,
          $9, $10, $11, $10,
          $12, '', '', $13, '',
          'CPS', 'seed', NOW()
        )
        ON CONFLICT (order_id, item_id) DO UPDATE SET
          item_name = EXCLUDED.item_name, shop_name = EXCLUDED.shop_name, shop_type = EXCLUDED.shop_type,
          price = EXCLUDED.price, order_value = EXCLUDED.order_value,
          shopee_product_commission_rate = EXCLUDED.shopee_product_commission_rate,
          shopee_product_commission = EXCLUDED.shopee_product_commission,
          total_product_commission = EXCLUDED.total_product_commission,
          total_order_commission = EXCLUDED.total_order_commission,
          net_commission = EXCLUDED.net_commission,
          order_status = EXCLUDED.order_status, order_time = EXCLUDED.order_time,
          complete_time = EXCLUDED.complete_time, click_time = EXCLUDED.click_time,
          sub_id1 = EXCLUDED.sub_id1, sub_id4 = EXCLUDED.sub_id4, channel = EXCLUDED.channel
      `, [o.oid, o.iid, o.name, o.shop, o.shopType, o.price, o.shopeeRate, shopeeComm, o.status, o.time, o.ctime, o.sub1, o.sub4]);

      // Insert matching convert_log (for JOIN to work)
      const user = USERS.find(u => u.user_id === o.sub1);
      const referrerId = user?.referrer_id || '';
      await client.query(`
        INSERT INTO convert_logs (user_id, user_name, original_link, product_name, item_id, sub_id1, sub_id2, sub_id3, status, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, '', 'success', $8)
        ON CONFLICT DO NOTHING
      `, [o.sub1, user?.display_name || '', `https://shopee.vn/product/${o.iid}`, o.name, o.iid, o.sub1, referrerId, o.time]);

      console.log(`  📦 #${o.oid} | ${o.name.substring(0, 30).padEnd(30)} | ${o.status.padEnd(14)} | ${o.price.toLocaleString().padStart(12)}đ × ${o.shopeeRate}% = NC: ${netComm.toLocaleString().padStart(8)}đ`);
    }

    await client.query('COMMIT');

    // Summary
    console.log('\n═══════════════════════════════════════════');
    console.log('📊 Seed Summary:');
    console.log(`   Users:  ${USERS.length}`);
    console.log(`   Orders: ${ORDERS.length}`);
    console.log('');
    console.log('   Chain: Đạt → Chi → Bình → An');
    console.log('   An mua  → F0=An(40%), F1=Bình(20%), F2=Chi(7%), F3=Đạt(3%)');
    console.log('   Bình mua → F0=Bình(40%), F1=Chi(20%), F2=Đạt(7%)');
    console.log('   Chi mua  → F0=Chi(40%), F1=Đạt(20%)');
    console.log('   Elly     → Custom 55% (no chain)');
    console.log('═══════════════════════════════════════════');
    console.log('✅ Staging seeded successfully!\n');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Seed failed:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

seed();
