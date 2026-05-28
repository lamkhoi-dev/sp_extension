import { useState, useRef, useCallback } from 'react';
import {
  History,
  UserPlus,
  UserMinus,
  Edit,
  CreditCard,
  RefreshCw,
  Settings,
  FileText,
  LogIn,
  LogOut,
  Shield,
  Eye,
  Trash2,
  Download,
  Upload,
  Link,
  Bell,
  Banknote,
  BarChart3,
  Clock,
  Activity,
  QrCode,
  Server,
} from 'lucide-react';
import Card from '../components/ui/Card';
import { useAuditLogs } from '../hooks/useApi';

// Keys are lowercase — action from server is normalized via .toLowerCase() at lookup time
const actionIcons = {
  // ── Auth ────────────────────────────────────────────────
  login:              { icon: LogIn,       bg: 'bg-teal-500',     ring: 'ring-teal-500/20',     label: 'Đăng nhập' },
  logout:             { icon: LogOut,      bg: 'bg-slate-500',    ring: 'ring-slate-500/20',    label: 'Đăng xuất' },
  change_password:    { icon: Shield,      bg: 'bg-rose-500',     ring: 'ring-rose-500/20',     label: 'Đổi mật khẩu' },

  // ── Payout ──────────────────────────────────────────────
  create_payout:      { icon: Banknote,    bg: 'bg-violet-500',   ring: 'ring-violet-500/20',   label: 'Tạo thanh toán' },
  update_bill:        { icon: Upload,      bg: 'bg-indigo-500',   ring: 'ring-indigo-500/20',   label: 'Upload bill' },

  // ── User ────────────────────────────────────────────────
  update_user_rates:  { icon: BarChart3,   bg: 'bg-lime-500',     ring: 'ring-lime-500/20',     label: 'Cập nhật tỷ lệ' },
  update_bank_info:   { icon: CreditCard,  bg: 'bg-blue-500',     ring: 'ring-blue-500/20',     label: 'Cập nhật NH' },
  update_bank:        { icon: QrCode,      bg: 'bg-sky-500',      ring: 'ring-sky-500/20',      label: 'QR tùy chỉnh' },

  // ── Order ───────────────────────────────────────────────
  simulate_order:     { icon: FileText,    bg: 'bg-amber-500',    ring: 'ring-amber-500/20',    label: 'Mô phỏng đơn' },
  sync_orders:        { icon: RefreshCw,   bg: 'bg-cyan-500',     ring: 'ring-cyan-500/20',     label: 'Đồng bộ đơn' },
  import_csv:         { icon: Download,    bg: 'bg-fuchsia-500',  ring: 'ring-fuchsia-500/20',  label: 'Nhập CSV' },

  // ── System ──────────────────────────────────────────────
  zalo_restart:       { icon: RefreshCw,   bg: 'bg-orange-500',   ring: 'ring-orange-500/20',   label: 'Restart Zalo' },

  // ── Legacy / extras ─────────────────────────────────────
  create_user:        { icon: UserPlus,    bg: 'bg-emerald-500',  ring: 'ring-emerald-500/20',  label: 'Thêm user' },
  delete_user:        { icon: UserMinus,   bg: 'bg-red-500',      ring: 'ring-red-500/20',      label: 'Xóa user' },
  payout:             { icon: Banknote,    bg: 'bg-violet-500',   ring: 'ring-violet-500/20',   label: 'Thanh toán' },
  settings:           { icon: Settings,    bg: 'bg-amber-600',    ring: 'ring-amber-600/20',    label: 'Cài đặt' },
  vps_settings_updated:{ icon: Server,      bg: 'bg-teal-600',     ring: 'ring-teal-600/20',     label: 'Cập nhật VPS' },
};

// Badge pill colors — matched to icon bg for consistency
const actionBadgeColors = {
  login:              'bg-teal-50    text-teal-700    dark:bg-teal-900/30    dark:text-teal-400',
  logout:             'bg-slate-100  text-slate-600   dark:bg-slate-700/50   dark:text-slate-400',
  change_password:    'bg-rose-50    text-rose-700    dark:bg-rose-900/30    dark:text-rose-400',
  create_payout:      'bg-violet-50  text-violet-700  dark:bg-violet-900/30  dark:text-violet-400',
  update_bill:        'bg-indigo-50  text-indigo-700  dark:bg-indigo-900/30  dark:text-indigo-400',
  update_user_rates:  'bg-lime-50    text-lime-700    dark:bg-lime-900/30    dark:text-lime-400',
  update_bank_info:   'bg-blue-50    text-blue-700    dark:bg-blue-900/30    dark:text-blue-400',
  update_bank:        'bg-sky-50     text-sky-700     dark:bg-sky-900/30     dark:text-sky-400',
  simulate_order:     'bg-amber-50   text-amber-700   dark:bg-amber-900/30   dark:text-amber-400',
  sync_orders:        'bg-cyan-50    text-cyan-700    dark:bg-cyan-900/30    dark:text-cyan-400',
  import_csv:         'bg-fuchsia-50 text-fuchsia-700 dark:bg-fuchsia-900/30 dark:text-fuchsia-400',
  zalo_restart:       'bg-orange-50  text-orange-700  dark:bg-orange-900/30  dark:text-orange-400',
  create_user:        'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  delete_user:        'bg-red-50     text-red-700     dark:bg-red-900/30     dark:text-red-400',
  payout:             'bg-violet-50  text-violet-700  dark:bg-violet-900/30  dark:text-violet-400',
  vps_settings_updated:'bg-teal-50    text-teal-700    dark:bg-teal-900/30    dark:text-teal-400',
};

const defaultBadge = 'bg-slate-100 text-slate-600 dark:bg-slate-700/50 dark:text-slate-400';


export default function SystemHistoryPage() {
  const { logs, stats, admins, loading, loadingMore, hasMore, filters, setFilters, loadMore } = useAuditLogs();

  const observer = useRef();
  const lastLogElementRef = useCallback(node => {
    if (loading || loadingMore) return;
    if (observer.current) observer.current.disconnect();
    observer.current = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && hasMore) {
        loadMore();
      }
    });
    if (node) observer.current.observe(node);
  }, [loading, loadingMore, hasMore, loadMore]);

  // Stats derived from the stats prop
  const todayCount = stats?.today || 0;
  const totalCount = stats?.total || logs.length;
  const uniqueAdmins = admins?.length || 0;

  return (
    <div className="space-y-5">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-slate-700 to-slate-900 dark:from-slate-500 dark:to-slate-700 flex items-center justify-center">
              <Shield className="w-4.5 h-4.5 text-white" />
            </div>
            Log Hệ Thống
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Theo dõi mọi hoạt động quản trị viên
          </p>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-3 gap-2 sm:gap-4">
        <div className="bg-white dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700/50 p-2.5 sm:p-4">
          <div className="flex items-center gap-1.5 mb-1">
            <Activity className="w-3.5 h-3.5 text-blue-500" />
            <p className="text-[10px] sm:text-xs text-slate-500">Tổng log</p>
          </div>
          <p className="text-lg sm:text-2xl font-bold text-slate-900 dark:text-white">{totalCount}</p>
        </div>
        <div className="bg-white dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700/50 p-2.5 sm:p-4">
          <div className="flex items-center gap-1.5 mb-1">
            <Clock className="w-3.5 h-3.5 text-emerald-500" />
            <p className="text-[10px] sm:text-xs text-slate-500">Hôm nay</p>
          </div>
          <p className="text-lg sm:text-2xl font-bold text-emerald-500">{todayCount}</p>
        </div>
        <div className="bg-white dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700/50 p-2.5 sm:p-4">
          <div className="flex items-center gap-1.5 mb-1">
            <Shield className="w-3.5 h-3.5 text-indigo-500" />
            <p className="text-[10px] sm:text-xs text-slate-500">Admin</p>
          </div>
          <p className="text-lg sm:text-2xl font-bold text-indigo-500">{uniqueAdmins}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Filter by Admin */}
        <select
          value={filters.admin}
          onChange={(e) => setFilters(prev => ({ ...prev, admin: e.target.value }))}
          className="px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400"
        >
          <option value="">Tất cả Admin</option>
          {admins.map(a => (
            <option key={a} value={a}>{a}</option>
          ))}
        </select>
        
        {/* Filter by Action — values shown in UI labels, sent as uppercase to match DB */}
        <select
          value={filters.action}
          onChange={(e) => setFilters(prev => ({ ...prev, action: e.target.value }))}
          className="px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400"
        >
          <option value="">Tất cả Hoạt động</option>
          {Object.entries(actionIcons).map(([key, conf]) => (
            <option key={key} value={key.toUpperCase()}>{conf.label}</option>
          ))}
        </select>

        {/* Active filters hint */}
        {(filters.admin || filters.action) && (
          <button
            onClick={() => setFilters({ admin: '', action: '' })}
            className="text-xs px-2.5 py-1.5 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors"
          >
            ✕ Xoá bộ lọc
          </button>
        )}
      </div>

      {/* Content */}
      <Card className="-mx-4 sm:mx-0 p-0 overflow-hidden rounded-none sm:rounded-xl border-x-0 sm:border-x">
        <div className="divide-y divide-slate-100 dark:divide-slate-800">
          {logs.map((log, index) => {
            const actionKey = (log.action || '').toLowerCase();
            const actionConfig = actionIcons[actionKey] || { icon: History, bg: 'bg-slate-500', ring: 'ring-slate-500/20', label: log.action || 'Khác' };
            const ActionIcon = actionConfig.icon;
            const time = new Date(log.created_at).toLocaleString('vi-VN');
            
            let description = '';
            if (typeof log.details === 'object' && log.details !== null) {
               description = log.details.message || JSON.stringify(log.details);
            } else {
               description = log.details || `${actionConfig.label} ${log.resource_type} ${log.resource_id}`;
            }

            const isLast = logs.length === index + 1;

            return (
              <div
                ref={isLast ? lastLogElementRef : undefined}
                key={log.id}
                className="flex items-start gap-3 px-3 sm:px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors group"
              >
                {/* Icon */}
                <div className={`w-9 h-9 rounded-xl ${actionConfig.bg} ring-4 ${actionConfig.ring} flex items-center justify-center flex-shrink-0 shadow-sm`}>
                  <ActionIcon className="w-4 h-4 text-white" />
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <p className="text-slate-800 dark:text-slate-100 text-sm font-medium leading-snug line-clamp-2">
                    {description}
                  </p>
                  <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                    {/* Action badge */}
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${actionBadgeColors[actionKey] || defaultBadge}`}>
                      {actionConfig.label}
                    </span>
                    <span className="text-slate-300 dark:text-slate-600">·</span>
                    {/* Admin name */}
                    <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 truncate max-w-[120px]">
                      {log.admin_username}
                    </span>
                    <span className="text-slate-300 dark:text-slate-600 hidden sm:inline">·</span>
                    {/* Timestamp */}
                    <span className="text-xs text-slate-400 hidden sm:inline">{time}</span>
                    {/* IP */}
                    {log.ip_address && (
                      <>
                        <span className="text-slate-300 dark:text-slate-600 hidden sm:inline">·</span>
                        <span className="hidden sm:inline text-[10px] text-slate-400 font-mono">
                          {log.ip_address}
                        </span>
                      </>
                    )}
                  </div>
                </div>

                {/* Timestamp for mobile */}
                <div className="sm:hidden text-right flex-shrink-0">
                  <p className="text-[10px] text-slate-400 whitespace-nowrap">
                    {new Date(log.created_at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                  </p>
                  <p className="text-[9px] text-slate-300 dark:text-slate-600">
                    {new Date(log.created_at).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })}
                  </p>
                </div>
              </div>
            );
          })}

          {logs.length === 0 && !loading && (
            <div className="p-12 text-center">
              <History className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
              <p className="text-slate-500 text-sm">Không tìm thấy hoạt động nào</p>
              {(filters.admin || filters.action) && (
                <p className="text-xs text-slate-400 mt-1">Thử xoá bộ lọc để xem tất cả</p>
              )}
            </div>
          )}
          
          {(loading || loadingMore) && (
            <div className="p-4 text-center">
              <RefreshCw className="w-5 h-5 text-blue-500 animate-spin mx-auto mb-1" />
              <p className="text-sm text-slate-500">Đang tải...</p>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
