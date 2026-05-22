require('dotenv').config();
const db = require('./src/db');
async function main() {
  const rows = await db.all('SELECT total_product_commission, net_commission FROM orders LIMIT 5');
  console.log(rows);
  process.exit(0);
}
main();
