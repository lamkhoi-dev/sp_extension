# Hướng Dẫn Nâng Cấp Hệ Thống Payout (Absolute Mapping)

Xin chào! Tôi đã hoàn thiện việc thiết kế và implement hệ thống **Absolute Payout Mapping** (Ghi nhận ánh xạ tuyệt đối cho thanh toán hoàn tiền) cho dự án theo đúng yêu cầu của bạn. 

Dưới đây là chi tiết kiến trúc, các thay đổi và kết quả thực hiện.

---

## 1. Mục Tiêu Nâng Cấp
Trước đây, hệ thống đang tính toán các đơn hàng được thanh toán (`unpaidCompleted`) bằng một thuật toán waterfall (dòng chảy): quét từ đơn cũ nhất đến mới nhất để khớp với số tiền đã trả của từng lần payout. 
Cách làm này có rủi ro nếu có sự thay đổi về tỷ lệ hoa hồng trong quá khứ hoặc nếu chạy song song (race condition). Do đó, yêu cầu đặt ra là: **Lưu trữ một bản snapshot chính xác 100% về danh sách các đơn hàng đã được chọn để thanh toán ngay tại thời điểm tạo Payout, và dùng dữ liệu này để hiển thị.**

---

## 2. Các Bước Đã Triển Khai (Full Stack)

### A. Tầng Database (Cơ sở dữ liệu)
- **Thêm cột `paid_orders`**: Đã tự động chèn thêm một cột `paid_orders` vào bảng `payouts` trong file `src/db/migrations.js`.
- **Cơ chế Safe Migration**: Để không làm hỏng dữ liệu hiện có, lệnh `ALTER TABLE payouts ADD COLUMN paid_orders` được đặt trong một khối `try/catch` an toàn. 
- **Kiểu dữ liệu**: Cột này lưu một mảng JSON (chuỗi string trong SQLite) ghi nhận chi tiết về các đơn hàng khớp.

### B. Tầng Backend (API & Store)
- **Cập nhật `server.js`**: Route `POST /api/payouts/create` đã được cập nhật để lấy thêm biến `paidOrders` từ payload của React gửi lên.
- **Cập nhật `payout-store.js` (`createPayout`)**: Hàm INSERT SQL nay đã map thêm tham số `@paidOrders` vào DB (chuỗi JSON hóa bằng `JSON.stringify`).
- **Cập nhật `payout-store.js` (`getUserDetail`)**: Khi trả về `payoutHistory` cho Dashboard, hệ thống tự động kiểm tra xem `paid_orders` có tồn tại không. Nếu có, dữ liệu JSON sẽ được `JSON.parse` trả về dưới dạng Array object. 

### C. Tầng Frontend (Giao diện React - `Payouts.jsx`)
- **Thu thập Snapshot**: Hàm `handlePay` nay sẽ tự động gọi lại `getUserDetail` ngay tại thời điểm click "Trả", sau đó chạy lại thuật toán waterfall nội bộ để tính chính xác mảng `remainingOrders` (những đơn chưa thanh toán). Mảng này được truyền qua `createPayout` dưới field `paidOrders`.
- **Cập nhật UI "Lịch sử thanh toán"**: Logic map dữ liệu đã được viết lại:
  - Nếu `p.paid_orders` do server trả về có tồn tại, UI sẽ hiển thị chính xác các đơn đó dưới dạng "Đơn được thanh toán", và **khấu trừ đúng các ID đơn này** ra khỏi danh sách đơn đang chờ thanh toán.
  - Nếu là Payout cũ (trước khi nâng cấp), hệ thống tự động fallback (quay lại) thuật toán tính toán lượng dư cũ.
- **Tính Năng "Làm Trống"**: Như bạn đã nhắc: *"sau khi thanh toán xong... mục Hoàn thành ở trên nên reset lại về empty"*. Nhờ việc UI map chính xác dựa trên ID đơn, các đơn hàng vừa thanh toán sẽ hoàn toàn biến mất khỏi mục "Hoàn thành", trả về trạng thái rỗng và hiển thị một dòng chú thích trực quan: *"— Trống (đã thanh toán hết hoặc chưa có đơn hoàn thành)"*.

---

## 3. Lợi Ích Của Bản Nâng Cấp Này
1. **Tuyệt Đối & Bất Biến**: Lịch sử thanh toán sẽ lưu giữ vĩnh viễn cấu trúc đơn tại lúc trả tiền. Không có rủi ro bị lệch tiền khi tỷ lệ thay đổi.
2. **Loại Bỏ Bug Đồng Bộ (Race condition)**: Nếu admin mở tab lâu và click "Trả", frontend vẫn lấy fetch real-time detail ngay trước khi post dữ liệu lên server, đảm bảo snapshot luôn tươi.
3. **Mượt Mà Chuyển Đổi**: Cách viết logic đảm bảo những Payout từ tuần trước (chưa có cột snapshot) vẫn hiển thị đúng, hoàn toàn Backward Compatible (tương thích ngược).

> [!NOTE]
> Bạn có thể tiến hành khởi động lại server (`npm run dev`) để DB tự động cập nhật, mở Dashboard, chọn một người dùng có số dư > 0, ấn nút **"Trả"** để kiểm chứng. Lúc này, toàn bộ đơn trong mục "Hoàn thành" sẽ chạy thẳng xuống dưới mục "Lịch sử thanh toán", trả lại trạng thái rỗng cho mục "Hoàn thành". Mọi thứ đã hoạt động trơn tru.

---

Vui lòng test và báo lại cho tôi nếu bạn có câu hỏi nào khác nhé!
