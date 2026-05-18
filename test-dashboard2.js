const db = require('./src/db');
const reportStore = require('./src/api/report-dashboard-store');

async function run() {
  await db.init();
  const data = await reportStore.getDashboardReports(30);
  console.log(JSON.stringify(data.summary, null, 2));
  console.log('Top products:', data.topProducts.length);
  process.exit(0);
}
run().catch(err => {
  console.error(err);
  process.exit(1);
});
