const express = require('express');
const http = require('http');
const fs = require('fs');
const { WebSocketServer } = require('ws');
const path = require('path');
const logger = require('./src/logger');
const { handleCommand, getWelcome } = require('./src/commands');
const ZaloBot = require('./src/zalo/zalo-bot');
const messageStore = require('./src/zalo/message-store');
const userCache = require('./src/zalo/user-cache');
const convertLogStore = require('./src/api/convert-log-store');
const orderStore = require('./src/api/order-store');
const payoutStore = require('./src/api/payout-store');
const productImageStore = require('./src/api/product-image-store');
const multer = require('multer');

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

const PORT = 3456;

// Auto-backup DB on startup to prevent data loss
const DB_PATH = path.join(__dirname, 'data/zalo-bot.db');
const BACKUP_DIR = path.join(__dirname, 'data/backups');
try {
  if (fs.existsSync(DB_PATH) && fs.statSync(DB_PATH).size > 4096) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    fs.copyFileSync(DB_PATH, path.join(BACKUP_DIR, `zalo-bot-${stamp}.db`));
    // Keep only the 7 most recent backups
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


app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// CORS for Dashboard dev server
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

// Extension state
let activeExtensionWs = null;
let extensionStatus = { connected: false, lastSeen: null };
const pendingRequests = {};
const reconnectQueue = []; // requests queued while extension is offline

// Drain the reconnect queue + re-dispatch any mid-flight requests that were lost
// when the SW was killed during task execution
function drainReconnectQueue() {
  // 1. Re-dispatch already-sent requests whose SW died mid-execution
  const midFlight = Object.entries(pendingRequests);
  if (midFlight.length > 0) {
    logger.warn('Server', `[Reconnect] Re-dispatching ${midFlight.length} mid-flight request(s) to new SW`);
    for (const [reqId, entry] of midFlight) {
      if (!entry.payload) continue; // no payload stored, can't retry
      clearTimeout(entry.timeout);
      // Reset timeout for 45s from NOW (fresh start)
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

  // 2. Drain queued requests that arrived while extension was offline
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

// Extension router — used by shopee-api to dispatch commands
function sendToExtension(reqId, payload) {
  return new Promise((resolve, reject) => {
    if (!activeExtensionWs || activeExtensionWs.readyState !== 1) {
      // Extension offline — queue request for up to 30s waiting for reconnect
      logger.warn('Server', `Extension offline — queuing request ${reqId} (max 30s wait)`);
      const queueTimer = setTimeout(() => {
        const idx = reconnectQueue.findIndex(r => r.reqId === reqId);
        if (idx !== -1) reconnectQueue.splice(idx, 1);
        reject(new Error('Extension chưa kết nối! Hãy mở tab Shopee Affiliate trên Chrome.'));
      }, 30000);
      reconnectQueue.push({ reqId, payload, resolve, reject, queueTimer });
      return;
    }

    // Store payload so we can re-dispatch if SW dies mid-execution
    pendingRequests[reqId] = {
      resolve,
      reject,
      payload, // ← key: saved for re-dispatch on reconnect
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

// REST API
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
    res.json({ success: true, message: 'Restarting Zalo bot...' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Zalo Monitoring API ────────────────────────────────
app.get('/api/zalo-messages', (req, res) => {
  const count = parseInt(req.query.count) || 50;
  const filter = req.query.filter || 'all';
  res.json(messageStore.getRecent(count, filter));
});

app.get('/api/zalo-users', (req, res) => {
  const top = parseInt(req.query.top);
  if (top) {
    res.json(userCache.getTopUsers(top));
  } else {
    res.json(userCache.getAll());
  }
});

app.get('/api/zalo-stats', (req, res) => {
  const stats = messageStore.getStats();
  stats.userCount = userCache.getUserCount();
  res.json(stats);
});

app.get('/api/zalo-user/:userId', (req, res) => {
  const user = userCache.getUser(req.params.userId);
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

// Dashboard stats overview
app.get('/api/dashboard-stats', (req, res) => {
  const msgStats = messageStore.getStats();
  const convertStats = convertLogStore.getStats();
  const orderStats = orderStore.getStats();
  const todayConvert = convertLogStore.getTodayStats();

  res.json({
    users: { total: userCache.getUserCount() },
    messages: { total: msgStats.total, today: msgStats.today?.total || 0 },
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
app.get('/api/users', (req, res) => {
  const { search, limit = 50, offset = 0 } = req.query;
  if (search) {
    res.json(userCache.search(search, parseInt(limit)));
  } else {
    res.json(userCache.getAllPaginated(parseInt(limit), parseInt(offset)));
  }
});

// Convert Logs API
app.get('/api/convert-logs', (req, res) => {
  const { search, user_id, limit = 50, offset = 0 } = req.query;
  if (search) {
    res.json(convertLogStore.search(search, parseInt(limit)));
  } else if (user_id) {
    res.json(convertLogStore.getByUser(user_id, parseInt(limit)));
  } else {
    res.json(convertLogStore.getRecent(parseInt(limit), parseInt(offset)));
  }
});

app.get('/api/convert-logs/stats', (req, res) => {
  res.json(convertLogStore.getStats());
});

// Orders API
app.get('/api/orders', (req, res) => {
  const { search, status, limit = 200, offset = 0,
    timeField, dateFrom, dateTo, orderId, shopName, shopType,
    productName, commissionType, channel } = req.query;

  // If any advanced filter param is present, use getFiltered
  const hasAdvancedFilter = timeField || dateFrom || dateTo || orderId
    || shopName || shopType || productName || commissionType || channel
    || (status && status !== 'Tất cả');

  if (hasAdvancedFilter) {
    res.json(orderStore.getFiltered({
      timeField, dateFrom, dateTo, status, orderId,
      shopName, shopType, productName, commissionType, channel
    }, parseInt(limit)));
  } else if (search) {
    res.json(orderStore.search(search, parseInt(limit)));
  } else {
    res.json(orderStore.getRecent(parseInt(limit), parseInt(offset)));
  }
});

app.get('/api/orders/filter-options', (req, res) => {
  res.json(orderStore.getFilterOptions());
});

app.get('/api/orders/stats', (req, res) => {
  res.json(orderStore.getStats());
});

// ─── Payout API ─────────────────────────────────────────

// Bill upload storage
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

// Serve bill images
app.use('/api/payouts/bills', express.static(path.join(__dirname, 'data/bills')));

app.get('/api/payouts/summary', (req, res) => {
  res.json(payoutStore.getSummary());
});

app.get('/api/payouts/history', (req, res) => {
  const { limit = 50, offset = 0 } = req.query;
  res.json(payoutStore.getHistory(parseInt(limit), parseInt(offset)));
});

app.get('/api/payouts/user/:userId', (req, res) => {
  const detail = payoutStore.getUserDetail(req.params.userId);
  if (!detail) return res.status(404).json({ error: 'User not found' });
  res.json(detail);
});

app.post('/api/payouts/create', (req, res) => {
  const { userId, userName, role, amount, paymentMethod, adminNote } = req.body;
  if (!userId || !amount || amount <= 0) {
    return res.status(400).json({ error: 'userId and positive amount are required' });
  }
  const id = payoutStore.createPayout({ userId, userName, role, amount, paymentMethod, adminNote });
  if (!id) return res.status(500).json({ error: 'Failed to create payout' });
  res.json({ success: true, payoutId: id });
});

app.post('/api/payouts/upload-bill', billUpload.single('bill'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  const payoutId = req.body.payoutId;
  if (payoutId) {
    payoutStore.updateBill(payoutId, req.file.filename);
  }
  res.json({ success: true, filename: req.file.filename, path: `/api/payouts/bills/${req.file.filename}` });
});

// User cashback rate update
app.patch('/api/users/:userId/cashback-rates', (req, res) => {
  const { buyerRate, referrerRate } = req.body;
  if (buyerRate == null || referrerRate == null) {
    return res.status(400).json({ error: 'buyerRate and referrerRate are required' });
  }
  const result = payoutStore.updateUserRates(req.params.userId, Number(buyerRate), Number(referrerRate));
  res.json(result);
});

// ─── Product Images API ─────────────────────────────────

// Get image map for a list of item_ids (POST to handle large arrays)
app.post('/api/product-images/batch', (req, res) => {
  const { itemIds } = req.body;
  if (!itemIds || !Array.isArray(itemIds)) {
    return res.status(400).json({ error: 'itemIds array required' });
  }
  res.json(productImageStore.getImgMap(itemIds));
});

// Get stats about cached images
app.get('/api/product-images/stats', (req, res) => {
  const cached = productImageStore.getCount();
  const missing = productImageStore.getMissingItems(1000).length;
  res.json({ cached, missing, total: cached + missing });
});

// Manual trigger for image fetch (non-blocking)
app.post('/api/product-images/fetch', async (req, res) => {
  if (!activeExtensionWs || activeExtensionWs.readyState !== 1) {
    return res.status(400).json({ error: 'Extension chưa kết nối' });
  }
  // Start fetch in background, respond immediately
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

    const importResult = orderStore.importCSV(result.csv);
    logger.info('Server', `Orders sync complete: ${importResult.inserted}/${importResult.total} records`);
    res.json({ success: true, fileName: result.fileName, ...importResult });

  } catch (err) {
    logger.error('Server', `Orders sync failed: ${err.message}`);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Orders CSV Upload (manual fallback)
app.post('/api/orders/import-csv', (req, res) => {
  const { csv } = req.body;
  if (!csv) {
    return res.status(400).json({ success: false, error: 'Missing csv field in request body' });
  }
  try {
    const result = orderStore.importCSV(csv);
    logger.info('Server', `CSV import: ${result.inserted}/${result.total} records`);
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

  // Send Zalo message stats + recent messages
  ws.send(JSON.stringify({ type: 'zalo_stats', data: { ...messageStore.getStats(), userCount: userCache.getUserCount() } }));
  ws.send(JSON.stringify({ type: 'zalo_messages_batch', data: messageStore.getRecent(30) }));
  ws.send(JSON.stringify({ type: 'zalo_users', data: userCache.getTopUsers(10) }));

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

      // Extension registration
      if (msg.type === 'register_extension') {
        logger.info('Server', '🔌 Chrome Extension đã kết nối!');
        activeExtensionWs = ws;
        ws.isExtension = true;
        extensionStatus = { connected: true, lastSeen: new Date().toISOString() };
        broadcastExtensionStatus();
        // Drain any queued requests that arrived while extension was offline
        drainReconnectQueue();
        return;
      }

      // Extension keep-alive
      if (msg.type === 'ping') {
        extensionStatus.lastSeen = new Date().toISOString();
        if (ws.readyState === ws.OPEN) ws.send(JSON.stringify({ type: 'pong' }));
        return;
      }

      // Extension automation result
      if (msg.type === 'automation_result') {
        const result = msg.data;
        const reqId = result.reqId;
        if (pendingRequests[reqId]) {
          clearTimeout(pendingRequests[reqId].timeout);
          if (result.success || result.noCommission) {
            // noCommission is a valid business result, not an error
            pendingRequests[reqId].resolve(result);
          } else {
            pendingRequests[reqId].reject(new Error(result.error || 'Automation failed'));
          }
          delete pendingRequests[reqId];
        }
        return;
      }

      // Chat message from Dashboard UI
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
zaloBot.onMessageEvent((entry) => {
  const stats = { ...messageStore.getStats(), userCount: userCache.getUserCount() };
  wss.clients.forEach((client) => {
    if (client.readyState === 1 && !client.isExtension) {
      client.send(JSON.stringify({ type: 'zalo_message', data: entry }));
      client.send(JSON.stringify({ type: 'zalo_stats', data: stats }));
    }
  });
});

// ─── Background Product Image Fetch ─────────────────────
let imageFetchInProgress = false;

async function triggerImageFetch() {
  if (imageFetchInProgress) return;
  if (!activeExtensionWs || activeExtensionWs.readyState !== 1) return;

  // Check if there are orders missing images
  const missing = productImageStore.getMissingItems(1);
  if (missing.length === 0) return;

  imageFetchInProgress = true;
  const reqId = `img_fetch_${Date.now()}`;

  // Time range: 6 months back
  const now = Math.floor(Date.now() / 1000);
  const startTimestamp = now - 180 * 24 * 3600;

  // Get already-cached item_ids to skip
  const allCachedMap = productImageStore.getImgMap([]);
  // We need all cached item_ids — get them from DB
  const db = require('./src/zalo/database');
  const cachedRows = db.prepare('SELECT item_id FROM product_images').all();
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
      const saved = productImageStore.bulkSave(result.images);
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

// Auto-fetch images every 5 minutes (non-blocking, safe)
setInterval(() => {
  triggerImageFetch().catch(() => {});
}, 5 * 60 * 1000);

// Start
server.listen(PORT, () => {
  logger.info('Server', `Running at http://localhost:${PORT}`);
  console.log(`\n🚀 Shopee Affiliate Bot running at \x1b[36mhttp://localhost:${PORT}\x1b[0m`);
  console.log(`⏳ Đang chờ Chrome Extension kết nối...`);

  // Auto-start Zalo bot
  console.log(`🤖 Đang khởi tạo Zalo Bot...\n`);
  zaloBot.start().catch((err) => {
    logger.error('Server', `Zalo Bot startup failed: ${err.message}`);
    console.log(`\n⚠️ Zalo Bot chưa khởi động. Truy cập Dashboard để xem mã QR hoặc gõ /api/zalo-restart.\n`);
  });

  // First image fetch after 30s (give extension time to connect)
  setTimeout(() => {
    triggerImageFetch().catch(() => {});
  }, 30000);
});
