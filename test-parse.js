const fs = require('fs');
const orderStore = require('./src/api/order-store');
const csv = fs.readFileSync('AffiliateCommissionReport202605062115.csv', 'utf8');
const records = orderStore.parseShopeeCSV(csv);
console.log(records.slice(0, 2).map(r => ({
  total_product_commission: r.total_product_commission,
  total_order_commission: r.total_order_commission,
  net_commission: r.net_commission
})));
