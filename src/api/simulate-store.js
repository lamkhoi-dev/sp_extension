const db = require('../db');
const logger = require('../logger');

const simulateStore = {
  async createOrder(data) {
    const orderId = `SIM-${Date.now()}`;
    const now = new Date().toISOString();
    const orderValue = (data.price || 0) * (data.quantity || 1);
    const commissionRate = data.commissionRate || 0;
    const netCommission = Math.round(orderValue * commissionRate / 100);

    try {
      await db.runNamed(`
        INSERT INTO orders (
          order_id, order_status, item_id, item_name, shop_id, shop_name,
          price, quantity, order_value, 
          shopee_product_commission_rate, net_commission,
          sub_id1, sub_id2, order_time, complete_time, channel
        ) VALUES (
          @orderId, @status, @itemId, @itemName, @shopId, @shopName,
          @price, @quantity, @orderValue,
          @commissionRate, @netCommission,
          @subId1, @subId2, @orderTime, @completeTime, @channel
        )
      `, {
        orderId,
        status: data.status || 'Đang chờ xử lý',
        itemId: data.itemId || '',
        itemName: data.itemName || '',
        shopId: data.shopId || '',
        shopName: data.shopName || '',
        price: data.price || 0,
        quantity: data.quantity || 1,
        orderValue,
        commissionRate,
        netCommission,
        subId1: data.subId1 || '',
        subId2: data.subId2 || '',
        orderTime: data.orderTime || now,
        completeTime: data.status === 'Hoàn thành' ? (data.completeTime || now) : '',
        channel: 'simulate',
      });

      logger.info('SimulateStore', `Created simulated order ${orderId} for user ${data.subId1}`);
      return { success: true, orderId, netCommission, orderValue };
    } catch (err) {
      logger.error('SimulateStore', `Create failed: ${err.message}`);
      return { success: false, error: err.message };
    }
  },
};

module.exports = simulateStore;
