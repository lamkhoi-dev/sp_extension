# Shopee Affiliate Automation Engine

Hệ thống rút gọn và tạo link Shopee Affiliate tự động bằng cách sử dụng công nghệ Chrome Extension DOM Automation.

## Kiến trúc
Hệ thống gồm 2 thành phần chính:
1. **Node.js WebServer:** Cung cấp Web UI (Dashboard) qua port 3456 để giao tiếp và ra lệnh tạo link thông qua WebSocket.
2. **Chrome Extension:** Tiện ích đóng vai trò là Client, thực hiện nhúng Script vào quy trình lướt Shopee, và tiêm lệnh (Main World Scripting) để mô phỏng hoàn toàn thao tác của người dùng gốc.

## Cách sử dụng
1. Install dependencies: `npm install`
2. Run server: `npm start`
3. Cài Extension trong thư mục `src/extension/` vào Chrome (Load unpacked).
4. Mở tab `https://affiliate.shopee.vn/offer/custom_link`.
5. Mở `http://localhost:3456` để sử dụng Bot.

## Cấu hình Môi trường (Environment)
Tạo file `.env` ở thư mục gốc:
```env
# URL để kết nối PostgreSQL (sử dụng trên VPS). 
# Nếu bỏ trống, hệ thống sẽ tự động sử dụng SQLite ở chế độ local.
DATABASE_URL=postgres://user:pass@host:port/dbname

# Mật khẩu quản trị Zalo Bot (cũ)
ADMIN_PASSWORD=your_secure_password
```

## Khởi tạo tài khoản Admin (Multi-Admin Auth)
Hệ thống sử dụng cơ chế đăng nhập với Username/Password cho 4 Admin. Để khởi tạo tài khoản mặc định, chạy lệnh:
```bash
node scripts/seed-admins.js
```
Các tài khoản sẽ được tạo với mật khẩu mặc định là `changeme123`. Yêu cầu đổi mật khẩu ở lần đăng nhập đầu tiên.

## Chuyển đổi Database (SQLite -> PostgreSQL)
Sau khi thiết lập `DATABASE_URL` trên VPS, để di chuyển toàn bộ dữ liệu hiện tại từ file SQLite lên PostgreSQL, bạn cần chạy công cụ migrate:
```bash
node scripts/migrate-to-postgres.js
```
Công cụ sẽ tự động khởi tạo các bảng và copy từng bảng dữ liệu một cách an toàn.
