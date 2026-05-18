const db = require('./src/db');

async function checkReferral() {
  try {
    const orders = await db.all(`
      SELECT o.order_id, o.sub_id1, o.net_commission, cl.sub_id2 as referrer_id
      FROM orders o
      INNER JOIN convert_logs cl ON (
        (o.item_id != '' AND o.item_id = cl.item_id AND o.sub_id1 = cl.sub_id1)
        OR
        (cl.item_id = '' AND o.item_name != '' AND o.item_name = cl.product_name AND o.sub_id1 = cl.sub_id1)
      )
      WHERE cl.status = 'success' AND cl.sub_id2 IS NOT NULL AND cl.sub_id2 != ''
    `);
    
    console.log("Matched Orders with Referrers:", orders.length);
    if (orders.length > 0) {
      console.log(orders.slice(0, 5));
    }

    const uniqueReferrers = [...new Set(orders.map(o => o.referrer_id))];
    console.log("Unique Referrers:", uniqueReferrers);

    if (uniqueReferrers.length > 0) {
      const refUsers = await db.all(`SELECT user_id, display_name FROM users WHERE user_id IN (${uniqueReferrers.map(u => `'${u}'`).join(',')})`);
      console.log("Users in DB for those referrers:", refUsers);
    }
    
  } catch (err) {
    console.error(err);
  } finally {
    process.exit(0);
  }
}

checkReferral();
