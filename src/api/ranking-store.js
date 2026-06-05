/**
 * Public Ranking Store
 *
 * Computes leaderboard data for the public /api/public/ranking endpoint.
 * No authentication required — returns sanitized display data only.
 *
 * Ranking metric: total money a user actually receives across all roles:
 *   total_earned = F0_cashback + F1_earnings + F2_earnings + F3_earnings
 *
 * Periods: 'month' | 'week' | 'all'
 * Limit: top 20 by default (configurable)
 */

const db = require('../db');
const logger = require('../logger');
const commissionRatesStore = require('./commission-rates-store');

// Not-cancelled filter (matches payout-store pattern)
const NOT_CANCELLED = `
  COALESCE(o.order_status, '') NOT LIKE '%hủy%'
  AND COALESCE(o.order_status, '') NOT LIKE '%huỷ%'
  AND COALESCE(o.order_status, '') NOT LIKE '%Cancel%'
`;

// Matched-orders EXISTS (buyer purchased through their own affiliate link).
// Uses EXISTS instead of JOIN so each order row is counted ONCE even if it
// matches multiple convert_logs (avoids double-counting net_commission).
const MATCHED_EXISTS = `
  EXISTS (
    SELECT 1 FROM convert_logs cl WHERE cl.status = 'success' AND (
      (o.item_id != '' AND o.item_id = cl.item_id AND o.sub_id1 = cl.sub_id1)
      OR (cl.item_id = '' AND o.item_name != '' AND o.item_name = cl.product_name AND o.sub_id1 = cl.sub_id1)
    )
  )
`;

function timeFilter(period) {
  if (period === 'month') {
    return `AND o.order_time >= TO_CHAR(DATE_TRUNC('month', NOW()), 'YYYY-MM-DD')`;
  }
  if (period === 'week') {
    return `AND o.order_time >= TO_CHAR(DATE_TRUNC('week', NOW()), 'YYYY-MM-DD')`;
  }
  return '';
}

/**
 * Compute the full earnings map for ALL users (not limited).
 * Returns { [userId]: { f0, f1, f2, f3, orderCount, total } } where each
 * amount is REAL money the user receives (net_commission × rate, cancelled
 * orders excluded, EXISTS to avoid double-counting).
 * Shared by getRanking() and the /api/users "Commission" column.
 */
async function computeEarningsMap(period = 'all') {
  const rates = await commissionRatesStore.getRates();
  const tf = timeFilter(period);

  // ── F0: buyer cashback from matched orders ──────────────────────────────
  const f0SQL = `
    SELECT
      o.sub_id1                                          AS user_id,
      COUNT(DISTINCT o.order_id)                         AS order_count,
      ROUND(SUM(o.net_commission) * ${rates.f0} / 100)  AS f0_earned
    FROM orders o
    WHERE ${MATCHED_EXISTS}
      AND COALESCE(o.sub_id4, '') NOT IN ('from_custom', 'custom')
      AND ${NOT_CANCELLED}
      ${tf}
    GROUP BY o.sub_id1
  `;

  const f1SQL = `
    SELECT
      u_buyer.referrer_id                                AS user_id,
      ROUND(SUM(o.net_commission) * ${rates.f1} / 100)  AS f1_earned
    FROM orders o
    INNER JOIN users u_buyer ON CAST(u_buyer.user_id AS TEXT) = CAST(o.sub_id1 AS TEXT)
    WHERE ${MATCHED_EXISTS}
      AND COALESCE(o.sub_id4, '') NOT IN ('from_custom', 'custom')
      AND ${NOT_CANCELLED}
      AND u_buyer.referrer_id IS NOT NULL AND u_buyer.referrer_id != ''
      ${tf}
    GROUP BY u_buyer.referrer_id
  `;

  const f2SQL = `
    SELECT
      u_f1.referrer_id                                   AS user_id,
      ROUND(SUM(o.net_commission) * ${rates.f2} / 100)  AS f2_earned
    FROM orders o
    INNER JOIN users u_buyer ON CAST(u_buyer.user_id AS TEXT) = CAST(o.sub_id1 AS TEXT)
    INNER JOIN users u_f1    ON CAST(u_f1.user_id AS TEXT) = CAST(u_buyer.referrer_id AS TEXT)
    WHERE ${MATCHED_EXISTS}
      AND COALESCE(o.sub_id4, '') NOT IN ('from_custom', 'custom')
      AND ${NOT_CANCELLED}
      AND u_buyer.referrer_id IS NOT NULL AND u_buyer.referrer_id != ''
      AND u_f1.referrer_id IS NOT NULL    AND u_f1.referrer_id != ''
      ${tf}
    GROUP BY u_f1.referrer_id
  `;

  const f3SQL = `
    SELECT
      u_f2.referrer_id                                   AS user_id,
      ROUND(SUM(o.net_commission) * ${rates.f3} / 100)  AS f3_earned
    FROM orders o
    INNER JOIN users u_buyer ON CAST(u_buyer.user_id AS TEXT) = CAST(o.sub_id1 AS TEXT)
    INNER JOIN users u_f1    ON CAST(u_f1.user_id AS TEXT) = CAST(u_buyer.referrer_id AS TEXT)
    INNER JOIN users u_f2    ON CAST(u_f2.user_id AS TEXT) = CAST(u_f1.referrer_id AS TEXT)
    WHERE ${MATCHED_EXISTS}
      AND COALESCE(o.sub_id4, '') NOT IN ('from_custom', 'custom')
      AND ${NOT_CANCELLED}
      AND u_buyer.referrer_id IS NOT NULL AND u_buyer.referrer_id != ''
      AND u_f1.referrer_id IS NOT NULL    AND u_f1.referrer_id != ''
      AND u_f2.referrer_id IS NOT NULL    AND u_f2.referrer_id != ''
      ${tf}
    GROUP BY u_f2.referrer_id
  `;

  const [f0Rows, f1Rows, f2Rows, f3Rows] = await Promise.all([
    db.all(f0SQL),
    db.all(f1SQL),
    db.all(f2SQL),
    db.all(f3SQL),
  ]);

  const earningsMap = {};
  const add = (rows, field) => {
    for (const r of rows) {
      if (!r.user_id) continue;
      if (!earningsMap[r.user_id]) {
        earningsMap[r.user_id] = { f0: 0, f1: 0, f2: 0, f3: 0, orderCount: 0 };
      }
      earningsMap[r.user_id][field] += Number(r[`${field}_earned`]) || 0;
      if (field === 'f0') earningsMap[r.user_id].orderCount = Number(r.order_count) || 0;
    }
  };
  add(f0Rows, 'f0');
  add(f1Rows, 'f1');
  add(f2Rows, 'f2');
  add(f3Rows, 'f3');

  for (const uid of Object.keys(earningsMap)) {
    const e = earningsMap[uid];
    e.total = e.f0 + e.f1 + e.f2 + e.f3;
  }
  return earningsMap;
}

async function getRanking(period = 'all', limit = 20) {
  try {
    const earningsMap = await computeEarningsMap(period);

    // Compute totals + sort
    const allUserIds = Object.keys(earningsMap);
    if (allUserIds.length === 0) return [];

    const ranked = allUserIds
      .map(uid => ({
        userId: uid,
        ...earningsMap[uid],
      }))
      .filter(u => u.total > 0)
      .sort((a, b) => b.total - a.total)
      .slice(0, limit);

    if (ranked.length === 0) return [];

    // Fetch user info for ranked IDs
    const ids = ranked.map(u => u.userId);
    const placeholders = ids.map((_, i) => `$${i + 1}`).join(',');
    const userRows = await db.all(
      `SELECT user_id, display_name, zalo_name, avatar,
        (SELECT COUNT(*) FROM users WHERE referrer_id = u.user_id) AS ctv_count
       FROM users u
       WHERE user_id IN (${placeholders})`,
      ids
    );
    const userMap = {};
    for (const u of userRows) userMap[u.user_id] = u;

    return ranked.map((u, idx) => {
      const info = userMap[u.userId] || {};
      return {
        rank: idx + 1,
        displayName: info.display_name || info.zalo_name || 'Thành viên',
        avatar: info.avatar || '',
        ctvCount: Number(info.ctv_count) || 0,
        orderCount: u.orderCount,
        totalEarned: u.total,
        breakdown: { f0: u.f0, f1: u.f1, f2: u.f2, f3: u.f3 },
      };
    });
  } catch (err) {
    logger.error('RankingStore', `getRanking(${period}) failed: ${err.message}`);
    return [];
  }
}

module.exports = { getRanking, computeEarningsMap };
