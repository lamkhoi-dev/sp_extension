// Diagnostic: how many DISTINCT Zalo users are hitting
// "ZcaApiError: Không thể nhận tin nhắn từ bạn" (Zalo's own stranger/friend
// message-limit rejection) — 1 user = isolated & expected, many users =
// the bot account itself may be getting rate-limited/flagged by Zalo.
// Run: node scripts/check-zalo-blocked.js
const { Pool } = require('pg');
require('dotenv').config();

(async () => {
  const connectionString = process.env.DATABASE_URL || 'postgres://localhost:5432/shopee_affiliate';
  let finalConnectionString = connectionString;
  const isLocalhost = connectionString.includes('@localhost') || connectionString.includes('@127.0.0.1');

  const poolConfig = {
    connectionString,
    max: 1,
    connectionTimeoutMillis: 5000,
  };

  if (!isLocalhost) {
    poolConfig.ssl = { rejectUnauthorized: false };
    finalConnectionString = finalConnectionString
      .replace(/[?&]sslmode=require/i, '')
      .replace(/[?&]sslmode=no-verify/i, '')
      .replace(/[?&]ssl=true/i, '');

    if (finalConnectionString.endsWith('?')) {
      finalConnectionString = finalConnectionString.slice(0, -1);
    }
  }
  poolConfig.connectionString = finalConnectionString;

  const pool = new Pool(poolConfig);
  try {
    const res = await pool.query(`
      SELECT sender_id, sender_name, COUNT(*) AS fail_count, MAX(received_at) AS last_seen
      FROM messages
      WHERE status = 'failed'
        AND error ILIKE '%nhận tin nhắn%'
        AND received_at >= NOW() - INTERVAL '30 days'
      GROUP BY sender_id, sender_name
      ORDER BY fail_count DESC
    `);
    console.log(`\n${res.rows.length} distinct user(s) hit "Zalo cannot receive message" in the last 30 days:\n`);
    console.table(res.rows);
    if (res.rows.length === 1) {
      console.log('\n=> Isolated to 1 user — expected Zalo behavior (they have not friended the bot, or blocked it). Not a system bug.');
    } else if (res.rows.length > 1) {
      console.log('\n=> Multiple users affected — the bot Zalo account itself may be getting rate-limited/flagged by Zalo for messaging strangers. Worth investigating account standing.');
    }
  } catch (err) {
    console.error('Error during query:', err);
  } finally {
    await pool.end();
  }
})();
