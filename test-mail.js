/**
 * Test script: verify email configuration is working
 * Usage: node test-mail.js
 */
require('dotenv').config();
const nodemailer = require('nodemailer');

const { GMAIL_USER, GMAIL_APP_PASSWORD, NOTIFY_EMAILS } = process.env;

// --- Validation ---
if (!GMAIL_USER || !GMAIL_APP_PASSWORD || !NOTIFY_EMAILS) {
  console.error('❌ Missing env variables! Please check your .env file:');
  console.error('   GMAIL_USER        =', GMAIL_USER || '(missing)');
  console.error('   GMAIL_APP_PASSWORD=', GMAIL_APP_PASSWORD ? '(set)' : '(missing)');
  console.error('   NOTIFY_EMAILS     =', NOTIFY_EMAILS || '(missing)');
  process.exit(1);
}

console.log('📧 Sending test email...');
console.log('   From:', GMAIL_USER);
console.log('   To:  ', NOTIFY_EMAILS);

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: GMAIL_USER,
    pass: GMAIL_APP_PASSWORD,
  },
});

transporter.sendMail({
  from: `"Shopee Ext Bot" <${GMAIL_USER}>`,
  to: NOTIFY_EMAILS,
  subject: '✅ [Test] Shopee Bot - Email hoạt động!',
  text: [
    '🎉 Email đã được cấu hình thành công!',
    '',
    'Hệ thống Shopee Affiliate Bot sẽ tự động gửi thông báo đến địa chỉ này khi:',
    '  ❌ Phát hiện lỗi kết nối (cookie incorrect, mất tab, v.v.)',
    '  ✅ Hệ thống tự khôi phục thành công',
    '',
    `Thời gian test: ${new Date().toLocaleString('vi-VN')}`,
    `Gửi từ: ${GMAIL_USER}`,
  ].join('\n'),
}, (err, info) => {
  if (err) {
    console.error('\n❌ Gửi mail THẤT BẠI!');
    console.error('   Lỗi:', err.message);
    console.error('\n💡 Gợi ý:');
    console.error('   - Kiểm tra GMAIL_APP_PASSWORD (phải là App Password 16 ký tự, không phải mật khẩu Google thường)');
    console.error('   - Đảm bảo đã bật 2-Step Verification trên tài khoản Google');
    console.error('   - Thử bỏ khoảng trắng nếu có trong App Password');
    process.exit(1);
  } else {
    console.log('\n✅ Gửi mail THÀNH CÔNG!');
    console.log('   Message ID:', info.messageId);
    console.log('   Kiểm tra hộp thư của:', NOTIFY_EMAILS);
    process.exit(0);
  }
});
