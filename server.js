const express = require('express');
const http = require('http');
const { WebSocketServer } = require('ws');
const path = require('path');
const logger = require('./src/logger');
const { handleCommand, getWelcome } = require('./src/commands');

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

const PORT = 3456;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Extension state
let activeExtensionWs = null;
let extensionStatus = { connected: false, lastSeen: null };
const pendingRequests = {};

// Extension router — used by shopee-api to dispatch commands
function sendToExtension(reqId, payload) {
  return new Promise((resolve, reject) => {
    if (!activeExtensionWs || activeExtensionWs.readyState !== 1) {
      return reject(new Error('Extension chưa kết nối! Hãy mở tab Shopee Affiliate trên Chrome.'));
    }

    pendingRequests[reqId] = {
      resolve,
      reject,
      timeout: setTimeout(() => {
        delete pendingRequests[reqId];
        reject(new Error('Extension không phản hồi (timeout 20s)'));
      }, 20000),
    };

    activeExtensionWs.send(JSON.stringify({
      type: 'execute_automation',
      data: { reqId, ...payload },
    }));
  });
}

// REST API
app.get('/api/status', (req, res) => {
  res.json({ extension: extensionStatus });
});

app.get('/api/logs', (req, res) => {
  const count = parseInt(req.query.count) || 50;
  res.json(logger.getRecent(count));
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

  // Send recent logs
  ws.send(JSON.stringify({ type: 'logs_batch', data: logger.getRecent(30) }));

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
          if (result.success) {
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

// Start
server.listen(PORT, () => {
  logger.info('Server', `Running at http://localhost:${PORT}`);
  console.log(`\n🚀 Shopee Affiliate Bot running at \x1b[36mhttp://localhost:${PORT}\x1b[0m`);
  console.log(`⏳ Đang chờ Chrome Extension kết nối...\n`);
});
