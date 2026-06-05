/**
 * Server-side HTML template for /thongke stat reports.
 * Self-contained: inline CSS + Lucide SVG icons, mobile-first, dark theme.
 */

// ─── Helpers ─────────────────────────────────────────────
function formatVND(val) {
  if (!val && val !== 0) return '0đ';
  return new Intl.NumberFormat('vi-VN').format(Math.round(val)) + 'đ';
}

function formatShortVND(val) {
  const v = Math.round(val || 0);
  if (v >= 1_000_000) return (v / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M';
  if (v >= 1_000) return Math.round(v / 1_000) + 'k';
  return String(v);
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

function escapeHtml(s) {
  if (s == null) return '';
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function statusBadge(status) {
  if (!status) return '<span class="status-badge status-default"><span class="status-dot"></span>--</span>';
  const s = status.toLowerCase();
  if (s.includes('hoàn thành') || s.includes('completed') || s.includes('settled'))
    return `<span class="status-badge status-completed"><span class="status-dot"></span>${escapeHtml(status)}</span>`;
  if (s.includes('hủy') || s.includes('cancel'))
    return `<span class="status-badge status-cancelled"><span class="status-dot"></span>${escapeHtml(status)}</span>`;
  return `<span class="status-badge status-pending"><span class="status-dot"></span>${escapeHtml(status)}</span>`;
}

// ─── Lucide SVG icons (24×24, stroke based, currentColor) ─
// Trimmed copies from lucide.dev — only paths needed, no library dep.
const ICON = {
  wallet: '<path d="M19 7V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-2"/><path d="M22 11h-4a2 2 0 1 0 0 4h4v-4Z"/>',
  package: '<path d="m7.5 4.27 9 5.15"/><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/>',
  trendingUp: '<polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/>',
  users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
  link: '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>',
  creditCard: '<rect width="20" height="14" x="2" y="5" rx="2"/><line x1="2" x2="22" y1="10" y2="10"/>',
  checkCircle: '<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>',
  clock: '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>',
  target: '<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>',
  info: '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/>',
  chevronRight: '<polyline points="9 18 15 12 9 6"/>',
  chevronDown: '<polyline points="6 9 12 15 18 9"/>',
  user: '<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
  shoppingBag: '<path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/><line x1="3" x2="21" y1="6" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/>',
  barChart: '<line x1="12" x2="12" y1="20" y2="10"/><line x1="18" x2="18" y1="20" y2="4"/><line x1="6" x2="6" y1="20" y2="16"/>',
  award: '<circle cx="12" cy="8" r="6"/><path d="M15.477 12.89 17 22l-5-3-5 3 1.523-9.11"/>',
  zap: '<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>',
  layers: '<polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/>',
};

function icon(name, size = 16, extraClass = '') {
  const path = ICON[name];
  if (!path) return '';
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lc-icon ${extraClass}">${path}</svg>`;
}

// ─── Stat card with tooltip ──────────────────────────────
function statCard({ accent, iconName, label, value, sub, formula, breakdown }) {
  const tooltip = formula ? `
    <button class="info-btn" data-tip>${icon('info', 14)}</button>
    <div class="info-popover" hidden>
      <div class="info-title">${escapeHtml(label)}</div>
      <div class="info-formula">${formula}</div>
      ${breakdown ? `<div class="info-breakdown">${breakdown}</div>` : ''}
    </div>` : '';
  return `
    <div class="stat-card ${accent}">
      <div class="stat-card-head">
        <span class="stat-icon">${icon(iconName, 18)}</span>
        ${tooltip}
      </div>
      <div class="stat-label">${escapeHtml(label)}</div>
      <div class="stat-value">${value}</div>
      ${sub ? `<div class="stat-sub">${sub}</div>` : ''}
    </div>`;
}

// ─── CTV node (recursive: F1 → F2 → F3) — 3 columns ─────
function renderCtvNode(node, level, rates) {
  const levelKey = `f${level}`;
  const levelRate = rates[levelKey] ?? 0;
  const subList = (node.subCtvs || []).filter(s => (s.orderCount > 0 || s.totalCommission > 0));
  const hasChildren = subList.length > 0 && level < 3;
  const avatarHtml = node.avatar
    ? `<img src="${escapeHtml(node.avatar)}" class="ctv-avatar" alt="" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">`
    : '';
  const initials = (node.displayName || '?')[0].toUpperCase();
  const tagLabel = node.commissionMode === 'custom' ? 'Custom' : levelKey.toUpperCase();
  const completedEarnings = node.completedEarnings ?? 0;
  const pendingEarnings = node.pendingEarnings ?? 0;
  return `
    <div class="ctv-node level-${level}">
      <div class="ctv-row ${hasChildren ? 'is-expandable' : ''}" ${hasChildren ? 'data-toggle-children' : ''}>
        <!-- Col 1: Tên -->
        <div class="ctv-col-name">
          ${hasChildren ? `<span class="ctv-chevron">${icon('chevronRight', 14)}</span>` : '<span class="ctv-chevron-spacer"></span>'}
          ${avatarHtml}
          <div class="ctv-avatar-placeholder" ${node.avatar ? 'style="display:none"' : ''}>${escapeHtml(initials)}</div>
          <div class="ctv-info">
            <div class="ctv-name-row">
              <span class="ctv-name">${escapeHtml(node.displayName)}</span>
              <span class="level-tag level-tag-${level}">${tagLabel}</span>
            </div>
            <div class="ctv-stats">
              <span>${icon('package', 11)} <span class="ctv-stat-value">${node.orderCount}</span> đơn</span>
              <span class="ctv-sep">·</span>
              <span>${levelRate}%</span>
            </div>
          </div>
        </div>
        <!-- Col 2: Đã nhận (completed) -->
        <div class="ctv-col-val">
          <div class="ctv-col-label">Đã nhận</div>
          <div class="ctv-col-amt ctv-col-done">+${formatVND(completedEarnings)}</div>
        </div>
        <!-- Col 3: Đang xử lý (pending) -->
        <div class="ctv-col-val">
          <div class="ctv-col-label">Đang xử lý</div>
          <div class="ctv-col-amt ctv-col-pending">${pendingEarnings > 0 ? '+' + formatVND(pendingEarnings) : '--'}</div>
        </div>
      </div>
      ${hasChildren ? `
      <div class="ctv-children" hidden>
        ${subList.map(child => renderCtvNode(child, level + 1, rates)).join('')}
      </div>` : ''}
    </div>`;
}

// ─── Rate breakdown row (sidebar) ────────────────────────
function rateBreakdownRow(label, value, accent) {
  return `
    <div class="rate-row">
      <span class="rate-label ${accent || ''}">${escapeHtml(label)}</span>
      <span class="rate-pct">${value}%</span>
    </div>`;
}

// ─── Main render ─────────────────────────────────────────
function renderReport(data) {
  const {
    user,
    rates = { admin: 30, f0: 40, f1: 20, f2: 7, f3: 3 },
    referrer,
    ctvList = [],
    monthlyChart = [],
    summary,
    links,
    matchedOrders,
    customOrders = [],
    payouts,
    generatedAt,
  } = data;

  const f0Rate = user.f0Rate ?? rates.f0;
  const isCustomMode = !!user.isCustomMode;
  const customRate = user.customRate || 0;

  // Per-order cashback in tables (×F0% — the "what you actually receive")
  const linksHtml = links.map((l, i) => {
    const userCashback = Math.round((l.commission_amount || 0) * f0Rate / 100);
    return `
    <tr data-row-links="${i}" style="display:none">
      <td>
        <a href="${escapeHtml(l.short_link || l.affiliate_link || l.original_link)}" target="_blank" rel="noopener" class="link-primary" title="${escapeHtml(l.product_name || l.original_link)}">
          <span class="truncate">${escapeHtml(l.product_name || l.original_link)}</span>
        </a>
      </td>
      <td class="text-right">
        <div class="ts-stack">
          <span class="ts-strong">${formatVND(userCashback)}</span>
          <span class="ts-muted">HH gốc: ${formatVND(l.commission_amount)}</span>
        </div>
      </td>
      <td class="text-right text-muted">${formatDate(l.created_at)}</td>
    </tr>`;
  }).join('');

  const ordersHtml = matchedOrders.map((o, i) => {
    const userCashback = Math.round((o.net_commission || 0) * f0Rate / 100);
    return `
    <tr data-row-orders="${i}" style="display:none">
      <td>
        <div class="item-name truncate">${escapeHtml(o.item_name || '')}</div>
        <div class="item-meta">Mã ĐH: ${escapeHtml(o.order_id?.slice(-8) || '--')} · Shop: ${escapeHtml(o.shop_name || '--')}</div>
      </td>
      <td class="text-right">${formatVND(o.order_value || o.price)}</td>
      <td class="text-center">${statusBadge(o.order_status)}</td>
      <td class="text-right">
        <div class="ts-stack">
          <span class="ts-strong" style="color:#34d399">${formatVND(userCashback)}</span>
          <span class="ts-muted">NET: ${formatVND(o.net_commission)}</span>
        </div>
      </td>
    </tr>`;
  }).join('');

  const payoutsHtml = payouts.map((p, i) => `
    <tr data-row-payouts="${i}" style="display:none">
      <td>${formatDate(p.paid_at)}</td>
      <td class="text-right font-semibold" style="color:#34d399">+${formatVND(p.amount)}</td>
      <td>
        <span class="chip-soft">${escapeHtml(p.payment_method || 'Chuyển khoản')}</span>
      </td>
      <td><span class="chip-role">${escapeHtml((p.role || 'buyer').toUpperCase())}</span></td>
      <td class="text-muted">${escapeHtml(p.admin_note || '--')}</td>
    </tr>`).join('');

  const customOrdersHtml = customOrders.map((o, i) => {
    const userCashback = Math.round((o.net_commission || 0) * (customRate || 0) / 100);
    return `
    <tr data-row-custom="${i}" style="display:none">
      <td>
        <div class="item-name truncate">${escapeHtml(o.item_name || '--')}</div>
        <div class="item-meta">Mã ĐH: ${escapeHtml(o.order_id?.slice(-8) || '--')} · Shop: ${escapeHtml(o.shop_name || '--')}</div>
      </td>
      <td class="text-center">
        <span class="chip-purple">${escapeHtml(o.sub_id2 || 'N/A')}</span>
      </td>
      <td class="text-right">${formatVND(o.order_value || o.price)}</td>
      <td class="text-center">${statusBadge(o.order_status)}</td>
      <td class="text-right font-semibold" style="color:#c084fc">${formatVND(userCashback)}</td>
    </tr>`;
  }).join('');

  // ── Stat cards content ──
  // ── Hàng 1: Thu nhập (3 cards) ──
  const cardTotalEarnings = statCard({
    accent: 'green',
    iconName: 'wallet',
    label: 'Tổng thu nhập',
    value: formatVND(summary.totalEarnings),
    sub: `F0 + F1/F2/F3${summary.hasCustomOrders ? ' + Custom' : ''}`,
    formula: `<code>= Buyer + Referrer${summary.hasCustomOrders ? ' + Custom' : ''}</code>`,
    breakdown: `
      <div class="kv"><span>Buyer (F0)</span><span>${formatVND(summary.totalBuyerCashback)}</span></div>
      <div class="kv"><span>Referrer (F1+F2+F3)</span><span>${formatVND(summary.totalReferrerEarnings)}</span></div>
      ${summary.totalCustomCashback > 0 ? `<div class="kv"><span>Custom</span><span>${formatVND(summary.totalCustomCashback)}</span></div>` : ''}
      <div class="kv-strong"><span>Tổng</span><span>${formatVND(summary.totalEarnings)}</span></div>`,
  });

  const cardPaid = statCard({
    accent: 'cyan',
    iconName: 'creditCard',
    label: 'Đã thanh toán',
    value: formatVND(summary.totalPaid),
    sub: `${payouts.length} lần nhận tiền`,
    formula: `<code>Σ amount FROM payouts WHERE user_id = bạn</code>`,
    breakdown: `
      <div class="kv"><span>Buyer (F0)</span><span>${formatVND(summary.totalPaidAsBuyer)}</span></div>
      <div class="kv"><span>Referrer (F1+F2+F3)</span><span>${formatVND(summary.totalPaidAsReferrer)}</span></div>
      ${summary.totalCustomPaid > 0 ? `<div class="kv"><span>Custom</span><span>${formatVND(summary.totalCustomPaid)}</span></div>` : ''}
      <div class="kv-strong"><span>Tổng đã trả</span><span>${formatVND(summary.totalPaid)}</span></div>`,
  });

  const cardPending = statCard({
    accent: 'yellow',
    iconName: 'clock',
    label: 'Chờ xử lý',
    value: formatVND(summary.totalPendingPayment),
    sub: `${summary.completedCount} đơn hoàn thành chờ trả`,
    formula: `<code>= cashback hoàn thành − đã trả</code>`,
    breakdown: `
      <div class="kv"><span>Buyer chờ trả</span><span>${formatVND(summary.pendingBuyerPayment)}</span></div>
      ${summary.pendingCustomPayment > 0 ? `<div class="kv"><span>Custom chờ trả</span><span>${formatVND(summary.pendingCustomPayment)}</span></div>` : ''}
      <div class="kv-strong"><span>Tổng chờ</span><span>${formatVND(summary.totalPendingPayment)}</span></div>`,
  });

  // ── Hàng 2: Chi tiết theo nguồn (2 cards) ──
  const cardOrders = statCard({
    accent: 'blue',
    iconName: 'shoppingBag',
    label: 'Hoa hồng từ Đơn hàng',
    value: formatVND(summary.totalBuyerCashback),
    sub: `${summary.completedCount}/${summary.totalOrders} đơn hoàn thành`,
    formula: `<code>= Σ (net_commission × ${f0Rate}%)</code>`,
    breakdown: `
      <div class="kv"><span>Tổng net commission</span><span>${formatVND(summary.totalNetCommission)}</span></div>
      <div class="kv"><span>${isCustomMode ? 'Custom rate' : 'F0 rate'}</span><span>${f0Rate}%</span></div>
      <div class="kv"><span>Đơn hoàn thành</span><span>${summary.completedCount}</span></div>
      <div class="kv"><span>Đơn đang xử lý</span><span>${summary.pendingCount}</span></div>
      <div class="kv-strong"><span>Bạn nhận</span><span>${formatVND(summary.totalBuyerCashback)}</span></div>`,
  });

  const cardReferrer = (summary.totalReferrerEarnings > 0 || ctvList.length > 0) ? statCard({
    accent: 'purple',
    iconName: 'layers',
    label: 'Hoa hồng từ CTV',
    value: formatVND(summary.totalReferrerEarnings),
    sub: `${summary.ctvCount} CTV F1 trực tiếp`,
    formula: `<code>= F1×${rates.f1}% + F2×${rates.f2}% + F3×${rates.f3}%</code>`,
    breakdown: `
      <div class="kv"><span>F1 (trực tiếp)</span><span>${formatVND(summary.totalF1Earnings)}</span></div>
      <div class="kv"><span>F2 (cấp 2)</span><span>${formatVND(summary.totalF2Earnings)}</span></div>
      <div class="kv"><span>F3 (cấp 3)</span><span>${formatVND(summary.totalF3Earnings)}</span></div>
      <div class="kv-strong"><span>Tổng từ CTV</span><span>${formatVND(summary.totalReferrerEarnings)}</span></div>`,
  }) : '';

  return `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Thống kê Affiliate · ${escapeHtml(user.displayName)}</title>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg-color: #050505;
      --glass-bg: rgba(255, 255, 255, 0.03);
      --glass-border: rgba(255, 255, 255, 0.05);
      --glass-hover: rgba(255, 255, 255, 0.06);
      --text-main: #f8fafc;
      --text-muted: #94a3b8;
      --text-dim: #64748b;
      --accent: #3b82f6;
      --accent-glow: rgba(59, 130, 246, 0.5);
      --green: #10b981;
      --yellow: #f59e0b;
      --cyan: #06b6d4;
      --purple: #a855f7;
      --rose: #f43f5e;
    }

    * { margin: 0; padding: 0; box-sizing: border-box; }

    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background-color: var(--bg-color);
      color: var(--text-main);
      min-height: 100vh;
      overflow-x: hidden;
      position: relative;
      line-height: 1.4;
    }

    /* Background orbs */
    .bg-orb {
      position: fixed; border-radius: 50%; filter: blur(80px);
      z-index: -1; opacity: 0.4;
      animation: float 12s infinite ease-in-out alternate;
    }
    .orb-1 { top: -100px; left: -100px; width: 400px; height: 400px; background: rgba(59, 130, 246, 0.25); }
    .orb-2 { bottom: -100px; right: -100px; width: 500px; height: 500px; background: rgba(16, 185, 129, 0.18); animation-delay: -5s; }
    @keyframes float { 0% { transform: translate(0,0); } 100% { transform: translate(30px,50px); } }

    /* Layout */
    .dashboard { display: flex; flex-direction: column; min-height: 100vh; }
    @media (min-width: 1024px) {
      .dashboard { flex-direction: row; padding: 24px; gap: 32px; max-width: 1920px; margin: 0 auto; width: 100%; }
    }

    /* Sidebar */
    .sidebar {
      background: var(--glass-bg);
      backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px);
      border-bottom: 1px solid var(--glass-border);
      padding: 28px 20px;
      display: flex; flex-direction: column; align-items: center; text-align: center;
      animation: slideDown 0.5s cubic-bezier(0.16, 1, 0.3, 1);
    }
    @media (min-width: 1024px) {
      .sidebar {
        width: 320px; height: calc(100vh - 48px);
        position: sticky; top: 24px;
        border: 1px solid var(--glass-border);
        border-radius: 20px;
        box-shadow: 0 25px 50px -12px rgba(0,0,0,0.5);
        animation: slideRight 0.5s cubic-bezier(0.16, 1, 0.3, 1);
        overflow-y: auto;
      }
    }

    .avatar-wrapper { position: relative; margin-bottom: 18px; }
    .avatar {
      width: 90px; height: 90px; border-radius: 50%; object-fit: cover;
      border: 2px solid transparent;
      background: linear-gradient(var(--bg-color), var(--bg-color)) padding-box,
                  linear-gradient(135deg, var(--accent), var(--cyan)) border-box;
      box-shadow: 0 0 24px var(--accent-glow);
    }
    .avatar-placeholder {
      width: 90px; height: 90px; border-radius: 50%;
      background: linear-gradient(135deg, var(--accent), var(--cyan));
      display: flex; align-items: center; justify-content: center;
      font-size: 32px; font-weight: 700;
      box-shadow: 0 0 24px var(--accent-glow);
    }

    .user-name { font-size: 22px; font-weight: 700; margin-bottom: 4px; letter-spacing: -0.4px; }
    .user-sub { font-size: 13px; color: var(--text-muted); font-weight: 400; }
    .mode-tag {
      display: inline-flex; align-items: center; gap: 4px;
      margin-top: 8px; padding: 3px 10px;
      font-size: 11px; font-weight: 600;
      border-radius: 12px;
      background: rgba(168,85,247,0.12); color: #c084fc;
      border: 1px solid rgba(168,85,247,0.25);
    }
    .mode-tag.normal {
      background: rgba(16,185,129,0.10); color: #34d399;
      border-color: rgba(16,185,129,0.22);
    }

    /* Rate breakdown card */
    .rate-card {
      margin-top: 24px;
      background: rgba(59,130,246,0.08);
      border: 1px solid rgba(59,130,246,0.18);
      border-radius: 14px;
      padding: 14px 16px;
      width: 100%;
    }
    .rate-card-title {
      font-size: 11px; font-weight: 600; letter-spacing: 0.6px;
      color: #93c5fd; text-transform: uppercase;
      margin-bottom: 10px; text-align: left;
      display: flex; align-items: center; gap: 6px;
    }
    .rate-row {
      display: flex; justify-content: space-between; align-items: center;
      padding: 5px 0; font-size: 12px;
      border-bottom: 1px dashed rgba(255,255,255,0.05);
    }
    .rate-row:last-child { border-bottom: none; padding-top: 8px; margin-top: 4px; border-top: 1px solid rgba(255,255,255,0.06); }
    .rate-label { color: var(--text-muted); display: inline-flex; align-items: center; gap: 6px; }
    .rate-label.f0 { color: #34d399; }
    .rate-label.f1 { color: #22d3ee; }
    .rate-label.f2 { color: #60a5fa; }
    .rate-label.f3 { color: #a78bfa; }
    .rate-label.admin { color: var(--text-muted); }
    .rate-pct { font-weight: 700; color: #f8fafc; font-size: 13px; tabular-nums: 1; }

    .referrer-card {
      margin-top: 16px;
      background: rgba(16,185,129,0.07);
      border: 1px solid rgba(16,185,129,0.15);
      border-radius: 12px;
      padding: 12px;
      width: 100%;
      display: flex; align-items: center; gap: 10px;
      text-align: left;
    }
    .referrer-avatar {
      width: 36px; height: 36px; border-radius: 50%; object-fit: cover;
      border: 2px solid rgba(16,185,129,0.3); flex-shrink: 0;
    }
    .referrer-avatar-placeholder {
      width: 36px; height: 36px; border-radius: 50%;
      background: linear-gradient(135deg, var(--green), #059669);
      display: flex; align-items: center; justify-content: center;
      font-size: 14px; font-weight: 700; color: #fff;
      flex-shrink: 0;
    }
    .referrer-label { font-size: 10px; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.5px; display: flex; align-items: center; gap: 4px; }
    .referrer-name { font-size: 13px; font-weight: 600; color: #34d399; margin-top: 2px; }

    .ctv-chip {
      margin-top: 16px;
      background: rgba(168,85,247,0.07);
      border: 1px solid rgba(168,85,247,0.18);
      border-radius: 12px;
      padding: 12px 14px;
      width: 100%; text-align: center;
    }
    .ctv-chip-row {
      display: grid; grid-template-columns: 1fr 1fr; gap: 8px;
      align-items: start;
    }
    .ctv-chip-item { display: flex; flex-direction: column; align-items: center; }
    .ctv-chip-item .num {
      font-size: 18px; font-weight: 700; color: #c084fc;
      word-break: break-all; text-align: center; line-height: 1.2;
    }
    .ctv-chip-item .lbl { font-size: 10px; color: var(--text-muted); margin-top: 3px; text-transform: uppercase; letter-spacing: 0.5px; }

    /* Main */
    .main-content {
      flex: 1; min-width: 0; padding: 16px;
      display: flex; flex-direction: column; gap: 20px;
      animation: fadeIn 0.6s ease-out 0.15s both;
    }
    @media (min-width: 768px) { .main-content { padding: 24px; gap: 28px; } }
    @media (min-width: 1024px) { .main-content { padding: 0; } }

    /* Stat grids */
    .stat-grid   { display: grid; gap: 10px; }
    .stat-grid-3 { grid-template-columns: repeat(3, 1fr); }
    .stat-grid-2 { grid-template-columns: repeat(2, 1fr); }
    @media (max-width: 480px) {
      .stat-grid-3 { grid-template-columns: repeat(1, 1fr); }
      .stat-grid-2 { grid-template-columns: repeat(1, 1fr); }
    }
    @media (min-width: 481px) and (max-width: 767px) {
      .stat-grid-3 { grid-template-columns: repeat(3, 1fr); }
    }
    @media (min-width: 768px) { .stat-grid { gap: 16px; } }

    .stat-card {
      background: var(--glass-bg);
      backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px);
      border: 1px solid var(--glass-border);
      border-radius: 14px; padding: 14px;
      position: relative; overflow: visible;
      transition: transform 0.25s cubic-bezier(0.16,1,0.3,1), background 0.25s, border-color 0.25s;
    }
    @media (min-width: 768px) { .stat-card { padding: 16px; border-radius: 16px; } }
    .stat-card:hover { transform: translateY(-2px); background: var(--glass-hover); }
    .stat-card::before {
      content: ''; position: absolute; top: 0; left: 14px; right: 14px; height: 2px; border-radius: 0 0 4px 4px;
    }
    .stat-card.blue::before { background: linear-gradient(90deg,#3b82f6,#06b6d4); }
    .stat-card.green::before { background: linear-gradient(90deg,#10b981,#34d399); }
    .stat-card.yellow::before { background: linear-gradient(90deg,#f59e0b,#fbbf24); }
    .stat-card.cyan::before { background: linear-gradient(90deg,#06b6d4,#2dd4bf); }
    .stat-card.purple::before { background: linear-gradient(90deg,#a855f7,#c084fc); }
    .stat-card.rose::before { background: linear-gradient(90deg,#f43f5e,#fb7185); }

    .stat-card-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
    .stat-icon {
      width: 30px; height: 30px; border-radius: 8px;
      display: inline-flex; align-items: center; justify-content: center;
      background: rgba(255,255,255,0.04);
      border: 1px solid var(--glass-border);
    }
    .stat-card.blue .stat-icon { color: #60a5fa; background: rgba(59,130,246,0.10); border-color: rgba(59,130,246,0.20); }
    .stat-card.green .stat-icon { color: #34d399; background: rgba(16,185,129,0.10); border-color: rgba(16,185,129,0.20); }
    .stat-card.yellow .stat-icon { color: #fbbf24; background: rgba(245,158,11,0.10); border-color: rgba(245,158,11,0.20); }
    .stat-card.cyan .stat-icon { color: #22d3ee; background: rgba(6,182,212,0.10); border-color: rgba(6,182,212,0.20); }
    .stat-card.purple .stat-icon { color: #c084fc; background: rgba(168,85,247,0.10); border-color: rgba(168,85,247,0.20); }

    .info-btn {
      background: transparent; border: 1px solid var(--glass-border);
      width: 22px; height: 22px; border-radius: 6px;
      display: inline-flex; align-items: center; justify-content: center;
      color: var(--text-muted); cursor: pointer; transition: all 0.2s;
      padding: 0;
    }
    .info-btn:hover, .info-btn[aria-expanded="true"] {
      background: rgba(255,255,255,0.06); color: var(--text-main); border-color: rgba(255,255,255,0.15);
    }

    /* Global tooltip — fixed positioning avoids backdrop-filter stacking context */
    #global-tip {
      position: fixed;
      min-width: 220px; max-width: 280px;
      background: #0f0f0f; border: 1px solid rgba(255,255,255,0.12);
      border-radius: 10px; padding: 12px; z-index: 9999;
      box-shadow: 0 16px 48px -8px rgba(0,0,0,0.8);
      pointer-events: none;
      animation: popIn 0.16s ease-out;
    }
    #global-tip[hidden] { display: none; }
    /* Legacy popover hidden by default */
    .info-popover { display: none; }
    .info-title { font-size: 12px; font-weight: 600; color: #fff; margin-bottom: 6px; }
    .info-formula { font-size: 11px; color: #94a3b8; margin-bottom: 8px; }
    .info-formula code { background: rgba(255,255,255,0.06); padding: 2px 6px; border-radius: 4px; color: #cbd5e1; font-size: 11px; }
    .info-breakdown { border-top: 1px solid var(--glass-border); padding-top: 8px; }
    .kv, .kv-strong { display: flex; justify-content: space-between; align-items: center; font-size: 11px; padding: 3px 0; }
    .kv { color: var(--text-muted); }
    .kv-strong { color: #fff; font-weight: 600; border-top: 1px dashed rgba(255,255,255,0.08); margin-top: 4px; padding-top: 6px; }
    @keyframes popIn { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: translateY(0); } }

    .stat-label { font-size: 11px; color: var(--text-muted); font-weight: 500; text-transform: uppercase; letter-spacing: 0.4px; margin-bottom: 4px; }
    .stat-value { font-size: 20px; font-weight: 700; letter-spacing: -0.5px; }
    @media (min-width: 768px) { .stat-label { font-size: 11px; } .stat-value { font-size: 22px; } }
    .stat-card.blue .stat-value { color: #60a5fa; }
    .stat-card.green .stat-value { color: #34d399; }
    .stat-card.yellow .stat-value { color: #fbbf24; }
    .stat-card.cyan .stat-value { color: #22d3ee; }
    .stat-card.purple .stat-value { color: #c084fc; }
    .stat-sub { font-size: 11px; color: var(--text-muted); margin-top: 6px; }

    /* Sections */
    .data-section {
      background: var(--glass-bg);
      backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px);
      border: 1px solid var(--glass-border);
      border-radius: 18px; overflow: hidden;
      display: flex; flex-direction: column;
    }
    .section-header {
      padding: 16px 20px;
      border-bottom: 1px solid var(--glass-border);
      display: flex; align-items: center; gap: 10px;
      background: rgba(255,255,255,0.01);
    }
    .section-title-wrap { display: flex; align-items: center; gap: 8px; }
    .section-icon {
      width: 28px; height: 28px; border-radius: 7px;
      background: rgba(59,130,246,0.10); color: #60a5fa;
      display: inline-flex; align-items: center; justify-content: center;
      border: 1px solid rgba(59,130,246,0.20);
    }
    .section-icon.green { background: rgba(16,185,129,0.10); color: #34d399; border-color: rgba(16,185,129,0.20); }
    .section-icon.purple { background: rgba(168,85,247,0.10); color: #c084fc; border-color: rgba(168,85,247,0.20); }
    .section-icon.cyan { background: rgba(6,182,212,0.10); color: #22d3ee; border-color: rgba(6,182,212,0.20); }
    .section-icon.yellow { background: rgba(245,158,11,0.10); color: #fbbf24; border-color: rgba(245,158,11,0.20); }
    .section-title { font-size: 15px; font-weight: 600; }
    .badge-count {
      background: rgba(255,255,255,0.06); color: #fff;
      padding: 3px 10px; border-radius: 12px;
      font-size: 12px; font-weight: 600;
    }

    /* Tables */
    .table-container { overflow-x: auto; -webkit-overflow-scrolling: touch; }
    table { width: 100%; border-collapse: collapse; font-size: 12px; }
    @media (min-width: 768px) { table { font-size: 13px; } }
    th {
      text-align: left; padding: 10px 12px;
      color: var(--text-muted); font-weight: 500;
      font-size: 10px; text-transform: uppercase; letter-spacing: 0.4px;
      background: rgba(0,0,0,0.20); white-space: nowrap;
    }
    @media (min-width: 768px) { th { padding: 12px 18px; font-size: 11px; } }
    td { padding: 10px 12px; border-bottom: 1px solid var(--glass-border); vertical-align: middle; }
    @media (min-width: 768px) { td { padding: 12px 18px; } }
    tr:last-child td { border-bottom: none; }
    tr:hover td { background: rgba(255,255,255,0.02); }

    .text-right { text-align: right; }
    .text-center { text-align: center; }
    .text-muted { color: var(--text-muted); }
    .font-semibold { font-weight: 600; }
    .link-primary { color: #60a5fa; text-decoration: none; transition: color 0.2s; }
    .link-primary:hover { color: #93c5fd; text-decoration: underline; }
    .truncate { display: inline-block; max-width: 130px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; vertical-align: middle; }
    @media (min-width: 768px) { .truncate { max-width: 350px; } }
    @media (min-width: 1200px) { .truncate { max-width: none; } }
    .item-name { font-weight: 500; color: #f8fafc; margin-bottom: 2px; font-size: 12px; }
    .item-meta { font-size: 10px; color: var(--text-dim); }
    @media (min-width: 768px) { .item-name { font-size: 13px; margin-bottom: 3px; } .item-meta { font-size: 11px; } }

    .ts-stack { display: flex; flex-direction: column; align-items: flex-end; gap: 2px; }
    .ts-strong { font-weight: 600; color: #60a5fa; font-size: 13px; }
    .ts-muted { font-size: 10px; color: var(--text-dim); font-weight: 400; }

    /* Status badges */
    .status-badge {
      display: inline-flex; align-items: center; gap: 5px;
      padding: 4px 10px; border-radius: 12px;
      font-size: 11px; font-weight: 600; white-space: nowrap;
    }
    .status-dot { width: 6px; height: 6px; border-radius: 50%; display: inline-block; }
    .status-completed { background: rgba(16,185,129,0.12); color: #34d399; border: 1px solid rgba(16,185,129,0.20); }
    .status-completed .status-dot { background: #10b981; }
    .status-cancelled { background: rgba(244,63,94,0.12); color: #fb7185; border: 1px solid rgba(244,63,94,0.20); }
    .status-cancelled .status-dot { background: #f43f5e; }
    .status-pending { background: rgba(245,158,11,0.12); color: #fbbf24; border: 1px solid rgba(245,158,11,0.20); }
    .status-pending .status-dot { background: #f59e0b; }
    .status-default { background: rgba(148,163,184,0.10); color: #cbd5e1; border: 1px solid rgba(148,163,184,0.15); }
    .status-default .status-dot { background: #94a3b8; }

    .chip-soft { background: rgba(255,255,255,0.06); padding: 3px 8px; border-radius: 6px; font-size: 11px; }
    .chip-role { background: rgba(59,130,246,0.10); color: #60a5fa; padding: 3px 8px; border-radius: 6px; font-size: 10px; font-weight: 600; border: 1px solid rgba(59,130,246,0.20); }
    .chip-purple { background: rgba(168,85,247,0.12); color: #c084fc; border: 1px solid rgba(168,85,247,0.20); padding: 3px 10px; border-radius: 12px; font-size: 11px; font-weight: 600; white-space: nowrap; }

    /* Empty state */
    .empty-state { padding: 40px 20px; text-align: center; color: var(--text-muted); }
    .empty-icon { color: var(--text-dim); margin-bottom: 12px; display: inline-flex; }

    /* Pagination */
    .pagination-bar { display: flex; align-items: center; justify-content: space-between; padding: 10px 18px; border-top: 1px solid var(--glass-border); gap: 12px; flex-wrap: wrap; }
    .pagination-info { font-size: 12px; color: var(--text-muted); }
    .pagination-controls { display: flex; align-items: center; gap: 6px; }
    .page-btn {
      min-width: 30px; height: 30px; padding: 0 8px;
      border-radius: 7px; border: 1px solid var(--glass-border);
      background: transparent; color: var(--text-muted);
      font-size: 12px; cursor: pointer; transition: background 0.2s, color 0.2s;
      display: inline-flex; align-items: center; justify-content: center;
    }
    .page-btn:hover:not(:disabled) { background: rgba(255,255,255,0.06); color: var(--text-main); }
    .page-btn:disabled { opacity: 0.35; cursor: default; }
    .page-btn.active { background: #3b82f6; color: #fff; border-color: #3b82f6; font-weight: 600; }

    /* CTV tree */
    .ctv-tree { padding: 12px 16px; display: flex; flex-direction: column; gap: 6px; }
    @media (min-width: 768px) { .ctv-tree { padding: 16px 20px; } }
    .ctv-node { display: flex; flex-direction: column; }
    .ctv-node.level-2 { padding-left: 28px; border-left: 1px dashed rgba(255,255,255,0.08); margin-left: 14px; }
    .ctv-node.level-3 { padding-left: 28px; border-left: 1px dashed rgba(255,255,255,0.08); margin-left: 14px; }

    .ctv-row {
      display: flex; align-items: center; gap: 8px;
      background: rgba(255,255,255,0.025);
      border: 1px solid var(--glass-border);
      border-radius: 10px; padding: 10px 12px;
      transition: background 0.2s;
    }
    .ctv-row.is-expandable { cursor: pointer; user-select: none; }
    .ctv-row:hover { background: rgba(255,255,255,0.05); }
    .ctv-chevron, .ctv-chevron-spacer { width: 16px; display: inline-flex; align-items: center; justify-content: center; color: var(--text-muted); flex-shrink: 0; transition: transform 0.2s; }
    .ctv-row.is-expanded .ctv-chevron { transform: rotate(90deg); }

    /* CTV 3-column layout */
    .ctv-col-name { display: flex; align-items: center; gap: 8px; flex: 1; min-width: 0; }
    .ctv-col-val { text-align: right; flex-shrink: 0; min-width: 80px; }
    .ctv-col-label { font-size: 9px; color: var(--text-dim); text-transform: uppercase; letter-spacing: 0.4px; margin-bottom: 2px; }
    .ctv-col-amt { font-size: 13px; font-weight: 700; }
    .ctv-col-done { color: #34d399; }
    .ctv-col-pending { color: #fbbf24; }

    /* CTV section header with column labels */
    .ctv-header {
      display: flex; align-items: center; gap: 8px;
      padding: 8px 12px 4px;
      font-size: 9px; font-weight: 700; color: var(--text-dim);
      text-transform: uppercase; letter-spacing: 0.4px;
    }
    .ctv-header-name { flex: 1; }
    .ctv-header-val { min-width: 80px; text-align: right; }

    .ctv-avatar { width: 32px; height: 32px; border-radius: 50%; object-fit: cover; border: 1px solid var(--glass-border); flex-shrink: 0; }
    .ctv-avatar-placeholder {
      width: 32px; height: 32px; border-radius: 50%;
      background: linear-gradient(135deg, #06b6d4, #3b82f6);
      display: flex; align-items: center; justify-content: center;
      font-size: 13px; font-weight: 600; color: #fff;
      flex-shrink: 0;
    }
    .ctv-info { min-width: 0; flex: 1; }
    .ctv-name-row { display: flex; align-items: center; gap: 6px; }
    .ctv-name { font-size: 13px; font-weight: 600; color: #f8fafc; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 160px; }
    .level-tag {
      font-size: 9px; font-weight: 700; padding: 1px 6px; border-radius: 8px; letter-spacing: 0.4px;
      flex-shrink: 0;
    }
    .level-tag-1 { background: rgba(34,211,238,0.15); color: #22d3ee; }
    .level-tag-2 { background: rgba(96,165,250,0.15); color: #60a5fa; }
    .level-tag-3 { background: rgba(167,139,250,0.15); color: #a78bfa; }
    .ctv-stats { font-size: 11px; color: var(--text-muted); display: flex; align-items: center; gap: 6px; margin-top: 2px; flex-wrap: wrap; }
    .ctv-stats svg { vertical-align: middle; }
    .ctv-stat-value { color: #f8fafc; font-weight: 600; }
    .ctv-sep { color: var(--text-dim); }

    .ctv-earnings { text-align: right; flex-shrink: 0; }
    .ctv-earnings-label { font-size: 9px; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.4px; }
    .ctv-earnings-value { font-size: 14px; font-weight: 700; color: #34d399; margin-top: 2px; }
    .ctv-children { margin-top: 6px; display: flex; flex-direction: column; gap: 6px; padding-top: 4px; }
    .ctv-children[hidden] { display: none; }

    /* SVG chart */
    .chart-container { padding: 16px; overflow-x: auto; }
    .chart-svg { width: 100%; height: auto; min-width: 300px; }
    .chart-month-label { font-size: 11px; fill: var(--text-muted); text-anchor: middle; }
    .chart-bar-value { font-size: 10px; fill: #60a5fa; text-anchor: middle; font-weight: 600; }

    /* Footer */
    .footer { text-align: center; padding: 24px; color: var(--text-muted); font-size: 13px; margin-top: auto; }
    .expire-notice {
      display: inline-flex; align-items: center; gap: 6px;
      background: rgba(245,158,11,0.08);
      color: #fbbf24;
      padding: 6px 14px; border-radius: 16px;
      margin-bottom: 10px; font-weight: 500;
      border: 1px solid rgba(245,158,11,0.18);
    }

    /* Animations */
    @keyframes slideRight { from { opacity: 0; transform: translateX(-20px); } to { opacity: 1; transform: translateX(0); } }
    @keyframes slideDown { from { opacity: 0; transform: translateY(-20px); } to { opacity: 1; transform: translateY(0); } }
    @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }

    .lc-icon { display: inline-block; vertical-align: middle; }
  </style>
</head>
<body>
  <div class="bg-orb orb-1"></div>
  <div class="bg-orb orb-2"></div>
  <!-- Global tooltip portal — avoids backdrop-filter stacking context -->
  <div id="global-tip" hidden></div>

  <div class="dashboard">
    <!-- Sidebar -->
    <aside class="sidebar">
      <div class="avatar-wrapper">
        ${user.avatar
          ? `<img src="${escapeHtml(user.avatar)}" class="avatar" alt="Avatar" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">`
          : ''}
        <div class="avatar-placeholder" ${user.avatar ? 'style="display:none"' : ''}>${escapeHtml((user.displayName || '?')[0].toUpperCase())}</div>
      </div>
      <h1 class="user-name">${escapeHtml(user.displayName)}</h1>
      <p class="user-sub">Báo cáo Affiliate cá nhân</p>
      <span class="mode-tag ${isCustomMode ? '' : 'normal'}">
        ${icon(isCustomMode ? 'award' : 'zap', 11)}
        ${isCustomMode ? `Custom · ${customRate}%` : 'Normal'}
      </span>

      <div class="rate-card">
        <div class="rate-card-title">${icon('layers', 12)} Tỷ lệ chia hoa hồng</div>
        ${isCustomMode
          ? rateBreakdownRow(`Custom (bạn)`, customRate, '') + rateBreakdownRow('Admin', 100 - customRate, 'admin')
          : rateBreakdownRow('F0 — Bạn mua', rates.f0, 'f0') +
            rateBreakdownRow('F1 — Cấp 1', rates.f1, 'f1') +
            rateBreakdownRow('F2 — Cấp 2', rates.f2, 'f2') +
            rateBreakdownRow('F3 — Cấp 3', rates.f3, 'f3') +
            rateBreakdownRow('Admin', rates.admin, 'admin')
        }
      </div>

      ${referrer ? `
      <div class="referrer-card">
        ${referrer.avatar
          ? `<img src="${escapeHtml(referrer.avatar)}" class="referrer-avatar" alt="" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">`
          : ''}
        <div class="referrer-avatar-placeholder" ${referrer.avatar ? 'style="display:none"' : ''}>${escapeHtml((referrer.displayName || '?')[0].toUpperCase())}</div>
        <div>
          <div class="referrer-label">${icon('user', 10)} Người giới thiệu bạn</div>
          <div class="referrer-name">${escapeHtml(referrer.displayName)}</div>
        </div>
      </div>` : ''}

      ${ctvList.length > 0 ? `
      <div class="ctv-chip">
        <div class="ctv-chip-row">
          <div class="ctv-chip-item">
            <div class="num">${ctvList.length}</div>
            <div class="lbl">CTV F1</div>
          </div>
          <div class="ctv-chip-item">
            <div class="num">${formatVND(summary.totalReferrerEarnings)}</div>
            <div class="lbl">Bạn nhận</div>
          </div>
        </div>
      </div>` : ''}
    </aside>

    <!-- Main -->
    <main class="main-content">
      <!-- Hàng 1: Thu nhập -->
      <div class="stat-grid stat-grid-3">
        ${cardTotalEarnings}
        ${cardPaid}
        ${cardPending}
      </div>
      <!-- Hàng 2: Chi tiết theo nguồn -->
      <div class="stat-grid ${cardReferrer ? 'stat-grid-2' : 'stat-grid-2'}" style="${!cardReferrer ? 'grid-template-columns:1fr' : ''}">
        ${cardOrders}
        ${cardReferrer}
      </div>

      ${summary.hasCustomOrders ? `
      <!-- Custom F1 Section -->
      <section class="data-section" style="border-color:rgba(168,85,247,0.2)">
        <div class="section-header" style="background:rgba(168,85,247,0.04)">
          <span class="section-icon purple">${icon('target', 14)}</span>
          <span class="section-title-wrap">
            <span class="section-title">Đơn Custom F1 — gửi link cho khách</span>
            <span class="badge-count" style="background:rgba(168,85,247,0.18);color:#c084fc">${customOrders.length} đơn</span>
          </span>
          <span style="margin-left:auto;font-size:11px;color:#c084fc;background:rgba(168,85,247,0.10);border:1px solid rgba(168,85,247,0.20);padding:3px 10px;border-radius:10px;font-weight:600">
            Tỷ lệ: ${summary.customRate}%
          </span>
        </div>
        <div style="padding:10px 18px;background:rgba(168,85,247,0.04);border-bottom:1px solid rgba(168,85,247,0.10);display:flex;flex-wrap:wrap;gap:14px;font-size:11px">
          <span>Tổng: <strong style="color:#c084fc">${summary.totalCustomOrders}</strong></span>
          <span>Hoàn thành: <strong style="color:#34d399">${summary.completedCustomCount}</strong></span>
          <span>Đang xử lý: <strong style="color:#fbbf24">${summary.pendingCustomCount}</strong></span>
          <span>HH bạn nhận: <strong style="color:#c084fc">${formatVND(summary.totalCustomCashback)}</strong></span>
          <span>Đã nhận: <strong style="color:#34d399">${formatVND(summary.totalCustomPaid)}</strong></span>
          <span>Chờ duyệt: <strong style="color:#fbbf24">${formatVND(summary.pendingCustomPayment)}</strong></span>
          <span>Khách F2: <strong style="color:#22d3ee">${summary.uniqueF2Count}</strong></span>
        </div>
        <div class="table-container">
          <table id="tbl-custom">
            <thead>
              <tr>
                <th>Thông tin đơn hàng</th>
                <th class="text-center">SĐT khách F2</th>
                <th class="text-right">Giá trị đơn</th>
                <th class="text-center">Trạng thái</th>
                <th class="text-right" style="color:#c084fc">Hoa hồng bạn nhận</th>
              </tr>
            </thead>
            <tbody>${customOrdersHtml}</tbody>
          </table>
        </div>
        <div class="pagination-bar" id="pg-custom" style="border-color:rgba(168,85,247,0.10)">
          <span class="pagination-info" id="pg-custom-info"></span>
          <div class="pagination-controls" id="pg-custom-ctrl"></div>
        </div>
      </section>` : ''}

      ${(() => {
        const maxCommission = Math.max(...monthlyChart.map(m => m.commission), 1);
        const chartWidth = 480, chartHeight = 180, barWidth = 52, gap = 20, startX = 32;
        const bars = monthlyChart.map((m, i) => {
          const barH = Math.max((m.commission / maxCommission) * (chartHeight - 40), 2);
          const x = startX + i * (barWidth + gap);
          const y = chartHeight - 20 - barH;
          const val = m.commission >= 1000000 ? (m.commission / 1000000).toFixed(1) + 'M'
                    : m.commission >= 1000 ? Math.round(m.commission / 1000) + 'k'
                    : Math.round(m.commission);
          return `<g>
            <defs><linearGradient id="barGrad${i}" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#60a5fa"/><stop offset="100%" stop-color="#3b82f6" stop-opacity="0.5"/></linearGradient></defs>
            <rect x="${x}" y="${y}" width="${barWidth}" height="${barH}" rx="6" fill="url(#barGrad${i})"/>
            <text x="${x + barWidth/2}" y="${y - 6}" class="chart-bar-value">${val}đ</text>
            <text x="${x + barWidth/2}" y="${chartHeight - 4}" class="chart-month-label">${m.label}</text>
          </g>`;
        }).join('');
        if (monthlyChart.some(m => m.commission > 0)) {
          return `
          <section class="data-section">
            <div class="section-header">
              <span class="section-icon">${icon('trendingUp', 14)}</span>
              <span class="section-title-wrap">
                <span class="section-title">Doanh thu 6 tháng</span>
                <span class="badge-count">${formatVND(monthlyChart.reduce((s,m) => s + m.commission, 0))}</span>
              </span>
            </div>
            <div class="chart-container">
              <svg class="chart-svg" viewBox="0 0 ${chartWidth} ${chartHeight}" preserveAspectRatio="xMidYMid meet">${bars}</svg>
            </div>
          </section>`;
        }
        return '';
      })()}

      ${ctvList.length > 0 ? `
      <section class="data-section">
        <div class="section-header">
          <span class="section-icon purple">${icon('users', 14)}</span>
          <span class="section-title-wrap">
            <span class="section-title">Cộng tác viên & Thu nhập theo cấp</span>
            <span class="badge-count">${ctvList.length} F1</span>
          </span>
          <span style="margin-left:auto;font-size:11px;color:#34d399;font-weight:600">
            Tổng: ${formatVND(summary.totalReferrerEarnings)}
          </span>
        </div>
        <div class="ctv-header">
          <div class="ctv-header-name">Thành viên</div>
          <div class="ctv-header-val">Đã nhận</div>
          <div class="ctv-header-val">Đang xử lý</div>
        </div>
        <div class="ctv-tree">
          ${ctvList.map(node => renderCtvNode(node, 1, rates)).join('')}
        </div>
      </section>` : ''}

      <!-- Links Section -->
      <section class="data-section">
        <div class="section-header">
          <span class="section-icon">${icon('link', 14)}</span>
          <span class="section-title-wrap">
            <span class="section-title">Link đã tạo</span>
            <span class="badge-count">${links.length}</span>
          </span>
        </div>
        ${links.length > 0 ? `
        <div class="table-container">
          <table id="tbl-links">
            <thead>
              <tr>
                <th>Sản phẩm / Link</th>
                <th class="text-right">Hoa hồng bạn nhận</th>
                <th class="text-right">Thời gian</th>
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
          <div class="empty-icon">${icon('link', 32)}</div>
          <p>Bạn chưa tạo link affiliate nào.</p>
        </div>`}
      </section>

      <!-- Orders Section -->
      <section class="data-section">
        <div class="section-header">
          <span class="section-icon green">${icon('shoppingBag', 14)}</span>
          <span class="section-title-wrap">
            <span class="section-title">Đơn hàng phát sinh</span>
            <span class="badge-count">${matchedOrders.length}</span>
          </span>
        </div>
        ${matchedOrders.length > 0 ? `
        <div class="table-container">
          <table id="tbl-orders">
            <thead>
              <tr>
                <th>Thông tin đơn hàng</th>
                <th class="text-right">Giá trị đơn</th>
                <th class="text-center">Trạng thái</th>
                <th class="text-right">Hoa hồng bạn nhận</th>
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
          <div class="empty-icon">${icon('shoppingBag', 32)}</div>
          <p>Chưa có đơn hàng nào ghi nhận.</p>
        </div>`}
      </section>

      <!-- Payouts Section -->
      <section class="data-section">
        <div class="section-header">
          <span class="section-icon cyan">${icon('creditCard', 14)}</span>
          <span class="section-title-wrap">
            <span class="section-title">Lịch sử nhận tiền</span>
            <span class="badge-count">${payouts.length}</span>
          </span>
        </div>
        ${payouts.length > 0 ? `
        <div class="table-container">
          <table id="tbl-payouts">
            <thead>
              <tr>
                <th>Ngày</th>
                <th class="text-right">Số tiền</th>
                <th>Phương thức</th>
                <th>Vai trò</th>
                <th>Ghi chú</th>
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
          <div class="empty-icon">${icon('creditCard', 32)}</div>
          <p>Chưa có lịch sử thanh toán.</p>
        </div>`}
      </section>

      <footer class="footer">
        <div class="expire-notice">
          ${icon('clock', 14)} Báo cáo tự hủy sau 24 giờ để bảo mật
        </div>
        <p>Cập nhật: ${formatDate(generatedAt)}</p>
        <p style="margin-top:4px;opacity:0.6">Shopee Affiliate System</p>
      </footer>
    </main>
  </div>

  <script>
    // ── Pagination ──
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
        const infoEl = document.getElementById(infoId);
        if (infoEl) infoEl.textContent = (total === 0 ? '0' : start + 1) + '–' + Math.min(start + pageSize, total) + ' / ' + total + ' bản ghi';
        const ctrlEl = document.getElementById(ctrlId);
        if (!ctrlEl) return;
        ctrlEl.innerHTML = '';
        const prev = document.createElement('button');
        prev.className = 'page-btn'; prev.textContent = '‹'; prev.disabled = page === 1;
        prev.onclick = () => render(cur - 1);
        ctrlEl.appendChild(prev);
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
          btn.textContent = p; btn.onclick = () => render(p);
          ctrlEl.appendChild(btn);
          last = p;
        });
        const next = document.createElement('button');
        next.className = 'page-btn'; next.textContent = '›'; next.disabled = page === totalPages;
        next.onclick = () => render(cur + 1);
        ctrlEl.appendChild(next);
      }
      render(1);
    }

    // ── Info tooltip — global fixed portal (avoids backdrop-filter stacking) ──
    const globalTip = document.getElementById('global-tip');
    let activeTipBtn = null;

    function closeTip() {
      globalTip.hidden = true;
      if (activeTipBtn) { activeTipBtn.setAttribute('aria-expanded', 'false'); activeTipBtn = null; }
    }

    function positionTip(btn) {
      const rect = btn.getBoundingClientRect();
      const tipW = 260;
      const vw = window.innerWidth;
      let left = rect.right - tipW;
      if (left < 8) left = 8;
      if (left + tipW > vw - 8) left = vw - tipW - 8;
      let top = rect.bottom + 8;
      globalTip.style.left = left + 'px';
      globalTip.style.top = top + 'px';
      globalTip.style.width = tipW + 'px';
    }

    function initTooltips() {
      document.querySelectorAll('[data-tip]').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const pop = btn.parentElement.querySelector('.info-popover');
          if (!pop) return;
          if (activeTipBtn === btn) { closeTip(); return; }
          closeTip();
          globalTip.innerHTML = pop.innerHTML;
          globalTip.hidden = false;
          positionTip(btn);
          activeTipBtn = btn;
          btn.setAttribute('aria-expanded', 'true');
        });
      });
      document.addEventListener('click', closeTip);
      window.addEventListener('scroll', closeTip, { passive: true });
      window.addEventListener('resize', closeTip, { passive: true });
    }

    // ── CTV expandable rows ──
    function initCtvTree() {
      document.querySelectorAll('[data-toggle-children]').forEach(row => {
        row.addEventListener('click', () => {
          const children = row.parentElement.querySelector('.ctv-children');
          if (!children) return;
          const willOpen = children.hidden;
          children.hidden = !willOpen;
          row.classList.toggle('is-expanded', willOpen);
        });
      });
    }

    document.addEventListener('DOMContentLoaded', function() {
      paginateTable('links',   'pg-links-info',   'pg-links-ctrl',   10);
      paginateTable('orders',  'pg-orders-info',  'pg-orders-ctrl',  10);
      paginateTable('payouts', 'pg-payouts-info', 'pg-payouts-ctrl', 10);
      paginateTable('custom',  'pg-custom-info',  'pg-custom-ctrl',  10);
      initTooltips();
      initCtvTree();
    });
  </script>
</body>
</html>`;
}

module.exports = { renderReport };
