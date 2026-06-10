/**
 * Single source of truth for the /thongke reply message.
 *
 * Both the Zalo bot (zalo-commands._handleThongke) and the admin Test /thongke
 * page (POST /api/reports/generate) render the message from this function, so
 * the preview shown to admins is byte-for-byte identical to what the user gets.
 */

function formatVND(val) {
  if (!val && val !== 0) return '0đ';
  return new Intl.NumberFormat('vi-VN').format(Math.round(val)) + 'đ';
}

/**
 * Build the exact text the bot replies with for /thongke.
 * @param {object} data     - output of reportGenerator.generateReport()
 * @param {string} reportUrl - the /s/:token link to embed
 * @returns {string}
 */
function buildThongkeMessage(data, reportUrl) {
  const s = data.summary;
  const isCustom = data.user.isCustomMode;
  const f0Rate = data.user.f0Rate;
  const rates = data.rates;

  // ─ Buyer block (luôn show) ─
  const buyerBlock = `🛒 Mua hàng (${isCustom ? 'Custom' : 'F0'} ${f0Rate}%)
   Đơn: ${s.totalOrders}
   Bạn nhận: ${formatVND(s.totalBuyerCashback)}
   Đã trả: ${formatVND(s.totalPaidAsBuyer)}
   Chờ trả: ${formatVND(s.pendingBuyerPayment)}`;

  // ─ Referrer block (chỉ show nếu có downline) ─
  const referrerBlock = (s.ctvCount > 0 || s.totalReferrerEarnings > 0)
    ? `\n\n👥 Thu nhập từ CTV (${s.ctvCount} F1 trực tiếp)
   F1 (×${rates.f1}%): ${formatVND(s.totalF1Earnings)}
   F2 (×${rates.f2}%): ${formatVND(s.totalF2Earnings)}
   F3 (×${rates.f3}%): ${formatVND(s.totalF3Earnings)}
   Tổng: ${formatVND(s.totalReferrerEarnings)}`
    : '';

  // ─ Custom block (chỉ show nếu có) ─
  const customBlock = s.hasCustomOrders
    ? `\n\n🎯 Đơn Custom (F1 — bạn gửi cho khách)
   Tỷ lệ ${s.customRate}% • ${s.totalCustomOrders} đơn • ${s.uniqueF2Count} khách
   Bạn nhận: ${formatVND(s.totalCustomCashback)}
   Đã trả: ${formatVND(s.totalCustomPaid)}
   Chờ trả: ${formatVND(s.pendingCustomPayment)}`
    : '';

  return `📊 Thống kê — ${data.user.displayName}

${buyerBlock}${referrerBlock}${customBlock}

🔗 Chi tiết & sơ đồ CTV:
${reportUrl}

⏰ Link hiệu lực 24 giờ`;
}

module.exports = { buildThongkeMessage, formatVND };
