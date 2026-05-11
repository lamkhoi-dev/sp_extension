const db = require('../zalo/database');
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

// ─── Prepared Statements ────────────────────────────────
const stmts = {
  upsert: db.prepare(`
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
    ) ON CONFLICT(order_id, item_id) DO UPDATE SET
      order_status = @order_status,
      complete_time = @complete_time,
      refund_amount = @refund_amount,
      total_order_commission = @total_order_commission,
      net_commission = @net_commission,
      product_status = @product_status,
      buyer_status = @buyer_status,
      imported_at = datetime('now','localtime')
  `),

  getRecent: db.prepare(`
    SELECT * FROM orders ORDER BY order_time DESC LIMIT ? OFFSET ?
  `),

  getByStatus: db.prepare(`
    SELECT * FROM orders WHERE order_status = ? ORDER BY order_time DESC LIMIT ?
  `),

  getCount: db.prepare(`SELECT COUNT(*) as count FROM orders`),

  getStats: db.prepare(`
    SELECT
      COUNT(*) as totalOrders,
      COUNT(DISTINCT order_id) as uniqueOrders,
      SUM(order_value) as totalOrderValue,
      SUM(total_product_commission) as totalCommission,
      SUM(net_commission) as totalCommissionNew,
      SUM(order_commission) as totalOrderCommission,
      SUM(order_bonus) as totalOrderBonus,
      COUNT(DISTINCT shop_id) as uniqueShops,
      COUNT(DISTINCT sub_id1) as uniqueBuyers
    FROM orders
  `),

  search: db.prepare(`
    SELECT * FROM orders
    WHERE item_name LIKE ? OR shop_name LIKE ? OR order_id LIKE ? OR sub_id1 LIKE ?
    ORDER BY order_time DESC LIMIT ?
  `),
};

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
  // Remove BOM if present
  let text = csvText;
  if (text.charCodeAt(0) === 0xFEFF) {
    text = text.slice(1);
  }

  const lines = text.split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) return [];

  // Skip header row
  const records = [];
  for (let i = 1; i < lines.length; i++) {
    const fields = parseCSVLine(lines[i]);
    if (fields.length < 10) continue; // Skip incomplete rows

    const record = {};
    for (let j = 0; j < CSV_COLUMNS.length && j < fields.length; j++) {
      const col = CSV_COLUMNS[j];
      let val = fields[j] || '';

      if (NUMERIC_COLS.has(col)) {
        // Strip trailing %, whitespace
        val = val.replace(/%/g, '').trim();
        // Detect format: multiple dots = thousand separators (1.234.567 → 1234567)
        // Single dot = decimal (4.00 → 4, 6379.08 → 6379.08)
        const dotCount = (val.match(/\./g) || []).length;
        if (dotCount > 1) {
          // Vietnamese thousands: 1.234.567 → 1234567, then comma → dot for decimal
          val = val.replace(/\./g, '').replace(/,/g, '.');
        } else {
          // International: single dot is decimal, comma might be thousands
          val = val.replace(/,/g, '');
        }
        record[col] = parseFloat(val) || 0;
      } else {
        record[col] = val;
      }
    }

    // Fill missing columns with defaults
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
    } else if (rawStatus.includes('hủy') || rawStatus.includes('huy')) {
      record.order_status = 'Đã hủy';
    } else {
      record.order_status = 'Đang chờ xử lý';
    }

    records.push(record);
  }

  return records;
}

// ─── Bulk Import (transaction for speed) ────────────────
const importRecords = db.transaction((records) => {
  let inserted = 0;
  let updated = 0;

  for (const record of records) {
    try {
      const result = stmts.upsert.run(record);
      if (result.changes > 0) {
        inserted++;
      }
    } catch (err) {
      logger.warn('OrderStore', `Upsert failed for order ${record.order_id}: ${err.message}`);
    }
  }

  return { inserted, total: records.length };
});

// ─── Exports ────────────────────────────────────────────
const orderStore = {
  parseShopeeCSV,

  importCSV(csvText) {
    const records = parseShopeeCSV(csvText);
    if (records.length === 0) {
      return { success: false, error: 'No valid records found in CSV' };
    }

    logger.info('OrderStore', `Importing ${records.length} order records...`);
    const result = importRecords(records);
    logger.info('OrderStore', `Import complete: ${result.inserted} inserted/updated out of ${result.total}`);
    return { success: true, ...result };
  },

  getRecent(limit = 50, offset = 0) {
    return stmts.getRecent.all(limit, offset);
  },

  getByStatus(status, limit = 50) {
    return stmts.getByStatus.all(status, limit);
  },

  getCount() {
    return stmts.getCount.get().count;
  },

  getStats() {
    return stmts.getStats.get();
  },

  search(query, limit = 20) {
    const q = `%${query}%`;
    return stmts.search.all(q, q, q, q, limit);
  },

  getFiltered(filters = {}, limit = 200) {
    const conditions = [];
    const params = {};

    // Date range — dynamic time field (order_time, complete_time, click_time)
    const timeField = filters.timeField || 'order_time';
    const validTimeFields = ['order_time', 'complete_time', 'click_time'];
    const safeTimeField = validTimeFields.includes(timeField) ? timeField : 'order_time';

    if (filters.dateFrom) {
      conditions.push(`${safeTimeField} >= @dateFrom`);
      params.dateFrom = filters.dateFrom;
    }
    if (filters.dateTo) {
      conditions.push(`${safeTimeField} <= @dateTo`);
      params.dateTo = filters.dateTo + ' 23:59:59';
    }

    // Status
    if (filters.status && filters.status !== 'Tất cả') {
      conditions.push('order_status = @status');
      params.status = filters.status;
    }

    // Order ID search
    if (filters.orderId) {
      conditions.push('order_id LIKE @orderId');
      params.orderId = `%${filters.orderId}%`;
    }

    // Shop name search
    if (filters.shopName) {
      conditions.push('shop_name LIKE @shopName');
      params.shopName = `%${filters.shopName}%`;
    }

    // Shop type dropdown
    if (filters.shopType && filters.shopType !== 'Tất cả') {
      conditions.push('shop_type = @shopType');
      params.shopType = filters.shopType;
    }

    // Product name search
    if (filters.productName) {
      conditions.push('item_name LIKE @productName');
      params.productName = `%${filters.productName}%`;
    }

    // Commission type dropdown
    if (filters.commissionType && filters.commissionType !== 'Tất cả') {
      conditions.push('commission_type = @commissionType');
      params.commissionType = filters.commissionType;
    }

    // Channel dropdown
    if (filters.channel && filters.channel !== 'Tất cả') {
      conditions.push('channel = @channel');
      params.channel = filters.channel;
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const sql = `SELECT * FROM orders ${where} ORDER BY ${safeTimeField} DESC LIMIT @limit`;
    params.limit = limit;

    return db.prepare(sql).all(params);
  },

  getFilterOptions() {
    const shopTypes = db.prepare(
      "SELECT DISTINCT shop_type FROM orders WHERE shop_type != '' ORDER BY shop_type"
    ).all().map(r => r.shop_type);

    const commissionTypes = db.prepare(
      "SELECT DISTINCT commission_type FROM orders WHERE commission_type != '' ORDER BY commission_type"
    ).all().map(r => r.commission_type);

    const channels = db.prepare(
      "SELECT DISTINCT channel FROM orders WHERE channel != '' ORDER BY channel"
    ).all().map(r => r.channel);

    const statuses = db.prepare(
      "SELECT DISTINCT order_status FROM orders WHERE order_status != '' ORDER BY order_status"
    ).all().map(r => r.order_status);

    return { shopTypes, commissionTypes, channels, statuses };
  },
};

module.exports = orderStore;
