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

// ─── Check Commission + Convert (All-API Pipeline) ──────
// Step 1: Resolve short link (if needed) — in service worker (no CORS)
// Step 2: Parse product name + itemId from URL
// Step 3: Search in commission products (MAIN world API)
// Step 4: If found → generate affiliate link with SubIDs (MAIN world API)
async function executeCheckAndConvert(tabId, payload, reqId) {
  try {
    let url = payload.url;
    const subIds = payload.subIds || { sub1: 'sub1', sub2: 'sub2', sub3: 'sub3' };

    // Step 1: Resolve short links via HTTP redirect (s.shopee.vn does 302)
    if (url.includes('s.shopee.vn/')) {
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

        // Inject script to fetch item API (same-origin on shopee.vn)
        const nameResults = await chrome.scripting.executeScript({
          target: { tabId: tempTabId },
          world: 'MAIN',
          func: async (itemId, shopId) => {
            try {
              console.log('[SHOPEE-TAB] Fetching item API:', itemId, shopId);
              const resp = await fetch(`/api/v4/item/get?itemid=${itemId}&shopid=${shopId}`, {
                method: 'GET',
                headers: { 'accept': 'application/json' },
                credentials: 'include',
              });
              const data = await resp.json();
              console.log('[SHOPEE-TAB] API response code:', data?.error, 'name:', data?.data?.name?.slice(0, 40));
              return { name: data?.data?.name || null, error: data?.error_msg };
            } catch (e) {
              console.error('[SHOPEE-TAB] Fetch failed:', e.message);
              return { name: null, error: e.message };
            }
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
          console.log('[BG] ✅ Got product name:', nameResult.name.slice(0, 60));
        } else {
          console.warn('[BG] ❌ item API returned no name:', JSON.stringify(nameResult));
        }
      } catch (err) {
        console.warn('[BG] ❌ Tab injection failed:', err.message);
        // Clean up temp tab on error
        if (tempTabId) chrome.tabs.remove(tempTabId).catch(() => {});
      }
    }

    if (!productInfo.searchKeyword && !productInfo.itemId) {
      sendResult(reqId, { success: false, error: 'Không thể phân tích link Shopee.' });
      return;
    }

    // Step 3 + 4: Search commission + generate link (combined in one MAIN world call)
    const results = await chrome.scripting.executeScript({
      target: { tabId },
      world: 'MAIN',
      func: async (searchKeyword, targetItemId, targetShopId, originalUrl, subId1, subId2, subId3) => {
        try {
          const csrfMatch = document.cookie.match(/csrftoken=([^;]+)/);
          const csrfToken = csrfMatch ? csrfMatch[1] : '';

          // Helper: generate affiliate link
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
                  advancedLinkParams: {
                    subId1: subId1,
                    subId2: subId2,
                    subId3: subId3,
                    subId4: '',
                    subId5: '',
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
            return data.data?.batchCustomLink?.[0];
          };

          // Helper: parse commission rate
          const parseRate = (v) => {
            if (!v) return 0;
            if (typeof v === 'number') return v;
            return parseFloat(v) || 0;
          };

          // Helper: search commission products
          const searchProducts = async (keyword) => {
            const searchUrl = `/api/v3/offer/product/list?list_type=0&keyword=${encodeURIComponent(keyword)}&sort_type=1&page_offset=0&page_limit=20&client_type=1`;
            const resp = await fetch(searchUrl, {
              method: 'GET',
              headers: {
                'accept': 'application/json, text/plain, */*',
                'affiliate-program-type': '1',
              },
              credentials: 'include',
            });
            return resp.json();
          };

          // ─── PATH A: We have product name → search → match → gen link ───
          if (searchKeyword) {
            console.log('[MAIN] Path A: searching by keyword:', searchKeyword.slice(0, 50));
            const searchData = await searchProducts(searchKeyword);
            if (searchData.code !== 0) {
              return { success: false, error: searchData.msg || `Search API error: ${searchData.code}` };
            }

            const list = searchData.data?.list || [];
            if (list.length === 0) {
              return { success: false, noCommission: true };
            }

            let matched = null;
            if (targetItemId) {
              matched = list.find(item => String(item.item_id) === String(targetItemId));
            }
            if (!matched) {
              if (targetItemId) return { success: false, noCommission: true };
              matched = list[0];
            }

            const card = matched.batch_item_for_item_card_full || {};
            const rawPrice = card.price ? parseInt(card.price) / 100000 : 0;

            console.log('[CHECK] Commission fields:', JSON.stringify({
              seller: matched.seller_commission_rate,
              default: matched.default_commission_rate,
              max: matched.max_commission_rate,
              item_id: matched.item_id,
              name: card.name?.slice(0, 40),
            }));

            const commission = Math.max(
              parseRate(matched.max_commission_rate),
              parseRate(matched.seller_commission_rate),
              parseRate(matched.default_commission_rate)
            );
            const productName = card.name || 'Sản phẩm';
            const productLink = matched.product_link || originalUrl;

            const linkResult = await genLink(productLink);
            return {
              success: true,
              hasCommission: true,
              productName,
              commission,
              price: new Intl.NumberFormat('vi-VN').format(rawPrice) + '₫',
              shortLink: linkResult?.shortLink || linkResult?.longLink || null,
            };
          }

          // ─── PATH B: No product name → try link gen directly ───
          // batchCustomLink works with product URL even without name
          // If it succeeds → product is in affiliate program
          if (targetItemId) {
            const productUrl = targetShopId
              ? `https://shopee.vn/product/${targetShopId}/${targetItemId}`
              : originalUrl;
            console.log('[MAIN] Path B: no keyword, trying direct link gen with:', productUrl);

            const linkResult = await genLink(productUrl);

            if (!linkResult || (linkResult.failCode && linkResult.failCode !== 0)) {
              console.log('[MAIN] Direct link gen failed → no commission. failCode:', linkResult?.failCode);
              return { success: false, noCommission: true };
            }

            console.log('[MAIN] Direct link gen succeeded! shortLink:', linkResult.shortLink);

            // Link gen succeeded → product has commission
            // Now try to get commission rate from search API using the generated link
            // The shortLink redirects back to a named product URL
            let commission = 0;
            let productName = 'Sản phẩm';
            let price = '';

            // Try searching by item_id in affiliate search  
            try {
              const searchData = await searchProducts(targetItemId);
              const list = searchData.data?.list || [];
              const matched = list.find(item => String(item.item_id) === String(targetItemId));
              if (matched) {
                const card = matched.batch_item_for_item_card_full || {};
                commission = Math.max(
                  parseRate(matched.max_commission_rate),
                  parseRate(matched.seller_commission_rate),
                  parseRate(matched.default_commission_rate)
                );
                productName = card.name || productName;
                const rawPrice = card.price ? parseInt(card.price) / 100000 : 0;
                price = rawPrice ? new Intl.NumberFormat('vi-VN').format(rawPrice) + '₫' : '';
                console.log('[MAIN] Got commission from search:', commission, '%', productName.slice(0, 40));
              }
            } catch (e) {
              console.warn('[MAIN] Commission lookup failed:', e.message);
            }

            return {
              success: true,
              hasCommission: true,
              productName,
              commission,
              price,
              shortLink: linkResult.shortLink || linkResult.longLink,
            };
          }

          return { success: false, noCommission: true, error: 'No product info available' };
        } catch (err) {
          return { success: false, error: err.message };
        }
      },
      args: [
        productInfo.searchKeyword || '',
        productInfo.itemId || '',
        productInfo.shopId || '',
        url,
        subIds.sub1 || 'sub1',
        subIds.sub2 || 'sub2',
        subIds.sub3 || 'sub3',
      ],
    });

    const result = results?.[0]?.result;
    if (result) {
      sendResult(reqId, result);
    } else {
      sendResult(reqId, { success: false, error: 'Script execution returned no result' });
    }
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
  const resolvedMatch = url.match(/shopee\.vn\/([a-zA-Z]+)\/(\d+)\/(\d+)/);
  if (resolvedMatch && resolvedMatch[1] !== 'product') {
    return { searchKeyword: null, shopId: resolvedMatch[2], itemId: resolvedMatch[3] };
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

connect();
