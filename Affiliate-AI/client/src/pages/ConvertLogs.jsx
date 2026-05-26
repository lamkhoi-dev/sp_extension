import { useState, useCallback } from 'react';
import Tooltip from '../components/ui/Tooltip';
import {
  Link2, ExternalLink, Copy, Check, RefreshCw, CheckCircle,
  XCircle, MousePointerClick, X, Monitor, Smartphone, Tablet, Bot,
} from 'lucide-react';
import DataTable from '../components/ui/DataTable';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';
import { useConvertLogs, useClickEvents, formatVND } from '../hooks/useApi';

// ─── Device Icon ────────────────────────────────────────
function DeviceIcon({ type, className = 'w-3.5 h-3.5' }) {
  if (type === 'mobile') return <Smartphone className={className} />;
  if (type === 'tablet') return <Tablet className={className} />;
  if (type === 'bot')    return <Bot className={className} />;
  return <Monitor className={className} />;
}

// ─── Click Detail Modal ──────────────────────────────────
function ClicksModal({ log, onClose }) {
  const { clicks, total, loading, fetchClicks } = useClickEvents();
  const [fetched, setFetched] = useState(false);

  // Fetch on first open
  const token = log?.redirect_token;
  if (!fetched && token) {
    setFetched(true);
    fetchClicks(token);
  }

  function fmtTime(dt) {
    if (!dt) return '--';
    const d = new Date(dt);
    if (isNaN(d)) return dt;
    return d.toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' });
  }

  const deviceColor = {
    mobile: 'text-blue-500',
    tablet: 'text-teal-500',
    desktop: 'text-slate-500',
    bot: 'text-orange-400',
    unknown: 'text-slate-400',
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 w-full max-w-3xl max-h-[80vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-700">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <MousePointerClick className="w-4 h-4 text-orange-500" />
              Chi tiết Click — <span className="font-mono text-orange-500 text-sm">{token}</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Sản phẩm: <span className="text-slate-700 dark:text-slate-300">{log?.product_name || '--'}</span>
              {' '}• User: <span className="text-slate-700 dark:text-slate-300">{log?.user_name || '--'}</span>
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Stats bar */}
        <div className="px-5 py-3 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700 flex items-center gap-6 text-sm">
          <span className="text-slate-500">Tổng clicks:</span>
          <span className="font-bold text-slate-900 dark:text-white">{loading ? '…' : total}</span>
        </div>

        {/* Click list */}
        <div className="overflow-y-auto flex-1">
          {loading ? (
            <div className="flex items-center justify-center py-14">
              <RefreshCw className="w-6 h-6 text-blue-500 animate-spin" />
            </div>
          ) : !token ? (
            <div className="text-center py-14 text-slate-400">
              <MousePointerClick className="w-8 h-8 mx-auto mb-2 opacity-40" />
              <p className="text-sm">Link này chưa dùng hệ thống redirect.</p>
              <p className="text-xs mt-1">Chỉ các link mới được tạo sau khi tính năng được bật mới có dữ liệu click.</p>
            </div>
          ) : clicks.length === 0 ? (
            <div className="text-center py-14 text-slate-400">
              <MousePointerClick className="w-8 h-8 mx-auto mb-2 opacity-40" />
              <p className="text-sm">Chưa có lượt click nào</p>
            </div>
          ) : (
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700">
                <tr>
                  {['#', 'Thời gian', 'Thiết bị', 'OS', 'Browser', 'IP', 'Ngôn ngữ', 'Referer'].map(h => (
                    <th key={h} className="px-3 py-2.5 text-left font-semibold text-slate-500 dark:text-slate-400 whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {clicks.map((c, i) => (
                  <tr
                    key={c.id}
                    className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/40"
                  >
                    <td className="px-3 py-2 text-slate-400">{i + 1}</td>
                    <td className="px-3 py-2 whitespace-nowrap text-slate-600 dark:text-slate-400">{fmtTime(c.clicked_at)}</td>
                    <td className="px-3 py-2">
                      <span className={`flex items-center gap-1 font-medium ${deviceColor[c.device_type] || 'text-slate-400'}`}>
                        <DeviceIcon type={c.device_type} />
                        {c.device_type || '--'}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-slate-700 dark:text-slate-300">{c.os_name || '--'}</td>
                    <td className="px-3 py-2 text-slate-700 dark:text-slate-300">{c.browser_name || '--'}</td>
                    <td className="px-3 py-2 font-mono text-slate-500">{c.ip_address || '--'}</td>
                    <td className="px-3 py-2 text-slate-500">{c.accept_language ? c.accept_language.split(',')[0] : '--'}</td>
                    <td className="px-3 py-2 max-w-[150px] truncate text-slate-400" title={c.referer || ''}>
                      {c.referer || '--'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-slate-200 dark:border-slate-700 flex justify-end">
          <Button variant="outline" onClick={onClose}>Đóng</Button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────
export default function ConvertLogsPage() {
  const { logs, stats, loading, search, setSearch, refresh } = useConvertLogs();
  const [copiedId, setCopiedId] = useState(null);
  const [clicksModal, setClicksModal] = useState(null); // log row being inspected

  const copyToClipboard = (text, id) => {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text)
        .then(() => { setCopiedId(id); setTimeout(() => setCopiedId(null), 2000); })
        .catch(() => fallbackCopy(text, id));
    } else {
      fallbackCopy(text, id);
    }
  };

  const fallbackCopy = (text, id) => {
    try {
      const textArea = document.createElement('textarea');
      textArea.value = text;
      textArea.style.cssText = 'position:fixed;top:0;left:0';
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      if (document.execCommand('copy')) { setCopiedId(id); setTimeout(() => setCopiedId(null), 2000); }
      document.body.removeChild(textArea);
    } catch {}
  };

  const columns = [
    {
      key: 'created_at',
      label: 'Thời gian',
      render: (value) => {
        if (!value) return '--';
        const d = new Date(value);
        return (
          <div className="text-slate-600 dark:text-slate-400 text-xs whitespace-nowrap">
            <div>{d.toLocaleDateString('vi-VN')}</div>
            <div className="text-[10px] text-slate-400 font-normal">
              {d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
            </div>
          </div>
        );
      },
    },
    {
      key: 'user_name',
      label: 'Khách hàng',
      render: (value, row) => (
        <div className="flex items-center gap-2 min-w-0">
          {row.user_avatar ? (
            <img
              src={row.user_avatar} alt=""
              className="w-8 h-8 rounded-full flex-shrink-0 object-cover border border-slate-200 dark:border-slate-700"
              onError={e => { e.target.style.display = 'none'; }}
            />
          ) : (
            <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-xs font-semibold text-slate-400 flex-shrink-0 border border-slate-200 dark:border-slate-700">
              {(value || '?').charAt(0).toUpperCase()}
            </div>
          )}
          <div className="min-w-0">
            <p className="font-medium text-slate-900 dark:text-white text-sm truncate">{value || '--'}</p>
            <p className="text-[10px] text-slate-500">{row.user_id ? row.user_id.slice(0, 10) : '--'}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'product_name',
      label: 'Sản phẩm',
      hideOnMobile: true,
      render: (value) => (
        <span className="text-slate-600 dark:text-slate-400 text-xs max-w-[150px] truncate block" title={value}>
          {value || '--'}
        </span>
      ),
    },
    {
      key: 'sub_id2',
      label: 'Người giới thiệu',
      hideOnMobile: true,
      render: (value, row) => {
        const refName = row.referrer_name_db || value;
        const refAvatar = row.referrer_avatar;
        if (!value) return <span className="text-slate-400 text-xs">--</span>;
        return (
          <div className="flex items-center gap-1.5 min-w-0">
            {refAvatar ? (
              <img
                src={refAvatar} alt={refName}
                className="w-6 h-6 rounded-full flex-shrink-0 object-cover border border-slate-200 dark:border-slate-700"
                onError={e => { e.target.style.display = 'none'; }}
              />
            ) : (
              <div className="w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-[10px] font-semibold text-blue-500 flex-shrink-0">
                {(refName || '?').charAt(0).toUpperCase()}
              </div>
            )}
            <span className="text-xs text-blue-500 truncate max-w-[80px]" title={refName}>{refName || value.slice(0, 8)}</span>
          </div>
        );
      },
    },
    {
      key: 'commission_rate',
      label: 'HH %',
      render: (value, row) => (
        <div className="text-right">
          <span className="font-semibold text-emerald-500 text-sm">{value ? `${value}%` : '--'}</span>
          {row.commission_amount > 0 && (
            <p className="text-[10px] text-slate-400">{formatVND(row.commission_amount)}</p>
          )}
        </div>
      ),
    },
    {
      key: 'short_link',
      label: 'Link',
      hideOnMobile: true,
      render: (value, row) => {
        // Prefer our custom short link (redirect_token exists), else fallback
        const hasRedirect = !!row.redirect_token;
        const serverUrl = import.meta.env.VITE_API_URL?.replace('/api', '') || '';
        const shortUrl = hasRedirect ? `${serverUrl}/go/${row.redirect_token}` : null;
        const displayLink = shortUrl || row.short_link || row.affiliate_link || row.original_link;
        const copyLink = shortUrl || row.short_link || row.affiliate_link;
        const showCopy = row.status === 'success' && copyLink;
        return displayLink ? (
          <div className="flex items-center gap-2 max-w-[200px]">
            <a
              href={displayLink} target="_blank" rel="noopener noreferrer"
              className="text-blue-500 hover:text-blue-600 text-xs truncate hover:underline flex-grow"
              title={displayLink}
            >
              {hasRedirect ? `…/go/${row.redirect_token}` : displayLink}
            </a>
            {showCopy && (
              <button
                onClick={e => { e.stopPropagation(); copyToClipboard(copyLink, row.id); }}
                className="text-slate-400 hover:text-blue-500 flex-shrink-0 p-1 hover:bg-slate-100 dark:hover:bg-slate-700/50 rounded transition-colors"
                title="Sao chép link"
              >
                {copiedId === row.id
                  ? <Check className="w-3.5 h-3.5 text-emerald-500" />
                  : <Copy className="w-3.5 h-3.5" />
                }
              </button>
            )}
          </div>
        ) : <span className="text-slate-400 text-sm">-</span>;
      },
    },
    {
      key: 'redirect_token',
      label: 'Clicks',
      render: (token, row) => {
        if (!token) {
          return <span className="text-slate-300 dark:text-slate-600 text-xs">—</span>;
        }
        const count = row.click_count ?? '?';
        return (
          <button
            onClick={() => setClicksModal(row)}
            className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400 hover:bg-orange-100 dark:hover:bg-orange-900/40 border border-orange-200 dark:border-orange-800/50 transition-colors"
            title="Xem chi tiết click"
          >
            <MousePointerClick className="w-3 h-3" />
            {count}
          </button>
        );
      },
    },
    {
      key: 'status',
      label: 'Trạng thái',
      render: (value) => (
        <Badge
          variant={value === 'success' ? 'success' : value === 'no_commission' ? 'warning' : 'danger'}
          dot
        >
          {value === 'success' ? 'Thành công' : value === 'no_commission' ? 'Không hoàn tiền' : 'Lỗi'}
        </Badge>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
            Lịch sử Convert Link
          </h1>
          <p className="text-slate-500 dark:text-slate-400">
            Log tất cả các lần convert link affiliate
          </p>
        </div>
        <Button variant="outline" icon={RefreshCw} onClick={refresh} disabled={loading}>
          {loading ? 'Đang tải...' : 'Refresh'}
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-2 sm:gap-4">
        <div className="bg-white dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700/50 p-2.5 sm:p-4">
          <div className="flex items-center gap-1.5 mb-1">
            <Link2 className="w-3.5 h-3.5 text-slate-400" />
            <p className="text-[10px] sm:text-xs text-slate-500 dark:text-slate-400">Tổng Convert</p>
            <Tooltip text="Tổng số lần chuyển đổi link Shopee thành link affiliate (bao gồm cả lỗi)." />
          </div>
          <p className="text-lg sm:text-2xl font-bold text-slate-900 dark:text-white">
            {stats?.total || 0}
          </p>
        </div>
        <div className="bg-white dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700/50 p-2.5 sm:p-4">
          <div className="flex items-center gap-1.5 mb-1">
            <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />
            <p className="text-[10px] sm:text-xs text-slate-500 dark:text-slate-400">Thành công</p>
            <Tooltip text="Số link đã chuyển đổi thành công, tạo được link affiliate hợp lệ." />
          </div>
          <p className="text-lg sm:text-2xl font-bold text-emerald-500">{stats?.success || 0}</p>
        </div>
        <div className="bg-white dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700/50 p-2.5 sm:p-4">
          <div className="flex items-center gap-1.5 mb-1">
            <XCircle className="w-3.5 h-3.5 text-red-500" />
            <p className="text-[10px] sm:text-xs text-slate-500 dark:text-slate-400">Lỗi</p>
            <Tooltip text="Số link chuyển đổi thất bại (sản phẩm không hoa hồng, link lỗi...)." />
          </div>
          <p className="text-lg sm:text-2xl font-bold text-red-500">{stats?.failed || 0}</p>
        </div>
      </div>

      {/* Data Table */}
      <div className="bg-white dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700/50 p-4 sm:p-6">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <RefreshCw className="w-6 h-6 text-blue-500 animate-spin" />
          </div>
        ) : (
          <DataTable
            columns={columns}
            data={logs}
            searchPlaceholder="Tìm kiếm theo user, sản phẩm, link..."
          />
        )}
      </div>

      {/* Click Detail Modal */}
      {clicksModal && (
        <ClicksModal
          log={clicksModal}
          onClose={() => setClicksModal(null)}
        />
      )}
    </div>
  );
}
