const db = require('../db');
const logger = require('../logger');

const simulateStore = {
  async createOrder(data) {
    const orderId = `SIM-${Date.now()}`;
    const now = new Date().toISOString();
    const price = Number(data.price) || 0;
    const quantity = Number(data.quantity) || 1;
    const orderValue = price * quantity;
    const refundAmount = Number(data.refundAmount) || 0;

    // ── Commission rates ──
    const shopeeRate = Number(data.shopeeRate) || 0;
    const sellerRate = Number(data.sellerRate) || 0;
    const mcnFeeRate = Number(data.mcnFeeRate) || 0;

    // ── Commission amounts (based on order_value − refund) ──
    const effectiveValue = Math.max(orderValue - refundAmount, 0);
    const shopeeCommission = Math.round(effectiveValue * shopeeRate / 100);
    const sellerCommission = Math.round(effectiveValue * sellerRate / 100);
    const xtraCommission = Number(data.xtraCommission) || 0;
    const totalProductCommission = shopeeCommission + sellerCommission + xtraCommission;

    const orderCommission = Number(data.orderCommission) || 0;
    const orderBonus = Number(data.orderBonus) || 0;
    const totalOrderCommission = totalProductCommission + orderCommission + orderBonus;

    // ── MCN fee ──
    const mcnFeeAmount = Math.round(totalOrderCommission * mcnFeeRate / 100);

    // ── NET = total − MCN fee ──
    const netCommission = totalOrderCommission - mcnFeeAmount;

    const commissionType = data.commissionType || 'CPS';

    try {
      await db.runNamed(`
        INSERT INTO orders (
          order_id, order_status, item_id, item_name, shop_id, shop_name,
          price, quantity, order_value, refund_amount,
          commission_type,
          shopee_product_commission_rate, shopee_product_commission,
          seller_product_commission_rate,
          xtra_product_commission, total_product_commission,
          order_commission, order_bonus, total_order_commission,
          shopee_product_commission_rate_new, shopee_product_commission_new,
          seller_product_commission_rate_new,
          xtra_product_commission_new, total_product_commission_new,
          order_commission_new, order_bonus_new,
          mcn_name, mcn_contract, mcn_fee_rate, mcn_fee_amount,
          agreed_commission_rate, net_commission,
          sub_id1, sub_id2, order_time, complete_time, channel
        ) VALUES (
          @orderId, @status, @itemId, @itemName, @shopId, @shopName,
          @price, @quantity, @orderValue, @refundAmount,
          @commissionType,
          @shopeeRate, @shopeeCommission,
          @sellerRate,
          @xtraCommission, @totalProductCommission,
          @orderCommission, @orderBonus, @totalOrderCommission,
          @shopeeRateNew, @shopeeCommissionNew,
          @sellerRateNew,
          @xtraCommissionNew, @totalProductCommissionNew,
          @orderCommissionNew, @orderBonusNew,
          @mcnName, @mcnContract, @mcnFeeRate, @mcnFeeAmount,
          @agreedRate, @netCommission,
          @subId1, @subId2, @orderTime, @completeTime, @channel
        )
      `, {
        orderId,
        status: data.status || 'Đang chờ xử lý',
        itemId: data.itemId || '',
        itemName: data.itemName || '',
        shopId: data.shopId || '',
        shopName: data.shopName || '',
        price,
        quantity,
        orderValue,
        refundAmount,
        commissionType,
        // Estimated = confirmed for simulate (no reconciliation phase)
        shopeeRate,
        shopeeCommission,
        sellerRate,
        xtraCommission,
        totalProductCommission,
        orderCommission,
        orderBonus,
        totalOrderCommission,
        // _new = same as estimated for simulate
        shopeeRateNew: shopeeRate,
        shopeeCommissionNew: shopeeCommission,
        sellerRateNew: sellerRate,
        xtraCommissionNew: xtraCommission,
        totalProductCommissionNew: totalProductCommission,
        orderCommissionNew: orderCommission,
        orderBonusNew: orderBonus,
        // MCN
        mcnName: data.mcnName || '',
        mcnContract: data.mcnContract || '',
        mcnFeeRate,
        mcnFeeAmount,
        agreedRate: shopeeRate + sellerRate,
        netCommission,
        // Tracking
        subId1: data.subId1 || '',
        subId2: data.subId2 || '',
        orderTime: data.orderTime || now,
        completeTime: data.status === 'Hoàn thành' ? (data.completeTime || now) : '',
        channel: 'simulate',
      });

      logger.info('SimulateStore', `Created order ${orderId} | value=${orderValue} shopee=${shopeeRate}% seller=${sellerRate}% xtra=${xtraCommission} orderComm=${orderCommission} bonus=${orderBonus} mcn=${mcnFeeRate}% → net=${netCommission}`);

      return {
        success: true,
        orderId,
        orderValue,
        shopeeCommission,
        sellerCommission,
        xtraCommission,
        totalProductCommission,
        orderCommission,
        orderBonus,
        totalOrderCommission,
        mcnFeeAmount,
        netCommission,
        refundAmount,
      };
    } catch (err) {
      logger.error('SimulateStore', `Create failed: ${err.message}`);
      return { success: false, error: err.message };
    }
  },
};

module.exports = simulateStore;
