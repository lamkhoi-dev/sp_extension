class App {
  constructor() {
    this.ws = null;
    this.connected = false;
    this.elements = {
      chatMessages: document.getElementById('chatMessages'),
      chatInput: document.getElementById('chatInput'),
      sendBtn: document.getElementById('sendBtn'),
      chatTyping: document.getElementById('chatTyping'),
      commandHints: document.getElementById('commandHints'),
      statusDot: document.getElementById('statusDot'),
      statusText: document.getElementById('statusText'),
      extBadge: document.getElementById('extBadge'),
      extDot: document.getElementById('extDot'),
      extText: document.getElementById('extText'),
      extStatus: document.getElementById('extStatus'),
      extLastSeen: document.getElementById('extLastSeen'),
      logsContainer: document.getElementById('logsContainer'),
      quickSearch: document.getElementById('quickSearch'),
      quickLink: document.getElementById('quickLink'),
      quickStatus: document.getElementById('quickStatus'),
    };
    this.init();
  }

  init() {
    this.connectWebSocket();
    this.bindEvents();
  }

  connectWebSocket() {
    const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
    this.ws = new WebSocket(`${protocol}//${location.host}`);

    this.ws.onopen = () => {
      this.connected = true;
      this.updateConnectionStatus('connected');
    };

    this.ws.onclose = () => {
      this.connected = false;
      this.updateConnectionStatus('disconnected');
      setTimeout(() => this.connectWebSocket(), 3000);
    };

    this.ws.onerror = () => {
      this.updateConnectionStatus('error');
    };

    this.ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      this.handleMessage(msg);
    };
  }

  bindEvents() {
    this.elements.sendBtn.addEventListener('click', () => this.sendMessage());
    this.elements.chatInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this.sendMessage();
      }
    });

    this.elements.chatInput.addEventListener('input', () => {
      const val = this.elements.chatInput.value;
      this.elements.commandHints.style.display = val.startsWith('/') ? 'flex' : 'none';
    });

    document.querySelectorAll('.hint-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const cmd = btn.dataset.cmd;
        this.elements.chatInput.value = cmd;
        this.elements.chatInput.focus();
        this.elements.commandHints.style.display = cmd.endsWith(' ') ? 'flex' : 'none';
      });
    });

    // Quick actions
    this.elements.quickSearch.addEventListener('click', () => {
      this.elements.chatInput.value = '/search ';
      this.elements.chatInput.focus();
    });
    this.elements.quickLink.addEventListener('click', () => {
      this.elements.chatInput.value = '/link ';
      this.elements.chatInput.focus();
    });
    this.elements.quickStatus.addEventListener('click', () => {
      this.elements.chatInput.value = '/status';
      this.sendMessage();
    });
  }

  sendMessage() {
    const text = this.elements.chatInput.value.trim();
    if (!text || !this.connected) return;

    this.addUserMessage(text);
    this.ws.send(JSON.stringify({ type: 'user_message', content: text }));
    this.elements.chatInput.value = '';
    this.elements.commandHints.style.display = 'none';
  }

  handleMessage(msg) {
    switch (msg.type) {
      case 'bot_message':
        this.addBotMessage(msg.data);
        break;
      case 'bot_typing':
        this.elements.chatTyping.style.display = msg.data ? 'flex' : 'none';
        break;
      case 'extension_status':
        this.updateExtensionStatus(msg.data);
        break;
      case 'log_entry':
        this.addLogEntry(msg.data);
        break;
      case 'logs_batch':
        msg.data.forEach(entry => this.addLogEntry(entry));
        break;
    }
  }

  addUserMessage(text) {
    const div = document.createElement('div');
    div.className = 'message user';
    div.innerHTML = `
      <div class="message-avatar">👤</div>
      <div class="message-bubble">${this.escapeHtml(text)}</div>
    `;
    this.elements.chatMessages.appendChild(div);
    this.scrollToBottom();
  }

  addBotMessage(data) {
    const div = document.createElement('div');
    div.className = 'message bot';

    let content = '';
    if (data.type === 'search_results') {
      content = this.renderSearchResults(data);
    } else if (data.type === 'link_result') {
      content = this.renderLinkResult(data);
    } else {
      content = this.formatMarkdown(data.content || '');
    }

    div.innerHTML = `
      <div class="message-avatar">🤖</div>
      <div class="message-bubble">${content}</div>
    `;
    this.elements.chatMessages.appendChild(div);
    this.scrollToBottom();

    // Bind copy buttons
    div.querySelectorAll('.copy-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        navigator.clipboard.writeText(btn.dataset.text);
        btn.textContent = '✅ Copied!';
        setTimeout(() => { btn.textContent = '📋 Copy'; }, 2000);
      });
    });
  }

  renderSearchResults(data) {
    let html = `<div class="search-results">`;
    html += `<div class="search-header">🔍 Tìm thấy <strong>${data.totalCount}</strong> sản phẩm cho "<strong>${this.escapeHtml(data.keyword)}</strong>"</div>`;

    for (const item of data.items.slice(0, 10)) {
      html += `
        <div class="product-card">
          ${item.imageUrl ? `<img class="product-image" src="${item.imageUrl}" alt="" loading="lazy">` : '<div class="product-image"></div>'}
          <div class="product-info">
            <div class="product-name">${this.escapeHtml(item.name)}</div>
            <div class="product-meta">
              <span class="commission-badge">💰 ${item.sellerCommission || item.defaultCommission || '--'}</span>
              <span class="product-price">${item.price}</span>
              ${item.priceBeforeDiscount ? `<span class="product-price-old">${item.priceBeforeDiscount}</span>` : ''}
              ${item.discount ? `<span style="color:var(--danger);font-size:11px">-${item.discount}</span>` : ''}
            </div>
            <div class="product-meta">
              <span>🏪 ${this.escapeHtml(item.shopName)}</span>
              <span>⭐ ${item.shopRating ? item.shopRating.toFixed(1) : '--'}</span>
              <span>📦 ${item.sold} đã bán</span>
            </div>
            ${item.affiliateLink ? `<button class="copy-btn" data-text="${this.escapeHtml(item.affiliateLink)}">📋 Copy Link</button>` : ''}
          </div>
        </div>
      `;
    }

    html += `</div>`;
    return html;
  }

  renderLinkResult(data) {
    if (!data.success) {
      return `❌ Lỗi: ${this.escapeHtml(data.error || 'Unknown error')}`;
    }

    let html = `<div class="link-result">`;
    html += `<div class="link-result-header">✅ <strong>Affiliate link tạo thành công!</strong></div>`;
    if (data.shortLink) {
      html += `<div class="link-result-url"><code>${data.shortLink}</code></div>`;
      html += `<button class="copy-btn primary" data-text="${data.shortLink}">📋 Copy Link</button>`;
    }
    if (data.originalLink) {
      html += `<div class="link-result-original">🔗 Gốc: <code>${this.escapeHtml(data.originalLink.slice(0, 60))}...</code></div>`;
    }
    html += `</div>`;
    return html;
  }

  formatMarkdown(text) {
    return text
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/\n/g, '<br>');
  }

  escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  updateConnectionStatus(status) {
    const dot = this.elements.statusDot;
    const text = this.elements.statusText;
    dot.className = 'status-dot';

    if (status === 'connected') {
      dot.classList.add('connected');
      text.textContent = 'Server: Online';
    } else if (status === 'error') {
      dot.classList.add('error');
      text.textContent = 'Server: Error';
    } else {
      text.textContent = 'Reconnecting...';
      dot.classList.add('loading');
    }
  }

  updateExtensionStatus(data) {
    const dot = this.elements.extDot;
    const text = this.elements.extText;
    const statusEl = this.elements.extStatus;
    const lastSeenEl = this.elements.extLastSeen;

    if (data.connected) {
      dot.className = 'ext-dot connected';
      text.textContent = 'Extension: Online';
      statusEl.textContent = '🟢 Đã kết nối';
      statusEl.className = 'status-value ok';
    } else {
      dot.className = 'ext-dot';
      text.textContent = 'Extension: Offline';
      statusEl.textContent = '🔴 Chưa kết nối';
      statusEl.className = 'status-value err';
    }

    if (data.lastSeen) {
      lastSeenEl.textContent = new Date(data.lastSeen).toLocaleTimeString('vi-VN');
    }
  }

  addLogEntry(entry) {
    const container = this.elements.logsContainer;
    const div = document.createElement('div');
    div.className = `log-entry ${entry.level}`;

    const time = new Date(entry.timestamp).toLocaleTimeString('vi-VN');

    if (entry.type === 'request') {
      const statusClass = entry.status >= 200 && entry.status < 400 ? 'log-status-ok' : 'log-status-err';
      div.innerHTML = `<span class="log-time">${time}</span> <span class="${statusClass}">${entry.method} ${entry.status}</span> ${entry.url?.split('?')[0] || ''} <span class="log-time">${entry.duration}ms</span>`;
    } else {
      div.innerHTML = `<span class="log-time">${time}</span> <span class="log-level">${entry.level}</span> ${entry.message}`;
    }

    container.appendChild(div);
    while (container.children.length > 100) {
      container.removeChild(container.firstChild);
    }
    container.scrollTop = container.scrollHeight;
  }

  scrollToBottom() {
    requestAnimationFrame(() => {
      this.elements.chatMessages.scrollTop = this.elements.chatMessages.scrollHeight;
    });
  }
}

document.addEventListener('DOMContentLoaded', () => new App());
