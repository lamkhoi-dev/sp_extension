# 📋 Shopee Affiliate Bot — Tài liệu Nghiệp vụ

> **Mục đích**: Mô tả chi tiết toàn bộ quy trình, luồng dữ liệu, và quy tắc tính toán của hệ thống Shopee Affiliate Cashback Bot.
> **Cập nhật**: 2026-05-10

---

## 1. Tổng quan Hệ thống

### 1.1 Mô hình hoạt động

```
Người dùng (Zalo) → Gửi link SP Shopee → Bot xử lý → Trả link Affiliate có hoa hồng
                                                      → Lưu log chuyển đổi (convert_logs)
                                                      → Tracking qua SubID

Shopee CSV (export thủ công) → Import vào hệ thống → Matching đơn hàng ↔ convert_logs
                                                    → Tính cashback → Admin thanh toán
```

### 1.2 Các bên tham gia

| Vai trò | Định danh | Mô tả |
|---------|-----------|-------|
| **Người mua (Buyer)** | `sub_id1` = Zalo User ID | Người gửi link SP vào nhóm Zalo, mua hàng qua link affiliate |
| **Người giới thiệu (Referrer)** | `sub_id2` = Zalo User ID | Người mời buyer vào nhóm Zalo (tracked qua Group Join Event) |
| **Admin (Chúng tôi)** | — | Chủ hệ thống, nhận phần hoa hồng còn lại |

### 1.3 Công nghệ

| Thành phần | Stack |
|-----------|-------|
| Bot chat | Zalo API (zca-js) |
| Server | Node.js + Express + WebSocket |
| Database | PostgreSQL (pg, pg-pool) |
| Extension | Chrome Extension (background.js) kết nối WS tới server |
| Dashboard | React (Vite) — Admin panel |

---

## 2. Luồng Chuyển đổi Link (Convert Flow)

### 2.1 Quy trình chi tiết

```
1. User gửi link Shopee vào nhóm Zalo
2. Bot nhận message → phát hiện URL Shopee
3. zalo-commands.js:
   a. Parse link → xác định shopId, itemId (nếu có)
   b. Lookup referrer: userCache.getReferrer(senderUid)
   c. Build SubIDs:
      - sub1 = senderUid (buyer)
      - sub2 = referrer_id (người giới thiệu, nếu có)
      - sub3 = commission rate (%)
   d. Gọi shopee.checkAndConvert(url, subIds)
4. shopee-api.js → gửi WS request tới Extension
5. Extension (background.js):
   a. Resolve short link → full URL (nếu cần)
   b. Parse itemId, shopId từ URL
   c. Search product trên Shopee Affiliate → check commission
   d. Generate affiliate link với SubIDs
   e. Shorten link
   f. Return: { shortLink, productName, commission, price, itemId, shopId }
6. Bot trả link cho user: "✅ @User\n🔗 shortLink\n🏷️ Hoa hồng: X%"
7. Lưu vào convert_logs
```

### 2.2 Dữ liệu lưu trữ (convert_logs)

| Cột | Mô tả | Ví dụ |
|-----|-------|-------|
| `user_id` | Zalo ID người gửi link | `8274629103` |
| `user_name` | Tên hiển thị | `Nguyễn Văn An` |
| `original_link` | Link gốc user gửi | `https://s.shopee.vn/xxx` |
| `affiliate_link` | Link affiliate đầy đủ | `https://s.shopee.vn/aff/xxx` |
| `short_link` | Link rút gọn trả về user | `https://s.shopee.vn/yyy` |
| `product_name` | Tên sản phẩm | `Xiaomi Band 10` |
| `commission_rate` | % hoa hồng | `4.0` |
| `commission_amount` | Số tiền HH ước tính | `39780` |
| `price` | Giá sản phẩm | `1170000` |
| `item_id` | **ID sản phẩm Shopee** | `28634712` |
| `shop_id` | **ID shop Shopee** | `193746` |
| `sub_id1` | Zalo ID buyer | `8274629103` |
| `sub_id2` | Zalo ID referrer | `7391028463` |
| `status` | Trạng thái convert | `success` / `error` / `no_commission` |

> **⚠️ Quan trọng**: `item_id` và `shop_id` là 2 cột mới được thêm vào để matching chính xác với đơn hàng.

---

## 3. Tracking Người giới thiệu (Referrer)

### 3.1 Cơ chế

```
Referrer A mời User B vào nhóm Zalo
  → Zalo Group Join Event trigger
  → zalo-bot.js bắt event:
      inviterUid = A (người mời)
      invitedUids = [B] (người được mời)
  → userCache.setReferrer(B, A, "Tên A")
  → DB: users.referrer_id = A, users.referrer_name = "Tên A"
```

### 3.2 Quy tắc

- Mỗi user chỉ có **1 referrer** (người mời đầu tiên)
- Referrer được set **tự động** khi user join nhóm qua lời mời
- Referrer relationship là **vĩnh viễn** (không thay đổi sau khi set)
- Khi user convert link → `sub_id2` = `referrer_id` của user đó

---

## 4. Đơn hàng (Orders)

### 4.1 Nguồn dữ liệu

Đơn hàng được import từ **CSV Shopee Affiliate** (47 cột). File CSV export thủ công từ:
`https://affiliate.shopee.vn → Báo cáo → Xuất CSV`

### 4.2 Các cột Commission quan trọng

| CSV Col | Tên tiếng Việt | DB Column | Mô tả |
|---------|---------------|-----------|-------|
| 23 | Tỷ lệ SP hoa hồng Shopee | `shopee_product_commission_rate` | % HH từ Shopee |
| 24 | Hoa hồng Shopee trên SP | `shopee_product_commission` | Tiền HH từ Shopee |
| 25 | Tỷ lệ SP hoa hồng người bán | `seller_product_commission_rate` | % HH từ Seller |
| 26 | Hoa hồng Xtra trên SP | `xtra_product_commission` | Tiền HH từ Seller |
| **27** | **Tổng hoa hồng sản phẩm** | `total_product_commission` | = col24 + col26 |
| 28 | HH đơn hàng từ Shopee | `order_commission` | HH cấp đơn từ Shopee |
| 29 | HH đơn hàng từ Người bán | `order_bonus` | HH cấp đơn từ Seller |
| **30** | **Tổng hoa hồng đơn hàng** | `total_order_commission` | = col28 + col29 |
| 35 | Mức HH tiếp thị liên kết | `agreed_commission_rate` | % thỏa thuận (100%) |
| **36** | **HH ròng tiếp thị liên kết** | **`net_commission`** | **= Số tiền THỰC NHẬN** |

### 4.3 Công thức Commission

```
HH Shopee trên SP (col24) = Giá × Tỷ lệ Shopee (col23)
HH Xtra trên SP (col26)   = Giá × Tỷ lệ Seller (col25)
Tổng HH SP (col27)        = col24 + col26

HH ĐH Shopee (col28)      = Aggregate HH Shopee theo đơn
HH ĐH Seller (col29)      = Aggregate HH Seller theo đơn
Tổng HH ĐH (col30)        = col28 + col29

HH ròng (col36) = Tổng HH ĐH (col30) × Mức thỏa thuận (col35) - MCN fee (col34)
                 = Tổng HH ĐH × 100% - 0
                 = Tổng HH ĐH (hiện tại MCN = 0)
```

### 4.4 ⭐ Quy tắc: Dùng `net_commission` để tính Cashback

> **`net_commission`** (col 36) = "Hoa hồng ròng tiếp thị liên kết" = **Số tiền thực nhận cuối cùng**.
> Đây là base để chia cashback cho buyer/referrer/admin.

### 4.5 Trạng thái đơn hàng

| Trạng thái | Ý nghĩa | Cashback? |
|-----------|---------|-----------|
| **Hoàn thành** | Đơn đã giao, hết hạn trả | ✅ Đủ điều kiện |
| Đang chờ xử lý | Đang giao / chờ xác nhận | ❌ Chưa đủ |
| Đã hủy | Đơn bị hủy | ❌ Không |
| Trả hàng | Đã trả hàng hoàn tiền | ❌ Không |

---

## 5. Matching: Đơn hàng ↔ Convert Logs

### 5.1 Chiến lược matching (ưu tiên từ cao → thấp)

```
Priority 1: item_id match
  orders.item_id = convert_logs.item_id
  AND orders.sub_id1 = convert_logs.sub_id1
  → Chính xác nhất

Priority 2: product_name match (fallback cho data cũ)
  orders.item_name = convert_logs.product_name
  AND orders.sub_id1 = convert_logs.sub_id1
  → Dùng khi convert_logs chưa có item_id
```

### 5.2 Quy tắc matching

- **Bắt buộc**: `sub_id1` phải khớp (cùng buyer)
- **Bắt buộc**: `convert_logs.status = 'success'` (chỉ match link convert thành công)
- **1 order-item chỉ match 1 convert log** (tránh trùng lặp)
- Sản phẩm user mua nhưng **không convert link** → không được cashback (hoa hồng thuộc admin 100%)

### 5.3 Ví dụ

```
User A gửi link SP "Xiaomi Band 10" (item_id: 28634712)
  → convert_logs: { user_id: A, item_id: 28634712, sub_id1: A }

Sau đó, User A mua "Xiaomi Band 10" + "Ốp lưng" + "Cáp sạc" trong 1 đơn
  → orders:
    - { item_id: 28634712, sub_id1: A, net_commission: 59670 }  ← MATCH ✅
    - { item_id: 99999, sub_id1: A, net_commission: 500 }       ← NO MATCH ❌
    - { item_id: 88888, sub_id1: A, net_commission: 300 }       ← NO MATCH ❌

Kết quả: Chỉ item "Xiaomi Band 10" được cashback.
"Ốp lưng" và "Cáp sạc" → HH thuộc admin 100%.
```

---

## 6. Tỷ lệ chia Cashback (Commission Split)

### 6.1 Tỷ lệ mặc định

| Bên | Khi có Referrer | Khi không có Referrer |
|-----|-----------------|----------------------|
| **Buyer** (sub1) | **60%** | **60%** (giữ nguyên) |
| **Referrer** (sub2) | **20%** | 0% |
| **Admin** | **20%** | **40%** (nhận thêm phần referrer) |
| **Tổng** | 100% | 100% |

### 6.2 Tỷ lệ tuỳ chỉnh

- **Buyer rate (60%)**: Cài đặt **system-wide**, áp dụng cho TẤT CẢ user. Không chỉnh per-user.
- **Referrer rate (20%)**: Có thể **override per-user** (trên bảng buyer). Ví dụ: buyer A có referrer rate = 25% → referrer nhận 25%, admin nhận 15%.
- Admin rate = 100 - buyer_rate - referrer_rate (luôn auto-calculate)
- DB: `users.cashback_buyer_rate` (default 60, system-wide), `users.cashback_referrer_rate` (default 20, adjustable per-user)
- Khi không có referrer: buyer vẫn nhận 60%, admin nhận 40% (KHÔNG cộng dồn cho buyer)

### 6.3 Công thức tính Cashback

```
Đầu vào:
  net_commission = 59,670đ (từ orders)
  buyer_rate = 60% (system-wide)
  referrer_rate = 20% (per-user, default)
  has_referrer = true (sub_id2 != '')

Tính toán:
  CÓ referrer:
    buyer_cashback    = 59,670 × 60% = 35,802đ
    referrer_cashback = 59,670 × 20% = 11,934đ
    admin_profit      = 59,670 × 20% = 11,934đ

  KHÔNG có referrer:
    buyer_cashback    = 59,670 × 60% = 35,802đ
    referrer_cashback = 0đ
    admin_profit      = 59,670 × 40% = 23,868đ
```

### 6.4 Snapshot tỷ lệ

> **Quy tắc**: Tỷ lệ được lấy **tại thời điểm tính cashback** (khi admin mở trang Payouts).
> Nếu admin thay đổi referrer rate sau đó → các đơn chưa thanh toán sẽ tính theo rate mới.
> Các đơn **đã thanh toán** (payouts record) → giữ nguyên số tiền đã trả.

---

## 7. Thanh toán (Payouts)

### 7.1 Quy trình thanh toán

```
1. Admin mở trang Payouts
2. Hệ thống tính toán:
   a. Match orders ↔ convert_logs
   b. Tính cashback per user theo tỷ lệ hiện tại
   c. Trừ đi số đã thanh toán (SUM payouts)
   d. Hiển thị pending list
3. Admin click vào user → xổ chi tiết:
   ├── 🟢 Hoàn thành (eligible for cashback)
   │   ├── Đơn 260429... - Xiaomi Band 10 - 59,670đ → Buyer: 23,868đ
   │   └── Đơn 260421... - Giá đỡ Laptop - 28,330đ → Buyer: 11,332đ
   └── 🟡 Đang xử lý (not yet eligible)
       ├── Đơn 260501... - Tai nghe - 15,500đ (chờ hoàn thành)
       └── Đơn 260503... - Chuột - 9,040đ (chờ hoàn thành)
4. Admin click "Trả" → chỉ tính trên đơn "Hoàn thành"
5. Upload bill thanh toán (ảnh chuyển khoản)
6. Ghi nhận payout record
```

### 7.2 Hiển thị trang Payouts

**Row chính (tổng hợp)**:
```
| User          | Tổng Commission | Buyer nhận  | Đã trả  | Còn nợ  | [Trả] |
| Nguyễn Văn An | 112,540đ *      | 45,016đ     | 23,868đ | 21,148đ | [✅]  |
```
> (*) Tổng commission bao gồm **cả đơn chưa hoàn thành** để user thấy con số lớn

**Nút "Trả"**: Chỉ enabled khi có pending > 0 từ đơn hoàn thành

### 7.3 Bảng payouts

| Cột | Mô tả |
|-----|-------|
| `user_id` | Zalo ID người nhận |
| `role` | `buyer` hoặc `referrer` |
| `amount` | Số tiền đã trả |
| `payment_method` | `momo` / `zalopay` / `bank` |
| `bill_image` | Đường dẫn ảnh bill |
| `admin_note` | Ghi chú |
| `status` | `paid` |
| `paid_at` | Thời gian thanh toán |

---

## 8. Bảng Database Schema

### 8.1 users (mở rộng)

```sql
-- Các cột mới cho cashback:
cashback_buyer_rate REAL DEFAULT 60    -- % buyer nhận (system-wide, chỉ đổi qua Settings)
cashback_referrer_rate REAL DEFAULT 20 -- % referrer nhận (adjustable per-user)
-- Admin rate = 100 - buyer - referrer (auto)

-- Tracking quan hệ giới thiệu:
referrer_id TEXT DEFAULT ''            -- Zalo ID người giới thiệu
referrer_name TEXT DEFAULT ''          -- Tên người giới thiệu

-- Thông tin thanh toán:
bank_name TEXT
bank_account TEXT
qr_code TEXT
```

### 8.2 convert_logs (mở rộng)

```sql
-- Cột mới cho matching:
item_id TEXT DEFAULT ''                -- ID sản phẩm Shopee
shop_id TEXT DEFAULT ''                -- ID shop Shopee
```

### 8.3 payouts (mới)

```sql
CREATE TABLE payouts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  user_name TEXT DEFAULT '',
  role TEXT DEFAULT 'buyer',         -- 'buyer' | 'referrer'
  amount REAL NOT NULL,
  payment_method TEXT DEFAULT '',    -- 'momo' | 'zalopay' | 'bank'
  bill_image TEXT DEFAULT '',
  admin_note TEXT DEFAULT '',
  status TEXT DEFAULT 'paid',
  paid_at TEXT DEFAULT (datetime('now','localtime')),
  created_at TEXT DEFAULT (datetime('now','localtime'))
);
```

---

## 9. API Endpoints

| Method | Path | Mô tả |
|--------|------|-------|
| `GET` | `/api/payouts/summary` | Danh sách users + pending cashback |
| `GET` | `/api/payouts/history` | Lịch sử đã thanh toán |
| `GET` | `/api/payouts/user/:userId` | Chi tiết eligible items cho 1 user |
| `POST` | `/api/payouts/create` | Tạo payout mới |
| `POST` | `/api/payouts/upload-bill` | Upload ảnh bill |
| `PATCH` | `/api/users/:userId/cashback-rates` | Cập nhật tỷ lệ referrer rate per-user (chỉ referrerRate) |

---

## 10. Edge Cases & Quy tắc đặc biệt

| # | Tình huống | Xử lý |
|---|-----------|-------|
| 1 | User mua SP không convert link | HH 100% thuộc admin |
| 2 | User convert link nhưng không mua | Không có cashback (không match) |
| 3 | User convert rồi mua thêm SP khác | Chỉ SP đã convert mới được cashback |
| 4 | Đơn bị hủy/trả hàng | Không tính cashback |
| 5 | Đơn "Đang xử lý" | Hiển thị trong tree nhưng không enable nút "Trả" |
| 6 | User không có referrer | buyer vẫn nhận 60%, admin nhận 40% (KHÔNG cộng cho buyer) |
| 7 | convert_logs cũ không có item_id | Fallback match bằng product_name |
| 8 | Admin đổi tỷ lệ user | Áp dụng cho đơn chưa thanh toán |
| 9 | Admin đã trả 1 phần | Số pending = total eligible - SUM(payouts đã trả) |
