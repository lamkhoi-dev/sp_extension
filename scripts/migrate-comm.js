require('/Users/an/Workspace/shope_ext/node_modules/dotenv').config({ path: '/Users/an/Workspace/shope_ext/.env' });
const { Client } = require('/Users/an/Workspace/shope_ext/node_modules/pg');

let connectionString = process.env.DATABASE_URL || "postgres://localhost:5432/shopee_affiliate";
const isDryRun = process.env.DRY_RUN !== 'false'; // defaults to dry-run

async function run() {
  console.log(`[Migration] Mode: ${isDryRun ? 'DRY-RUN (No changes will be saved)' : 'LIVE (Changes will be saved to DB)'}`);
  
  const isLocalhost = connectionString.includes('localhost') || connectionString.includes('127.0.0.1');
  const clientConfig = { connectionString };

  if (!isLocalhost) {
    clientConfig.ssl = { rejectUnauthorized: false };
    connectionString = connectionString
      .replace(/[?&]sslmode=require/i, '')
      .replace(/[?&]sslmode=no-verify/i, '')
      .replace(/[?&]ssl=true/i, '');
    if (connectionString.endsWith('?')) {
      connectionString = connectionString.slice(0, -1);
    }
    clientConfig.connectionString = connectionString;
  }

  const client = new Client(clientConfig);
  await client.connect();
  console.log("[Migration] Connected to database.");

  // 1. Get all order_ids that have more than 1 item
  const resGroup = await client.query(`
    SELECT order_id
    FROM orders
    GROUP BY order_id
    HAVING COUNT(*) > 1
  `);
  
  console.log(`[Migration] Found ${resGroup.rows.length} multi-item orders to inspect.`);

  let totalOrdersUpdated = 0;
  let totalRowsUpdated = 0;

  for (const groupRow of resGroup.rows) {
    const { order_id } = groupRow;
    
    // Fetch all items for this order
    const resItems = await client.query(`
      SELECT id, item_name, price, quantity, net_commission, total_product_commission
      FROM orders
      WHERE order_id = $1
    `, [order_id]);

    const items = resItems.rows;
    
    const sumNet = items.reduce((sum, item) => sum + (parseFloat(item.net_commission) || 0), 0);
    const sumProd = items.reduce((sum, item) => sum + (parseFloat(item.total_product_commission) || 0), 0);

    if (sumNet <= 0) {
      continue; // No net commission to redistribute
    }

    const updates = [];
    
    for (const item of items) {
      const currentNet = parseFloat(item.net_commission) || 0;
      let expectedNet = 0;

      if (sumProd > 0) {
        const prodComm = parseFloat(item.total_product_commission) || 0;
        expectedNet = (prodComm / sumProd) * sumNet;
      } else {
        // Fallback: price * quantity
        const itemVal = (parseFloat(item.price) || 0) * (parseInt(item.quantity) || 0);
        const sumVal = items.reduce((sum, r) => sum + (parseFloat(r.price) || 0) * (parseInt(r.quantity) || 0), 0);
        if (sumVal > 0) {
          expectedNet = (itemVal / sumVal) * sumNet;
        } else {
          expectedNet = sumNet / items.length;
        }
      }

      // Round to 4 decimal places to match database floating point representation
      const currentNetRounded = parseFloat(currentNet.toFixed(4));
      const expectedNetRounded = parseFloat(expectedNet.toFixed(4));

      if (Math.abs(currentNetRounded - expectedNetRounded) > 0.0001) {
        updates.push({
          id: item.id,
          itemName: item.item_name,
          currentNet: currentNetRounded,
          expectedNet: expectedNetRounded
        });
      }
    }

    if (updates.length > 0) {
      console.log(`\n--------------------------------------------------`);
      console.log(`[Order ID] ${order_id}`);
      console.log(`Original total net commission: ${sumNet}`);
      console.log(`Proposed redistribution:`);
      for (const u of updates) {
        console.log(`  - Row ID ${u.id}: "${u.itemName.substring(0, 40)}..."`);
        console.log(`    Current net: ${u.currentNet} -> Expected net: ${u.expectedNet}`);
      }

      if (!isDryRun) {
        // Run live updates
        for (const u of updates) {
          await client.query(`
            UPDATE orders
            SET net_commission = $1
            WHERE id = $2
          `, [u.expectedNet, u.id]);
          totalRowsUpdated++;
        }
        totalOrdersUpdated++;
      } else {
        totalRowsUpdated += updates.length;
        totalOrdersUpdated++;
      }
    }
  }

  console.log(`\n--------------------------------------------------`);
  console.log(`[Migration Complete]`);
  console.log(`Total orders affected: ${totalOrdersUpdated}`);
  console.log(`Total rows affected: ${totalRowsUpdated}`);

  await client.end();
}

run().catch(async (err) => {
  console.error("[Migration Error]", err);
});
