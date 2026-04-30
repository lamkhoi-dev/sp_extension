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
      // Zalo Bot elements
      zaloStatus: document.getElementById('zaloStatus'),
      zaloAccount: document.getElementById('zaloAccount'),
      zaloQrSection: document.getElementById('zaloQrSection'),
      zaloQrImage: document.getElementById('zaloQrImage'),
      zaloRestart: document.getElementById('zaloRestart'),
      // Zalo Monitor elements
      statTotal: document.getElementById('statTotal'),
      statReplied: document.getElementById('statReplied'),
      statFailed: document.getElementById('statFailed'),
      statAvgTime: document.getElementById('statAvgTime'),
      statUsers: document.getElementById('statUsers'),
      msgLogBody: document.getElementById('msgLogBody'),
      msgLogEmpty: document.getElementById('msgLogEmpty'),
      userList: document.getElementById('userList'),
      userCount: document.getElementById('userCount'),
      // Modal elements
      userModal: document.getElementById('userModal'),
      modalClose: document.getElementById('modalClose'),
      modalAvatar: document.getElementById('modalAvatar'),
      modalName: document.getElementById('modalName'),
      modalZaloName: document.getElementById('modalZaloName'),
      modalUserId: document.getElementById('modalUserId'),
      modalGender: document.getElementById('modalGender'),
      modalPhone: document.getElementById('modalPhone'),
      modalDob: document.getElementById('modalDob'),
      modalBio: document.getElementById('modalBio'),
      modalFriend: document.getElementById('modalFriend'),
      modalOnline: document.getElementById('modalOnline'),
      modalMsgCount: document.getElementById('modalMsgCount'),
      modalFirstContact: document.getElementById('modalFirstContact'),
      modalLastSeen: document.getElementById('modalLastSeen'),
    };
    this.msgFilter = 'all';
    this.init();
  }

  init() {
    this.connectWebSocket();
    this.bindEvents();
    this.bindMonitorEvents();
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

    // Zalo restart button
    this.elements.zaloRestart.addEventListener('click', async () => {
      this.elements.zaloRestart.disabled = true;
      this.elements.zaloRestart.textContent = '⏳ Đang khởi động...';
      try {
        const res = await fetch('/api/zalo-restart', { method: 'POST' });
        const data = await res.json();
        if (!data.success) throw new Error(data.error);
      } catch (err) {
        alert('Lỗi: ' + err.message);
      }
      setTimeout(() => {
        this.elements.zaloRestart.disabled = false;
        this.elements.zaloRestart.textContent = '🔄 Khởi động lại';
      }, 3000);
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
      case 'zalo_status':
        this.updateZaloStatus(msg.data);
        break;
      // Zalo Monitor events
      case 'zalo_stats':
        this.updateZaloStats(msg.data);
        break;
      case 'zalo_messages_batch':
        this.renderMessageLog(msg.data);
        break;
      case 'zalo_message':
        this.addMessageRow(msg.data, true);
        break;
      case 'zalo_users':
        this.renderUserList(msg.data);
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

  updateZaloStatus(data) {
    const statusEl = this.elements.zaloStatus;
    const accountEl = this.elements.zaloAccount;
    const qrSection = this.elements.zaloQrSection;
    const qrImage = this.elements.zaloQrImage;

    switch (data.status) {
      case 'online':
        statusEl.textContent = '🟢 Online';
        statusEl.className = 'status-value ok';
        accountEl.textContent = data.accountName || `ID:${data.ownId}`;
        qrSection.style.display = 'none';
        break;
      case 'qr_pending':
        statusEl.textContent = '📱 Đang chờ quét QR';
        statusEl.className = 'status-value warn';
        accountEl.textContent = '--';
        qrSection.style.display = 'block';
        qrImage.src = `/api/zalo-qr?t=${Date.now()}`;
        // Auto-refresh QR every 5s
        if (this._qrRefreshTimer) clearInterval(this._qrRefreshTimer);
        this._qrRefreshTimer = setInterval(() => {
          qrImage.src = `/api/zalo-qr?t=${Date.now()}`;
        }, 5000);
        break;
      case 'error':
        statusEl.textContent = '🔴 Lỗi';
        statusEl.className = 'status-value err';
        qrSection.style.display = 'none';
        break;
      default:
        statusEl.textContent = '⚫ Offline';
        statusEl.className = 'status-value';
        accountEl.textContent = '--';
        qrSection.style.display = 'none';
    }

    if (data.status !== 'qr_pending' && this._qrRefreshTimer) {
      clearInterval(this._qrRefreshTimer);
      this._qrRefreshTimer = null;
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

  // ─── Zalo Monitor ──────────────────────────────────

  bindMonitorEvents() {
    document.querySelectorAll('.filter-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.msgFilter = btn.dataset.filter;
        this.fetchFilteredMessages();
      });
    });

    // Modal close
    this.elements.modalClose.addEventListener('click', () => this.closeUserModal());
    this.elements.userModal.addEventListener('click', (e) => {
      if (e.target === this.elements.userModal) this.closeUserModal();
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') this.closeUserModal();
    });

    // User list clicks (delegated)
    this.elements.userList.addEventListener('click', (e) => {
      const item = e.target.closest('.user-item');
      if (item?.dataset.uid) this.showUserModal(item.dataset.uid);
    });

    // Message table sender clicks (delegated)
    this.elements.msgLogBody.addEventListener('click', (e) => {
      const sender = e.target.closest('.msg-sender[data-uid]');
      if (sender) this.showUserModal(sender.dataset.uid);
    });
  }

  async fetchFilteredMessages() {
    try {
      const res = await fetch(`/api/zalo-messages?count=50&filter=${this.msgFilter}`);
      const data = await res.json();
      this.renderMessageLog(data);
    } catch (err) {
      console.error('fetchFilteredMessages:', err);
    }
  }

  updateZaloStats(data) {
    if (!data) return;
    const allTime = data.allTime || {};
    this.elements.statTotal.textContent = allTime.total || 0;
    this.elements.statReplied.textContent = allTime.replied || 0;
    this.elements.statFailed.textContent = allTime.failed || 0;
    this.elements.statAvgTime.textContent = allTime.avg_response_ms || '--';
    this.elements.statUsers.textContent = data.userCount || 0;
  }

  renderMessageLog(messages) {
    const body = this.elements.msgLogBody;
    body.innerHTML = '';
    if (!messages || messages.length === 0) {
      this.elements.msgLogEmpty.style.display = 'block';
      return;
    }
    this.elements.msgLogEmpty.style.display = 'none';
    messages.forEach(msg => this.addMessageRow(msg, false));
  }

  addMessageRow(msg, isNew = false) {
    const body = this.elements.msgLogBody;
    this.elements.msgLogEmpty.style.display = 'none';

    // Check if row already exists (status update)
    const existing = body.querySelector(`tr[data-id="${msg.id}"]`);
    if (existing) {
      existing.querySelector('.status-badge').className = `status-badge ${msg.status}`;
      existing.querySelector('.status-badge').textContent = this._statusLabel(msg.status);
      const timeCell = existing.querySelector('.msg-response-time');
      if (timeCell) timeCell.textContent = msg.processing_time_ms || '--';
      return;
    }

    const tr = document.createElement('tr');
    tr.dataset.id = msg.id;
    if (isNew) tr.className = 'new-row';

    const time = msg.received_at ? new Date(msg.received_at).toLocaleTimeString('vi-VN') : '--';
    const avatarHtml = msg.avatar
      ? `<img class="msg-sender-avatar" src="${msg.avatar}" alt="">`
      : `<div class="msg-sender-avatar">👤</div>`;
    const senderName = msg.user_display_name || msg.sender_name || msg.sender_id?.slice(-6) || '?';
    const groupIcon = msg.is_group ? '👥 ' : '';
    const senderUid = msg.sender_id || '';

    tr.innerHTML = `
      <td class="msg-time">${time}</td>
      <td>
        <div class="msg-sender" data-uid="${senderUid}" style="cursor:pointer" title="Click để xem thông tin">
          ${avatarHtml}
          <span class="msg-sender-name">${groupIcon}${this.escapeHtml(senderName)}</span>
        </div>
      </td>
      <td class="msg-content-cell" title="${this.escapeHtml(msg.content || '')}">${this.escapeHtml((msg.content || '').slice(0, 40))}</td>
      <td><span class="status-badge ${msg.status}">${this._statusLabel(msg.status)}</span></td>
      <td class="msg-response-time">${msg.processing_time_ms || '--'}</td>
    `;

    // Insert at top for new messages, at bottom for batch
    if (isNew) {
      body.insertBefore(tr, body.firstChild);
      // Keep max 50 rows
      while (body.children.length > 50) body.removeChild(body.lastChild);
    } else {
      body.appendChild(tr);
    }
  }

  _statusLabel(status) {
    const labels = {
      received: '⏳ Nhận',
      processing: '⚙️ Xử lý',
      replied: '✅ Xong',
      failed: '❌ Lỗi',
      skipped: '⏭️ Bỏ qua',
    };
    return labels[status] || status;
  }

  renderUserList(users) {
    const container = this.elements.userList;
    this.elements.userCount.textContent = users.length;
    if (!users || users.length === 0) {
      container.innerHTML = '<div class="user-list-empty">Chưa có dữ liệu</div>';
      return;
    }

    container.innerHTML = users.map(u => {
      const avatarHtml = u.avatar
        ? `<img class="user-avatar" src="${u.avatar}" alt="">`
        : `<div class="user-avatar">👤</div>`;
      const genderIcon = u.gender === 0 ? '♂️' : u.gender === 1 ? '♀️' : '';
      const lastSeen = u.lastSeen ? new Date(u.lastSeen + 'Z').toLocaleString('vi-VN') : '--';

      return `
        <div class="user-item" data-uid="${u.userId}">
          ${avatarHtml}
          <div class="user-info">
            <div class="user-name">${this.escapeHtml(u.displayName)} ${genderIcon}</div>
            <div class="user-meta">
              <span>Cuối: ${lastSeen}</span>
              ${u.phoneNumber ? `<span>📞 ${u.phoneNumber}</span>` : ''}
            </div>
          </div>
          <div class="user-msg-count">${u.messageCount} tin</div>
        </div>
      `;
    }).join('');
  }

  // ─── User Detail Modal ──────────────────────────────

  async showUserModal(userId) {
    if (!userId) return;
    try {
      const res = await fetch(`/api/zalo-user/${userId}`);
      if (!res.ok) throw new Error('User not found');
      const user = await res.json();
      this._fillModal(user);
      this.elements.userModal.style.display = 'flex';
    } catch (err) {
      console.error('showUserModal:', err);
    }
  }

  closeUserModal() {
    this.elements.userModal.style.display = 'none';
  }

  _fillModal(u) {
    const el = this.elements;
    // Avatar
    if (u.avatar) {
      el.modalAvatar.innerHTML = `<img src="${u.avatar}" alt="">`;
    } else {
      el.modalAvatar.innerHTML = '👤';
    }
    // Names
    el.modalName.textContent = u.displayName || u.zaloName || 'Không tên';
    el.modalZaloName.textContent = u.zaloName ? `Zalo: ${u.zaloName}` : '';
    el.modalUserId.textContent = u.userId || '--';
    // Gender
    const genderMap = { 0: '♂️ Nam', 1: '♀️ Nữ' };
    el.modalGender.textContent = genderMap[u.gender] || 'Không rõ';
    // Phone
    el.modalPhone.textContent = u.phoneNumber || 'Không có';
    // DOB
    el.modalDob.textContent = u.dob || 'Không có';
    // Bio
    el.modalBio.textContent = u.statusText || 'Không có';
    // Friend
    el.modalFriend.textContent = u.isFriend ? '✅ Bạn bè' : '❌ Chưa kết bạn';
    // Online
    const onlineParts = [];
    if (u.isActive) onlineParts.push('📱 Mobile');
    if (u.isActivePc) onlineParts.push('💻 PC');
    if (u.isActiveWeb) onlineParts.push('🌐 Web');
    el.modalOnline.textContent = onlineParts.length ? onlineParts.join(', ') : 'Offline';
    // Stats
    el.modalMsgCount.textContent = u.messageCount || 0;
    el.modalFirstContact.textContent = u.firstContact
      ? new Date(u.firstContact + 'Z').toLocaleString('vi-VN')
      : '--';
    el.modalLastSeen.textContent = u.lastSeen
      ? new Date(u.lastSeen + 'Z').toLocaleString('vi-VN')
      : '--';
  }
}

document.addEventListener('DOMContentLoaded', () => new App());
