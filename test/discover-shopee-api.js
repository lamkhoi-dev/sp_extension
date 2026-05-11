/**
 * Test Script: Discover Shopee Conversion Report API
 * 
 * HOW TO USE:
 * 1. Mở Chrome DevTools trên tab affiliate.shopee.vn/report/conversion_report
 * 2. Vào tab Console
 * 3. Paste toàn bộ code này vào Console và Enter
 * 4. Bấm nút "Xuất dữ liệu" trên trang Shopee
 * 5. Xem kết quả trong Console — sẽ in ra API URL + request body
 * 
 * ALTERNATIVE: Inject via Extension
 * Thêm action 'discover_api' vào background.js, rồi gọi từ server
 */

// ══════════════════════════════════════════
// INTERCEPT ALL NETWORK REQUESTS
// ══════════════════════════════════════════

const captured = [];

// Intercept fetch()
const _origFetch = window.fetch;
window.fetch = async function(...args) {
  const url = typeof args[0] === 'string' ? args[0] : args[0]?.url || '';
  const opts = args[1] || {};
  
  // Filter out noise (analytics, tracking, etc.)
  const isRelevant = url.includes('api') || url.includes('gql') || url.includes('report') || url.includes('export') || url.includes('conversion');
  
  if (isRelevant) {
    const entry = {
      type: 'FETCH',
      url: url,
      method: opts.method || 'GET',
      headers: opts.headers ? Object.fromEntries(
        opts.headers instanceof Headers ? opts.headers.entries() : Object.entries(opts.headers)
      ) : {},
      body: opts.body ? (typeof opts.body === 'string' ? opts.body : '[FormData/Blob]') : null,
      timestamp: new Date().toISOString(),
    };
    captured.push(entry);
    console.log('🔵 [FETCH]', entry.method, url);
    if (entry.body) {
      try {
        console.log('   Body:', JSON.parse(entry.body));
      } catch {
        console.log('   Body:', entry.body);
      }
    }
  }
  
  const response = await _origFetch.apply(this, args);
  
  if (isRelevant) {
    // Clone to read body without consuming
    const clone = response.clone();
    try {
      const text = await clone.text();
      const lastEntry = captured[captured.length - 1];
      if (lastEntry && lastEntry.url === url) {
        lastEntry.responseStatus = response.status;
        lastEntry.responsePreview = text.slice(0, 500);
        console.log('🟢 [RESPONSE]', response.status, url);
        try {
          console.log('   Data:', JSON.parse(text.slice(0, 1000)));
        } catch {
          console.log('   Data (raw):', text.slice(0, 200));
        }
      }
    } catch {}
  }
  
  return response;
};

// Intercept XMLHttpRequest
const _origXHROpen = XMLHttpRequest.prototype.open;
const _origXHRSend = XMLHttpRequest.prototype.send;

XMLHttpRequest.prototype.open = function(method, url, ...args) {
  this._capturedUrl = url;
  this._capturedMethod = method;
  return _origXHROpen.call(this, method, url, ...args);
};

XMLHttpRequest.prototype.send = function(body) {
  const url = this._capturedUrl || '';
  const isRelevant = url.includes('api') || url.includes('gql') || url.includes('report') || url.includes('export') || url.includes('conversion');
  
  if (isRelevant) {
    const entry = {
      type: 'XHR',
      url: url,
      method: this._capturedMethod,
      body: body,
      timestamp: new Date().toISOString(),
    };
    captured.push(entry);
    console.log('🟡 [XHR]', entry.method, url);
    if (body) {
      try {
        console.log('   Body:', JSON.parse(body));
      } catch {
        console.log('   Body:', body);
      }
    }
  }
  
  return _origXHRSend.call(this, body);
};

console.log(`
══════════════════════════════════════════
 ✅ API Interceptor đã cài đặt!
 
 📋 Bây giờ hãy:
    1. Bấm "Xuất dữ liệu" (Export) trên trang
    2. Hoặc thao tác bất kỳ trên bảng
    3. Xem Console để thấy API calls
    
 📊 Xem tất cả captured requests:
    → Gõ: captured
    
 🔍 Xem chi tiết request cuối:
    → Gõ: captured[captured.length - 1]
══════════════════════════════════════════
`);
