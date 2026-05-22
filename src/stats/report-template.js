/**
 * Server-side HTML template for /thongke stat reports.
 * Self-contained: inline CSS, mobile-first, dark theme.
 */

function formatVND(val) {
  if (!val && val !== 0) return '0đ';
  return new Intl.NumberFormat('vi-VN').format(Math.round(val)) + 'đ';
}

function formatDate(dateStr) {
  if (!dateStr) return '--';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr.slice(0, 16).replace('T', ' ');
    return d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' }) +
      ' ' + d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
  } catch { return dateStr; }
}

function statusBadge(status) {
  if (!status) return '<span class="status-badge status-default">--</span>';
  const s = status.toLowerCase();
  if (s.includes('hoàn thành') || s.includes('completed') || s.includes('settled'))
    return `<span class="status-badge status-completed">${status}</span>`;
  if (s.includes('hủy') || s.includes('cancel'))
    return `<span class="status-badge status-cancelled">${status}</span>`;
  return `<span class="status-badge status-pending">${status}</span>`;
}

function renderReport(data) {
  const { user, summary, links, matchedOrders, payouts, generatedAt, expiresAt } = data;

  const linksHtml = links.map((l, i) => `
    <tr data-row-links="${i}" style="display:none">
      <td>
        <a href="${l.short_link || l.affiliate_link || l.original_link}" target="_blank" class="link-primary" title="${l.product_name || l.original_link}">
          <span class="truncate">${l.product_name || l.original_link}</span>
        </a>
      </td>
      <td class="text-right font-semibold" style="color: #60a5fa">${formatVND(l.commission_amount)}</td>
      <td class="text-right text-muted">${formatDate(l.created_at)}</td>
    </tr>
  `).join('');

  const ordersHtml = matchedOrders.map((o, i) => `
    <tr data-row-orders="${i}" style="display:none">
      <td>
        <div class="item-name truncate">${(o.item_name || '')}</div>
        <div class="item-meta">Mã ĐH: ${o.order_id?.slice(-8) || '--'} • Shop: ${o.shop_name || '--'}</div>
      </td>
      <td class="text-right">${formatVND(o.order_value || o.price)}</td>
      <td class="text-center">${statusBadge(o.order_status)}</td>
      <td class="text-right font-semibold" style="color: #34d399">${formatVND(o.net_commission)}</td>
    </tr>
  `).join('');

  const payoutsHtml = payouts.map((p, i) => `
    <tr data-row-payouts="${i}" style="display:none">
      <td>${formatDate(p.paid_at)}</td>
      <td class="text-right font-semibold" style="color: #34d399">+${formatVND(p.amount)}</td>
      <td>
        <span style="background: rgba(255,255,255,0.1); padding: 4px 8px; border-radius: 4px; font-size: 12px;">
          ${p.payment_method || 'Chuyển khoản'}
        </span>
      </td>
      <td class="text-muted">${p.admin_note || '--'}</td>
    </tr>
  `).join('');

  return `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Thống kê Affiliate - ${user.displayName}</title>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg-color: #050505;
      --glass-bg: rgba(255, 255, 255, 0.03);
      --glass-border: rgba(255, 255, 255, 0.05);
      --glass-hover: rgba(255, 255, 255, 0.06);
      --text-main: #f8fafc;
      --text-muted: #94a3b8;
      --accent: #3b82f6;
      --accent-glow: rgba(59, 130, 246, 0.5);
      --green: #10b981;
      --yellow: #f59e0b;
      --cyan: #06b6d4;
    }
    
    * { margin: 0; padding: 0; box-sizing: border-box; }
    
    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background-color: var(--bg-color);
      color: var(--text-main);
      min-height: 100vh;
      overflow-x: hidden;
      position: relative;
    }

    /* Animated Background Orbs */
    .bg-orb {
      position: fixed;
      border-radius: 50%;
      filter: blur(80px);
      z-index: -1;
      opacity: 0.4;
      animation: float 10s infinite ease-in-out alternate;
    }
    .orb-1 { top: -100px; left: -100px; width: 400px; height: 400px; background: rgba(59, 130, 246, 0.3); }
    .orb-2 { bottom: -100px; right: -100px; width: 500px; height: 500px; background: rgba(16, 185, 129, 0.2); animation-delay: -5s; }

    @keyframes float {
      0% { transform: translate(0, 0); }
      100% { transform: translate(30px, 50px); }
    }

    /* Layout */
    .dashboard {
      display: flex;
      flex-direction: column;
      min-height: 100vh;
    }

    @media (min-width: 1024px) {
      .dashboard {
        flex-direction: row;
        padding: 24px;
        gap: 32px;
        max-width: 1920px;
        margin: 0 auto;
        width: 100%;
      }
    }

    /* Sidebar */
    .sidebar {
      background: var(--glass-bg);
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
      border-bottom: 1px solid var(--glass-border);
      padding: 32px 24px;
      display: flex;
      flex-direction: column;
      align-items: center;
      text-align: center;
      animation: slideDown 0.6s cubic-bezier(0.16, 1, 0.3, 1);
    }
    
    @media (min-width: 1024px) {
      .sidebar {
        width: 320px;
        height: calc(100vh - 48px);
        position: sticky;
        top: 24px;
        border: 1px solid var(--glass-border);
        border-radius: 24px;
        box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
        animation: slideRight 0.6s cubic-bezier(0.16, 1, 0.3, 1);
      }
    }

    .avatar-wrapper {
      position: relative;
      margin-bottom: 20px;
    }
    .avatar {
      width: 100px;
      height: 100px;
      border-radius: 50%;
      object-fit: cover;
      border: 2px solid transparent;
      background: linear-gradient(var(--bg-color), var(--bg-color)) padding-box,
                  linear-gradient(135deg, var(--accent), var(--cyan)) border-box;
      box-shadow: 0 0 20px var(--accent-glow);
    }
    .avatar-placeholder {
      width: 100px;
      height: 100px;
      border-radius: 50%;
      background: linear-gradient(135deg, var(--accent), var(--cyan));
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 36px;
      font-weight: 700;
      box-shadow: 0 0 20px var(--accent-glow);
    }
    
    .user-name { font-size: 24px; font-weight: 700; margin-bottom: 4px; letter-spacing: -0.5px; }
    .user-sub { font-size: 14px; color: var(--text-muted); font-weight: 400; }

    .rate-card {
      margin-top: 32px;
      background: rgba(59, 130, 246, 0.1);
      border: 1px solid rgba(59, 130, 246, 0.2);
      border-radius: 16px;
      padding: 20px;
      width: 100%;
    }
    .rate-card .label { font-size: 13px; color: #93c5fd; text-transform: uppercase; letter-spacing: 1px; font-weight: 600; margin-bottom: 8px;}
    .rate-card .value { font-size: 32px; font-weight: 700; color: #fff; background: linear-gradient(to right, #60a5fa, #38bdf8); -webkit-background-clip: text; -webkit-text-fill-color: transparent;}
    .rate-card .desc { font-size: 12px; color: #7dd3fc; margin-top: 8px; opacity: 0.8; }

    /* Main Content */
    .main-content {
      flex: 1;
      min-width: 0;
      padding: 16px;
      display: flex;
      flex-direction: column;
      gap: 24px;
      animation: fadeIn 0.8s ease-out 0.2s both;
    }
    @media (min-width: 768px) {
      .main-content { padding: 24px; gap: 32px; }
    }
    @media (min-width: 1024px) {
      .main-content { padding: 0; }
    }

    /* Stat Grid */
    .stat-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 10px;
    }
    @media (min-width: 768px) {
      .stat-grid { grid-template-columns: repeat(4, 1fr); gap: 20px; }
    }

    .stat-card {
      background: var(--glass-bg);
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
      border: 1px solid var(--glass-border);
      border-radius: 16px;
      padding: 14px;
      transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1), background 0.3s;
      position: relative;
      overflow: hidden;
    }
    @media (min-width: 768px) {
      .stat-card { padding: 20px; border-radius: 20px; }
    }
    .stat-card:hover {
      transform: translateY(-5px);
      background: var(--glass-hover);
    }
    .stat-card::before {
      content: '';
      position: absolute;
      top: 0; left: 0; width: 100%; height: 4px;
    }
    .stat-card.blue::before { background: linear-gradient(90deg, #3b82f6, #06b6d4); }
    .stat-card.green::before { background: linear-gradient(90deg, #10b981, #34d399); }
    .stat-card.yellow::before { background: linear-gradient(90deg, #f59e0b, #fbbf24); }
    .stat-card.cyan::before { background: linear-gradient(90deg, #06b6d4, #2dd4bf); }

    .stat-label { font-size: 11px; color: var(--text-muted); font-weight: 500; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 6px;}
    .stat-value { font-size: 20px; font-weight: 700; letter-spacing: -0.5px; }
    @media (min-width: 768px) {
      .stat-label { font-size: 13px; margin-bottom: 8px; }
      .stat-value { font-size: 28px; }
    }
    .stat-card.blue .stat-value { color: #60a5fa; }
    .stat-card.green .stat-value { color: #34d399; }
    .stat-card.yellow .stat-value { color: #fbbf24; }
    .stat-card.cyan .stat-value { color: #22d3ee; }
    .stat-sub { font-size: 11px; color: var(--text-muted); margin-top: 6px; }
    @media (min-width: 768px) {
      .stat-sub { font-size: 13px; margin-top: 8px; }
    }

    /* Content Grid — all sections full width for table readability */
    .content-grid {
      display: grid;
      grid-template-columns: 1fr;
      gap: 24px;
    }
    @media (min-width: 768px) {
      .content-grid { gap: 32px; }
    }

    /* Sections */
    .data-section {
      background: var(--glass-bg);
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
      border: 1px solid var(--glass-border);
      border-radius: 24px;
      overflow: hidden;
      display: flex;
      flex-direction: column;
    }
    
    .section-header {
      padding: 20px 24px;
      border-bottom: 1px solid var(--glass-border);
      display: flex;
      align-items: center;
      gap: 12px;
      background: rgba(255,255,255,0.01);
    }
    .section-title {
      font-size: 18px; font-weight: 600;
    }
    .badge-count {
      background: rgba(255,255,255,0.1);
      color: #fff;
      padding: 4px 12px;
      border-radius: 20px;
      font-size: 13px;
      font-weight: 600;
    }

    /* Tables */
    .table-container {
      overflow-x: auto;
      -webkit-overflow-scrolling: touch;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 12px;
    }
    @media (min-width: 768px) {
      table { font-size: 14px; }
    }
    th {
      text-align: left;
      padding: 10px 12px;
      color: var(--text-muted);
      font-weight: 500;
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      background: rgba(0,0,0,0.2);
      white-space: nowrap;
    }
    @media (min-width: 768px) {
      th { padding: 14px 20px; font-size: 12px; letter-spacing: 1px; }
    }
    td {
      padding: 10px 12px;
      border-bottom: 1px solid var(--glass-border);
      vertical-align: middle;
    }
    @media (min-width: 768px) {
      td { padding: 14px 20px; }
    }
    tr:last-child td { border-bottom: none; }
    tr:hover td { background: rgba(255,255,255,0.02); }

    /* Utils */
    .text-right { text-align: right; }
    .text-center { text-align: center; }
    .text-muted { color: var(--text-muted); }
    .font-semibold { font-weight: 600; }
    
    .link-primary { color: #60a5fa; text-decoration: none; transition: color 0.2s; }
    .link-primary:hover { color: #93c5fd; text-decoration: underline; }
    
    .truncate {
      display: inline-block;
      max-width: 130px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      vertical-align: middle;
    }
    @media (min-width: 768px) { .truncate { max-width: 350px; } }
    @media (min-width: 1200px) { .truncate { max-width: none; } }

    .item-name { font-weight: 500; color: #f8fafc; margin-bottom: 2px; font-size: 12px; }
    .item-meta { font-size: 10px; color: var(--text-muted); }
    @media (min-width: 768px) {
      .item-name { font-size: 14px; margin-bottom: 4px; }
      .item-meta { font-size: 12px; }
    }

    /* Status Badges */
    .status-badge {
      display: inline-flex; align-items: center; justify-content: center;
      padding: 6px 12px; border-radius: 20px; font-size: 12px; font-weight: 600; white-space: nowrap;
    }
    .status-completed { background: rgba(16,185,129,0.15); color: #34d399; border: 1px solid rgba(16,185,129,0.2); }
    .status-cancelled { background: rgba(239,68,68,0.15); color: #f87171; border: 1px solid rgba(239,68,68,0.2); }
    .status-pending { background: rgba(245,158,11,0.15); color: #fbbf24; border: 1px solid rgba(245,158,11,0.2); }
    .status-default { background: rgba(148,163,184,0.15); color: #cbd5e1; border: 1px solid rgba(148,163,184,0.2); }

    /* Empty States */
    .empty-state {
      padding: 48px 24px;
      text-align: center;
      color: var(--text-muted);
    }
    .empty-icon { font-size: 48px; margin-bottom: 16px; opacity: 0.5; }

    /* Pagination */
    .pagination-bar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 12px 20px;
      border-top: 1px solid var(--glass-border);
      gap: 12px;
      flex-wrap: wrap;
    }
    .pagination-info { font-size: 12px; color: var(--text-muted); }
    .pagination-controls { display: flex; align-items: center; gap: 6px; }
    .page-btn {
      min-width: 32px; height: 32px; padding: 0 8px;
      border-radius: 8px; border: 1px solid var(--glass-border);
      background: transparent; color: var(--text-muted);
      font-size: 12px; cursor: pointer; transition: background 0.2s, color 0.2s;
      display: inline-flex; align-items: center; justify-content: center;
    }
    .page-btn:hover:not(:disabled) { background: rgba(255,255,255,0.06); color: var(--text-main); }
    .page-btn:disabled { opacity: 0.35; cursor: default; }
    .page-btn.active { background: #3b82f6; color: #fff; border-color: #3b82f6; font-weight: 600; }

    /* Footer */
    .footer {
      text-align: center;
      padding: 24px;
      color: var(--text-muted);
      font-size: 13px;
      margin-top: auto;
    }
    .expire-notice {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      background: rgba(245,158,11,0.1);
      color: #fbbf24;
      padding: 8px 16px;
      border-radius: 20px;
      margin-bottom: 12px;
      font-weight: 500;
    }

    /* Animations */
    @keyframes slideRight {
      from { opacity: 0; transform: translateX(-20px); }
      to { opacity: 1; transform: translateX(0); }
    }
    @keyframes slideDown {
      from { opacity: 0; transform: translateY(-20px); }
      to { opacity: 1; transform: translateY(0); }
    }
    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(10px); }
      to { opacity: 1; transform: translateY(0); }
    }
  </style>
</head>
<body>
  <div class="bg-orb orb-1"></div>
  <div class="bg-orb orb-2"></div>

  <div class="dashboard">
    <!-- Sidebar -->
    <aside class="sidebar">
      <div class="avatar-wrapper">
        ${user.avatar 
          ? `<img src="${user.avatar}" class="avatar" alt="Avatar" onerror="this.style.display='none'">`
          : `<div class="avatar-placeholder">${(user.displayName || '?')[0].toUpperCase()}</div>`
        }
      </div>
      <h1 class="user-name">${user.displayName}</h1>
      <p class="user-sub">Thống kê Affiliate Cá nhân</p>
      
      <div class="rate-card">
        <div class="label">Tỷ lệ hoàn tiền</div>
        <div class="value">${user.cashbackBuyerRate}%</div>
        <div class="desc">Áp dụng cho đơn hàng hoàn thành</div>
      </div>
    </aside>

    <!-- Main Content -->
    <main class="main-content">
      <!-- Overview Cards -->
      <div class="stat-grid">
        <div class="stat-card blue">
          <div class="stat-label">Tổng hoa hồng</div>
          <div class="stat-value">${formatVND(summary.totalNetCommission)}</div>
          <div class="stat-sub">${summary.totalOrders} đơn phát sinh</div>
        </div>
        <div class="stat-card green">
          <div class="stat-label">Đã thanh toán</div>
          <div class="stat-value">${formatVND(summary.totalPaid)}</div>
          <div class="stat-sub">${payouts.length} lần nhận tiền</div>
        </div>
        <div class="stat-card yellow">
          <div class="stat-label">Đang chờ duyệt</div>
          <div class="stat-value">${formatVND(summary.pendingPayment)}</div>
          <div class="stat-sub">${summary.completedCount} đơn hoàn thành</div>
        </div>
        <div class="stat-card cyan">
          <div class="stat-label">Link đã tạo</div>
          <div class="stat-value">${summary.totalLinks}</div>
          <div class="stat-sub">Tổng lượt chuyển đổi</div>
        </div>
      </div>

      <div class="content-grid">
        <!-- Links Section -->
        <section class="data-section">
        <div class="section-header">
          <span class="section-title">🔗 Link đã gửi</span>
          <span class="badge-count">${links.length}</span>
        </div>
        ${links.length > 0 ? `
        <div class="table-container">
          <table id="tbl-links">
            <thead>
              <tr>
                <th>Sản phẩm / Link</th>
                <th class="text-right">Hoa hồng dự kiến</th>
                <th class="text-right">Thời gian tạo</th>
              </tr>
            </thead>
            <tbody>${linksHtml}</tbody>
          </table>
        </div>
        <div class="pagination-bar" id="pg-links">
          <span class="pagination-info" id="pg-links-info"></span>
          <div class="pagination-controls" id="pg-links-ctrl"></div>
        </div>` : `
        <div class="empty-state">
          <div class="empty-icon">🔗</div>
          <p>Bạn chưa tạo link affiliate nào.</p>
        </div>`}
      </section>

        <!-- Orders Section -->
        <section class="data-section full-width">
        <div class="section-header">
          <span class="section-title">📦 Đơn hàng phát sinh</span>
          <span class="badge-count">${matchedOrders.length}</span>
        </div>
        ${matchedOrders.length > 0 ? `
        <div class="table-container">
          <table id="tbl-orders">
            <thead>
              <tr>
                <th>Thông tin đơn hàng</th>
                <th class="text-right">Giá trị đơn</th>
                <th class="text-center">Trạng thái</th>
                <th class="text-right">Hoa hồng nhận</th>
              </tr>
            </thead>
            <tbody>${ordersHtml}</tbody>
          </table>
        </div>
        <div class="pagination-bar" id="pg-orders">
          <span class="pagination-info" id="pg-orders-info"></span>
          <div class="pagination-controls" id="pg-orders-ctrl"></div>
        </div>` : `
        <div class="empty-state">
          <div class="empty-icon">🛒</div>
          <p>Chưa có đơn hàng nào được ghi nhận từ link của bạn.</p>
        </div>`}
      </section>

      <!-- Payouts Section -->
      <section class="data-section">
        <div class="section-header">
          <span class="section-title">💸 Lịch sử rút tiền</span>
          <span class="badge-count">${payouts.length}</span>
        </div>
        ${payouts.length > 0 ? `
        <div class="table-container">
          <table id="tbl-payouts">
            <thead>
              <tr>
                <th>Ngày nhận</th>
                <th class="text-right">Số tiền</th>
                <th>Phương thức</th>
                <th>Ghi chú từ Admin</th>
              </tr>
            </thead>
            <tbody>${payoutsHtml}</tbody>
          </table>
        </div>
        <div class="pagination-bar" id="pg-payouts">
          <span class="pagination-info" id="pg-payouts-info"></span>
          <div class="pagination-controls" id="pg-payouts-ctrl"></div>
        </div>` : `
        <div class="empty-state">
          <div class="empty-icon">💳</div>
          <p>Chưa có lịch sử thanh toán nào.</p>
        </div>`}
      </section>
      </div>

      <footer class="footer">
        <div class="expire-notice">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
          Báo cáo này sẽ tự hủy sau 24 giờ để bảo mật
        </div>
        <p>Cập nhật lần cuối: ${formatDate(generatedAt)}</p>
        <p style="margin-top: 4px; opacity: 0.6;">Shopee Affiliate System © 2024</p>
      </footer>
    </main>
  </div>

  <script>
    function paginateTable(attrName, infoId, ctrlId, pageSize) {
      const rows = Array.from(document.querySelectorAll('[data-row-' + attrName + ']'));
      const total = rows.length;
      if (total === 0) return;
      const totalPages = Math.max(1, Math.ceil(total / pageSize));
      let cur = 1;

      function render(page) {
        cur = page;
        const start = (page - 1) * pageSize;
        rows.forEach((r, i) => { r.style.display = (i >= start && i < start + pageSize) ? '' : 'none'; });
        // info
        const infoEl = document.getElementById(infoId);
        if (infoEl) infoEl.textContent = (total === 0 ? '0' : start + 1) + '–' + Math.min(start + pageSize, total) + ' / ' + total + ' bản ghi';
        // controls
        const ctrlEl = document.getElementById(ctrlId);
        if (!ctrlEl) return;
        ctrlEl.innerHTML = '';
        // prev
        const prev = document.createElement('button');
        prev.className = 'page-btn'; prev.textContent = '‹'; prev.disabled = page === 1;
        prev.onclick = () => render(cur - 1);
        ctrlEl.appendChild(prev);
        // page buttons
        const pages = [];
        for (let p = 1; p <= totalPages; p++) {
          if (p === 1 || p === totalPages || Math.abs(p - page) <= 1) pages.push(p);
        }
        let last = 0;
        pages.forEach(p => {
          if (last && p - last > 1) {
            const dots = document.createElement('span');
            dots.textContent = '...'; dots.style.cssText = 'color:var(--text-muted);font-size:12px;padding:0 4px';
            ctrlEl.appendChild(dots);
          }
          const btn = document.createElement('button');
          btn.className = 'page-btn' + (p === page ? ' active' : '');
          btn.textContent = p;
          btn.onclick = () => render(p);
          ctrlEl.appendChild(btn);
          last = p;
        });
        // next
        const next = document.createElement('button');
        next.className = 'page-btn'; next.textContent = '›'; next.disabled = page === totalPages;
        next.onclick = () => render(cur + 1);
        ctrlEl.appendChild(next);
      }

      render(1);
    }

    document.addEventListener('DOMContentLoaded', function() {
      paginateTable('links',   'pg-links-info',   'pg-links-ctrl',   10);
      paginateTable('orders',  'pg-orders-info',  'pg-orders-ctrl',  10);
      paginateTable('payouts', 'pg-payouts-info', 'pg-payouts-ctrl', 10);
    });
  </script>
</body>
</html>`;
}

module.exports = { renderReport };
