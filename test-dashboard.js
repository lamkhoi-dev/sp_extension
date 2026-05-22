require('dotenv').config();
const db = require('./src/db');
const messageStore = require('./src/zalo/message-store');
const convertLogStore = require('./src/api/convert-log-store');
const orderStore = require('./src/api/order-store');
const userCache = require('./src/zalo/user-cache');

async function main() {
  const [msgStats, convertStats, orderStats, todayConvert, userCount] = await Promise.all([
    messageStore.getStats(),
    convertLogStore.getStats(),
    orderStore.getStats(),
    convertLogStore.getTodayStats(),
    userCache.getUserCount(),
  ]);
  console.log({
    users: { total: userCount },
    messages: { total: msgStats.allTime?.total || 0, today: msgStats.today?.total || 0 },
    converts: {
      total: convertStats.total || 0,
      success: convertStats.success || 0,
      failed: convertStats.failed || 0,
      totalCommission: convertStats.totalCommission || 0,
      avgRate: convertStats.avgRate || 0,
      uniqueUsers: convertStats.uniqueUsers || 0,
      today: todayConvert.total || 0,
      todaySuccess: todayConvert.success || 0,
    },
    orders: {
      total: orderStats.totalOrders || 0,
      uniqueOrders: orderStats.uniqueOrders || 0,
      totalValue: orderStats.totalOrderValue || 0,
      totalCommission: orderStats.totalCommission || 0,
      totalCommissionNew: orderStats.totalCommissionNew || 0,
      uniqueShops: orderStats.uniqueShops || 0,
      uniqueBuyers: orderStats.uniqueBuyers || 0,
    }
  });
  process.exit(0);
}
main();
