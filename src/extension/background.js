let socket = null;
let botActive = true;
const SERVER_URL = 'ws://localhost:3456';

// Load saved state
chrome.storage.local.get('botActive', (data) => {
  botActive = data.botActive !== false; // default ON
});

// Listen for toggle from popup
chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === 'toggle_bot') {
    botActive = msg.active;
    console.log('[BG] Bot', botActive ? 'ACTIVATED' : 'DEACTIVATED');
    if (botActive && !socket) connect();
    if (!botActive && socket) {
      socket.close();
      socket = null;
    }
  }
});

// Keep-alive: MV3 Service Worker sleeps after ~30s of inactivity
setInterval(() => {
  if (socket && socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify({ type: 'ping' }));
  }
}, 20000);

function connect() {
  console.log('[BG] Connecting to Server:', SERVER_URL);

  try {
    socket = new WebSocket(SERVER_URL);
  } catch (e) {
    console.error('[BG] WebSocket creation failed', e);
    setTimeout(connect, 5000);
    return;
  }

  socket.onopen = () => {
    console.log('[BG] ✅ Connected to Node Server!');
    socket.send(JSON.stringify({ type: 'register_extension', status: 'ready' }));
  };

  socket.onmessage = async (event) => {
    try {
      const msg = JSON.parse(event.data);

      if (msg.type === 'pong') return;

      if (msg.type === 'execute_automation') {
        if (!botActive) {
          sendResult(msg.data.reqId, { success: false, error: 'Bot đang TẮT. Bật lại trong popup Extension.' });
          return;
        }
        const { action, payload, reqId } = msg.data;
        await handleAutomation(action, payload, reqId);
      }
    } catch (e) {
      console.error('[BG] Error handling message:', e);
    }
  };

  socket.onclose = () => {
    console.log('[BG] Connection lost, reconnecting in 5s...');
    setTimeout(connect, 5000);
  };

  socket.onerror = (e) => {
    console.error('[BG] WebSocket Error', e);
  };
}

async function handleAutomation(action, payload, reqId) {
  // Find any Shopee Affiliate tab
  const tabs = await chrome.tabs.query({ url: '*://affiliate.shopee.vn/*' });

  if (tabs.length === 0) {
    return sendResult(reqId, { success: false, error: 'Không tìm thấy tab Shopee Affiliate! Hãy mở https://affiliate.shopee.vn' });
  }

  const targetTab = tabs[0];

  // TAB ROUTING: Navigate to the correct page based on action
  if (action === 'convert_link') {
    const targetUrl = 'https://affiliate.shopee.vn/offer/custom_link';
    if (!targetTab.url.includes('/offer/custom_link')) {
      console.log('[BG] Routing tab to Custom Link page...');
      await navigateAndWait(targetTab.id, targetUrl);
    }
    // Forward to content script
    forwardToContentScript(targetTab.id, action, payload, reqId);

  } else if (action === 'search_product') {
    // Search uses Main World scripting — inject directly
    const targetUrl = 'https://affiliate.shopee.vn/offer/product_offer';
    if (!targetTab.url.includes('/offer/product_offer')) {
      console.log('[BG] Routing tab to Product Search page...');
      await navigateAndWait(targetTab.id, targetUrl);
    }
    // Inject search script into MAIN world
    executeSearchInMainWorld(targetTab.id, payload.keyword, reqId);

  } else {
    sendResult(reqId, { success: false, error: `Unknown action: ${action}` });
  }
}

function forwardToContentScript(tabId, action, payload, reqId) {
  chrome.tabs.sendMessage(tabId, { action, payload }, (response) => {
    if (chrome.runtime.lastError) {
      console.error('[BG] Content script error:', chrome.runtime.lastError.message);
      sendResult(reqId, { success: false, error: 'Content script không phản hồi. Hãy refresh tab Shopee.' });
      return;
    }
    if (!response) {
      sendResult(reqId, { success: false, error: 'Không nhận được phản hồi từ Content Script.' });
      return;
    }
    sendResult(reqId, response);
  });
}

async function executeSearchInMainWorld(tabId, keyword, reqId) {
  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId },
      world: 'MAIN',
      func: async (kw) => {
        try {
          const url = `/api/v3/offer/product/list?list_type=0&keyword=${encodeURIComponent(kw)}&sort_type=1&page_offset=0&page_limit=20&client_type=1`;
          const response = await fetch(url, {
            method: 'GET',
            headers: {
              'accept': 'application/json, text/plain, */*',
              'affiliate-program-type': '1',
            },
            credentials: 'include',
          });
          const data = await response.json();

          if (data.code !== 0) {
            return { success: false, error: data.msg || `API error code: ${data.code}` };
          }

          const items = (data.data?.list || []).map(item => {
            const card = item.batch_item_for_item_card_full || {};
            const rawPrice = card.price ? parseInt(card.price) / 100000 : 0;
            const rawPriceBefore = card.price_before_discount ? parseInt(card.price_before_discount) / 100000 : 0;

            return {
              itemId: item.item_id,
              name: card.name || 'Unknown',
              productLink: item.product_link,
              affiliateLink: item.long_link,
              sellerCommission: item.seller_commission_rate,
              defaultCommission: item.default_commission_rate,
              maxCommission: item.max_commission_rate,
              price: new Intl.NumberFormat('vi-VN').format(rawPrice) + '₫',
              priceBeforeDiscount: rawPriceBefore > 0 ? new Intl.NumberFormat('vi-VN').format(rawPriceBefore) + '₫' : null,
              discount: card.discount || '',
              imageUrl: card.image ? `https://down-vn.img.susercontent.com/file/${card.image}` : null,
              shopName: card.shop_name || '',
              shopRating: card.shop_rating || 0,
              sold: card.historical_sold_text || '0',
              rating: card.item_rating?.rating_star || 0,
            };
          });

          return {
            success: true,
            items,
            totalCount: data.data?.total_count || 0,
          };
        } catch (err) {
          return { success: false, error: err.message };
        }
      },
      args: [keyword],
    });

    const result = results?.[0]?.result;
    if (result) {
      sendResult(reqId, result);
    } else {
      sendResult(reqId, { success: false, error: 'Script execution returned no result' });
    }
  } catch (err) {
    console.error('[BG] Main World script error:', err);
    sendResult(reqId, { success: false, error: err.message });
  }
}

function navigateAndWait(tabId, url) {
  return new Promise((resolve) => {
    chrome.tabs.update(tabId, { url }, () => {
      // Wait for tab to finish loading
      function listener(updatedTabId, changeInfo) {
        if (updatedTabId === tabId && changeInfo.status === 'complete') {
          chrome.tabs.onUpdated.removeListener(listener);
          // Short delay for React to hydrate
          setTimeout(resolve, 500);
        }
      }
      chrome.tabs.onUpdated.addListener(listener);
      // Safety timeout
      setTimeout(() => {
        chrome.tabs.onUpdated.removeListener(listener);
        resolve();
      }, 10000);
    });
  });
}

function sendResult(reqId, data) {
  if (socket && socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify({
      type: 'automation_result',
      data: { reqId, ...data },
    }));
  }
}

connect();
