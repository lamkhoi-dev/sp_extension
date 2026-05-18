const db = require('./src/api/db');
const store = require('./src/api/report-dashboard-store');
(async () => {
  try {
    const data = await store.getDashboardReports(30);
    console.log(JSON.stringify(data, null, 2).slice(0, 500));
  } catch (e) {
    console.error(e);
  } finally {
    process.exit(0);
  }
})();
