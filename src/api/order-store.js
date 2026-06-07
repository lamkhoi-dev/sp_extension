const db = require('../db');
const logger = require('../logger');

// ─── CSV Column mapping (Shopee 47 cols → DB fields) ────
const CSV_COLUMNS = [
  'order_id', 'order_status', 'checkout_id', 'order_time', 'complete_time', // 0-4
  'click_time', 'shop_name', 'shop_id', 'shop_type', 'item_id',             // 5-9
  'item_name', 'model_id', 'product_type', 'promotion_id',                  // 10-13
  'category_l1', 'category_l2', 'category_l3',                              // 14-16
  'price', 'quantity', 'commission_type', 'campaign_partner',               // 17-20
  'order_value', 'refund_amount',                                           // 21-22
  'shopee_product_commission_rate', 'shopee_product_commission',            // 23-24
  'seller_product_commission_rate', 'xtra_product_commission',              // 25-26
  'total_product_commission', 'order_commission', 'order_bonus',            // 27-29
  'total_order_commission',                                                 // 30
  'mcn_name', 'mcn_contract', 'mcn_fee_rate', 'mcn_fee_amount',             // 31-34
  'agreed_commission_rate', 'net_commission',                               // 35-36
  'product_status', 'product_note', 'attribute_type', 'buyer_status',       // 37-40
  'sub_id1', 'sub_id2', 'sub_id3', 'sub_id4', 'sub_id5',                    // 41-45
  'channel'                                                                 // 46
];

// Numeric columns (parse as float)
const NUMERIC_COLS = new Set([
  'price', 'quantity', 'order_value', 'refund_amount',
  'shopee_product_commission_rate', 'shopee_product_commission',
  'seller_product_commission_rate', 'xtra_product_commission',
  'total_product_commission', 'order_commission', 'order_bonus',
  'total_order_commission', 'mcn_fee_rate', 'mcn_fee_amount',
  'agreed_commission_rate', 'net_commission'
]);

// ─── CSV Parsing ────────────────────────────────────────
function parseCSVLine(line) {
  const fields = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') {
        current += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        current += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ',') {
        fields.push(current.trim());
        current = '';
      } else {
        current += ch;
      }
    }
  }
  fields.push(current.trim());
  return fields;
}

function parseShopeeCSV(csvText) {
  let text = csvText;
  if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);

  const lines = text.split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) return [];

  const records = [];
  for (let i = 1; i < lines.length; i++) {
    const fields = parseCSVLine(lines[i]);
    if (fields.length < 10) continue;

    const record = {};
    for (let j = 0; j < CSV_COLUMNS.length && j < fields.length; j++) {
      const col = CSV_COLUMNS[j];
      let val = fields[j] || '';

      if (NUMERIC_COLS.has(col)) {
        val = val.replace(/%/g, '').trim();
        const dotCount = (val.match(/\./g) || []).length;
        if (dotCount > 1) {
          val = val.replace(/\./g, '').replace(/,/g, '.');
        } else {
          val = val.replace(/,/g, '');
        }
        record[col] = parseFloat(val) || 0;
      } else {
        record[col] = val;
      }
    }

    for (const col of CSV_COLUMNS) {
      if (!(col in record)) {
        record[col] = NUMERIC_COLS.has(col) ? 0 : '';
      }
    }

    // Standardize Order Status
    const rawStatus = (record.order_status || '').toLowerCase();
    if (rawStatus.includes('hoàn thành')) {
      record.order_status = 'Hoàn thành';
    } else if (rawStatus.includes('đang giao')) {
      record.order_status = 'Đang giao hàng';
    } else if (rawStatus.includes('chờ xử lý') || rawStatus.includes('chờ')) {
      record.order_status = 'Đang chờ xử lý';
    } else if (rawStatus.includes('chưa thanh toán')) {
      record.order_status = 'Chưa thanh toán';
    } else if (rawStatus.includes('hủy') || rawStatus.includes('huy')) {
      record.order_status = 'Đã hủy';
    } else {
      record.order_status = 'Đang chờ xử lý';
    }

    records.push(record);
  }

  return records;
}

// ─── Upsert SQL ─────────────────────────────────────────
const UPSERT_SQL = `
  INSERT INTO orders (
    order_id, order_status, checkout_id, order_time, complete_time,
    click_time, shop_name, shop_id, shop_type, item_id,
    item_name, model_id, product_type, promotion_id,
    category_l1, category_l2, category_l3,
    price, quantity, commission_type, campaign_partner,
    order_value, refund_amount,
    shopee_product_commission_rate, shopee_product_commission,
    seller_product_commission_rate, xtra_product_commission,
    total_product_commission, order_commission, order_bonus,
    total_order_commission, mcn_name, mcn_contract, mcn_fee_rate,
    mcn_fee_amount, agreed_commission_rate, net_commission,
    product_status, product_note, attribute_type, buyer_status,
    sub_id1, sub_id2, sub_id3, sub_id4, sub_id5, channel
  ) VALUES (
    @order_id, @order_status, @checkout_id, @order_time, @complete_time,
    @click_time, @shop_name, @shop_id, @shop_type, @item_id,
    @item_name, @model_id, @product_type, @promotion_id,
    @category_l1, @category_l2, @category_l3,
    @price, @quantity, @commission_type, @campaign_partner,
    @order_value, @refund_amount,
    @shopee_product_commission_rate, @shopee_product_commission,
    @seller_product_commission_rate, @xtra_product_commission,
    @total_product_commission, @order_commission, @order_bonus,
    @total_order_commission, @mcn_name, @mcn_contract, @mcn_fee_rate,
    @mcn_fee_amount, @agreed_commission_rate, @net_commission,
    @product_status, @product_note, @attribute_type, @buyer_status,
    @sub_id1, @sub_id2, @sub_id3, @sub_id4, @sub_id5, @channel
  ) ON CONFLICT(order_id, item_id, model_id) DO UPDATE SET
    order_status       = @order_status,
    complete_time      = @complete_time,
    price              = @price,
    quantity           = @quantity,
    commission_type    = @commission_type,
    campaign_partner   = @campaign_partner,
    order_value        = @order_value,
    refund_amount      = @refund_amount,
    shopee_product_commission_rate = @shopee_product_commission_rate,
    shopee_product_commission      = @shopee_product_commission,
    seller_product_commission_rate = @seller_product_commission_rate,
    xtra_product_commission        = @xtra_product_commission,
    total_product_commission       = @total_product_commission,
    order_commission   = @order_commission,
    order_bonus        = @order_bonus,
    total_order_commission = @total_order_commission,
    mcn_name           = @mcn_name,
    mcn_contract       = @mcn_contract,
    mcn_fee_rate       = @mcn_fee_rate,
    mcn_fee_amount     = @mcn_fee_amount,
    agreed_commission_rate = @agreed_commission_rate,
    net_commission     = @net_commission,
    product_status     = @product_status,
    product_note       = @product_note,
    attribute_type     = @attribute_type,
    buyer_status       = @buyer_status,
    imported_at        = datetime('now','localtime')
`;

// ─── Exports ────────────────────────────────────────────
const orderStore = {
  parseShopeeCSV,

  async importCSV(csvText) {
    const records = parseShopeeCSV(csvText);
    if (records.length === 0) {
      return { success: false, error: 'No valid records found in CSV' };
    }

    logger.info('OrderStore', `Importing ${records.length} order records...`);

    let inserted = 0;
    await db.transaction(async (tx) => {
      for (const record of records) {
        try {
          const result = await tx.runNamed(UPSERT_SQL, record);
          if (result.changes > 0) inserted++;
        } catch (err) {
          logger.warn('OrderStore', `Upsert failed for order ${record.order_id}: ${err.message}`);
        }
      }
    });

    logger.info('OrderStore', `Import complete: ${inserted} inserted/updated out of ${records.length}`);
    return { success: true, inserted, total: records.length };
  },

  async getRecent(limit = 50, offset = 0) {
    return db.all('SELECT * FROM orders ORDER BY order_time DESC LIMIT ? OFFSET ?', [limit, offset]);
  },

  async getByStatus(status, limit = 50) {
    return db.all('SELECT * FROM orders WHERE order_status = ? ORDER BY order_time DESC LIMIT ?', [status, limit]);
  },

  async getCount() {
    const row = await db.get('SELECT COUNT(*) as count FROM orders');
    return row.count;
  },

  async getStats(filters = {}) {
    const conditions = [];
    const params = [];

    const timeField = filters.timeField || 'order_time';
    const validTimeFields = ['order_time', 'complete_time', 'click_time'];
    const safeTimeField = validTimeFields.includes(timeField) ? timeField : 'order_time';

    if (filters.dateFrom) { conditions.push(`${safeTimeField} >= ?`); params.push(filters.dateFrom); }
    if (filters.dateTo) { conditions.push(`${safeTimeField} <= ?`); params.push(filters.dateTo + ' 23:59:59'); }
    if (filters.status && filters.status !== 'Tất cả') { conditions.push('order_status = ?'); params.push(filters.status); }
    if (filters.orderId) { conditions.push('order_id LIKE ?'); params.push(`%${filters.orderId}%`); }
    if (filters.shopName) { conditions.push('shop_name LIKE ?'); params.push(`%${filters.shopName}%`); }
    if (filters.shopType && filters.shopType !== 'Tất cả') { conditions.push('shop_type = ?'); params.push(filters.shopType); }
    if (filters.productName) { conditions.push('item_name LIKE ?'); params.push(`%${filters.productName}%`); }
    if (filters.commissionType && filters.commissionType !== 'Tất cả') { conditions.push('commission_type = ?'); params.push(filters.commissionType); }
    if (filters.channel && filters.channel !== 'Tất cả') { conditions.push('channel = ?'); params.push(filters.channel); }
    if (filters.userId) { conditions.push('sub_id1 = ?'); params.push(filters.userId); }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // NOT_CANCELLED expression — matches Shopee Dashboard behaviour (excludes cancelled from financial metrics)
    const notCancelledExpr = `(
      COALESCE(order_status,'') NOT LIKE '%hủy%'
      AND COALESCE(order_status,'') NOT LIKE '%huỷ%'
      AND COALESCE(order_status,'') NOT LIKE '%Cancel%'
      AND order_status != 'Chưa thanh toán'
    )`;

    const baseStats = await db.get(`
      SELECT
        COUNT(*) as "totalOrders",
        -- Financial metrics exclude cancelled (matching Shopee Dashboard)
        COUNT(DISTINCT CASE WHEN ${notCancelledExpr} THEN order_id END) as "uniqueOrders",
        COALESCE(SUM(CASE WHEN ${notCancelledExpr} THEN order_value END), 0) as "totalOrderValue",
        COALESCE(SUM(CASE WHEN ${notCancelledExpr} THEN total_product_commission END), 0) as "totalCommission",
        COALESCE(SUM(CASE WHEN ${notCancelledExpr} THEN net_commission END), 0) as "totalCommissionNew",
        COALESCE(SUM(CASE WHEN ${notCancelledExpr} THEN order_commission END), 0) as "totalOrderCommission",
        COALESCE(SUM(CASE WHEN ${notCancelledExpr} THEN order_bonus END), 0) as "totalOrderBonus",
        COALESCE(SUM(CASE WHEN ${notCancelledExpr} THEN order_commission END), 0) + COALESCE(SUM(CASE WHEN ${notCancelledExpr} THEN order_bonus END), 0) as "totalEstimatedCommission",
        COALESCE(SUM(CASE WHEN ${notCancelledExpr} THEN quantity END), 0) as "totalQuantity",
        -- These include all orders (for shop/buyer diversity stats)
        COUNT(DISTINCT shop_id) as "uniqueShops",
        COUNT(DISTINCT sub_id1) as "uniqueBuyers"
      FROM orders ${where}
    `, params);

    // New buyers: sub_id1 whose FIRST ever order falls within current filter range
    let newBuyers = 0;
    if (filters.dateFrom) {
      const nbResult = await db.get(`
        SELECT COUNT(*) as cnt FROM (
          SELECT sub_id1, MIN(order_time) as first_order
          FROM orders
          WHERE sub_id1 != '' AND sub_id1 IS NOT NULL
          GROUP BY sub_id1
          HAVING MIN(order_time) >= ?
          ${filters.dateTo ? 'AND MIN(order_time) <= ?' : ''}
        ) t
      `, filters.dateTo ? [filters.dateFrom, filters.dateTo + ' 23:59:59'] : [filters.dateFrom]);
      newBuyers = nbResult?.cnt || 0;
    }

    return { ...baseStats, newBuyers };
  },

  /**
   * Compute admin's theoretical net profit assuming all users have been fully paid out.
   * = total net_commission - all user portions (F0/F1/F2/F3 + custom)
   *
   * Uses LEFT JOIN chain resolution (3 levels) for accurate per-order calculation.
   * Handles: normal chain, custom-mode buyers, custom orders (from_custom).
   */
  async getAdminProfitEstimate(rates) {
    const NOT_CANCELLED = `(
      COALESCE(o.order_status,'') NOT LIKE '%hủy%'
      AND COALESCE(o.order_status,'') NOT LIKE '%huỷ%'
      AND COALESCE(o.order_status,'') NOT LIKE '%Cancel%'
      AND o.order_status != 'Chưa thanh toán'
    )`;

    // EXISTS (not JOIN) so each order line-item counts once even if it matches
    // multiple convert_logs — avoids double-counting net_commission.
    const MATCHED_EXISTS = `
      EXISTS (
        SELECT 1 FROM convert_logs cl WHERE cl.status = 'success' AND (
          (o.item_id != '' AND o.item_id = cl.item_id AND o.sub_id1 = cl.sub_id1)
          OR (cl.item_id = '' AND o.item_name != '' AND o.item_name = cl.product_name AND o.sub_id1 = cl.sub_id1)
        )
      )
    `;

    // 1. Total net commission from all non-cancelled orders (includes unmatched + custom)
    const totalRow = await db.get(`
      SELECT COALESCE(SUM(o.net_commission), 0) as total_net
      FROM orders o
      WHERE ${NOT_CANCELLED}
    `);

    // 2. Matched normal (from_direct) orders: F0 + F1/F2/F3 via pure referrer_id chain.
    //    commission_mode does NOT affect from_direct orders (custom_rate only for from_custom).
    const chainRow = await db.get(`
      SELECT
        -- F0: every buyer gets standard F0%
        COALESCE(SUM(o.net_commission * $1 / 100), 0) as buyer_total,

        -- F1: buyer has a referrer
        COALESCE(SUM(CASE
          WHEN ub1.user_id IS NOT NULL THEN o.net_commission * $2 / 100 ELSE 0
        END), 0) as f1_total,

        -- F2: referrer's referrer
        COALESCE(SUM(CASE
          WHEN ub1.user_id IS NOT NULL AND ub2.user_id IS NOT NULL
            THEN o.net_commission * $3 / 100 ELSE 0
        END), 0) as f2_total,

        -- F3: 3rd level
        COALESCE(SUM(CASE
          WHEN ub1.user_id IS NOT NULL AND ub2.user_id IS NOT NULL AND ub3.user_id IS NOT NULL
            THEN o.net_commission * $4 / 100 ELSE 0
        END), 0) as f3_total

      FROM (
        SELECT o.id, o.net_commission, o.sub_id1
        FROM orders o
        WHERE ${MATCHED_EXISTS}
          AND ${NOT_CANCELLED}
          AND COALESCE(o.sub_id4, '') NOT IN ('from_custom', 'custom')
      ) o
      LEFT JOIN users ub  ON CAST(ub.user_id AS TEXT) = CAST(o.sub_id1 AS TEXT)
      LEFT JOIN users ub1 ON CAST(ub1.user_id AS TEXT) = CAST(ub.referrer_id AS TEXT)
        AND ub.referrer_id IS NOT NULL AND ub.referrer_id != ''
      LEFT JOIN users ub2 ON CAST(ub2.user_id AS TEXT) = CAST(ub1.referrer_id AS TEXT)
        AND ub1.referrer_id IS NOT NULL AND ub1.referrer_id != ''
      LEFT JOIN users ub3 ON CAST(ub3.user_id AS TEXT) = CAST(ub2.referrer_id AS TEXT)
        AND ub2.referrer_id IS NOT NULL AND ub2.referrer_id != ''
    `, [rates.f0, rates.f1, rates.f2, rates.f3]);

    // 3. Custom orders (F1 gửi link cho khách): F1 user gets custom_rate%
    const customRow = await db.get(`
      SELECT COALESCE(SUM(o.net_commission * COALESCE(u.custom_rate, 0) / 100), 0) as custom_user_total
      FROM orders o
      LEFT JOIN users u ON CAST(u.user_id AS TEXT) = CAST(o.sub_id1 AS TEXT)
      WHERE o.sub_id4 IN ('from_custom', 'custom')
        AND ${NOT_CANCELLED}
    `);

    const totalUserCashback =
      Number(chainRow?.buyer_total || 0) +
      Number(chainRow?.f1_total || 0) +
      Number(chainRow?.f2_total || 0) +
      Number(chainRow?.f3_total || 0) +
      Number(customRow?.custom_user_total || 0);

    return Math.round(Number(totalRow?.total_net || 0) - totalUserCashback);
  },

  async search(query, limit = 20) {
    const q = `%${query}%`;
    return db.all(
      'SELECT * FROM orders WHERE item_name LIKE ? OR shop_name LIKE ? OR order_id LIKE ? OR sub_id1 LIKE ? ORDER BY order_time DESC LIMIT ?',
      [q, q, q, q, limit]
    );
  },

  async getFiltered(filters = {}, limit = 200) {
    const conditions = [];
    const params = [];
    let paramIdx = 0;

    const timeField = filters.timeField || 'order_time';
    const validTimeFields = ['order_time', 'complete_time', 'click_time'];
    const safeTimeField = validTimeFields.includes(timeField) ? timeField : 'order_time';

    if (filters.dateFrom) {
      paramIdx++;
      conditions.push(`${safeTimeField} >= ?`);
      params.push(filters.dateFrom);
    }
    if (filters.dateTo) {
      paramIdx++;
      conditions.push(`${safeTimeField} <= ?`);
      params.push(filters.dateTo + ' 23:59:59');
    }
    if (filters.status && filters.status !== 'Tất cả') {
      paramIdx++;
      conditions.push('order_status = ?');
      params.push(filters.status);
    }
    if (filters.orderId) {
      paramIdx++;
      conditions.push('order_id LIKE ?');
      params.push(`%${filters.orderId}%`);
    }
    if (filters.shopName) {
      paramIdx++;
      conditions.push('shop_name LIKE ?');
      params.push(`%${filters.shopName}%`);
    }
    if (filters.shopType && filters.shopType !== 'Tất cả') {
      paramIdx++;
      conditions.push('shop_type = ?');
      params.push(filters.shopType);
    }
    if (filters.productName) {
      paramIdx++;
      conditions.push('item_name LIKE ?');
      params.push(`%${filters.productName}%`);
    }
    if (filters.commissionType && filters.commissionType !== 'Tất cả') {
      paramIdx++;
      conditions.push('commission_type = ?');
      params.push(filters.commissionType);
    }
    if (filters.channel && filters.channel !== 'Tất cả') {
      paramIdx++;
      conditions.push('channel = ?');
      params.push(filters.channel);
    }
    if (filters.userId) {
      paramIdx++;
      conditions.push('sub_id1 = ?');
      params.push(filters.userId);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    params.push(limit);
    const sql = `SELECT * FROM orders ${where} ORDER BY ${safeTimeField} DESC LIMIT ?`;

    return db.all(sql, params);
  },

  async getFilterOptions() {
    const [shopTypeRows, commissionTypeRows, channelRows, statusRows] = await Promise.all([
      db.all("SELECT DISTINCT shop_type FROM orders WHERE shop_type != '' ORDER BY shop_type"),
      db.all("SELECT DISTINCT commission_type FROM orders WHERE commission_type != '' ORDER BY commission_type"),
      db.all("SELECT DISTINCT channel FROM orders WHERE channel != '' ORDER BY channel"),
      db.all("SELECT DISTINCT order_status FROM orders WHERE order_status != '' ORDER BY order_status"),
    ]);
    return {
      shopTypes: shopTypeRows.map(r => r.shop_type),
      commissionTypes: commissionTypeRows.map(r => r.commission_type),
      channels: channelRows.map(r => r.channel),
      statuses: statusRows.map(r => r.order_status),
    };
  },

  async getTotalNetCommission() {
    const NOT_CANCELLED = `(
      COALESCE(order_status,'') NOT LIKE '%hủy%'
      AND COALESCE(order_status,'') NOT LIKE '%huỷ%'
      AND COALESCE(order_status,'') NOT LIKE '%Cancel%'
      AND order_status != 'Chưa thanh toán'
    )`;
    const row = await db.get(
      `SELECT COALESCE(SUM(net_commission), 0) as total_net FROM orders WHERE ${NOT_CANCELLED}`
    );
    return Number(row?.total_net || 0);
  },
};

module.exports = orderStore;
