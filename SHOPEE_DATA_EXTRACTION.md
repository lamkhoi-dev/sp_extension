# Shopee Data Extraction — Kho tri thức kỹ thuật

> Tài liệu này mô tả **cách hệ thống lấy dữ liệu từ Shopee**: link affiliate, hoa hồng,
> thông tin & ảnh sản phẩm, và đơn hàng. Đây là phần "bí kíp" quý giá nhất của dự án —
> viết ra để các AI/developer khác đọc, hiểu, và tái sử dụng.
>
> **Phạm vi:** CHỈ nói về cơ chế lấy data. KHÔNG bàn logic tính tiền/hoa hồng cho user
> (xem `BUSINESS_LOGIC.md`).
>
> Cập nhật lần cuối: 2026-07 · Nguồn: đọc trực tiếp từ code trong repo.

---

## 0. TL;DR — 4 nguồn data & 4 kỹ thuật

Hệ thống lấy data Shopee bằng **4 kỹ thuật độc lập**, xếp theo thứ tự "rẻ → đắt":

| # | Kỹ thuật | Dùng cho | Cần gì | File |
|---|----------|----------|--------|------|
| 1 | **Headless `an_redir`** | Tạo link affiliate | Chỉ cần `affiliate_id` | `src/shopee-direct-link.js` |
| 2 | **API bên thứ 3 `addlivetag`** | Hoa hồng + tên + giá + shopId | Không cần login | `src/shopee-direct-link.js`, `background.js` |
| 3 | **Shopee GraphQL/REST qua Extension** | Link chuẩn, search, hoa hồng chính xác, đơn hàng, ảnh | **Chrome đăng nhập affiliate.shopee.vn** | `src/extension/background.js` |
| 4 | **DOM automation qua Extension** | Fallback khi API đổi | Chrome + tab affiliate | `src/extension/content.js` |

**Nguyên tắc vàng:** luôn thử cách rẻ trước, cách đắt sau. Mỗi cách đều có fallback sang cách kế tiếp.

**Vì sao phải qua Extension?** Các API nội bộ của Shopee (`/api/v3/gql`, `/api/v1/report/...`,
`/api/v4/item/get`) yêu cầu **cookie đăng nhập + CSRF token** và chặn request từ ngoài
(CORS + anti-bot). Chạy code **bên trong tab trình duyệt đã đăng nhập** thì request là
"same-origin", đi kèm cookie thật → Shopee coi như thao tác của người dùng thật. Đây là
mấu chốt của cả kiến trúc.

---

## 1. Kiến trúc tổng thể

```
┌────────────┐   Zalo msg    ┌──────────────┐
│  Người dùng │ ────────────► │  Zalo Bot     │
│  (Zalo)     │ ◄──────────── │  (zca-js)     │
└────────────┘   trả link    └──────┬───────┘
                                     │ gọi ShopeeAPI
                                     ▼
                        ┌────────────────────────┐
                        │  Node Server (server.js)│
                        │  - shopee-api.js         │
                        │  - shopee-direct-link.js │
                        └───┬───────────────┬──────┘
             cách 1,2 (headless)         cách 3,4 (cần login)
                            │               │ WebSocket ws://localhost:3456
                            ▼               ▼
                 ┌──────────────┐   ┌─────────────────────────┐
                 │ addlivetag   │   │ Chrome Extension (MV3)   │
                 │ (bên thứ 3)  │   │ background.js (SW)       │
                 └──────────────┘   │  → inject vào tab Shopee │
                                    └────────────┬────────────┘
                                                 │ fetch same-origin + cookie
                                                 ▼
                                    ┌─────────────────────────┐
                                    │ affiliate.shopee.vn      │
                                    │ shopee.vn (API nội bộ)   │
                                    └─────────────────────────┘
```

**Giao tiếp Server ↔ Extension:** WebSocket. Server là WS *server* (port 3456), Extension
là WS *client*. Xem chi tiết phần 7.

---

## 2. Nhận diện & chuẩn hoá link Shopee (bước 0 của mọi luồng)

Trước khi lấy được data, phải parse được `shopId` + `itemId` từ đủ loại URL Shopee. User
gửi vào đủ kiểu link — code phải "moi" ra ID.

### 2.1. Các định dạng URL Shopee (đã gặp thực tế)

Nguồn: `ShopeeAPI.parseShopeeLink()` (`src/shopee-api.js:213`) và
`parseProductInfo()` (`src/extension/background.js:924`):

| Định dạng | Ví dụ | Lấy được |
|-----------|-------|----------|
| `/product/{shopId}/{itemId}` | `shopee.vn/product/812449960/21532544326` | shopId + itemId |
| `/{tên-sp}-i.{shopId}.{itemId}` | `shopee.vn/Áo-thun-i.812449960.21532544326` | shopId + itemId + **tên (từ slug)** |
| `/universal-link/product/{shopId}/{itemId}` | | shopId + itemId |
| `affiliate.shopee.vn/offer/product_offer/{itemId}` | | itemId (không shopId) |
| `/{path-mã-hoá}/{shopId}/{itemId}` | `shopee.vn/opaanlp/812449960/21532544326` | shopId + itemId |
| `/{shop-slug}/{itemId}` | `shopee.vn/ecoshop6868/24189784914` | itemId (slug ≠ shopId) |
| Short link | `s.shopee.vn/xxx`, `vn.shp.ee/xxx` | phải resolve trước (2.2) |
| `an_redir` | `s.shopee.vn/an_redir?origin_link=...` | đã là link affiliate — moi `origin_link` ra |

> ⚠️ **Lưu ý mấu chốt:** với định dạng "shop-slug" (ví dụ `/ecoshop6868/24189784914`),
> phần chữ **KHÔNG phải shopId** — nó là tên shop. Chỉ có `itemId` là đáng tin. Code phân
> biệt bằng: slug chứa chữ cái → là tên shop; toàn số → là shopId. `itemId` luôn ≥ 8 chữ số.

### 2.2. Resolve short link

`s.shopee.vn/...` và `vn.shp.ee/...` là link rút gọn → phải theo redirect để ra URL đầy đủ.
Dùng `fetch(url, { redirect: 'follow' })` rồi đọc `resp.url` (URL cuối sau redirect).

```js
// src/shopee-direct-link.js:82 resolveShortLink()
const resp = await fetch(url, { method:'GET', redirect:'follow', headers:{ 'User-Agent':'Mozilla/5.0 ...' }});
const finalUrl = resp.url;  // ← URL thật sau khi Shopee 301/302
```

> ⚠️ **BẪY:** link `an_redir` cũng nằm trên domain `s.shopee.vn` nhưng **KHÔNG được** đem
> đi resolve — nó đã là link affiliate hoàn chỉnh. Phải check `url.includes('an_redir')`
> và **bỏ qua** bước resolve (`shopee-direct-link.js:88`). Nếu resolve nhầm sẽ hỏng link.

### 2.3. Bóc `origin_link` từ link `an_redir`

Nếu user gửi lại một link affiliate `an_redir`, ta bóc `origin_link` (đã URL-encode) ra để
lấy lại link sản phẩm gốc rồi mới parse tiếp:

```js
const u = new URL(anRedirUrl);
const origin = decodeURIComponent(u.searchParams.get('origin_link'));
```

---

## 3. KỸ THUẬT 1 — Tạo link affiliate headless (`an_redir`)

**Đây là cách rẻ nhất, nhanh nhất, không cần login, không cần Extension.** Là chế độ mặc
định của hệ thống (`LINK_MODE=direct`).

### Cách hoạt động

Shopee hỗ trợ một endpoint redirect công khai: bất kỳ ai có `affiliate_id` đều có thể tự
"ráp" link affiliate mà không cần gọi API:

```
https://s.shopee.vn/an_redir?origin_link={URL_SP_ĐÃ_ENCODE}&affiliate_id={AFF_ID}&sub_id={SUBS}
```

Code: `ShopeeDirectLink.generateLink()` (`src/shopee-direct-link.js:112`).

**Các bước:**
1. **Làm sạch URL** — xoá hết tracking param (`utm_*`, `gclid`, `fbclid`, `af_*`, …) để link
   gọn và không mang tracking của người khác. Danh sách: `TRACKING_PARAMS` (`shopee-direct-link.js:4`).
2. **Ráp `sub_id`** — nối `sub1-sub2-sub3-sub4-sub5` bằng dấu `-`. Giá trị nào chứa sẵn dấu
   `-` sẽ bị **bỏ** (tránh lỗi phân tách). Xem `buildSubIdString()`.
3. **Encode** `origin_link` bằng `encodeURIComponent` rồi ghép chuỗi cuối.

### Ưu / nhược

- ✅ Không cần login, không cần Chrome mở. Chạy được ngay cả khi Extension offline.
- ✅ Cực nhanh (~vài ms, chỉ ghép chuỗi).
- ❌ **Không tự biết** hoa hồng/tên/giá — phải kết hợp KỸ THUẬT 2 (addlivetag) để làm giàu data.
- ❌ Link `an_redir` không đẹp bằng short link chính chủ `shortLink` do Shopee cấp (KỸ THUẬT 3).

---

## 4. KỸ THUẬT 2 — API bên thứ 3 `addlivetag` (hoa hồng không cần login)

`addlivetag.com` là dịch vụ ngoài, cung cấp data hoa hồng sản phẩm Shopee **miễn phí, không
cần login**. Hệ thống dùng nó làm nguồn hoa hồng chính cho chế độ headless và làm **fallback**
cho luồng Extension.

### Endpoint

```
GET https://data.addlivetag.com/product-data/product-data.php?item_id={ITEM_ID}
```

Không cần header đặc biệt (chỉ cần `User-Agent` bất kỳ). Code: `checkCommission()`
(`src/shopee-direct-link.js:138`) và `fetchAddlivetagCommission()` (`background.js:571`).

### Response (các field dùng đến)

```jsonc
{
  "status": "success",
  "productInfo": {
    "commission": 12345,          // SỐ TIỀN hoa hồng (đồng), đã trừ cap — KHÔNG phải %
    "price": 199000,              // giá hiện tại; = 0 khi hết hàng / hết flash sale
    "productName": "...",
    "shopName": "...",
    "shopId": 812449960,          // dùng để resolve shopId còn thiếu
    "productLink": "https://shopee.vn/product/{shopId}/{itemId}",  // link chuẩn!
    "latestPriceHistory": { "price": 195000 },   // giá gần nhất (fallback)
    "priceStats": { "avgPrice": 210000 },        // giá TB (fallback)
    "isXtra": false
  }
}
```

### ⚠️ Hai bẫy quan trọng khi xử lý addlivetag

1. **`commission` là SỐ TIỀN, không phải %.** Muốn ra tỉ lệ % phải tự chia:
   `rate = commission / price * 100`. Code làm tròn 2 số lẻ.

2. **`price` = 0 khi sản phẩm hết hàng / hết flash sale.** Nếu chia cho 0 sẽ ra tỉ lệ sai
   (Infinity/NaN). Phải fallback giá theo thứ tự:
   `price > 0 ? price : latestPriceHistory.price : round(priceStats.avgPrice) : 0`
   (`shopee-direct-link.js:160`). Đây là lỗi thực tế đã gặp và fix.

### Công dụng phụ: resolve `shopId` còn thiếu

Với link kiểu shop-slug chỉ có `itemId`, gọi addlivetag để lấy `productInfo.shopId` hoặc
`productInfo.productLink` (đã chứa link chuẩn). Xem `resolveShopeeUrl()` (`server.js:439`)
và `background.js:230`.

---

## 5. KỸ THUẬT 3 — Shopee API nội bộ qua Extension (chính xác nhất)

Khi cần data **chính xác từ chính Shopee** (link chính chủ, hoa hồng đúng, search, đơn hàng,
ảnh), phải gọi API nội bộ của Shopee. Các API này **chỉ chạy được bên trong tab đã đăng nhập**.

Cơ chế: Server gửi lệnh qua WebSocket → `background.js` (service worker) dùng
`chrome.scripting.executeScript({ world: 'MAIN' })` để **tiêm hàm fetch vào ngữ cảnh trang
Shopee**. Request đi kèm cookie thật + CSRF token → Shopee chấp nhận.

> **`world: 'MAIN'` là chìa khoá:** nó chạy code trong cùng ngữ cảnh JS của trang web (không
> phải "isolated world" của extension), nên `document.cookie`, session, CSRF đều là của
> người dùng thật. Đây là cách "mượn phiên đăng nhập" hợp lệ.

### 5.1. Tạo link affiliate chuẩn — GraphQL `batchGetCustomLink`

Endpoint: `POST /api/v3/gql?q=batchCustomLink` trên `affiliate.shopee.vn`.
Code: `executeConvertInMainWorld()` (`background.js:450`).

```js
// Lấy CSRF token từ cookie
const csrfToken = document.cookie.match(/csrftoken=([^;]+)/)?.[1] || '';

const gqlBody = {
  operationName: 'batchGetCustomLink',
  query: `query batchGetCustomLink($linkParams: [CustomLinkParam!], $sourceCaller: SourceCaller){
    batchCustomLink(linkParams: $linkParams, sourceCaller: $sourceCaller){ shortLink longLink failCode }
  }`,
  variables: {
    linkParams: [{
      originalLink: url,
      advancedLinkParams: { subId1, subId2, subId3, subId4:'', subId5:'' }
    }],
    sourceCaller: 'CUSTOM_LINK_CALLER',
  },
};

await fetch('/api/v3/gql?q=batchCustomLink', {
  method: 'POST',
  headers: {
    'accept': 'application/json, text/plain, */*',
    'content-type': 'application/json; charset=UTF-8',
    'affiliate-program-type': '1',      // ← header bắt buộc cho API affiliate
    'csrf-token': csrfToken,            // ← bắt buộc cho POST
  },
  credentials: 'include',              // ← gửi cookie
  body: JSON.stringify(gqlBody),
});
```

- Kết quả trả `shortLink` (link `s.shopee.vn/...` chính chủ) hoặc `longLink`.
- Check lỗi: `data.errors[]` hoặc `result.failCode !== 0`.
- **Lỗi "cookie incorrect"** ⇒ session hết hạn → code tự `chrome.tabs.reload(tabId)` để lấy
  cookie mới rồi báo thử lại (`background.js:536`).

### 5.2. Tìm sản phẩm + hoa hồng — REST `offer/product/list`

Endpoint: `GET /api/v3/offer/product/list?keyword=...&list_type=0&sort_type=1&page_limit=20&client_type=1`.
Code: `executeSearchInMainWorld()` (`background.js:976`) và trong `executeCheckAndConvert()`.

Response `data.list[]`, mỗi item có `batch_item_for_item_card_full` (viết tắt "card"):

| Field | Ý nghĩa | Xử lý |
|-------|---------|-------|
| `item.item_id` | ID sản phẩm | so khớp với itemId cần tìm |
| `card.name` | tên sản phẩm | |
| `card.price` | **giá × 100000** | chia `100000` để ra VND |
| `card.price_before_discount` | giá gốc × 100000 | |
| `item.max_commission_rate` / `seller_commission_rate` / `default_commission_rate` | **các mức % hoa hồng** | lấy **max** của cả 3 |
| `card.image` | **img_code** (không phải URL) | ghép thành URL, xem phần 6 |
| `card.shop_name`, `card.shop_rating`, `card.item_rating.rating_star`, `card.historical_sold_text` | metadata | |
| `item.product_link`, `item.long_link` | link chuẩn, link affiliate | |

> ⚠️ **`price` bị nhân 100000.** Đây là quy ước của Shopee (tránh số thập phân). Luôn
> `parseInt(card.price) / 100000`. Quên bước này = giá sai 100000 lần.

> ⚠️ **Hoa hồng lấy MAX của 3 mức:** `Math.max(max_commission_rate, seller_commission_rate,
> default_commission_rate)`. Các field này có thể là string → parse float trước.

### 5.3. Lấy thông tin sản phẩm đầy đủ — `/api/v4/item/get`

Endpoint (trên **shopee.vn**, không phải affiliate): `GET /api/v4/item/get?itemid=X&shopid=Y`.
Code: `executeExtractFull()` (`background.js:206`) và bước resolve tên trong
`executeCheckAndConvert()` (`background.js:692`).

- Trả về `data.data` = toàn bộ thông tin item (tên, mô tả, ảnh, biến thể, tồn kho…).
- Vì là API của `shopee.vn` (khác domain affiliate), phải inject vào **tab shopee.vn**. Nếu
  chưa có tab nào mở, code tạo **tab ẩn** (`active:false`) trỏ tới trang sản phẩm, đợi load
  xong rồi inject, xong thì đóng tab (nếu là tab do mình tạo).
- **Fallback tên sản phẩm:** nếu API không trả tên, đọc `document.title` của trang SPA rồi
  cắt bỏ đuôi `| Shopee Việt Nam` (`background.js:710`).

### 5.4. Đồng bộ đơn hàng — pipeline Export CSV 3 bước

Đây là cách lấy **lịch sử đơn hàng affiliate** — không có API trả thẳng, phải đi qua cơ chế
"xuất báo cáo" của Shopee. Code: `executeSyncOrders()` (`background.js:339`).

```
Bước 1: POST trigger export
        GET /api/v1/report/download?page_size=500&page_num=1
            &purchase_time_s={startTs}&purchase_time_e={endTs}
        → trả về task_id

Bước 2: Poll cho tới khi xong (tối đa 60s, mỗi 3s 1 lần)
        GET /api/v1/export/list?page_size=5&page_num=1
        → tìm task theo task_id, đợi status===3 && progress===100
        → lấy file_name

Bước 3: Tải CSV
        GET /api/v1/export/download?task_id={taskId}
        → trả về text CSV thô
```

- Khoảng thời gian mặc định: **66 ngày gần nhất** (`now - 66*24*3600`). Timestamp tính bằng **giây**.
- Server nhận CSV text → `orderStore.importCSV()` parse & upsert vào DB.
- **CSV Shopee có 47 cột**, cố định thứ tự. Mapping đầy đủ: `CSV_COLUMNS` (`src/api/order-store.js:5`).
  Vài cột quan trọng: `order_id`, `order_status`, `item_id`, `shop_id`, `total_order_commission`,
  `sub_id1..5`, `order_time`, `complete_time`.
- **Bẫy parse CSV:**
  - File có **BOM** (`0xFEFF`) ở đầu → phải cắt bỏ.
  - Số kiểu VN đôi khi dùng `.` ngăn nghìn và `,` thập phân → code xử lý theo số lượng dấu chấm.
  - Có ô chứa dấu phẩy trong ngoặc kép → tự viết parser tôn trọng `"` (không `split(',')` ngây thơ).
  - Chuẩn hoá `order_status` về tập cố định: `Hoàn thành` / `Đang giao hàng` / `Đang chờ xử lý`
    / `Chưa thanh toán` / `Đã hủy`.

---

## 6. Lấy ẢNH sản phẩm

Shopee **không trả URL ảnh trực tiếp** — chỉ trả một mã `img_code` (hash). Phải tự ghép URL:

```
https://down-vn.img.susercontent.com/file/{img_code}
```

Áp dụng ở cả backend (`background.js:1014`) và frontend (`Affiliate-AI/client/src/pages/Orders.jsx:74`).

### Nguồn `img_code`

1. **Search API** (`offer/product/list`) trả `card.image` = img_code (phần 5.2).
2. **Report API** (`/api/v3/report/list`) trả `item.img_code` cho từng đơn — dùng để cache ảnh
   cho các đơn đã có. Code: `executeFetchProductImages()` (`background.js:1079`).

### Cơ chế cache ảnh (chạy nền)

- `triggerImageFetch()` (`server.js:1987`) chạy **mỗi 5 phút**, nhưng chỉ khi có sản phẩm
  thiếu ảnh (`productImageStore.getMissingItems`).
- Gửi lệnh `fetch_product_images` cho Extension kèm **danh sách itemId đã cache** → Extension
  phân trang `report/list` (50 item/trang, nghỉ 1.5s giữa trang để tránh rate-limit), chỉ lấy
  ảnh của item **chưa có**.
- Server lưu vào bảng `product_images` (`item_id`, `shop_id`, `img_code`) — upsert idempotent
  (`src/api/product-image-store.js`).
- Quét trong **180 ngày** gần nhất.

> 💡 Lưu img_code (ngắn) thay vì URL đầy đủ → tiết kiệm DB & linh hoạt đổi CDN domain sau này.

---

## 7. KỸ THUẬT 4 & hạ tầng — Extension MV3 và giao thức WebSocket

### 7.1. Vì sao WebSocket, không phải HTTP?

Extension cần **nhận lệnh bất kỳ lúc nào** từ server (khi có user gửi link trên Zalo). WS
cho phép server chủ động "đẩy" lệnh xuống Extension. Extension là WS client, tự kết nối tới
`ws://localhost:3456`.

### 7.2. Giao thức tin nhắn (WS)

| Chiều | `type` | Ý nghĩa |
|-------|--------|---------|
| Ext → Server | `register_extension` | Extension báo đã sẵn sàng (server lưu `activeExtensionWs`) |
| Ext → Server | `ping` / Server → Ext `pong` | giữ kết nối |
| Server → Ext | `execute_automation` | `{ reqId, action, payload }` — lệnh cần chạy |
| Ext → Server | `automation_result` | `{ reqId, success, ... }` — kết quả |

`action` gồm: `convert_link`, `check_and_convert`, `search_product`, `sync_orders`,
`fetch_product_images`, `extract_full` (xem `handleAutomation()` `background.js:159`).

**Mẫu request/response bất đồng bộ:** mỗi lệnh có `reqId` duy nhất
(`ShopeeAPI.genReqId()`). Server lưu `pendingRequests[reqId] = { resolve, reject, timeout }`
rồi `await` promise; khi `automation_result` về đúng `reqId` thì resolve. Timeout mặc định
**45s** (sync đơn hàng 90s, ảnh 120s). Code: `sendToExtension()` (`server.js:138`).

### 7.3. Xử lý Extension offline / reconnect (rất quan trọng)

- Nếu Extension chưa kết nối, request **không fail ngay** — vào `reconnectQueue`, chờ tối đa
  **30s** cho Extension kết nối lại rồi mới gửi (`server.js:142`).
- Khi Extension `register_extension` lại, `drainReconnectQueue()` (`server.js:87`) gửi lại
  toàn bộ request đang chờ + các request "mid-flight" (đã gửi nhưng chưa có kết quả khi mất kết nối).

### 7.4. Giữ Service Worker MV3 sống (mẹo chống Chrome "ngủ")

Chrome MV3 **tự tắt** service worker sau ~30s không hoạt động → mất kết nối WS. Extension dùng
**3 lớp** để chống (`background.js:5`):

1. **`chrome.alarms`** — cơ chế đánh thức MV3 đáng tin duy nhất, đặt kêu mỗi ~24s
   (`periodInMinutes: 0.4`). Mỗi lần kêu: kiểm tra WS còn sống không → chết thì reconnect.
2. **Offscreen document** — một trang ẩn ping service worker mỗi 5s (nhanh hơn alarms), giữ
   SW "trông như đang bận" (`ensureOffscreen()`).
3. **Khôi phục state khi SW restart** — SW restart là mất hết biến toàn cục, nên trạng thái
   `botActive` lưu ở `chrome.storage.local`, đọc lại lúc khởi động và tự reconnect.

> Đây là phần "khó nhằn" nhất của MV3. Nếu bỏ 3 lớp này, bot sẽ ngắt kết nối ngẫu nhiên sau
> vài phút không dùng.

### 7.5. Điều hướng tab đúng trang

Một số action cần tab đang ở đúng URL (ví dụ `custom_link` DOM fallback cần trang
`/offer/custom_link`). `navigateAndWait()` (`background.js:1046`) đổi URL tab và đợi
`status === 'complete'` + 500ms cho React hydrate, có safety timeout 10s.

---

## 8. Pipeline hoàn chỉnh: "user gửi link → nhận link affiliate + hoa hồng"

Đây là luồng `checkAndConvert` — kết hợp cả 4 kỹ thuật, có nhiều tầng fallback.
Chế độ **direct (headless)**, `ShopeeAPI.checkAndConvert()` → `checkAndGenerate()`:

```
1. Bóc origin_link (nếu là an_redir) HOẶC resolve short link
2. Parse shopId + itemId từ URL
3. Nếu parse fail nhưng vẫn là link shopee → vẫn tạo link an_redir (không có data hoa hồng)
4. Có itemId → gọi addlivetag (KỸ THUẬT 2) lấy hoa hồng/tên/giá
5. Không có hoa hồng → vẫn trả link an_redir, cờ commission=0
6. Có hoa hồng → nhét rate vào sub3, tạo link an_redir cuối cùng
```

Chế độ **graphql (qua Extension)**, `executeCheckAndConvert()` (`background.js:612`) — mạnh
hơn, chạy song song để nhanh:

```
1. Resolve short link (trong service worker, không CORS)
2. Parse URL → itemId/shopId/tên-từ-slug
2a. Nếu có "product hint" từ preview tin nhắn Zalo → dùng làm keyword (nhanh nhất)
2b. Nếu vẫn thiếu tên nhưng có itemId+shopId → inject vào tab shopee.vn gọi /api/v4/item/get
     (fallback: đọc document.title)
2.5. SONG SONG: fire addlivetag lookup (service worker)
3+4. SONG SONG: search offer/product/list + tạo link GraphQL (trong tab affiliate)
5. Gộp kết quả: ưu tiên data từ Shopee; nếu Shopee ra 0 hoa hồng mà addlivetag có → dùng addlivetag
```

**Triết lý:** nhiều nguồn chạy song song (`Promise.all`), nguồn nào có data tốt hơn thì
ưu tiên, luôn có đường lui để **không bao giờ trả về tay trắng** khi link vẫn hợp lệ.

---

## 9. Token / Session management (chế độ dùng cURL thủ công)

Ngoài Extension, hệ thống còn hỗ trợ nạp cookie/header bằng tay (dán cURL từ DevTools) để
gọi API Shopee khi không tiện mở Chrome. `src/token-manager.js`:

- `parseCurl()` bóc header + cookie từ chuỗi `curl` (regex `-H '...'` và `-b '...'`).
- `setManualOverrides()` lưu đè các header đó.
- **Auto-reset mỗi 2 giờ** (`startAutoReset`) — reload trang để token không hết hạn.

> Cookie/CSRF Shopee hết hạn khá nhanh. Đây là lý do có cả cơ chế auto-reload (token-manager)
> lẫn tự-reload-khi-"cookie incorrect" (background.js).

---

## 10. Danh sách API Shopee đã dùng (tham chiếu nhanh)

| API | Method | Domain | Mục đích | Auth |
|-----|--------|--------|----------|------|
| `/api/v3/gql?q=batchCustomLink` | POST | affiliate.shopee.vn | Tạo link affiliate | cookie + csrf-token + `affiliate-program-type:1` |
| `/api/v3/offer/product/list` | GET | affiliate.shopee.vn | Search sp + hoa hồng | cookie + `affiliate-program-type:1` |
| `/api/v3/report/list` | GET | affiliate.shopee.vn | Lấy img_code theo đơn | cookie + `affiliate-program-type:1` |
| `/api/v1/report/download` | GET | affiliate.shopee.vn | Trigger export đơn hàng | cookie |
| `/api/v1/export/list` | GET | affiliate.shopee.vn | Poll trạng thái export | cookie |
| `/api/v1/export/download` | GET | affiliate.shopee.vn | Tải CSV đơn hàng | cookie |
| `/api/v4/item/get` | GET | shopee.vn | Thông tin sản phẩm đầy đủ | cookie |
| `an_redir` | GET | s.shopee.vn | Redirect tạo link (public) | chỉ cần affiliate_id |
| `product-data.php` | GET | data.addlivetag.com | Hoa hồng (bên thứ 3) | không cần |

**Header hằng gặp:**
- `affiliate-program-type: 1` — bắt buộc cho mọi API affiliate.
- `csrf-token: {từ cookie csrftoken}` — bắt buộc cho POST.
- `credentials: 'include'` — bắt buộc để gửi cookie same-origin.

---

## 11. Những "bẫy" & bài học tổng kết

1. **Giá bị ×100000** ở API affiliate (`offer/product/list`). Luôn chia lại.
2. **`commission` của addlivetag là SỐ TIỀN, không phải %.** Tự tính rate.
3. **`price=0` khi hết hàng** → fallback qua `latestPriceHistory`/`priceStats`, đừng chia cho 0.
4. **`an_redir` không được resolve như short link** — nó đã là link cuối.
5. **Ảnh chỉ là img_code** — tự ghép `down-vn.img.susercontent.com/file/{code}`.
6. **API Shopee cần chạy trong tab đã login** (`world:'MAIN'` + `credentials:'include'`) —
   không gọi được từ server thuần.
7. **MV3 service worker tự ngủ** → cần alarms + offscreen + khôi phục state, nếu không mất kết nối.
8. **CSV có BOM + số kiểu VN + dấu phẩy trong ngoặc kép** — phải parse cẩn thận, đủ 47 cột.
9. **Cookie Shopee hết hạn nhanh** → auto-reload (2h) + tự reload khi "cookie incorrect".
10. **Shop-slug trong URL không phải shopId** — chỉ tin `itemId` (≥8 số), resolve shopId qua addlivetag.
11. **Luôn có fallback** — parse fail vẫn tạo được link; API fail vẫn dùng addlivetag; mọi luồng
    cố gắng không trả tay trắng.

---

## 12. Bản đồ file (nơi tìm từng thứ)

| Chủ đề | File chính |
|--------|-----------|
| Điều phối lấy data, chọn chế độ direct/graphql | `src/shopee-api.js` |
| Tạo link headless + addlivetag + parse URL | `src/shopee-direct-link.js` |
| Toàn bộ automation qua Extension (mọi API) | `src/extension/background.js` |
| DOM fallback tạo link | `src/extension/content.js` |
| Tự đăng nhập lại Shopee | `src/extension/auto-login.js` |
| Manifest Extension (permissions, host) | `src/extension/manifest.json` |
| Giao thức WS server↔ext, queue, timeout | `server.js` (`sendToExtension`, `drainReconnectQueue`, `wss.on`) |
| Import CSV đơn hàng (47 cột) | `src/api/order-store.js` |
| Cache ảnh sản phẩm | `src/api/product-image-store.js`, `server.js:triggerImageFetch` |
| Quản lý token/cookie thủ công | `src/token-manager.js` |
| Landing page hiển thị link + hoa hồng | `server.js:buildLandingPage` |

---

*Ghi chú: các số dòng (`file.js:NNN`) đúng tại thời điểm viết tài liệu và có thể lệch nhẹ nếu
code thay đổi — dùng tên hàm để tra cho chắc.*
