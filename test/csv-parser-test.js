/**
 * CSV Parser Test — Shopee Affiliate Commission Report
 * 
 * Purpose: Parse real Shopee CSV export and validate column mapping
 * Run: node test/csv-parser-test.js [path-to-csv]
 */

const fs = require('fs');
const path = require('path');

// CSV file path — default to sample file
const csvPath = process.argv[2] || '/Users/an/Downloads/AffiliateCommissionReport202604302341.csv';

if (!fs.existsSync(csvPath)) {
  console.error(`❌ File not found: ${csvPath}`);
  process.exit(1);
}

// Column mapping: CSV header → DB field name
const COLUMN_MAP = {
  'ID đơn hàng': 'order_id',
  'Trạng thái đặt hàng': 'order_status',
  'Checkout id': 'checkout_id',
  'Thời Gian Đặt Hàng': 'order_time',
  'Thời gian hoàn thành': 'complete_time',
  'Thời gian Click': 'click_time',
  'Tên Shop': 'shop_name',
  'Shop id': 'shop_id',
  'Loại Shop': 'shop_type',
  'Item id': 'item_id',
  'Tên Item': 'product_name',
  'ID Model': 'model_id',
  'Loại sản phẩm': 'product_type',
  'Promotion id': 'promotion_id',
  'L1 Danh mục toàn cầu': 'category_l1',
  'L2 Danh mục toàn cầu': 'category_l2',
  'L3 Danh mục toàn cầu': 'category_l3',
  'Giá(₫)': 'product_price',
  'Số lượng': 'quantity',
  'Loại Hoa hồng': 'commission_type',
  'Đối tác chiến dịch': 'campaign_partner', // note: CSV has typo "dịchr" sometimes
  'Giá trị đơn hàng (₫)': 'order_value',
  'Số tiền hoàn trả (₫)': 'refund_amount',
  'Tỷ lệ sản phẩm hoa hồng Shope': 'shopee_comm_rate',  // note: "Shope" not "Shopee"
  'Hoa hồng Shopee trên sản phẩm(₫)': 'shopee_product_comm',
  'Tỷ lệ sản phẩm hoa hồng người bán': 'seller_comm_rate',
  'Hoa hồng Xtra trên sản phẩm(₫)': 'xtra_product_comm',
  'Tổng hoa hồng sản phẩm(₫)': 'total_product_comm',
  'Hoa hồng đơn hàng từ Shopee(₫)': 'shopee_order_comm',
  'Hoa hồng đơn hàng từ Người bán(₫)': 'seller_order_comm',
  'Tổng hoa hồng đơn hàng(₫)': 'total_order_comm',
  'Tên MNC đã liên kết': 'mcn_name',
  'Mã hợp đồng MCN': 'mcn_contract',
  'Mức phí quản lý MCN': 'mcn_fee_rate',
  'Phí quản lý MCN(₫)': 'mcn_fee',
  'Mức hoa hồng tiếp thị liên kết theo thỏa thuận': 'agreed_comm_rate',
  'Hoa hồng ròng tiếp thị liên kết(₫)': 'net_commission',
  'Trạng thái sản phẩm liên kết': 'affiliate_product_status',
  'Ghi chú sản phẩm': 'product_note',
  'Loại thuộc tính': 'attribution_type',
  'Trạng thái người mua': 'buyer_status',
  'Sub_id1': 'sub_id1',
  'Sub_id2': 'sub_id2',
  'Sub_id3': 'sub_id3',
  'Sub_id4': 'sub_id4',
  'Sub_id5': 'sub_id5',
  'Kênh': 'channel',
};

// Numeric fields that should be parsed as float
const NUMERIC_FIELDS = new Set([
  'product_price', 'quantity', 'order_value', 'refund_amount',
  'shopee_product_comm', 'xtra_product_comm', 'total_product_comm',
  'shopee_order_comm', 'seller_order_comm', 'total_order_comm',
  'mcn_fee', 'net_commission',
]);

/**
 * Parse CSV with proper handling of quoted fields containing commas
 */
function parseCSVLine(line) {
  const fields = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++; // skip escaped quote
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      fields.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  fields.push(current.trim());
  return fields;
}

/**
 * Parse the CSV file and return structured records
 */
function parseShopeeCSV(filePath) {
  let raw = fs.readFileSync(filePath, 'utf-8');

  // Remove BOM if present
  if (raw.charCodeAt(0) === 0xFEFF) {
    raw = raw.slice(1);
  }

  // Normalize line endings
  const lines = raw.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n').filter(l => l.trim());

  if (lines.length < 2) {
    return { headers: [], records: [], errors: ['File has no data rows'] };
  }

  // Parse header
  const headerFields = parseCSVLine(lines[0]);
  console.log(`\n📋 CSV Headers (${headerFields.length} columns):`);

  // Map header index → DB field
  const indexToField = {};
  const unmappedHeaders = [];

  headerFields.forEach((header, i) => {
    // Try exact match first
    let dbField = COLUMN_MAP[header];

    // Fuzzy match for typos (e.g. "dịchr" → "dịch")
    if (!dbField) {
      for (const [csvName, field] of Object.entries(COLUMN_MAP)) {
        if (header.includes(csvName.slice(0, 10)) || csvName.includes(header.slice(0, 10))) {
          dbField = field;
          break;
        }
      }
    }

    if (dbField) {
      indexToField[i] = dbField;
      console.log(`  ✅ [${i + 1}] "${header}" → ${dbField}`);
    } else {
      unmappedHeaders.push({ index: i, name: header });
      console.log(`  ⚠️ [${i + 1}] "${header}" → UNMAPPED`);
    }
  });

  // Parse data rows
  const records = [];
  const errors = [];

  for (let rowIdx = 1; rowIdx < lines.length; rowIdx++) {
    const fields = parseCSVLine(lines[rowIdx]);
    const record = {};

    for (const [i, dbField] of Object.entries(indexToField)) {
      let value = fields[parseInt(i)] || '';

      // Parse numeric fields
      if (NUMERIC_FIELDS.has(dbField)) {
        // Remove commas and parse
        value = parseFloat(value.replace(/,/g, '')) || 0;
      }

      record[dbField] = value;
    }

    records.push(record);
  }

  return { headers: headerFields, records, unmappedHeaders, errors };
}

// --- Run ---
console.log(`\n🔍 Parsing: ${path.basename(csvPath)}`);
console.log(`   Path: ${csvPath}`);

const result = parseShopeeCSV(csvPath);

console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
console.log(`📊 Results: ${result.records.length} records parsed`);

if (result.unmappedHeaders.length > 0) {
  console.log(`\n⚠️ Unmapped headers:`);
  result.unmappedHeaders.forEach(h => console.log(`   [${h.index + 1}] "${h.name}"`));
}

// Print each record in a readable format
result.records.forEach((record, i) => {
  console.log(`\n━━━ Record ${i + 1} ━━━━━━━━━━━━━━━━━━━━━━`);

  // Core info
  console.log(`  📦 Order:    ${record.order_id} [${record.order_status}]`);
  console.log(`  🕐 Ordered:  ${record.order_time || '--'}`);
  console.log(`  ✅ Complete: ${record.complete_time || '--'}`);
  console.log(`  🔗 Clicked:  ${record.click_time || '--'}`);

  // Shop info
  console.log(`  🏪 Shop:     ${record.shop_name} (${record.shop_type})`);

  // Product info
  console.log(`  🛒 Product:  ${record.product_name}`);
  console.log(`  💰 Price:    ${record.product_price?.toLocaleString('vi-VN')}₫ × ${record.quantity}`);

  // Commission
  console.log(`  📊 Type:     ${record.commission_type}`);
  console.log(`  💵 Order Val: ${record.order_value?.toLocaleString('vi-VN')}₫`);
  console.log(`  🏷️ Shopee Rate: ${record.shopee_comm_rate} → ${record.shopee_product_comm?.toLocaleString('vi-VN')}₫`);
  console.log(`  🏷️ Seller Rate: ${record.seller_comm_rate} → ${record.xtra_product_comm?.toLocaleString('vi-VN')}₫`);
  console.log(`  💎 Total Prod Comm: ${record.total_product_comm?.toLocaleString('vi-VN')}₫`);
  console.log(`  💎 Total Order Comm: ${record.total_order_comm?.toLocaleString('vi-VN')}₫`);
  console.log(`  💎 Net Commission: ${record.net_commission?.toLocaleString('vi-VN')}₫`);

  // SubIDs
  console.log(`  🔖 Sub1: "${record.sub_id1}" | Sub2: "${record.sub_id2}" | Sub3: "${record.sub_id3}"`);
  console.log(`  📡 Channel: ${record.channel}`);
  console.log(`  👤 Buyer Status: ${record.buyer_status}`);
  console.log(`  📌 Affiliate Status: ${record.affiliate_product_status}`);
});

// Summary
console.log(`\n━━━ Summary ━━━━━━━━━━━━━━━━━━━━━━`);
const totalComm = result.records.reduce((s, r) => s + (r.net_commission || 0), 0);
const statusGroups = {};
result.records.forEach(r => {
  statusGroups[r.order_status] = (statusGroups[r.order_status] || 0) + 1;
});
console.log(`  Total net commission: ${totalComm.toLocaleString('vi-VN')}₫`);
console.log(`  Status breakdown:`, statusGroups);
console.log(`  Unique orders: ${new Set(result.records.map(r => r.order_id)).size}`);
console.log(`  Channels:`, [...new Set(result.records.map(r => r.channel))]);
console.log(`\n✅ Parser test complete!`);

// Export for module use
module.exports = { parseShopeeCSV, parseCSVLine, COLUMN_MAP, NUMERIC_FIELDS };
