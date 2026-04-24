const ShopeeAPI = require('./shopee-api');
const logger = require('./logger');

const api = new ShopeeAPI();

const HELP_TEXT = `🤖 **Shopee Affiliate Bot** (Extension Mode)

Xin chào! Tôi giúp bạn tìm kiếm sản phẩm và tạo affiliate link.

**Các lệnh:**

\`/search <tên sản phẩm>\` — Tìm sản phẩm, xem hoa hồng
\`/link <URL shopee>\` — Tạo affiliate link
\`/link <URL> <sub_id>\` — Tạo link có Sub ID
\`/status\` — Xem trạng thái Extension
\`/help\` — Hiển thị hướng dẫn này

**Ví dụ:**
\`/search Bông mút rửa mặt AMORTALS\`
\`/link https://shopee.vn/product/1391725226/26326757902\`
\`/link https://s.shopee.vn/qfmqIMWXN tele_bot\``;

const WELCOME_TEXT = `👋 Chào bạn! Tôi là **Shopee Affiliate Bot** (Extension Mode).

⏳ Đang chờ Chrome Extension kết nối...
Gõ \`/help\` để xem danh sách lệnh.`;

async function handleCommand(input) {
  const trimmed = input.trim();

  if (trimmed === '/help') {
    return { type: 'text', content: HELP_TEXT };
  }

  if (trimmed === '/status') {
    return handleStatus();
  }

  if (trimmed.startsWith('/search ')) {
    const keyword = trimmed.replace('/search ', '').trim();
    if (!keyword) return { type: 'text', content: '⚠️ Vui lòng nhập tên sản phẩm.\nVí dụ: `/search Bông mút rửa mặt`' };
    return await handleSearch(keyword);
  }

  if (trimmed.startsWith('/link ')) {
    const parts = trimmed.replace('/link ', '').trim().split(/\s+/);
    const url = parts[0];
    const subId1 = parts[1] || '';
    const subId2 = parts[2] || '';
    if (!url) return { type: 'text', content: '⚠️ Vui lòng nhập URL.\nVí dụ: `/link https://shopee.vn/product/...`' };
    return await handleLink(url, { subId1, subId2 });
  }

  if (trimmed.startsWith('/')) {
    return { type: 'text', content: `❓ Lệnh không hợp lệ: \`${trimmed.split(' ')[0]}\`\nGõ \`/help\` để xem danh sách lệnh.` };
  }

  return { type: 'text', content: `💡 Bạn có thể gõ:\n• \`/search ${trimmed}\` để tìm sản phẩm\n• \`/help\` để xem hướng dẫn` };
}

function handleStatus() {
  const extConnected = !!ShopeeAPI.sendToExtension;
  const icon = extConnected ? '🟢' : '🔴';

  let content = `**📊 Trạng thái hệ thống**\n\n`;
  content += `${icon} Extension: **${extConnected ? 'Đã kết nối' : 'Chưa kết nối'}**\n`;
  content += `\n💡 Extension hoạt động ở chế độ DOM Automation.\nTab Shopee Affiliate cần được mở trên Chrome.`;

  return { type: 'text', content };
}

async function handleSearch(keyword) {
  const result = await api.searchProduct(keyword);

  if (!result.success) {
    return {
      type: 'text',
      content: `❌ Lỗi tìm kiếm: ${result.error}\n\n💡 Kiểm tra tab Shopee Affiliate đang mở và Extension đã kết nối.`,
    };
  }

  if (result.items.length === 0) {
    return {
      type: 'text',
      content: `🔍 Không tìm thấy sản phẩm nào cho: **"${keyword}"**`,
    };
  }

  return {
    type: 'search_results',
    keyword: result.keyword,
    totalCount: result.totalCount,
    items: result.items,
  };
}

async function handleLink(url, subIds) {
  const parsed = api.parseShopeeLink(url);

  if (!parsed) {
    return { type: 'text', content: '⚠️ URL không hợp lệ. Hỗ trợ:\n• `https://shopee.vn/product/shopId/itemId`\n• `https://s.shopee.vn/xxx`\n• `https://shopee.vn/ten-sp-i.shopId.itemId`\n• Bất kỳ link shopee.vn nào' };
  }

  const result = await api.convertLink(url, subIds);
  if (!result.success) {
    return { type: 'text', content: `❌ Lỗi convert: ${result.error}` };
  }
  return { type: 'link_result', ...result, parsed };
}

function getWelcome() {
  return { type: 'text', content: WELCOME_TEXT };
}

module.exports = { handleCommand, getWelcome };
