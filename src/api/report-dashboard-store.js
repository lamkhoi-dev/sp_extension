const db = require('../db');
const logger = require('../logger');

const reportDashboardStore = {
  async getDashboardReports(days = 30) {
    try {
      // Calculate date boundary to avoid dialect-specific DATE/INTERVAL functions
      const dateFrom = new Date();
      dateFrom.setDate(dateFrom.getDate() - days);
      const dateFromStr = dateFrom.toISOString().split('T')[0] + ' 00:00:00';
      
      const params = [dateFromStr];
      const whereClause = `WHERE order_time >= ?`; // Not filtering Cancelled/Refunded per user's request

      // 1. Summary
      const summaryRow = await db.get(`
        SELECT 
          COUNT(*) as "totalOrders",
          SUM(net_commission) as "totalRevenue",
          SUM(CASE WHEN order_status = 'Hoàn thành' THEN net_commission ELSE 0 END) as "receivedCommission",
          SUM(order_value) as "totalOrderValue"
        FROM orders
        ${whereClause}
      `, params);

      // Pseudo-conversion rate (Since we don't have total clicks mapped here directly,
      // we could compute it based on total orders if we had click data, but for now 
      // we'll return a static/placeholder or base it on something else if needed, 
      // or just calculate total unique buyers as a proxy)
      const buyersRow = await db.get(`
        SELECT COUNT(DISTINCT sub_id1) as "uniqueBuyers"
        FROM orders
        ${whereClause}
      `, params);

      const totalOrders = Number(summaryRow.totalOrders || summaryRow.totalorders || 0);
      const uniqueBuyers = Number(buyersRow.uniqueBuyers || buyersRow.uniquebuyers || 0);

      const summary = {
        totalRevenue: Number(summaryRow.totalRevenue || summaryRow.totalrevenue || 0),
        receivedCommission: Number(summaryRow.receivedCommission || summaryRow.receivedcommission || 0),
        totalOrderValue: Number(summaryRow.totalOrderValue || summaryRow.totalordervalue || 0),
        totalOrders: totalOrders,
        conversionRate: uniqueBuyers ? ((totalOrders / uniqueBuyers) * 100).toFixed(2) : 0, 
        // 👆 Just an example proxy metric. You can adjust this if `convert_logs` provides total clicks.
      };

      // 2. Chart Data (Grouped by Date)
      // Since SQLite uses substr(order_time, 1, 10) and Postgres uses DATE(order_time) or LEFT(order_time, 10)
      // The safest cross-db way for "YYYY-MM-DD" given order_time is generally a string like '2024-01-01 12:34:56'
      // is to use substring.
      let chartDataRaw;
      if (db.type === 'postgres') {
        chartDataRaw = await db.all(`
          SELECT 
            SUBSTRING(CAST(order_time AS TEXT) FROM 1 FOR 10) as date,
            SUM(net_commission) as commission
          FROM orders
          ${whereClause}
          GROUP BY SUBSTRING(CAST(order_time AS TEXT) FROM 1 FOR 10)
          ORDER BY date ASC
        `, params);
      } else {
        // SQLite
        chartDataRaw = await db.all(`
          SELECT 
            substr(order_time, 1, 10) as date,
            SUM(net_commission) as commission
          FROM orders
          ${whereClause}
          GROUP BY substr(order_time, 1, 10)
          ORDER BY date ASC
        `, params);
      }

      // Fill in missing dates to make the chart look contiguous
      const chartData = fillMissingDates(chartDataRaw, days, dateFrom);

      // 3. Top Products
      const topProducts = await db.all(`
        SELECT 
          item_id as id,
          item_name as name,
          SUM(quantity) as sold,
          SUM(order_value) as revenue,
          SUM(net_commission) as commission
        FROM orders
        ${whereClause}
        GROUP BY item_id, item_name
        ORDER BY commission DESC
        LIMIT 10
      `, params);

      const formattedTopProducts = topProducts.map(p => ({
        id: p.id,
        name: p.name,
        sold: Number(p.sold || 0),
        revenue: Number(p.revenue || 0),
        commission: Number(p.commission || 0)
      }));

      return {
        summary,
        chartData,
        topProducts: formattedTopProducts
      };

    } catch (error) {
      logger.error('ReportDashboardStore', `Error fetching dashboard reports: ${error.message}`);
      throw error;
    }
  }
};

// Utility to ensure every day in the range has a data point, even if 0
function fillMissingDates(dbData, days, startDate) {
  const dataMap = {};
  for (const row of dbData) {
    if (row.date) {
      dataMap[row.date] = Number(row.commission) || 0;
    }
  }

  const result = [];
  for (let i = 0; i <= days; i++) {
    const d = new Date(startDate.getTime());
    d.setDate(d.getDate() + i);
    
    // Format YYYY-MM-DD
    const isoStr = d.toISOString().split('T')[0];
    
    // Format DD/MM for chart display using the exact parts from the UTC isoStr 
    // to match the date string produced by PostgreSQL's SUBSTRING
    const [, month, day] = isoStr.split('-');
    const displayDate = `${day}/${month}`;

    result.push({
      date: displayDate,
      commission: dataMap[isoStr] || 0
    });
  }

  return result;
}

module.exports = reportDashboardStore;
