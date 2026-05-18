const db = require('./src/db');
const store = require('./src/api/report-dashboard-store');

(async () => {
  try {
    const data = await store.getDashboardReports(30);
    console.log(JSON.stringify(data.summary, null, 2));
  } catch (err) {
    console.error(err);
  } finally {
    process.exit(0);
  }
})();
