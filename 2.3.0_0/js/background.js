let socket = null;
let botActive = true;
const SERVER_URL = 'ws://localhost:3456';

// ─── MV3 Keep-Alive Strategy ────────────────────────────────
// Problem: Chrome MV3 terminates Service Workers after ~30s of inactivity.
// setInterval alone cannot prevent termination — Chrome ignores it.
//
// Solution:
// 1. chrome.alarms API — only reliable MV3 wake mechanism (fires every 25s)
// 2. On each alarm tick: check WS health → reconnect if dead
// 3. On SW restart (install/startup): restore botActive + reconnect
// ────────────────────────────────────────────────────────────

// Load saved state on every SW startup (SW restarts lose all variables)
chrome.storage.local.get(['botActive'], (data) => {
  botActive = data.botActive !== false; // default ON
  // Auto-connect on SW startup if bot is active
  if (botActive) {
    console.log('[BG] SW started/restarted — auto-connecting...');
    connect();
  }
});

// Register keep-alive alarm (survives SW termination)
chrome.alarms.get('keepAlive', (alarm) => {
  if (!alarm) {
    chrome.alarms.create('keepAlive', { periodInMinutes: 0.4 }); // every ~24s
    console.log('[BG] Keep-alive alarm created.');
  }
});

// ─── Offscreen Document — prevents SW from ever sleeping ─────
// An offscreen page pings the SW every 5s, making it appear active to Chrome.
// This is more reliable than alarms (which only fire every 24s minimum).
async function ensureOffscreen() {
  const existing = await chrome.offscreen.hasDocument();
  if (!existing) {
    await chrome.offscreen.createDocument({
      url: 'offscreen.html',
      reasons: ['BLOBS'],
      justification: 'Keep service worker alive for persistent WebSocket connection',
    }).catch((e) => console.warn('[BG] Offscreen create failed:', e.message));
  }
}
ensureOffscreen();

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name !== 'keepAlive') return;

  const isConnected = socket && socket.readyState === WebSocket.OPEN;
  const isDead = !socket || socket.readyState === WebSocket.CLOSED || socket.readyState === WebSocket.CLOSING;

  if (isConnected) {
    // WS alive → send ping to keep connection warm
    socket.send(JSON.stringify({ type: 'ping' }));
  } else if (isDead && botActive) {
    // WS dead + bot should be active → reconnect
    console.log('[BG] Alarm: WS dead, reconnecting...');
    socket = null;
    connect();
  }
});

// Listen for messages from popup + content scripts
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type === 'toggle_bot') {
    botActive = msg.active;
    chrome.storage.local.set({ botActive }); // persist through SW restarts
    console.log('[BG] Bot', botActive ? 'ACTIVATED' : 'DEACTIVATED');
    if (botActive && (!socket || socket.readyState !== WebSocket.OPEN)) connect();
    if (!botActive && socket) {
      socket.close();
      socket = null;
    }
  }
  if (msg.type === 'get_status') {
    sendResponse({ connected: !!(socket && socket.readyState === WebSocket.OPEN), botActive });
  }
  // offscreen_ping from offscreen.js — keeps SW alive, check WS health
  if (msg.type === 'offscreen_ping') {
    if (botActive && (!socket || socket.readyState === WebSocket.CLOSED || socket.readyState === WebSocket.CLOSING)) {
      console.log('[BG] Offscreen ping: WS dead, reconnecting...');
      socket = null;
      connect();
    } else if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({ type: 'ping' }));
    }
    sendResponse({ ok: true });
  }

  // ─── Content Script Widget Handlers ─────────────────────────
  // CREATE_AFFILIATE_LINK — from link widget on shopee.vn pages
  if (msg.type === 'CREATE_AFFILIATE_LINK') {
    (async () => {
      try {
        const originalLink = msg.originalLink;
        const subIds = msg.subIds || {};
        
        // Find any affiliate.shopee.vn tab to execute the API call
        const tabs = await chrome.tabs.query({ url: '*://affiliate.shopee.vn/*' });
        if (tabs.length === 0) {
          sendResponse({ success: false, error: 'UNAUTHORIZED' });
          return;
        }
        
        const tabId = tabs[0].id;
        const results = await chrome.scripting.executeScript({
          target: { tabId },
          world: 'MAIN',
          func: async (url, subs) => {
            try {
              const csrfMatch = document.cookie.match(/csrftoken=([^;]+)/);
              const csrfToken = csrfMatch ? csrfMatch[1] : '';
              const gqlBody = {
                operationName: 'batchGetCustomLink',
                query: `query batchGetCustomLink($linkParams: [CustomLinkParam!], $sourceCaller: SourceCaller){ batchCustomLink(linkParams: $linkParams, sourceCaller: $sourceCaller){ shortLink longLink failCode } }`,
                variables: {
                  linkParams: [{
                    originalLink: url,
                    advancedLinkParams: {
                      subId1: subs.subId1 || '',
                      subId2: subs.subId2 || '',
                      subId3: subs.subId3 || '',
                      subId4: subs.subId4 || '',
                      subId5: subs.subId5 || '',
                    },
                  }],
                  sourceCaller: 'CUSTOM_LINK_CALLER',
                },
              };
              const resp = await fetch('/api/v3/gql?q=batchCustomLink', {
                method: 'POST',
                headers: {
                  'accept': 'application/json, text/plain, */*',
                  'content-type': 'application/json; charset=UTF-8',
                  'affiliate-program-type': '1',
                  'csrf-token': csrfToken,
                },
                credentials: 'include',
                body: JSON.stringify(gqlBody),
              });
              const data = await resp.json();
              if (data.errors && data.errors.length > 0) {
                return { success: false, error: data.errors[0].message || 'GraphQL error' };
              }
              const result = data.data?.batchCustomLink?.[0];
              if (!result) return { success: false, error: 'No result from API' };
              if (result.failCode && result.failCode !== 0) return { success: false, error: `API fail code: ${result.failCode}` };
              return { success: true, shortLink: result.shortLink || '', longLink: result.longLink || '' };
            } catch (err) {
              return { success: false, error: err.message };
            }
          },
          args: [originalLink, subIds],
        });
        const result = results?.[0]?.result;
        sendResponse(result || { success: false, error: 'Script returned no result' });
      } catch (err) {
        console.error('[BG] CREATE_AFFILIATE_LINK error:', err);
        sendResponse({ success: false, error: err.message });
      }
    })();
    return true; // async sendResponse
  }

  // GET_PRODUCT_COMMISSION — commission badge on product pages
  if (msg.type === 'GET_PRODUCT_COMMISSION') {
    (async () => {
      try {
        const itemId = msg.itemId;
        // Try addlivetag API first (no affiliate tab needed)
        const addlivetag = await fetchAddlivetagCommission(itemId);
        if (addlivetag.found) {
          sendResponse({
            success: true,
            data: {
              status: 'success',
              productInfo: {
                commission: addlivetag.commissionAmount || 0,
                commissionRate: addlivetag.commission || 0,
                isXtra: addlivetag.isXtra || false,
                sellerComFinal: 0,
                shopeeComFinal: 0,
                hasSellerCommission: false,
                hasShopeeCommission: false,
                isCapped: false,
                cap: 0,
                lastUpdate: new Date().toISOString(),
              },
            },
          });
        } else {
          sendResponse({ success: false, error: 'No commission data found' });
        }
      } catch (err) {
        sendResponse({ success: false, error: err.message });
      }
    })();
    return true;
  }

  // CALCULATE_PRODUCT_STATS — widget icon badge
  if (msg.type === 'CALCULATE_PRODUCT_STATS') {
    // Return no stats for now — this requires order history from IndexedDB
    sendResponse({ success: true, stats: { totalOrders: 0 } });
  }

  // FETCH_PRICE_TRACKING — price history chart
  if (msg.type === 'FETCH_PRICE_TRACKING') {
    (async () => {
      try {
        const { itemId, days, currency, productData } = msg;
        const endpoint = `https://data-vultr.addlivetag.com/price-tracking/`;
        const params = new URLSearchParams({
          item_id: itemId,
          days: days || 90,
          currency: currency || 'VND',
        });
        // Also send product data if available (for price tracking service to store)
        const body = productData ? JSON.stringify(productData) : null;
        const resp = await fetch(`${endpoint}?${params}`, {
          method: body ? 'POST' : 'GET',
          headers: body ? { 'Content-Type': 'application/json' } : {},
          body,
        });
        const data = await resp.json();
        if (data && (data.prices || data.data)) {
          sendResponse({ success: true, data: data.data || data });
        } else {
          sendResponse({ success: false, error: 'No price data' });
        }
      } catch (err) {
        sendResponse({ success: false, error: err.message });
      }
    })();
    return true;
  }

  // OPEN_OPTIONS_PAGE
  if (msg.type === 'OPEN_OPTIONS_PAGE') {
    chrome.runtime.openOptionsPage();
    sendResponse({ ok: true });
  }

  return true;
});

// Handle SW install/update events
chrome.runtime.onInstalled.addListener(async () => {
  chrome.alarms.create('keepAlive', { periodInMinutes: 0.4 });
  await ensureOffscreen();
  console.log('[BG] Extension installed/updated — keep-alive alarm + offscreen set.');
});

let _reconnectTimer = null;
function connect() {
  // Prevent duplicate connection attempts
  if (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) {
    console.log('[BG] Already connected or connecting, skip.');
    return;
  }

  console.log('[BG] Connecting to Server:', SERVER_URL);
  if (_reconnectTimer) { clearTimeout(_reconnectTimer); _reconnectTimer = null; }

  try {
    socket = new WebSocket(SERVER_URL);
  } catch (e) {
    console.error('[BG] WebSocket creation failed', e);
    _reconnectTimer = setTimeout(connect, 5000);
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

  socket.onclose = (evt) => {
    console.log(`[BG] Connection closed (code=${evt.code}), reconnecting in 5s...`);
    socket = null;
    // Only auto-reconnect if bot is active
    if (botActive) {
      _reconnectTimer = setTimeout(connect, 5000);
    }
  };

  socket.onerror = (e) => {
    console.error('[BG] WebSocket error — connection will close and retry.');
    // onclose will fire after onerror, handling reconnect
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
    // Direct API — no page navigation needed, any affiliate.shopee.vn page works
    executeConvertInMainWorld(targetTab.id, payload, reqId);

  } else if (action === 'check_and_convert') {
    // New flow: resolve link → search commission → generate affiliate link
    executeCheckAndConvert(targetTab.id, payload, reqId);

  } else if (action === 'search_product') {
    // Search uses Main World scripting — inject directly
    const targetUrl = 'https://affiliate.shopee.vn/offer/product_offer';
    if (!targetTab.url.includes('/offer/product_offer')) {
      console.log('[BG] Routing tab to Product Search page...');
      await navigateAndWait(targetTab.id, targetUrl);
    }
    // Inject search script into MAIN world
    executeSearchInMainWorld(targetTab.id, payload.keyword, reqId);

  } else if (action === 'sync_orders') {
    // Orders sync: trigger export → poll → download CSV via Shopee API
    executeSyncOrders(targetTab.id, payload, reqId);

  } else if (action === 'fetch_product_images') {
    // Background fetch: get img_code from Shopee report API
    executeFetchProductImages(targetTab.id, payload, reqId);

  } else if (action === 'extract_full') {
    // Extract full product data via internal Shopee API
    executeExtractFull(targetTab.id, payload, reqId);

  } else {
    sendResult(reqId, { success: false, error: `Unknown action: ${action}` });
  }
}

// ─── Extract Full Product Data ─────────────────────────────────
async function executeExtractFull(tabId, payload, reqId) {
  try {
    let url = payload.url;

    // Step 1: Resolve short links via HTTP redirect
    if (url.includes('s.shopee.vn/') || url.includes('vn.shp.ee/')) {
      console.log('[BG] ExtractFull: Resolving short link:', url);
      try {
        const resp = await fetch(url, { method: 'GET', redirect: 'follow' });
        const finalUrl = resp.url;
        console.log('[BG] ExtractFull: Resolved to:', finalUrl);
        if (finalUrl.includes('shopee.vn')) {
          url = finalUrl;
        }
      } catch (err) {
        console.warn('[BG] ExtractFull: Short link resolve failed:', err.message);
      }
    }

    // Step 2: Parse product info from URL
    let productInfo = parseProductInfo(url);
    console.log('[BG] ExtractFull: Parsed product info:', JSON.stringify(productInfo));

    // If shopId is missing but itemId exists, try to resolve shopId via addlivetag
    if (productInfo.itemId && !productInfo.shopId) {
      console.log('[BG] ExtractFull: shopId missing, attempting lookup via addlivetag for itemId:', productInfo.itemId);
      try {
        const resp = await fetch(
          `https://data.addlivetag.com/product-data/product-data.php?item_id=${productInfo.itemId}`,
          { method: 'GET', signal: AbortSignal.timeout(8000) }
        );
        const data = await resp.json();
        if (data.status === 'success' && data.productInfo?.shopId) {
          productInfo.shopId = String(data.productInfo.shopId);
          console.log('[BG] ExtractFull: Resolved shopId from addlivetag:', productInfo.shopId);
        }
      } catch (e) {
        console.warn('[BG] ExtractFull: addlivetag shopId lookup failed:', e.message);
      }
    }

    if (!productInfo.itemId || !productInfo.shopId) {
      sendResult(reqId, { success: false, error: 'Không thể phân tích shopId và itemId từ link.' });
      return;
    }

    console.log('[BG] ExtractFull: fetching full data via shopee.vn tab...');
    let tempTabId = null;
    try {
      // Try to find an existing shopee.vn tab first
      const existingTabs = await chrome.tabs.query({ url: 'https://shopee.vn/*' });
      
      if (existingTabs.length > 0) {
        tempTabId = existingTabs[0].id;
        console.log('[BG] ExtractFull: Found existing shopee.vn tab:', tempTabId);
      } else {
        // Create a hidden tab
        const tempTab = await chrome.tabs.create({
          url: `https://shopee.vn/product/${productInfo.shopId}/${productInfo.itemId}`,
          active: false,
        });
        tempTabId = tempTab.id;
        console.log('[BG] ExtractFull: Created temp shopee.vn tab:', tempTabId);

        // Wait for tab to finish loading
        await new Promise((resolve) => {
          const timeout = setTimeout(() => {
            chrome.tabs.onUpdated.removeListener(listener);
            resolve();
          }, 5000);

          const listener = (tId, changeInfo) => {
            if (tId === tempTabId && changeInfo.status === 'complete') {
              chrome.tabs.onUpdated.removeListener(listener);
              clearTimeout(timeout);
              resolve();
            }
          };
          chrome.tabs.onUpdated.addListener(listener);
        });
      }

      // Inject script to fetch full item data
      const results = await chrome.scripting.executeScript({
        target: { tabId: tempTabId },
        world: 'MAIN',
        func: async (itemId, shopId) => {
          try {
            console.log('[SHOPEE-TAB] ExtractFull: Calling API for', itemId, shopId);
            const resp = await fetch(`/api/v4/item/get?itemid=${itemId}&shopid=${shopId}`, {
              method: 'GET',
              headers: { 'accept': 'application/json' },
              credentials: 'include',
            });
            const data = await resp.json();
            if (data?.data) {
              return { success: true, productData: data.data };
            }
            return { success: false, error: data?.error_msg || data?.error || 'Unknown API error' };
          } catch (e) {
            return { success: false, error: e.message };
          }
        },
        args: [productInfo.itemId, productInfo.shopId],
      });

      // Close temp tab only if we created it
      if (!existingTabs || existingTabs.length === 0) {
        chrome.tabs.remove(tempTabId).catch(() => {});
      }

      const result = results?.[0]?.result;
      if (result && result.success) {
        sendResult(reqId, { success: true, data: result.productData });
      } else {
        sendResult(reqId, { success: false, error: result?.error || 'Failed to extract data' });
      }

    } catch (err) {
      if (tempTabId) chrome.tabs.remove(tempTabId).catch(() => {});
      sendResult(reqId, { success: false, error: err.message });
    }

  } catch (err) {
    console.error('[BG] ExtractFull error:', err);
    sendResult(reqId, { success: false, error: err.message });
  }
}

// ─── Sync Orders — Shopee Export API Pipeline ─────────────
// Step 1: Trigger CSV export via /api/v1/report/download
// Step 2: Poll /api/v1/export/list until ready (status=3)
// Step 3: Download CSV via /api/v1/export/download?task_id=X
async function executeSyncOrders(tabId, payload, reqId) {
  try {
    // Increase timeout for this operation (up to 90s)
    const results = await chrome.scripting.executeScript({
      target: { tabId },
      world: 'MAIN',
      func: async (startTs, endTs) => {
        try {
          const headers = {
            'accept': 'application/json, text/plain, */*',
            'affiliate-program-type': '1',
          };

          // Step 1: Trigger export
          console.log('[SyncOrders] Step 1: Triggering export...');
          const exportUrl = `/api/v1/report/download?page_size=20&page_num=1&purchase_time_s=${startTs}&purchase_time_e=${endTs}`;
          const exportRes = await fetch(exportUrl, { headers, credentials: 'include' });
          const exportData = await exportRes.json();

          if (exportData.code !== 0) {
            return { success: false, error: `Export trigger failed: ${exportData.msg}` };
          }

          const taskId = exportData.data?.task_id;
          if (!taskId) {
            return { success: false, error: 'No task_id returned from export API' };
          }
          console.log('[SyncOrders] Step 1 done. task_id:', taskId);

          // Step 2: Poll until ready (max 60s, every 3s)
          console.log('[SyncOrders] Step 2: Waiting for export to complete...');
          let fileName = '';
          for (let i = 0; i < 20; i++) {
            await new Promise(r => setTimeout(r, 3000));

            const listRes = await fetch(
              `/api/v1/export/list?page_size=5&page_num=1`,
              { headers, credentials: 'include' }
            );
            const listData = await listRes.json();
            const task = listData.data?.list?.find(t => t.task_id === taskId);

            if (task) {
              console.log(`[SyncOrders] Poll ${i + 1}: status=${task.status} progress=${task.progress}%`);
              if (task.status === 3 && task.progress === 100) {
                fileName = task.file_name;
                break;
              }
            }

            if (i === 19) {
              return { success: false, error: 'Export timeout (60s). Try again later.' };
            }
          }

          // Step 3: Download CSV
          console.log('[SyncOrders] Step 3: Downloading CSV...', fileName);
          const csvRes = await fetch(
            `/api/v1/export/download?task_id=${taskId}`,
            { credentials: 'include' }
          );

          if (!csvRes.ok) {
            return { success: false, error: `Download failed: HTTP ${csvRes.status}` };
          }

          const csvText = await csvRes.text();
          console.log(`[SyncOrders] Done! CSV size: ${csvText.length} chars`);

          return {
            success: true,
            csv: csvText,
            fileName,
            taskId,
          };
        } catch (err) {
          return { success: false, error: `SyncOrders error: ${err.message}` };
        }
      },
      args: [
        payload.startTimestamp || Math.floor(Date.now() / 1000) - 30 * 24 * 3600, // default: last 30 days
        payload.endTimestamp || Math.floor(Date.now() / 1000),
      ],
    });

    const result = results?.[0]?.result;
    sendResult(reqId, result || { success: false, error: 'Script execution returned no result' });
  } catch (err) {
    console.error('[BG] SyncOrders error:', err);
    sendResult(reqId, { success: false, error: `SyncOrders error: ${err.message}` });
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

// ─── Direct API Convert Link (MAIN World) ────────────────
// Calls Shopee GraphQL endpoint directly inside the tab's context
// Same cookies/session as the real UI — no DOM manipulation needed
async function executeConvertInMainWorld(tabId, payload, reqId) {
  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId },
      world: 'MAIN',
      func: async (url, subId1, subId2) => {
        try {
          // Get CSRF token from cookie
          const csrfMatch = document.cookie.match(/csrftoken=([^;]+)/);
          const csrfToken = csrfMatch ? csrfMatch[1] : '';

          const gqlBody = {
            operationName: 'batchGetCustomLink',
            query: `
              query batchGetCustomLink($linkParams: [CustomLinkParam!], $sourceCaller: SourceCaller){
                batchCustomLink(linkParams: $linkParams, sourceCaller: $sourceCaller){
                  shortLink
                  longLink
                  failCode
                }
              }
            `,
            variables: {
              linkParams: [{
                originalLink: url,
                advancedLinkParams: {
                  subId1: subId1 || '',
                  subId2: subId2 || '',
                  subId3: '',
                  subId4: '',
                  subId5: '',
                },
              }],
              sourceCaller: 'CUSTOM_LINK_CALLER',
            },
          };

          const response = await fetch('/api/v3/gql?q=batchCustomLink', {
            method: 'POST',
            headers: {
              'accept': 'application/json, text/plain, */*',
              'content-type': 'application/json; charset=UTF-8',
              'affiliate-program-type': '1',
              'csrf-token': csrfToken,
            },
            credentials: 'include',
            body: JSON.stringify(gqlBody),
          });

          const data = await response.json();

          // Check for errors
          if (data.errors && data.errors.length > 0) {
            return { success: false, error: data.errors[0].message || 'GraphQL error' };
          }

          const result = data.data?.batchCustomLink?.[0];
          if (!result) {
            return { success: false, error: 'No result from API' };
          }

          if (result.failCode && result.failCode !== 0) {
            return { success: false, error: `API fail code: ${result.failCode}` };
          }

          return {
            success: true,
            originalLink: url,
            shortLink: result.shortLink || result.longLink,
          };
        } catch (err) {
          return { success: false, error: err.message };
        }
      },
      args: [payload.url, payload.subId1 || '', payload.subId2 || ''],
    });

    const result = results?.[0]?.result;
    if (result) {
      // If direct API failed, fallback to DOM content script
      if (!result.success) {
        console.warn('[BG] Direct API failed, falling back to content script:', result.error);
        const targetUrl = 'https://affiliate.shopee.vn/offer/custom_link';
        const currentTab = await chrome.tabs.get(tabId);
        
        // Auto-reload on cookie incorrect error
        if (result.error && typeof result.error === 'string' && result.error.includes('cookie incorrect')) {
          console.log('[BG] Detected cookie incorrect error, reloading tab...');
          await chrome.tabs.reload(tabId);
          // Wait briefly for reload to start
          await new Promise(resolve => setTimeout(resolve, 2000));
          sendResult(reqId, { success: false, error: 'cookie incorrect - reloading tab' });
          return;
        }

        if (!currentTab.url.includes('/offer/custom_link')) {
          await navigateAndWait(tabId, targetUrl);
        }
        forwardToContentScript(tabId, 'convert_link', payload, reqId);
        return;
      }
      sendResult(reqId, result);
    } else {
      sendResult(reqId, { success: false, error: 'Script execution returned no result' });
    }
  } catch (err) {
    console.error('[BG] Main World convert error:', err);
    // Fallback to content script
    console.warn('[BG] Falling back to content script...');
    const targetUrl = 'https://affiliate.shopee.vn/offer/custom_link';
    const currentTab = await chrome.tabs.get(tabId);
    if (!currentTab.url.includes('/offer/custom_link')) {
      await navigateAndWait(tabId, targetUrl);
    }
    forwardToContentScript(tabId, 'convert_link', payload, reqId);
  }
}

// ─── Addlivetag Commission Lookup (Service Worker level) ──────
// Calls third-party API to get commission data as fallback
// Runs in service worker → no CORS issues
async function fetchAddlivetagCommission(itemId) {
  try {
    const resp = await fetch(
      `https://data.addlivetag.com/product-data/product-data.php?item_id=${itemId}`,
      { method: 'GET' }
    );
    const data = await resp.json();
    if (data.status === 'success' && data.productInfo?.commission > 0) {
      const info = data.productInfo;
      const rate = info.price > 0
        ? Math.round((info.commission / info.price) * 10000) / 100
        : 0;
      return {
        found: true,
        commission: rate,
        commissionAmount: info.commission,
        productName: info.productName,
        price: info.price,
        shopName: info.shopName,
        isXtra: info.isXtra || false,
        source: 'addlivetag',
      };
    }
    return { found: false };
  } catch (err) {
    console.warn('[BG] Addlivetag fetch failed:', err.message);
    return { found: false };
  }
}

// ─── Check Commission + Convert (All-API Pipeline) ──────
// Step 1: Resolve short link (if needed) — in service worker (no CORS)
// Step 2: Parse product name + itemId from URL
// Step 2.5: Fire Addlivetag commission lookup in parallel (service worker)
// Step 3: Search in commission products (MAIN world API) — uses addlivetag as fallback
// Step 4: If found → generate affiliate link with SubIDs (MAIN world API)
async function executeCheckAndConvert(tabId, payload, reqId) {
  try {
    let url = payload.url;
    const subIds = payload.subIds || { sub1: 'sub1', sub2: 'sub2', sub3: 'sub3' };

    // Step 1: Resolve short links via HTTP redirect (s.shopee.vn or vn.shp.ee does 301/302)
    if (url.includes('s.shopee.vn/') || url.includes('vn.shp.ee/')) {
      console.log('[BG] Resolving short link:', url);
      try {
        const resp = await fetch(url, { method: 'GET', redirect: 'follow' });
        const finalUrl = resp.url;
        console.log('[BG] Resolved to:', finalUrl);
        if (finalUrl.includes('shopee.vn')) {
          url = finalUrl;
        }
      } catch (err) {
        console.warn('[BG] Short link resolve failed:', err.message);
      }
    }

    // Step 2: Parse product info from URL
    let productInfo = parseProductInfo(url);
    console.log('[BG] Parsed product info:', JSON.stringify(productInfo));

    // Step 2a: Use product hint from Zalo message preview (fastest, no API needed)
    if (!productInfo.searchKeyword && payload.productHint) {
      productInfo.searchKeyword = payload.productHint;
      console.log('[BG] Using product hint from Zalo:', payload.productHint.slice(0, 50));
    }

    // Step 2b: If no product name but have itemId+shopId, resolve via shopee.vn tab
    // We inject a script into a shopee.vn page context to call /api/v4/item/get
    // (same-origin request with cookies → bypasses anti-bot for logged-in users)
    if (!productInfo.searchKeyword && productInfo.itemId && productInfo.shopId) {
      console.log('[BG] Step 2b: resolving product name via shopee.vn tab...');
      let tempTabId = null;
      try {
        // Try to find an existing shopee.vn tab first (avoid creating new ones)
        const existingTabs = await chrome.tabs.query({ url: 'https://shopee.vn/*' });
        
        if (existingTabs.length > 0) {
          // Use existing shopee.vn tab — no need to create
          tempTabId = existingTabs[0].id;
          console.log('[BG] Found existing shopee.vn tab:', tempTabId);
        } else {
          // Create a hidden tab
          const tempTab = await chrome.tabs.create({
            url: `https://shopee.vn/product/${productInfo.shopId}/${productInfo.itemId}`,
            active: false,
          });
          tempTabId = tempTab.id;
          console.log('[BG] Created temp shopee.vn tab:', tempTabId);

          // Wait for tab to finish loading
          await new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
              chrome.tabs.onUpdated.removeListener(listener);
              resolve(); // resolve anyway, try injection
            }, 5000);

            const listener = (tabId, changeInfo) => {
              if (tabId === tempTabId && changeInfo.status === 'complete') {
                chrome.tabs.onUpdated.removeListener(listener);
                clearTimeout(timeout);
                resolve();
              }
            };
            chrome.tabs.onUpdated.addListener(listener);
          });
          console.log('[BG] Temp tab loaded, injecting script...');
        }

        // Inject script to fetch item API, fallback to page title
        const nameResults = await chrome.scripting.executeScript({
          target: { tabId: tempTabId },
          world: 'MAIN',
          func: async (itemId, shopId) => {
            // Attempt 1: API call (fastest if it works)
            try {
              console.log('[SHOPEE-TAB] Trying item API:', itemId, shopId);
              const resp = await fetch(`/api/v4/item/get?itemid=${itemId}&shopid=${shopId}`, {
                method: 'GET',
                headers: { 'accept': 'application/json' },
                credentials: 'include',
              });
              const data = await resp.json();
              if (data?.data?.name) {
                console.log('[SHOPEE-TAB] ✅ API got name:', data.data.name.slice(0, 40));
                return { name: data.data.name, source: 'api' };
              }
              console.warn('[SHOPEE-TAB] API no name, error:', data?.error, data?.error_msg);
            } catch (e) {
              console.warn('[SHOPEE-TAB] API fetch failed:', e.message);
            }

            // Attempt 2: Read page title (SPA sets it after render)
            // Wait a bit for SPA to render
            await new Promise(r => setTimeout(r, 1500));
            const title = document.title || '';
            // Shopee title format: "Product Name | Shopee Việt Nam" or just "Shopee Việt Nam"
            const cleaned = title.replace(/\s*[\|–-]\s*Shopee.*$/i, '').trim();
            if (cleaned && cleaned.length > 3 && !cleaned.toLowerCase().includes('shopee')) {
              console.log('[SHOPEE-TAB] ✅ Got name from title:', cleaned.slice(0, 40));
              return { name: cleaned, source: 'title' };
            }

            console.warn('[SHOPEE-TAB] ❌ All methods failed. Title was:', title.slice(0, 60));
            return { name: null, error: 'All methods failed' };
          },
          args: [productInfo.itemId, productInfo.shopId],
        });

        // Close temp tab only if we created it
        if (!existingTabs || existingTabs.length === 0) {
          chrome.tabs.remove(tempTabId).catch(() => {});
        }

        const nameResult = nameResults?.[0]?.result;
        if (nameResult?.name) {
          productInfo.searchKeyword = nameResult.name;
        }
      } catch (err) {
        if (tempTabId) chrome.tabs.remove(tempTabId).catch(() => {});
      }
    }

    if (!productInfo.searchKeyword && !productInfo.itemId) {
      sendResult(reqId, { success: false, error: 'Không thể phân tích link Shopee.' });
      return;
    }

    // Step 2.5: Fire Addlivetag commission lookup in parallel (service worker)
    const addlivetagPromise = productInfo.itemId
      ? fetchAddlivetagCommission(productInfo.itemId)
      : Promise.resolve({ found: false });

    // Step 3 + 4: Search commission + generate link (combined in one MAIN world call)
    const mainWorldPromise = chrome.scripting.executeScript({
      target: { tabId },
      world: 'MAIN',
      func: async (searchKeyword, targetItemId, targetShopId, originalUrl, subId1, subId2, subId3) => {
        try {
          const csrfMatch = document.cookie.match(/csrftoken=([^;]+)/);
          const csrfToken = csrfMatch ? csrfMatch[1] : '';

          const genLink = async (productLink) => {
            const gqlBody = {
              operationName: 'batchGetCustomLink',
              query: `
                query batchGetCustomLink($linkParams: [CustomLinkParam!], $sourceCaller: SourceCaller){
                  batchCustomLink(linkParams: $linkParams, sourceCaller: $sourceCaller){
                    shortLink
                    longLink
                    failCode
                  }
                }
              `,
              variables: {
                linkParams: [{
                  originalLink: productLink,
                  advancedLinkParams: { subId1: subId1, subId2: subId2, subId3: subId3, subId4: '', subId5: '' },
                }],
                sourceCaller: 'CUSTOM_LINK_CALLER',
              },
            };
            const resp = await fetch('/api/v3/gql?q=batchCustomLink', {
              method: 'POST',
              headers: {
                'accept': 'application/json, text/plain, */*',
                'content-type': 'application/json; charset=UTF-8',
                'affiliate-program-type': '1',
                'csrf-token': csrfToken,
              },
              credentials: 'include',
              body: JSON.stringify(gqlBody),
            });
            const data = await resp.json();
            return data.data?.batchCustomLink?.[0];
          };

          const parseRate = (v) => { if (!v) return 0; if (typeof v === 'number') return v; return parseFloat(v) || 0; };
          const searchProducts = async (keyword) => {
            const searchUrl = `/api/v3/offer/product/list?list_type=0&keyword=${encodeURIComponent(keyword)}&sort_type=1&page_offset=0&page_limit=20&client_type=1`;
            const resp = await fetch(searchUrl, {
              method: 'GET',
              headers: { 'accept': 'application/json, text/plain, */*', 'affiliate-program-type': '1' },
              credentials: 'include',
            });
            return resp.json();
          };

          if (searchKeyword) {
            const searchData = await searchProducts(searchKeyword);
            if (searchData.code !== 0) return { success: false, error: searchData.msg || `Search API error: ${searchData.code}` };
            const list = searchData.data?.list || [];
            if (list.length === 0) return { success: false, noCommission: true, _needFallback: true };

            let matched = null;
            if (targetItemId) matched = list.find(item => String(item.item_id) === String(targetItemId));
            if (!matched) {
              if (targetItemId) return { success: false, noCommission: true, _needFallback: true };
              matched = list[0];
            }

            const card = matched.batch_item_for_item_card_full || {};
            const rawPrice = card.price ? parseInt(card.price) / 100000 : 0;
            const commission = Math.max(parseRate(matched.max_commission_rate), parseRate(matched.seller_commission_rate), parseRate(matched.default_commission_rate));
            const commissionAmount = Math.round((rawPrice * commission) / 100);

            if (commission <= 0) {
              const productName = card.name || 'Sản phẩm';
              const productLink = matched.product_link || originalUrl;
              const linkResult = await genLink(productLink);
              return { success: true, hasCommission: false, _needFallback: true, productName, commission: 0, commissionAmount: 0, price: new Intl.NumberFormat('vi-VN').format(rawPrice) + '₫', shortLink: linkResult?.shortLink || linkResult?.longLink || null, source: 'shopee_zero' };
            }

            const linkResult = await genLink(matched.product_link || originalUrl);
            return { success: true, hasCommission: true, productName: card.name || 'Sản phẩm', commission, commissionAmount, price: new Intl.NumberFormat('vi-VN').format(rawPrice) + '₫', shortLink: linkResult?.shortLink || linkResult?.longLink || null, source: 'shopee' };
          }

          if (targetItemId) {
            const productUrl = targetShopId ? `https://shopee.vn/product/${targetShopId}/${targetItemId}` : originalUrl;
            const linkResult = await genLink(productUrl);
            if (!linkResult || (linkResult.failCode && linkResult.failCode !== 0)) return { success: false, noCommission: true, _needFallback: true };

            let commission = 0;
            let commissionAmount = 0;
            let productName = 'Sản phẩm';
            let price = '';
            try {
              const searchData = await searchProducts(targetItemId);
              const matched = (searchData.data?.list || []).find(item => String(item.item_id) === String(targetItemId));
              if (matched) {
                const card = matched.batch_item_for_item_card_full || {};
                commission = Math.max(parseRate(matched.max_commission_rate), parseRate(matched.seller_commission_rate), parseRate(matched.default_commission_rate));
                productName = card.name || productName;
                const rawPrice = card.price ? parseInt(card.price) / 100000 : 0;
                price = rawPrice ? new Intl.NumberFormat('vi-VN').format(rawPrice) + '₫' : '';
                commissionAmount = Math.round((rawPrice * commission) / 100);
              }
            } catch (e) {}

            return { success: true, hasCommission: commission > 0, _needFallback: commission <= 0, productName, commission, commissionAmount, price, shortLink: linkResult.shortLink || linkResult.longLink, source: commission > 0 ? 'shopee' : 'shopee_zero' };
          }
          return { success: false, noCommission: true, error: 'No product info available' };
        } catch (err) { return { success: false, error: err.message }; }
      },
      args: [productInfo.searchKeyword || '', productInfo.itemId || '', productInfo.shopId || '', url, subIds.sub1 || 'sub1', subIds.sub2 || 'sub2', subIds.sub3 || 'sub3'],
    });

    const [addlivetagData, mainResults] = await Promise.all([addlivetagPromise, mainWorldPromise]);
    let result = mainResults?.[0]?.result;

    if (!result) {
      sendResult(reqId, { success: false, error: 'Script execution returned no result' });
      return;
    }

    if (result._needFallback && addlivetagData.found) {
      if (!result.success || !result.shortLink) {
        const linkUrl = productInfo.shopId ? `https://shopee.vn/product/${productInfo.shopId}/${productInfo.itemId}` : url;
        try {
          const linkResults = await chrome.scripting.executeScript({
            target: { tabId },
            world: 'MAIN',
            func: async (productLink, s1, s2, s3) => {
              const csrfMatch = document.cookie.match(/csrftoken=([^;]+)/);
              const gqlBody = {
                operationName: 'batchGetCustomLink',
                query: `query batchGetCustomLink($linkParams: [CustomLinkParam!], $sourceCaller: SourceCaller){ batchCustomLink(linkParams: $linkParams, sourceCaller: $sourceCaller){ shortLink longLink failCode } }`,
                variables: { linkParams: [{ originalLink: productLink, advancedLinkParams: { subId1: s1, subId2: s2, subId3: s3, subId4: '', subId5: '' } }], sourceCaller: 'CUSTOM_LINK_CALLER' }
              };
              const resp = await fetch('/api/v3/gql?q=batchCustomLink', { method: 'POST', headers: { 'accept': 'application/json', 'content-type': 'application/json', 'affiliate-program-type': '1', 'csrf-token': csrfMatch ? csrfMatch[1] : '' }, credentials: 'include', body: JSON.stringify(gqlBody) });
              const data = await resp.json();
              const lr = data.data?.batchCustomLink?.[0];
              return (!lr || (lr.failCode && lr.failCode !== 0)) ? null : (lr.shortLink || lr.longLink);
            },
            args: [linkUrl, subIds.sub1 || 'sub1', subIds.sub2 || 'sub2', subIds.sub3 || 'sub3'],
          });
          const shortLink = linkResults?.[0]?.result;
          if (shortLink) {
            result = { success: true, hasCommission: true, productName: addlivetagData.productName || 'Sản phẩm', commission: addlivetagData.commission, commissionAmount: addlivetagData.commissionAmount, price: addlivetagData.price ? new Intl.NumberFormat('vi-VN').format(addlivetagData.price) + '₫' : '', shortLink, source: 'addlivetag' };
          } else {
            result = { success: false, noCommission: true };
          }
        } catch (err) { result = { success: false, noCommission: true }; }
      } else {
        result.hasCommission = true;
        result.commission = addlivetagData.commission;
        result.commissionAmount = addlivetagData.commissionAmount;
        result.productName = result.productName || addlivetagData.productName || 'Sản phẩm';
        if (!result.price && addlivetagData.price) result.price = new Intl.NumberFormat('vi-VN').format(addlivetagData.price) + '₫';
        result.source = 'addlivetag';
      }
    } else if (result._needFallback && !addlivetagData.found) {
      if (!result.success || !result.shortLink) result = { success: false, noCommission: true };
    } else if (result.success) {
      console.log('[BG] ✅ Commission source:', result.source || 'shopee', `${result.commission}%`);
    }

    delete result._needFallback;
    // Inject item/shop IDs for convert_logs matching
    if (productInfo.itemId) result.itemId = productInfo.itemId;
    if (productInfo.shopId) result.shopId = productInfo.shopId;
    sendResult(reqId, result);
  } catch (err) {
    console.error('[BG] check_and_convert error:', err);
    sendResult(reqId, { success: false, error: err.message });
  }
}

// Parse product info from any Shopee URL format
function parseProductInfo(url) {
  // Format 1: shopee.vn/{name}-i.{shopId}.{itemId}
  const namedMatch = url.match(/shopee\.vn\/(.+)-i\.(\d+)\.(\d+)/);
  if (namedMatch) {
    const slug = namedMatch[1];
    const name = decodeURIComponent(slug).replace(/[-_.]+/g, ' ').trim();
    return { searchKeyword: name, shopId: namedMatch[2], itemId: namedMatch[3] };
  }

  // Format 2: shopee.vn/product/{shopId}/{itemId}
  const productMatch = url.match(/shopee\.vn\/product\/(\d+)\/(\d+)/);
  if (productMatch) {
    return { searchKeyword: null, shopId: productMatch[1], itemId: productMatch[2] };
  }

  // Format 3: shopee.vn/universal-link/product/{shopId}/{itemId}
  const universalMatch = url.match(/universal-link\/product\/(\d+)\/(\d+)/);
  if (universalMatch) {
    return { searchKeyword: null, shopId: universalMatch[1], itemId: universalMatch[2] };
  }

  // Format 4: affiliate.shopee.vn/offer/product_offer/{itemId}
  const affiliateMatch = url.match(/affiliate\.shopee\.vn\/offer\/product_offer\/(\d+)/);
  if (affiliateMatch) {
    return { searchKeyword: null, shopId: null, itemId: affiliateMatch[1] };
  }

  // Format 5: shopee.vn/{word}/{shopId}/{itemId} (resolved short links → e.g. /opaanlp/123/456)
  const resolvedMatch = url.match(/shopee\.vn\/([a-zA-Z0-9]+)\/(\d+)\/(\d+)/);
  if (resolvedMatch && resolvedMatch[1] !== 'product') {
    return { searchKeyword: null, shopId: resolvedMatch[2], itemId: resolvedMatch[3] };
  }

  // Format 6: shopee.vn/{shop_slug}/{itemId} (shop-branded URL, e.g. /ecoshop6868/24189784914)
  // Slug contains letters AND digits, itemId must be 8+ digits
  const shopSlugMatch = url.match(/shopee\.vn\/([a-zA-Z0-9][a-zA-Z0-9_-]*)\/(\d{8,})/);
  if (shopSlugMatch && shopSlugMatch[1] !== 'product' && shopSlugMatch[1] !== 'universal-link') {
    return { searchKeyword: null, shopId: null, itemId: shopSlugMatch[2] };
  }

  // Fallback: try to extract any product-like slug from shopee.vn
  const fallbackSlug = url.match(/shopee\.vn\/([^/?#]+)/);
  if (fallbackSlug && !fallbackSlug[1].startsWith('product')) {
    const name = decodeURIComponent(fallbackSlug[1]).replace(/[-_.]+/g, ' ').trim();
    if (name.length > 3) {
      return { searchKeyword: name, shopId: null, itemId: null };
    }
  }

  return { searchKeyword: null, shopId: null, itemId: null };
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

// ─── Fetch Product Images from Conversion Report API ────
// Calls /api/v3/report/list to extract img_code for each item.
// Processes one page at a time with delay to avoid rate limiting.
async function executeFetchProductImages(tabId, payload, reqId) {
  try {
    const { startTimestamp, endTimestamp, knownItemIds } = payload;
    const knownSet = new Set(knownItemIds || []);

    const results = await chrome.scripting.executeScript({
      target: { tabId },
      world: 'MAIN',
      func: async (startTs, endTs, alreadyCachedIds) => {
        const cached = new Set(alreadyCachedIds);
        const imageMap = []; // [{item_id, shop_id, img_code}]
        let pageNum = 1;
        const pageSize = 50;
        let totalFetched = 0;
        let hasMore = true;

        while (hasMore) {
          try {
            const url = `/api/v3/report/list?page_size=${pageSize}&page_num=${pageNum}&purchase_time_s=${startTs}&purchase_time_e=${endTs}&version=1`;
            const resp = await fetch(url, {
              method: 'GET',
              headers: {
                'accept': 'application/json, text/plain, */*',
                'affiliate-program-type': '1',
              },
              credentials: 'include',
            });

            if (!resp.ok) {
              return { success: false, error: `API returned ${resp.status}` };
            }

            const data = await resp.json();
            if (data.code !== 0) {
              return { success: false, error: data.msg || `API error code: ${data.code}` };
            }

            const list = data.data?.list || [];
            const total = data.data?.total_count || 0;

            for (const conv of list) {
              for (const order of (conv.orders || [])) {
                for (const item of (order.items || [])) {
                  const itemId = String(item.item_id);
                  if (item.img_code && !cached.has(itemId)) {
                    imageMap.push({
                      item_id: itemId,
                      shop_id: String(item.shop_id || ''),
                      img_code: item.img_code,
                    });
                    cached.add(itemId);
                  }
                }
              }
            }

            totalFetched += list.length;
            hasMore = totalFetched < total && list.length === pageSize;
            pageNum++;

            // Throttle: wait 1.5s between pages to be safe
            if (hasMore) {
              await new Promise(r => setTimeout(r, 1500));
            }
          } catch (err) {
            return { success: false, error: `Page ${pageNum} failed: ${err.message}` };
          }
        }

        return { success: true, images: imageMap, totalPages: pageNum - 1, totalFetched };
      },
      args: [startTimestamp, endTimestamp, Array.from(knownSet)],
    });

    const result = results?.[0]?.result;
    if (result) {
      sendResult(reqId, result);
    } else {
      sendResult(reqId, { success: false, error: 'Script execution returned no result' });
    }
  } catch (err) {
    console.error('[BG] fetch_product_images error:', err);
    sendResult(reqId, { success: false, error: err.message });
  }
}

// SW auto-connects inside storage.local.get() callback above (on every restart)
