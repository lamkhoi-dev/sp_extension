require('dotenv').config();
const bcrypt = require('bcryptjs');
const db = require('../src/db');
const logger = require('../src/logger');

const SALT_ROUNDS = 10;
const DEFAULT_PASSWORD = 'changeme123';
const TARGET_ADMIN = 'admin1';

async function resetPassword() {
  try {
    const admin = await db.get('SELECT * FROM admin_users WHERE username = ?', [TARGET_ADMIN]);
    
    if (!admin) {
      console.log(`❌ Không tìm thấy user '${TARGET_ADMIN}' trong database.`);
      process.exit(1);
    }

    const hash = await bcrypt.hash(DEFAULT_PASSWORD, SALT_ROUNDS);
    await db.run(
      'UPDATE admin_users SET password_hash = ?, must_change_password = true WHERE username = ?',
      [hash, TARGET_ADMIN]
    );

    console.log(`✅ Đã reset mật khẩu cho '${TARGET_ADMIN}' thành công!`);
    console.log(`📌 Mật khẩu mới là: ${DEFAULT_PASSWORD}`);
    process.exit(0);
  } catch (err) {
    console.error('❌ Lỗi khi reset mật khẩu:', err);
    process.exit(1);
  }
}

resetPassword();
