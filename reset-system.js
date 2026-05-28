require('dotenv').config();
const { DB } = require('./src/db/index');
const logger = require('./src/logger');

async function resetSystem() {
  logger.info('Reset', 'Bắt đầu quá trình reset toàn bộ hệ thống (giữ lại admin)...');

  try {
    if (DB.type === 'postgres') {
      // Dành cho PostgreSQL (Aiven)
      const tables = [
        'messages',
        'users',
        'convert_logs',
        'payouts',
        'orders',
        'product_images',
        'audit_logs',
        'stat_reports',
        'link_redirects',
        'link_click_events'
      ];
      
      logger.info('Reset', 'Đang xoá dữ liệu các bảng...');
      for (const table of tables) {
        await DB.exec(`TRUNCATE TABLE ${table} RESTART IDENTITY CASCADE;`);
        logger.info('Reset', `Đã xoá sạch bảng: ${table}`);
      }

    } else {
      // Dành cho SQLite
      const tables = [
        'messages', 'users', 'convert_logs', 'payouts', 'orders', 
        'product_images', 'audit_logs', 'stat_reports', 
        'link_redirects', 'link_click_events'
      ];
      
      for (const table of tables) {
        await DB.exec(`DELETE FROM ${table};`);
        logger.info('Reset', `Đã xoá sạch bảng: ${table}`);
      }
      
      // Xoá index tự tăng của SQLite
      try {
        await DB.exec(`DELETE FROM sqlite_sequence WHERE name NOT IN ('admin_users');`);
      } catch (e) {
        // Có thể sqlite_sequence chưa tồn tại
      }
    }

    logger.info('Reset', '✅ Reset hệ thống thành công! Dữ liệu admin_users vẫn được giữ nguyên.');
    process.exit(0);
    
  } catch (error) {
    logger.error('Reset', 'Lỗi khi reset hệ thống: ' + error.message);
    process.exit(1);
  }
}

resetSystem();
