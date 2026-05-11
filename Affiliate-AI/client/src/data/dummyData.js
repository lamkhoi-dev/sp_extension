// Dummy data cho Affiliate Marketing Dashboard

export const users = [
  { id: 1, name: 'Nguyễn Văn An', subId: 'AFF001', zalo: '0901234567', totalCommission: 15680000, totalRefunded: 7840000, status: 'active', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=An', bankAccount: '1234567890', bankName: 'Vietcombank', qrCode: 'https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=1234567890' },
  { id: 2, name: 'Trần Thị Bình', subId: 'AFF002', zalo: '0912345678', totalCommission: 12450000, totalRefunded: 6225000, status: 'active', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Binh', bankAccount: '0987654321', bankName: 'Techcombank', qrCode: 'https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=0987654321' },
  { id: 3, name: 'Lê Hoàng Cường', subId: 'AFF003', zalo: '0923456789', totalCommission: 9870000, totalRefunded: 4935000, status: 'active', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Cuong', bankAccount: null, bankName: null, qrCode: null },
  { id: 4, name: 'Phạm Minh Đức', subId: 'AFF004', zalo: '0934567890', totalCommission: 8540000, totalRefunded: 4270000, status: 'pending', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Duc', bankAccount: '5566778899', bankName: 'MB Bank', qrCode: 'https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=5566778899' },
  { id: 5, name: 'Hoàng Thị Em', subId: 'AFF005', zalo: '0945678901', totalCommission: 7230000, totalRefunded: 3615000, status: 'active', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Em', bankAccount: null, bankName: null, qrCode: null },
  { id: 6, name: 'Võ Văn Phúc', subId: 'AFF006', zalo: '0956789012', totalCommission: 6120000, totalRefunded: 3060000, status: 'inactive', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Phuc', bankAccount: '1122334455', bankName: 'ACB', qrCode: 'https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=1122334455' },
  { id: 7, name: 'Đặng Thị Giang', subId: 'AFF007', zalo: '0967890123', totalCommission: 5890000, totalRefunded: 2945000, status: 'active', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Giang', bankAccount: null, bankName: null, qrCode: null },
  { id: 8, name: 'Bùi Văn Hải', subId: 'AFF008', zalo: '0978901234', totalCommission: 4560000, totalRefunded: 2280000, status: 'active', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Hai', bankAccount: '9988776655', bankName: 'BIDV', qrCode: 'https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=9988776655' },
];

export const orders = [
  { id: 'ORD001', userId: 1, userName: 'Nguyễn Văn An', product: 'Áo thun nam cao cấp', value: 450000, platform: 'Shopee', clickTime: '2024-01-15 10:30', status: 'confirmed', commission: 45000, refund50: 22500, syncTime: '2024-01-15 14:00' },
  { id: 'ORD002', userId: 2, userName: 'Trần Thị Bình', product: 'Tai nghe Bluetooth', value: 890000, platform: 'TikTok', clickTime: '2024-01-15 11:45', status: 'pending', commission: 89000, refund50: 44500, syncTime: null },
  { id: 'ORD003', userId: 1, userName: 'Nguyễn Văn An', product: 'Bàn phím cơ gaming', value: 1250000, platform: 'Shopee', clickTime: '2024-01-15 14:20', status: 'shipping', commission: 125000, refund50: 62500, syncTime: '2024-01-15 18:00' },
  { id: 'ORD004', userId: 3, userName: 'Lê Hoàng Cường', product: 'Kem chống nắng', value: 320000, platform: 'TikTok', clickTime: '2024-01-14 09:15', status: 'confirmed', commission: 32000, refund50: 16000, syncTime: null },
  { id: 'ORD005', userId: 4, userName: 'Phạm Minh Đức', product: 'Giày thể thao Nike', value: 2100000, platform: 'Shopee', clickTime: '2024-01-14 16:30', status: 'cancelled', commission: 0, refund50: 0, syncTime: '2024-01-14 20:00' },
  { id: 'ORD006', userId: 2, userName: 'Trần Thị Bình', product: 'Túi xách nữ', value: 680000, platform: 'TikTok', clickTime: '2024-01-14 12:00', status: 'confirmed', commission: 68000, refund50: 34000, syncTime: null },
  { id: 'ORD007', userId: 5, userName: 'Hoàng Thị Em', product: 'Đồng hồ thông minh', value: 1850000, platform: 'Shopee', clickTime: '2024-01-13 08:45', status: 'confirmed', commission: 185000, refund50: 92500, syncTime: '2024-01-13 12:00' },
  { id: 'ORD008', userId: 3, userName: 'Lê Hoàng Cường', product: 'Máy sấy tóc', value: 560000, platform: 'TikTok', clickTime: '2024-01-13 15:20', status: 'shipping', commission: 56000, refund50: 28000, syncTime: null },
  { id: 'ORD009', userId: 1, userName: 'Nguyễn Văn An', product: 'Balo laptop', value: 750000, platform: 'Shopee', clickTime: '2024-01-12 10:00', status: 'confirmed', commission: 75000, refund50: 37500, syncTime: '2024-01-12 14:30' },
  { id: 'ORD010', userId: 6, userName: 'Võ Văn Phúc', product: 'Áo khoác nam', value: 890000, platform: 'TikTok', clickTime: '2024-01-12 17:45', status: 'pending', commission: 89000, refund50: 44500, syncTime: null },
];

export const convertLogs = [
  { id: 1, userId: 1, userName: 'Nguyễn Văn An', time: '2024-01-15 10:25:30', originalLink: 'https://shopee.vn/product/123456', affiliateLink: 'https://s.shopee.vn/aff/AFF001/123456', subId: 'AFF001', status: 'success' },
  { id: 2, userId: 2, userName: 'Trần Thị Bình', time: '2024-01-15 11:40:15', originalLink: 'https://tiktok.com/shop/789012', affiliateLink: 'https://vt.tiktok.com/aff/AFF002/789012', subId: 'AFF002', status: 'success' },
  { id: 3, userId: 1, userName: 'Nguyễn Văn An', time: '2024-01-15 14:15:45', originalLink: 'https://shopee.vn/product/345678', affiliateLink: 'https://s.shopee.vn/aff/AFF001/345678', subId: 'AFF001', status: 'success' },
  { id: 4, userId: 3, userName: 'Lê Hoàng Cường', time: '2024-01-14 09:10:20', originalLink: 'https://tiktok.com/shop/901234', affiliateLink: null, subId: 'AFF003', status: 'error' },
  { id: 5, userId: 4, userName: 'Phạm Minh Đức', time: '2024-01-14 16:25:00', originalLink: 'https://shopee.vn/product/567890', affiliateLink: 'https://s.shopee.vn/aff/AFF004/567890', subId: 'AFF004', status: 'success' },
  { id: 6, userId: 2, userName: 'Trần Thị Bình', time: '2024-01-14 11:55:30', originalLink: 'https://tiktok.com/shop/234567', affiliateLink: 'https://vt.tiktok.com/aff/AFF002/234567', subId: 'AFF002', status: 'success' },
  { id: 7, userId: 5, userName: 'Hoàng Thị Em', time: '2024-01-13 08:40:10', originalLink: 'https://shopee.vn/product/890123', affiliateLink: 'https://s.shopee.vn/aff/AFF005/890123', subId: 'AFF005', status: 'success' },
  { id: 8, userId: 3, userName: 'Lê Hoàng Cường', time: '2024-01-13 15:15:45', originalLink: 'https://tiktok.com/shop/456789', affiliateLink: 'https://vt.tiktok.com/aff/AFF003/456789', subId: 'AFF003', status: 'success' },
];

export const payouts = [
  { id: 1, userId: 1, userName: 'Nguyễn Văn An', confirmedCommission: 7840000, amountToPay: 3920000, method: 'Momo', status: 'paid', paidAt: '2024-01-10 15:30' },
  { id: 2, userId: 2, userName: 'Trần Thị Bình', confirmedCommission: 6225000, amountToPay: 3112500, method: 'ZaloPay', status: 'paid', paidAt: '2024-01-10 16:00' },
  { id: 3, userId: 3, userName: 'Lê Hoàng Cường', confirmedCommission: 4935000, amountToPay: 2467500, method: null, status: 'pending', paidAt: null },
  { id: 4, userId: 4, userName: 'Phạm Minh Đức', confirmedCommission: 4270000, amountToPay: 2135000, method: null, status: 'pending', paidAt: null },
  { id: 5, userId: 5, userName: 'Hoàng Thị Em', confirmedCommission: 3615000, amountToPay: 1807500, method: 'Bank', status: 'paid', paidAt: '2024-01-08 10:15' },
];

// Chart data - Commission theo ngày (7 ngày gần nhất)
export const dailyCommissionData = [
  { date: '09/01', shopee: 2450000, tiktok: 1850000, total: 4300000 },
  { date: '10/01', shopee: 3120000, tiktok: 2340000, total: 5460000 },
  { date: '11/01', shopee: 2890000, tiktok: 1980000, total: 4870000 },
  { date: '12/01', shopee: 3560000, tiktok: 2670000, total: 6230000 },
  { date: '13/01', shopee: 4120000, tiktok: 3150000, total: 7270000 },
  { date: '14/01', shopee: 3890000, tiktok: 2890000, total: 6780000 },
  { date: '15/01', shopee: 4560000, tiktok: 3420000, total: 7980000 },
];

// Chart data - Commission theo 30 ngày
export const monthlyCommissionData = [
  { date: '17/12', shopee: 1850000, tiktok: 1250000 },
  { date: '19/12', shopee: 2120000, tiktok: 1680000 },
  { date: '21/12', shopee: 2450000, tiktok: 1920000 },
  { date: '23/12', shopee: 2890000, tiktok: 2150000 },
  { date: '25/12', shopee: 3120000, tiktok: 2340000 },
  { date: '27/12', shopee: 2780000, tiktok: 2080000 },
  { date: '29/12', shopee: 3450000, tiktok: 2560000 },
  { date: '31/12', shopee: 3890000, tiktok: 2890000 },
  { date: '02/01', shopee: 2560000, tiktok: 1950000 },
  { date: '04/01', shopee: 2890000, tiktok: 2120000 },
  { date: '06/01', shopee: 3120000, tiktok: 2340000 },
  { date: '08/01', shopee: 3560000, tiktok: 2670000 },
  { date: '10/01', shopee: 3120000, tiktok: 2340000 },
  { date: '12/01', shopee: 3560000, tiktok: 2670000 },
  { date: '14/01', shopee: 3890000, tiktok: 2890000 },
  { date: '15/01', shopee: 4560000, tiktok: 3420000 },
];

// Chart data - Commission theo năm (12 tháng)
export const yearlyCommissionData = {
  2024: [
    { date: 'T1', shopee: 45000000, tiktok: 32000000 },
    { date: 'T2', shopee: 52000000, tiktok: 38000000 },
    { date: 'T3', shopee: 48000000, tiktok: 35000000 },
    { date: 'T4', shopee: 61000000, tiktok: 42000000 },
    { date: 'T5', shopee: 58000000, tiktok: 45000000 },
    { date: 'T6', shopee: 72000000, tiktok: 52000000 },
    { date: 'T7', shopee: 68000000, tiktok: 48000000 },
    { date: 'T8', shopee: 75000000, tiktok: 55000000 },
    { date: 'T9', shopee: 82000000, tiktok: 61000000 },
    { date: 'T10', shopee: 78000000, tiktok: 58000000 },
    { date: 'T11', shopee: 95000000, tiktok: 72000000 },
    { date: 'T12', shopee: 120000000, tiktok: 85000000 },
  ],
  2025: [
    { date: 'T1', shopee: 98000000, tiktok: 72000000 },
    { date: 'T2', shopee: 85000000, tiktok: 65000000 },
    { date: 'T3', shopee: 92000000, tiktok: 68000000 },
    { date: 'T4', shopee: 105000000, tiktok: 78000000 },
    { date: 'T5', shopee: 112000000, tiktok: 82000000 },
    { date: 'T6', shopee: 125000000, tiktok: 92000000 },
    { date: 'T7', shopee: 118000000, tiktok: 88000000 },
    { date: 'T8', shopee: 132000000, tiktok: 98000000 },
    { date: 'T9', shopee: 145000000, tiktok: 105000000 },
    { date: 'T10', shopee: 138000000, tiktok: 102000000 },
    { date: 'T11', shopee: 158000000, tiktok: 115000000 },
    { date: 'T12', shopee: 175000000, tiktok: 128000000 },
  ],
  2026: [
    { date: 'T1', shopee: 142000000, tiktok: 105000000 },
    { date: 'T2', shopee: 135000000, tiktok: 98000000 },
    { date: 'T3', shopee: 148000000, tiktok: 108000000 },
    { date: 'T4', shopee: 162000000, tiktok: 118000000 },
    { date: 'T5', shopee: 0, tiktok: 0 },
    { date: 'T6', shopee: 0, tiktok: 0 },
    { date: 'T7', shopee: 0, tiktok: 0 },
    { date: 'T8', shopee: 0, tiktok: 0 },
    { date: 'T9', shopee: 0, tiktok: 0 },
    { date: 'T10', shopee: 0, tiktok: 0 },
    { date: 'T11', shopee: 0, tiktok: 0 },
    { date: 'T12', shopee: 0, tiktok: 0 },
  ],
};

// Platform distribution
export const platformData = [
  { name: 'Shopee', value: 58, color: '#EE4D2D' },
  { name: 'TikTok', value: 42, color: '#000000' },
];

// Top products
export const topProducts = [
  { name: 'Áo thun nam cao cấp', orders: 156, revenue: 70200000, commission: 7020000 },
  { name: 'Tai nghe Bluetooth', orders: 98, revenue: 87220000, commission: 8722000 },
  { name: 'Kem chống nắng', orders: 234, revenue: 74880000, commission: 7488000 },
  { name: 'Giày thể thao', orders: 67, revenue: 140700000, commission: 14070000 },
  { name: 'Túi xách nữ', orders: 89, revenue: 60520000, commission: 6052000 },
];

// KPI data
export const kpiData = {
  totalCommission: 42890000,
  totalRefund50: 21445000,
  activeUsers: 156,
  newOrders: 89,
  conversionRate: 12.5,
  gmv: 428900000,
};

// Notifications
export const notifications = [
  { id: 1, type: 'order', message: 'Đơn hàng mới từ Nguyễn Văn An - 450,000đ', time: '5 phút trước', read: false },
  { id: 2, type: 'payout', message: 'Yêu cầu hoàn tiền từ Trần Thị Bình - 3,112,500đ', time: '15 phút trước', read: false },
  { id: 3, type: 'system', message: 'Đồng bộ Shopee hoàn tất - 45 đơn mới', time: '1 giờ trước', read: true },
  { id: 4, type: 'order', message: 'Đơn hàng confirmed - Lê Hoàng Cường', time: '2 giờ trước', read: true },
  { id: 5, type: 'alert', message: 'Tỷ lệ chuyển đổi giảm 5% so với tuần trước', time: '3 giờ trước', read: true },
];

// System Activity History - Admin actions
export const systemHistory = [
  { id: 1, adminName: 'Admin Nam', adminAvatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Nam', action: 'create_user', description: 'Đã thêm user mới: Nguyễn Văn An (AFF001)', target: 'Nguyễn Văn An', timestamp: '2024-01-15 17:23:45', ip: '192.168.1.100' },
  { id: 2, adminName: 'Admin Linh', adminAvatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Linh', action: 'update_user', description: 'Đã cập nhật thông tin user: Trần Thị Bình', target: 'Trần Thị Bình', timestamp: '2024-01-15 16:45:12', ip: '192.168.1.101' },
  { id: 3, adminName: 'Admin Nam', adminAvatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Nam', action: 'payout', description: 'Đã thanh toán 3,920,000đ cho Nguyễn Văn An qua Momo', target: 'Nguyễn Văn An', timestamp: '2024-01-15 15:30:00', ip: '192.168.1.100' },
  { id: 4, adminName: 'Admin Linh', adminAvatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Linh', action: 'sync', description: 'Đã đồng bộ dữ liệu từ Shopee - 45 đơn hàng mới', target: 'Shopee API', timestamp: '2024-01-15 14:00:00', ip: '192.168.1.101' },
  { id: 5, adminName: 'Admin Nam', adminAvatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Nam', action: 'delete_user', description: 'Đã xóa user: Trương Văn Test (AFF099)', target: 'Trương Văn Test', timestamp: '2024-01-15 11:20:33', ip: '192.168.1.100' },
  { id: 6, adminName: 'Admin Linh', adminAvatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Linh', action: 'settings', description: 'Đã thay đổi cài đặt hệ thống: Bật thông báo email', target: 'System Settings', timestamp: '2024-01-15 10:15:00', ip: '192.168.1.101' },
  { id: 7, adminName: 'Admin Nam', adminAvatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Nam', action: 'sync', description: 'Đã đồng bộ dữ liệu từ TikTok - 28 đơn hàng mới', target: 'TikTok API', timestamp: '2024-01-15 09:00:00', ip: '192.168.1.100' },
  { id: 8, adminName: 'Admin Linh', adminAvatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Linh', action: 'payout', description: 'Đã thanh toán 3,112,500đ cho Trần Thị Bình qua ZaloPay', target: 'Trần Thị Bình', timestamp: '2024-01-14 16:00:00', ip: '192.168.1.101' },
  { id: 9, adminName: 'Admin Nam', adminAvatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Nam', action: 'create_user', description: 'Đã thêm user mới: Lê Hoàng Cường (AFF003)', target: 'Lê Hoàng Cường', timestamp: '2024-01-14 14:30:00', ip: '192.168.1.100' },
  { id: 10, adminName: 'Admin Linh', adminAvatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Linh', action: 'update_order', description: 'Đã cập nhật trạng thái đơn hàng ORD005 thành Cancelled', target: 'ORD005', timestamp: '2024-01-14 12:45:00', ip: '192.168.1.101' },
];

// System Logs - Technical logs for debugging
export const systemLogs = [
  { id: 1, level: 'info', service: 'API Gateway', message: 'Request completed: GET /api/users - 200 OK', timestamp: '2024-01-15 17:25:00', duration: '45ms' },
  { id: 2, level: 'warning', service: 'Shopee Sync', message: 'Rate limit approaching: 80/100 requests per minute', timestamp: '2024-01-15 17:20:00', duration: null },
  { id: 3, level: 'error', service: 'TikTok API', message: 'Connection timeout after 30s - Retrying...', timestamp: '2024-01-15 17:15:00', duration: '30000ms' },
  { id: 4, level: 'info', service: 'Database', message: 'Query executed: SELECT * FROM users WHERE status = active', timestamp: '2024-01-15 17:10:00', duration: '12ms' },
  { id: 5, level: 'success', service: 'Payout Service', message: 'Payment processed successfully: TXN_123456789', timestamp: '2024-01-15 17:05:00', duration: '1250ms' },
  { id: 6, level: 'info', service: 'Auth Service', message: 'Admin login successful: admin@affiliatehub.vn', timestamp: '2024-01-15 17:00:00', duration: '89ms' },
  { id: 7, level: 'error', service: 'Email Service', message: 'Failed to send email: SMTP connection refused', timestamp: '2024-01-15 16:55:00', duration: null },
  { id: 8, level: 'warning', service: 'Cache', message: 'Cache miss for key: user_stats_daily - Fetching from DB', timestamp: '2024-01-15 16:50:00', duration: '156ms' },
  { id: 9, level: 'info', service: 'Webhook', message: 'Received webhook from Shopee: order_confirmed', timestamp: '2024-01-15 16:45:00', duration: '23ms' },
  { id: 10, level: 'success', service: 'Sync Service', message: 'Shopee sync completed: 45 orders processed', timestamp: '2024-01-15 16:40:00', duration: '8500ms' },
  { id: 11, level: 'info', service: 'API Gateway', message: 'Request completed: POST /api/convert-link - 201 Created', timestamp: '2024-01-15 16:35:00', duration: '67ms' },
  { id: 12, level: 'error', service: 'Validation', message: 'Invalid bank account format: ABC123 for user AFF003', timestamp: '2024-01-15 16:30:00', duration: null },
  { id: 13, level: 'warning', service: 'Memory', message: 'High memory usage detected: 85% of allocated heap', timestamp: '2024-01-15 16:25:00', duration: null },
  { id: 14, level: 'info', service: 'Scheduler', message: 'Cron job started: daily_commission_calculation', timestamp: '2024-01-15 16:20:00', duration: null },
  { id: 15, level: 'success', service: 'Scheduler', message: 'Cron job completed: daily_commission_calculation', timestamp: '2024-01-15 16:22:00', duration: '120000ms' },
];
