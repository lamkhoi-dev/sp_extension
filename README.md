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
