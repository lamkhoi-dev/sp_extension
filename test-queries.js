require('dotenv').config();
const db = require('./src/db');
const convertLogStore = require('./src/api/convert-log-store');
const orderStore = require('./src/api/order-store');

async function main() {
  try {
    const convertStats = await convertLogStore.getStats();
    console.log('convertStats:', convertStats);
    console.log('convertStats types:', Object.fromEntries(Object.entries(convertStats).map(([k, v]) => [k, typeof v])));

    const orderStats = await orderStore.getStats();
    console.log('orderStats:', orderStats);
    console.log('orderStats types:', Object.fromEntries(Object.entries(orderStats).map(([k, v]) => [k, typeof v])));

    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}
main();
