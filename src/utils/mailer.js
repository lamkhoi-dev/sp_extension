const nodemailer = require('nodemailer');

let transporter = null;

// Instance label so alert emails show which server they came from
// (pm2 sets `name` = app name: shopee-bot / shopee-staging).
const INSTANCE = process.env.name || process.env.NODE_ENV || 'local';

function getTransporter() {
  if (!transporter && process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD) {
    transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_APP_PASSWORD,
      },
    });
  }
  return transporter;
}

/**
 * Sends an email notification.
 * @param {string} to - Recipient email address(es), comma-separated
 * @param {string} subject - Email subject
 * @param {string} text - Email body
 */
async function sendMail(to, subject, text) {
  if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD || !to) {
    console.log('[Mailer] Missing email configuration. Skip sending email.');
    return;
  }

  const transport = getTransporter();
  if (!transport) return;

  try {
    const info = await transport.sendMail({
      from: `"Shopee Ext Bot [${INSTANCE}]" <${process.env.GMAIL_USER}>`,
      to,
      subject,
      text,
    });
    console.log(`[Mailer] Email sent: ${info.messageId}`);
  } catch (error) {
    console.error(`[Mailer] Failed to send email: ${error.message}`);
  }
}

module.exports = { sendMail };
