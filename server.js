require('dotenv').config();
const express = require('express');
const http = require('http');
const fs = require('fs');
const { WebSocketServer } = require('ws');
const path = require('path');
const cookieParser = require('cookie-parser');
const logger = require('./src/logger');
const { handleCommand, getWelcome } = require('./src/commands');
const ZaloBot = require('./src/zalo/zalo-bot');
const messageStore = require('./src/zalo/message-store');
const userCache = require('./src/zalo/user-cache');
const convertLogStore = require('./src/api/convert-log-store');
const orderStore = require('./src/api/order-store');
const payoutStore = require('./src/api/payout-store');
const simulateStore = require('./src/api/simulate-store');
const productImageStore = require('./src/api/product-image-store');
const reportDashboardStore = require('./src/api/report-dashboard-store');
const db = require('./src/db');
const { runMigrations } = require('./src/db/migrations');
const multer = require('multer');
const authStore = require('./src/auth/auth-store');
const { requireAuth, signToken, JWT_COOKIE } = require('./src/auth/middleware');
const auditStore = require('./src/audit/audit-store');
const reportGenerator = require('./src/stats/report-generator');
const reportStore = require('./src/stats/report-store');
const { renderReport } = require('./src/stats/report-template');
const healthMonitor = require('./src/cron/health-monitor');

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

const PORT = 3456;

// Auto-backup DB on startup (SQLite only)
if (db.type === 'sqlite') {
  const DB_PATH = path.join(__dirname, 'data/zalo-bot.db');
  const BACKUP_DIR = path.join(__dirname, 'data/backups');
  try {
    if (fs.existsSync(DB_PATH) && fs.statSync(DB_PATH).size > 4096) {
      fs.mkdirSync(BACKUP_DIR, { recursive: true });
      const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      fs.copyFileSync(DB_PATH, path.join(BACKUP_DIR, `zalo-bot-${stamp}.db`));
      const backups = fs.readdirSync(BACKUP_DIR)
        .filter(f => f.endsWith('.db'))
        .sort()
        .reverse();
      backups.slice(7).forEach(f => fs.unlinkSync(path.join(BACKUP_DIR, f)));
      console.log(`[INFO] Server: DB backed up → backups/zalo-bot-${stamp}.db`);
    }
  } catch (e) {
    console.warn('[WARN] Server: Could not create DB backup:', e.message);
  }
}

app.use(express.json({ limit: '10mb' }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

// CORS for Dashboard dev server
app.use((req, res, next) => {
  const origin = req.headers.origin || '*';
  res.header('Access-Control-Allow-Origin', origin);
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Credentials', 'true');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

// Extension state
let activeExtensionWs = null;
let extensionStatus = { connected: false, lastSeen: null };
const pendingRequests = {};
const reconnectQueue = [];

function drainReconnectQueue() {
  const midFlight = Object.entries(pendingRequests);
  if (midFlight.length > 0) {
    logger.warn('Server', `[Reconnect] Re-dispatching ${midFlight.length} mid-flight request(s) to new SW`);
    for (const [reqId, entry] of midFlight) {
      if (!entry.payload) continue;
      clearTimeout(entry.timeout);
      entry.timeout = setTimeout(() => {
        delete pendingRequests[reqId];
        entry.reject(new Error('Extension không phản hồi (timeout 45s sau reconnect)'));
      }, 45000);
      try {
        activeExtensionWs.send(JSON.stringify({
          type: 'execute_automation',
          data: { reqId, ...entry.payload },
        }));
        logger.info('Server', `[Reconnect] Re-dispatched mid-flight reqId=${reqId}`);
      } catch (e) {
        clearTimeout(entry.timeout);
        delete pendingRequests[reqId];
        entry.reject(new Error('Extension reconnect re-dispatch failed'));
      }
    }
  }

  while (reconnectQueue.length > 0) {
    const { reqId, payload, resolve, reject, queueTimer } = reconnectQueue.shift();
    clearTimeout(queueTimer);
    pendingRequests[reqId] = {
      resolve,
      reject,
      payload,
      timeout: setTimeout(() => {
        delete pendingRequests[reqId];
        reject(new Error('Extension không phản hồi (timeout 45s)'));
      }, 45000),
    };
    try {
      activeExtensionWs.send(JSON.stringify({
        type: 'execute_automation',
        data: { reqId, ...payload },
      }));
      logger.info('Server', `[Queue] Dispatched queued request ${reqId} after reconnect`);
    } catch (e) {
      clearTimeout(pendingRequests[reqId].timeout);
      delete pendingRequests[reqId];
      reject(new Error('Extension reconnect dispatch failed'));
    }
  }
}

function sendToExtension(reqId, payload) {
  return new Promise((resolve, reject) => {
    if (!activeExtensionWs || activeExtensionWs.readyState !== 1) {
      logger.warn('Server', `Extension offline — queuing request ${reqId} (max 30s wait)`);
      const queueTimer = setTimeout(() => {
        const idx = reconnectQueue.findIndex(r => r.reqId === reqId);
        if (idx !== -1) reconnectQueue.splice(idx, 1);
        reject(new Error('Extension chưa kết nối! Hãy mở tab Shopee Affiliate trên Chrome.'));
      }, 30000);
      reconnectQueue.push({ reqId, payload, resolve, reject, queueTimer });
      return;
    }

    pendingRequests[reqId] = {
      resolve,
      reject,
      payload,
      timeout: setTimeout(() => {
        delete pendingRequests[reqId];
        reject(new Error('Extension không phản hồi (timeout 45s)'));
      }, 45000),
    };

    activeExtensionWs.send(JSON.stringify({
      type: 'execute_automation',
      data: { reqId, ...payload },
    }));
  });
}

// Zalo Bot instance
const zaloBot = new ZaloBot();

// ═══════════════════════════════════════════════════════
// PUBLIC ROUTES (no auth required)
// ═══════════════════════════════════════════════════════

// ─── Stat Report (public) ─────────────────────────────
app.get('/s/:token', async (req, res) => {
  try {
    const report = await reportStore.getReport(req.params.token);
    if (!report) return res.status(404).send('<!DOCTYPE html><html><head><meta charset="UTF-8"><title>404</title><style>body{background:#0f172a;color:#94a3b8;display:flex;align-items:center;justify-content:center;height:100vh;font-family:sans-serif;flex-direction:column}h1{font-size:48px;color:#f8fafc}p{margin-top:8px}</style></head><body><h1>404</h1><p>Link đã hết hạn hoặc không tồn tại</p></body></html>');
    const html = renderReport(report.data);
    res.type('html').send(html);
  } catch (err) {
    logger.error('Report', `Error rendering report: ${err.message}`);
    res.status(500).send('Internal error');
  }
});

// ─── Auth Routes (login is public) ────────────────────
app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password, remember } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Username và password là bắt buộc' });

    const admin = await authStore.validateLogin(username, password);
    if (!admin) return res.status(401).json({ error: 'Sai tên đăng nhập hoặc mật khẩu' });

    const token = signToken(
      { username: admin.username, displayName: admin.displayName },
      !!remember
    );

    res.cookie(JWT_COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: remember ? 7 * 24 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000,
    });

    await auditStore.log(admin.username, 'LOGIN', 'auth', '', {}, req.ip);

    res.json({
      username: admin.username,
      displayName: admin.displayName,
      mustChangePassword: admin.mustChangePassword,
    });
  } catch (err) {
    logger.error('Auth', `Login error: ${err.message}`);
    res.status(500).json({ error: 'Server error' });
  }
});

// ═══════════════════════════════════════════════════════
// AUTH MIDDLEWARE — protects all /api/* below this point
// ═══════════════════════════════════════════════════════
app.use('/api', requireAuth);

// ─── Authenticated Auth Routes ────────────────────────
app.post('/api/auth/logout', async (req, res) => {
  await auditStore.log(req.admin.username, 'LOGOUT', 'auth', '', {}, req.ip);
  res.clearCookie(JWT_COOKIE);
  res.json({ ok: true });
});

app.get('/api/auth/me', async (req, res) => {
  const admin = await authStore.getAdmin(req.admin.username);
  if (!admin) return res.status(404).json({ error: 'Admin not found' });
  res.json(admin);
});

app.patch('/api/auth/change-password', async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body;
    if (!oldPassword || !newPassword) return res.status(400).json({ error: 'Thiếu thông tin' });
    if (newPassword.length < 6) return res.status(400).json({ error: 'Mật khẩu mới phải ít nhất 6 ký tự' });
    await authStore.changePassword(req.admin.username, oldPassword, newPassword);
    await auditStore.log(req.admin.username, 'CHANGE_PASSWORD', 'auth', '', {}, req.ip);
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ─── Audit Log Routes ─────────────────────────────────
app.get('/api/audit-logs', async (req, res) => {
  const { limit = 50, offset = 0, action, admin, resourceType, dateFrom, dateTo } = req.query;
  const result = await auditStore.getRecent(
    parseInt(limit), parseInt(offset),
    { action, admin, resourceType, dateFrom, dateTo }
  );
  res.json(result);
});

app.get('/api/audit-logs/stats', async (req, res) => {
  const stats = await auditStore.getStats();
  res.json(stats);
});

app.get('/api/audit-logs/admins', async (req, res) => {
  const admins = await auditStore.getAdminList();
  res.json(admins);
});

// ═══════════════════════════════════════════════════════
// REST API — All async for database adapter compatibility
// ═══════════════════════════════════════════════════════

app.get('/api/status', (req, res) => {
  res.json({ extension: extensionStatus, zalo: zaloBot.getStatus() });
});

app.get('/api/logs', (req, res) => {
  const count = parseInt(req.query.count) || 50;
  res.json(logger.getRecent(count));
});

// Zalo Bot API
app.get('/api/zalo-status', (req, res) => {
  res.json(zaloBot.getStatus());
});

app.get('/api/zalo-qr', (req, res) => {
  const qrPath = path.join(__dirname, 'public/zalo-qr.png');
  if (fs.existsSync(qrPath)) {
    res.sendFile(qrPath);
  } else {
    res.status(404).json({ error: 'QR not available yet' });
  }
});

app.post('/api/zalo-restart', async (req, res) => {
  try {
    await zaloBot.stop();
    zaloBot.start().catch((err) => logger.error('Server', `Zalo restart failed: ${err.message}`));
    await auditStore.log(req.admin?.username || 'system', 'ZALO_RESTART', 'zalo', '', {}, req.ip);
    res.json({ success: true, message: 'Restarting Zalo bot...' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Zalo Monitoring API ────────────────────────────────
app.get('/api/zalo-messages', async (req, res) => {
  const count = parseInt(req.query.count) || 50;
  const filter = req.query.filter || 'all';
  res.json(await messageStore.getRecent(count, filter));
});

app.get('/api/zalo-users', async (req, res) => {
  const top = parseInt(req.query.top);
  if (top) {
    res.json(await userCache.getTopUsers(top));
  } else {
    res.json(await userCache.getAll());
  }
});

app.get('/api/zalo-stats', async (req, res) => {
  const stats = await messageStore.getStats();
  stats.userCount = await userCache.getUserCount();
  res.json(stats);
});

app.get('/api/zalo-user/:userId', async (req, res) => {
  const user = await userCache.getUser(req.params.userId);
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json(user);
});

app.get('/api/zalo-user-fetch/:userId', async (req, res) => {
  const userId = req.params.userId;
  const user = await userCache.fetchAndSave(userId);
  if (!user) return res.status(404).json({ error: 'Failed to fetch user from Zalo API' });
  res.json(user);
});

// ═══════════════════════════════════════════════════════
// REST API — Dashboard
// ═══════════════════════════════════════════════════════

app.get('/api/dashboard-stats', async (req, res) => {
  const [msgStats, convertStats, orderStats, todayConvert, userCount] = await Promise.all([
    messageStore.getStats(),
    convertLogStore.getStats(),
    orderStore.getStats(),
    convertLogStore.getTodayStats(),
    userCache.getUserCount(),
  ]);

  res.json({
    users: { total: userCount },
    messages: { total: msgStats.allTime?.total || 0, today: msgStats.today?.total || 0 },
    converts: {
      total: convertStats.total || 0,
      success: convertStats.success || 0,
      failed: convertStats.failed || 0,
      totalCommission: convertStats.totalCommission || 0,
      avgRate: convertStats.avgRate || 0,
      uniqueUsers: convertStats.uniqueUsers || 0,
      today: todayConvert.total || 0,
      todaySuccess: todayConvert.success || 0,
    },
    orders: {
      total: orderStats.totalOrders || 0,
      uniqueOrders: orderStats.uniqueOrders || 0,
      totalValue: orderStats.totalOrderValue || 0,
      totalCommission: orderStats.totalCommission || 0,
      totalCommissionNew: orderStats.totalCommissionNew || 0,
      uniqueShops: orderStats.uniqueShops || 0,
      uniqueBuyers: orderStats.uniqueBuyers || 0,
    },
    extension: extensionStatus,
    zalo: zaloBot.getStatus(),
  });
});

// Users API (paginated + search)
app.get('/api/users', async (req, res) => {
  const { search, limit = 100, offset = 0 } = req.query;
  const lim = Math.min(parseInt(limit) || 100, 500);
  const off = parseInt(offset) || 0;
  if (search) {
    const q = `%${search}%`;
    const rows = await db.all(`
      SELECT u.*, r.avatar as referrer_avatar
      FROM users u
      LEFT JOIN users r ON u.referrer_id = r.user_id
      WHERE u.display_name LIKE ? OR u.zalo_name LIKE ? OR u.user_id LIKE ?
      ORDER BY u.last_seen DESC LIMIT ?
    `, [q, q, q, lim]);
    return res.json(rows);
  }
  const rows = await db.all(`
    SELECT u.*, r.avatar as referrer_avatar
    FROM users u
    LEFT JOIN users r ON u.referrer_id = r.user_id
    ORDER BY u.last_seen DESC LIMIT ? OFFSET ?
  `, [lim, off]);
  res.json(rows);
});

// Convert Logs API
app.get('/api/convert-logs', async (req, res) => {
  const { search, user_id, limit = 50, offset = 0 } = req.query;
  if (search) {
    res.json(await convertLogStore.search(search, parseInt(limit)));
  } else if (user_id) {
    res.json(await convertLogStore.getByUser(user_id, parseInt(limit)));
  } else {
    res.json(await convertLogStore.getRecent(parseInt(limit), parseInt(offset)));
  }
});

app.get('/api/convert-logs/stats', async (req, res) => {
  res.json(await convertLogStore.getStats());
});

// Orders API
app.get('/api/orders', async (req, res) => {
  const { search, status, limit = 200, offset = 0,
    timeField, dateFrom, dateTo, orderId, shopName, shopType,
    productName, commissionType, channel } = req.query;

  const hasAdvancedFilter = timeField || dateFrom || dateTo || orderId
    || shopName || shopType || productName || commissionType || channel
    || (status && status !== 'Tất cả');

  if (hasAdvancedFilter) {
    res.json(await orderStore.getFiltered({
      timeField, dateFrom, dateTo, status, orderId,
      shopName, shopType, productName, commissionType, channel
    }, parseInt(limit)));
  } else if (search) {
    res.json(await orderStore.search(search, parseInt(limit)));
  } else {
    res.json(await orderStore.getRecent(parseInt(limit), parseInt(offset)));
  }
});

app.get('/api/orders/filter-options', async (req, res) => {
  res.json(await orderStore.getFilterOptions());
});

app.get('/api/orders/stats', async (req, res) => {
  res.json(await orderStore.getStats());
});

// ─── Report Dashboard API ───────────────────────────────
app.get('/api/reports/dashboard', async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 30;
    const data = await reportDashboardStore.getDashboardReports(days);
    res.json(data);
  } catch (err) {
    logger.error('Reports', `Dashboard report failed: ${err.message}`);
    res.status(500).json({ error: 'Failed to generate report' });
  }
});

// ─── Payout API ─────────────────────────────────────────

const billUpload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      const dir = path.join(__dirname, 'data/bills');
      fs.mkdirSync(dir, { recursive: true });
      cb(null, dir);
    },
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname) || '.png';
      cb(null, `bill-${Date.now()}${ext}`);
    },
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
});

app.use('/api/payouts/bills', express.static(path.join(__dirname, 'data/bills')));

app.get('/api/payouts/summary', async (req, res) => {
  res.json(await payoutStore.getSummary());
});

app.get('/api/payouts/history', async (req, res) => {
  const { limit = 50, offset = 0 } = req.query;
  res.json(await payoutStore.getHistory(parseInt(limit), parseInt(offset)));
});

app.get('/api/payouts/user/:userId', async (req, res) => {
  const detail = await payoutStore.getUserDetail(req.params.userId);
  if (!detail) return res.status(404).json({ error: 'User not found' });
  res.json(detail);
});

app.post('/api/payouts/create', async (req, res) => {
  const { userId, role, paymentMethod, adminNote, billImage } = req.body;
  if (!userId || !role) {
    return res.status(400).json({ error: 'userId and role are required' });
  }

  // Server-side calculation: atomically find unpaid orders + create payout
  const result = await payoutStore.calculateServerPayout(userId, role, paymentMethod, adminNote, billImage);

  if (!result) return res.status(500).json({ error: 'Failed to create payout' });
  if (result.error || result.amount <= 0) {
    return res.status(400).json({ error: result.error || 'No unpaid orders found' });
  }

  const orderCount = role === 'combined' 
    ? ((result.buyerPayout?.paidOrders?.length || 0) + (result.referrerPayout?.paidOrders?.length || 0))
    : (result.paidOrders?.length || 0);

  const payoutId = role === 'combined' 
    ? `${result.buyerPayout?.payoutId || ''},${result.referrerPayout?.payoutId || ''}`.replace(/^,|,$/g, '') 
    : String(result.payoutId);

  await auditStore.log(req.admin?.username || 'system', 'CREATE_PAYOUT', 'payout', payoutId, { userId, amount: result.amount, role }, req.ip);
  res.json({ success: true, payoutId, amount: result.amount, orderCount });
});

app.post('/api/payouts/upload-bill', billUpload.single('bill'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  const payoutId = req.body.payoutId;
  if (payoutId) {
    await payoutStore.updateBill(payoutId, req.file.filename);
    await auditStore.log(req.admin?.username || 'system', 'UPDATE_BILL', 'payout', payoutId, { filename: req.file.filename }, req.ip);
  }
  res.json({ success: true, filename: req.file.filename, path: `/api/payouts/bills/${req.file.filename}` });
});

app.patch('/api/users/:userId/cashback-rates', async (req, res) => {
  const { referrerRate } = req.body;
  if (referrerRate == null) {
    return res.status(400).json({ error: 'referrerRate is required' });
  }
  const result = await payoutStore.updateUserReferrerRate(req.params.userId, Number(referrerRate));
  await auditStore.log(req.admin?.username || 'system', 'UPDATE_USER_RATES', 'user', req.params.userId, { referrerRate }, req.ip);
  res.json(result);
});

app.patch('/api/users/:userId/bank-info', async (req, res) => {
  const { bankName, bankAccount } = req.body;
  if (!bankName || !bankAccount) {
    return res.status(400).json({ error: 'bankName and bankAccount are required' });
  }
  // Generate VietQR URL
  const qrCode = `https://img.vietqr.io/image/${encodeURIComponent(bankName)}-${encodeURIComponent(bankAccount)}-compact2.jpg`;
  const ok = await userCache.updateBankInfo(req.params.userId, bankName, bankAccount, qrCode);
  if (!ok) return res.status(500).json({ error: 'Failed to update bank info' });
  await auditStore.log(req.admin?.username || 'system', 'UPDATE_BANK_INFO', 'user', req.params.userId, { bankName, bankAccount }, req.ip);
  res.json({ success: true, qrCode });
});

// ─── Simulate Order API ─────────────────────────────────
app.get('/api/users/select', async (req, res) => {
  const users = await db.all(`
    SELECT user_id, display_name, zalo_name, avatar, referrer_id, referrer_name,
           cashback_buyer_rate, cashback_referrer_rate
    FROM users ORDER BY display_name ASC
  `);
  res.json(users);
});

app.post('/api/shopee/extract', async (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: 'url required' });
  try {
    const ShopeeAPI = require('./src/shopee-api');
    const api = new ShopeeAPI();
    const result = await api.checkAndConvert(url, { sub1: 'sim', sub2: 'sim', sub3: 'sim' });
    if (!result.success) return res.json({ success: false, error: result.error || 'Không lấy được thông tin' });
    res.json({
      success: true,
      productName: result.productName || '',
      price: result.price || 0,
      commissionRate: result.commission || 0,
      itemId: result.itemId || '',
      shopId: result.shopId || '',
    });
  } catch (err) {
    res.json({ success: false, error: err.message });
  }
});

app.post('/api/orders/simulate', async (req, res) => {
  const { itemId, itemName, shopId, shopName, price, quantity, commissionRate, status, subId1, subId2, orderTime, completeTime } = req.body;
  if (!subId1) {
    return res.status(400).json({ error: 'subId1 (buyer) is required' });
  }
  const result = await simulateStore.createOrder({
    itemId, itemName, shopId, shopName, price: Number(price), quantity: Number(quantity || 1),
    commissionRate: Number(commissionRate || 0), status, subId1, subId2: subId2 || '',
    orderTime, completeTime,
  });
  if (result.success) {
    await auditStore.log(req.admin?.username || 'system', 'SIMULATE_ORDER', 'order', result.orderId, req.body, req.ip);
  }
  res.json(result);
});

// ─── Product Images API ─────────────────────────────────

app.post('/api/product-images/batch', async (req, res) => {
  const { itemIds } = req.body;
  if (!itemIds || !Array.isArray(itemIds)) {
    return res.status(400).json({ error: 'itemIds array required' });
  }
  res.json(await productImageStore.getImgMap(itemIds));
});

app.get('/api/product-images/stats', async (req, res) => {
  const cached = await productImageStore.getCount();
  const missing = await productImageStore.getMissingItems(1000);
  res.json({ cached, missing: missing.length, total: cached + missing.length });
});

app.post('/api/product-images/fetch', async (req, res) => {
  if (!activeExtensionWs || activeExtensionWs.readyState !== 1) {
    return res.status(400).json({ error: 'Extension chưa kết nối' });
  }
  triggerImageFetch();
  res.json({ success: true, message: 'Image fetch started in background' });
});

// Orders Sync — trigger Extension to fetch from Shopee
app.post('/api/orders/sync', async (req, res) => {
  const reqId = `sync_orders_${Date.now()}`;
  const now = Math.floor(Date.now() / 1000);
  const startTimestamp = req.body.startTimestamp || now - 66 * 24 * 3600;
  const endTimestamp = req.body.endTimestamp || now;

  try {
    const result = await new Promise((resolve, reject) => {
      if (!activeExtensionWs || activeExtensionWs.readyState !== 1) {
        return reject(new Error('Extension chưa kết nối! Hãy mở tab Shopee Affiliate trên Chrome.'));
      }

      pendingRequests[reqId] = {
        resolve,
        reject,
        timeout: setTimeout(() => {
          delete pendingRequests[reqId];
          reject(new Error('Sync timeout (90s). Try again later.'));
        }, 90000),
      };

      activeExtensionWs.send(JSON.stringify({
        type: 'execute_automation',
        data: { reqId, action: 'sync_orders', payload: { startTimestamp, endTimestamp } },
      }));
    });

    if (!result.success) {
      return res.status(400).json({ success: false, error: result.error });
    }

    const importResult = await orderStore.importCSV(result.csv);
    logger.info('Server', `Orders sync complete: ${importResult.inserted}/${importResult.total} records`);
    await auditStore.log(req.admin?.username || 'system', 'SYNC_ORDERS', 'order', '', { inserted: importResult.inserted, total: importResult.total }, req.ip);
    res.json({ success: true, fileName: result.fileName, ...importResult });

  } catch (err) {
    logger.error('Server', `Orders sync failed: ${err.message}`);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Orders CSV Upload (manual fallback)
app.post('/api/orders/import-csv', async (req, res) => {
  const { csv } = req.body;
  if (!csv) {
    return res.status(400).json({ success: false, error: 'Missing csv field in request body' });
  }
  try {
    const result = await orderStore.importCSV(csv);
    logger.info('Server', `CSV import: ${result.inserted}/${result.total} records`);
    await auditStore.log(req.admin?.username || 'system', 'IMPORT_CSV', 'order', '', { inserted: result.inserted, total: result.total }, req.ip);
    res.json({ success: true, ...result });
  } catch (err) {
    logger.error('Server', `CSV import failed: ${err.message}`);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Expose extension router globally for shopee-api
const ShopeeAPI = require('./src/shopee-api');
ShopeeAPI.sendToExtension = sendToExtension;

// WebSocket handling
wss.on('connection', (ws) => {
  logger.info('WebSocket', 'Client connected');

  // Send welcome
  ws.send(JSON.stringify({ type: 'bot_message', data: getWelcome() }));

  // Send extension status
  ws.send(JSON.stringify({ type: 'extension_status', data: extensionStatus }));

  // Send Zalo bot status
  ws.send(JSON.stringify({ type: 'zalo_status', data: zaloBot.getStatus() }));

  // Send recent logs
  ws.send(JSON.stringify({ type: 'logs_batch', data: logger.getRecent(30) }));

  // Send async data after connection
  (async () => {
    try {
      const [stats, messages, topUsers] = await Promise.all([
        messageStore.getStats().then(async s => ({ ...s, userCount: await userCache.getUserCount() })),
        messageStore.getRecent(30),
        userCache.getTopUsers(10),
      ]);
      if (ws.readyState === ws.OPEN) {
        ws.send(JSON.stringify({ type: 'zalo_stats', data: stats }));
        ws.send(JSON.stringify({ type: 'zalo_messages_batch', data: messages }));
        ws.send(JSON.stringify({ type: 'zalo_users', data: topUsers }));
      }
    } catch (err) {
      logger.warn('WebSocket', `Init data send failed: ${err.message}`);
    }
  })();

  // Subscribe to log updates
  const unsubLog = logger.subscribe((entry) => {
    if (ws.readyState === ws.OPEN) {
      ws.send(JSON.stringify({ type: 'log_entry', data: entry }));
    }
  });

  // Handle incoming messages
  ws.on('message', async (data) => {
    try {
      const msg = JSON.parse(data.toString());

      if (msg.type === 'register_extension') {
        logger.info('Server', '🔌 Chrome Extension đã kết nối!');
        activeExtensionWs = ws;
        ws.isExtension = true;
        extensionStatus = { connected: true, lastSeen: new Date().toISOString() };
        broadcastExtensionStatus();
        drainReconnectQueue();
        return;
      }

      if (msg.type === 'ping') {
        extensionStatus.lastSeen = new Date().toISOString();
        if (ws.readyState === ws.OPEN) ws.send(JSON.stringify({ type: 'pong' }));
        return;
      }

      if (msg.type === 'automation_result') {
        const result = msg.data;
        const reqId = result.reqId;
        if (pendingRequests[reqId]) {
          clearTimeout(pendingRequests[reqId].timeout);
          if (result.success || result.noCommission) {
            pendingRequests[reqId].resolve(result);
          } else {
            pendingRequests[reqId].reject(new Error(result.error || 'Automation failed'));
          }
          delete pendingRequests[reqId];
        }
        return;
      }

      if (msg.type === 'user_message') {
        const userText = msg.content;
        logger.info('Chat', `User: ${userText}`);

        ws.send(JSON.stringify({ type: 'bot_typing', data: true }));
        const response = await handleCommand(userText);
        ws.send(JSON.stringify({ type: 'bot_typing', data: false }));
        ws.send(JSON.stringify({ type: 'bot_message', data: response }));
      }
    } catch (err) {
      logger.error('WebSocket', `Message error: ${err.message}`);
      ws.send(JSON.stringify({
        type: 'bot_message',
        data: { type: 'text', content: `❌ Lỗi hệ thống: ${err.message}` },
      }));
    }
  });

  ws.on('close', () => {
    unsubLog();
    if (ws.isExtension) {
      logger.warn('WebSocket', '🔌 Chrome Extension ngắt kết nối!');
      activeExtensionWs = null;
      extensionStatus = { connected: false, lastSeen: extensionStatus.lastSeen };
      broadcastExtensionStatus();
    } else {
      logger.info('WebSocket', 'Dashboard UI disconnected');
    }
  });
});

function broadcastExtensionStatus() {
  wss.clients.forEach((client) => {
    if (client.readyState === client.OPEN) {
      client.send(JSON.stringify({ type: 'extension_status', data: extensionStatus }));
    }
  });
}

// Broadcast Zalo status to all dashboard clients
zaloBot.onStatusChange((data) => {
  wss.clients.forEach((client) => {
    if (client.readyState === 1) {
      client.send(JSON.stringify({ type: 'zalo_status', data }));
    }
  });
});

// Broadcast real-time message events to dashboard
zaloBot.onMessageEvent(async (entry) => {
  try {
    const stats = await messageStore.getStats();
    stats.userCount = await userCache.getUserCount();
    wss.clients.forEach((client) => {
      if (client.readyState === 1 && !client.isExtension) {
        client.send(JSON.stringify({ type: 'zalo_message', data: entry }));
        client.send(JSON.stringify({ type: 'zalo_stats', data: stats }));
      }
    });
  } catch (err) {
    logger.warn('Server', `Broadcast message event failed: ${err.message}`);
  }
});

// ─── Background Product Image Fetch ─────────────────────
let imageFetchInProgress = false;

async function triggerImageFetch() {
  if (imageFetchInProgress) return;
  if (!activeExtensionWs || activeExtensionWs.readyState !== 1) return;

  const missing = await productImageStore.getMissingItems(1);
  if (missing.length === 0) return;

  imageFetchInProgress = true;
  const reqId = `img_fetch_${Date.now()}`;

  const now = Math.floor(Date.now() / 1000);
  const startTimestamp = now - 180 * 24 * 3600;

  // Get cached item IDs to skip
  const cachedRows = await db.all('SELECT item_id FROM product_images');
  const knownItemIds = cachedRows.map(r => r.item_id);

  logger.info('ProductImages', `Starting background fetch (${knownItemIds.length} already cached, ${missing.length}+ missing)`);

  try {
    const result = await new Promise((resolve, reject) => {
      pendingRequests[reqId] = {
        resolve,
        reject,
        timeout: setTimeout(() => {
          delete pendingRequests[reqId];
          reject(new Error('Image fetch timeout (120s)'));
        }, 120000),
      };

      activeExtensionWs.send(JSON.stringify({
        type: 'execute_automation',
        data: {
          reqId,
          action: 'fetch_product_images',
          payload: { startTimestamp, endTimestamp: now, knownItemIds },
        },
      }));
    });

    if (result.success && result.images?.length > 0) {
      const saved = await productImageStore.bulkSave(result.images);
      logger.info('ProductImages', `Cached ${saved} new product images (${result.totalPages} pages, ${result.totalFetched} conversions)`);
    } else if (result.success) {
      logger.info('ProductImages', 'No new images found');
    } else {
      logger.warn('ProductImages', `Fetch returned error: ${result.error}`);
    }
  } catch (err) {
    logger.warn('ProductImages', `Background fetch failed: ${err.message}`);
  } finally {
    imageFetchInProgress = false;
  }
}

// Auto-fetch images every 5 minutes
setInterval(() => {
  triggerImageFetch().catch(() => {});
}, 5 * 60 * 1000);

// ─── SPA Catch-all Route ─────────────────────────────────
app.get('/zalo-scan', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'zalo.html'));
});

app.use((req, res, next) => {
  if (req.method === 'GET' && !req.path.startsWith('/api/')) {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
  } else {
    next();
  }
});

// ─── Cleanup Crons ───────────────────────────────────────
// Audit logs: delete older than 6 months (run daily)
setInterval(() => auditStore.cleanup(6).catch(() => {}), 24 * 60 * 60 * 1000);
// Stat reports: delete expired (run hourly)
setInterval(() => reportStore.cleanup().catch(() => {}), 60 * 60 * 1000);

// ─── Start ──────────────────────────────────────────────
async function start() {
  // Run database migrations
  await runMigrations(db);
  logger.info('Server', 'Database migrations complete');

  // Initial cleanup
  auditStore.cleanup(6).catch(() => {});
  reportStore.cleanup().catch(() => {});

  server.listen(PORT, () => {
    logger.info('Server', `Running at http://localhost:${PORT}`);
    console.log(`\n🚀 Shopee Affiliate Bot running at \x1b[36mhttp://localhost:${PORT}\x1b[0m`);
    console.log(`⏳ Đang chờ Chrome Extension kết nối...`);

    console.log(`🤖 Đang khởi tạo Zalo Bot...\n`);
    zaloBot.start().catch((err) => {
      logger.error('Server', `Zalo Bot startup failed: ${err.message}`);
      console.log(`\n⚠️ Zalo Bot chưa khởi động. Truy cập Dashboard để xem mã QR hoặc gõ /api/zalo-restart.\n`);
    });

    setTimeout(() => {
      triggerImageFetch().catch(() => {});
    }, 30000);
    
    healthMonitor.startMonitor();
  });
}

// ─── Crash Protection ────────────────────────────────────
process.on('uncaughtException', (err) => {
  logger.error('FATAL', `Uncaught Exception: ${err.message}\n${err.stack}`);
  console.error('[FATAL] Uncaught Exception:', err);
  // Attempt to send email before exiting
  const { sendMail } = require('./src/utils/mailer');
  sendMail(
    process.env.NOTIFY_EMAILS,
    '💀 [Shopee Ext] Server CRASH - Uncaught Exception',
    `Server bị crash do lỗi không xử lý được.\n\nLỗi: ${err.message}\n\nStack:\n${err.stack}\n\nThời gian: ${new Date().toLocaleString('vi-VN')}`
  ).catch(() => {}).finally(() => process.exit(1));
});

process.on('unhandledRejection', (reason) => {
  const msg = reason instanceof Error ? reason.message : String(reason);
  const stack = reason instanceof Error ? reason.stack : '';
  logger.error('FATAL', `Unhandled Rejection: ${msg}`);
  console.error('[FATAL] Unhandled Rejection:', reason);
  // Don't exit — just log and notify so the server keeps running
  const { sendMail } = require('./src/utils/mailer');
  sendMail(
    process.env.NOTIFY_EMAILS,
    '⚠️ [Shopee Ext] Unhandled Promise Rejection',
    `Server gặp lỗi Promise không được xử lý (server vẫn chạy).\n\nLỗi: ${msg}\n\nStack:\n${stack}\n\nThời gian: ${new Date().toLocaleString('vi-VN')}`
  ).catch(() => {});
});

// ─── Graceful Shutdown ───────────────────────────────────
async function gracefulShutdown(signal) {
  logger.info('Server', `${signal} received. Shutting down gracefully...`);
  console.log(`\n🛑 ${signal} — shutting down...`);

  healthMonitor.stopMonitor();

  // Close WebSocket connections
  wss.clients.forEach((client) => {
    try { client.close(1001, 'Server shutting down'); } catch {}
  });

  // Close HTTP server (stop accepting new connections)
  server.close(() => {
    logger.info('Server', 'HTTP server closed.');
  });

  // Close DB pool
  try {
    await db.close();
    logger.info('Server', 'Database pool closed.');
  } catch {}

  // Force exit after 5 seconds if cleanup hangs
  setTimeout(() => {
    console.error('⚠️ Forced exit after 5s timeout');
    process.exit(1);
  }, 5000).unref();

  process.exit(0);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

start().catch((err) => {
  console.error('Fatal startup error:', err);
  process.exit(1);
});
