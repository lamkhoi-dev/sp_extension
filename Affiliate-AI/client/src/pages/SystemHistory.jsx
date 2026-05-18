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
  Search,
  Filter,
} from 'lucide-react';
import Card from '../components/ui/Card';
import { useAuditLogs } from '../hooks/useApi';

const actionIcons = {
  create_user: { icon: UserPlus, color: 'bg-emerald-500', label: 'Thêm user' },
  update_user: { icon: Edit, color: 'bg-blue-500', label: 'Cập nhật' },
  delete_user: { icon: UserMinus, color: 'bg-red-500', label: 'Xóa user' },
  payout: { icon: CreditCard, color: 'bg-violet-500', label: 'Thanh toán' },
  sync: { icon: RefreshCw, color: 'bg-cyan-500', label: 'Đồng bộ' },
  settings: { icon: Settings, color: 'bg-amber-500', label: 'Cài đặt' },
  update_order: { icon: FileText, color: 'bg-orange-500', label: 'Đơn hàng' },
  login: { icon: History, color: 'bg-indigo-500', label: 'Đăng nhập' },
  logout: { icon: History, color: 'bg-slate-500', label: 'Đăng xuất' }
};

export default function SystemHistoryPage() {
  const { logs, stats, admins, loading, loadingMore, hasMore, filters, setFilters, loadMore } = useAuditLogs();

  const handleSearch = (e) => {
    // Only fetch on enter or button click if it was an API search, 
    // but right now the API filters are applied when state changes
    // Wait, the hook refetches when `filters` changes. 
    // For simple local search: wait, the API supports filtering by action, admin, dateFrom, dateTo.
    // Let's use the local state for search, or use API filters.
  };

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

  return (
    <div className="space-y-4">
      {/* Search + Filter */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
          <button
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm"
          >
            <History className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Hoạt động hệ thống</span>
          </button>
        </div>

        {/* Filter by Admin */}
        <select
          value={filters.admin}
          onChange={(e) => setFilters(prev => ({ ...prev, admin: e.target.value }))}
          className="px-3 py-1.5 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Tất cả Admin</option>
          {admins.map(a => (
            <option key={a} value={a}>{a}</option>
          ))}
        </select>
        
        {/* Filter by Action */}
        <select
          value={filters.action}
          onChange={(e) => setFilters(prev => ({ ...prev, action: e.target.value }))}
          className="px-3 py-1.5 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Tất cả Hoạt động</option>
          {Object.entries(actionIcons).map(([key, conf]) => (
            <option key={key} value={key}>{conf.label}</option>
          ))}
        </select>
      </div>

      {/* Content */}
      <Card className="-mx-4 sm:mx-0 p-0 overflow-hidden rounded-none sm:rounded-xl border-x-0 sm:border-x">
        <div className="divide-y divide-slate-100 dark:divide-slate-800">
          {logs.map((log, index) => {
            const actionConfig = actionIcons[log.action] || { icon: History, color: 'bg-slate-500', label: log.action || 'Khác' };
            const ActionIcon = actionConfig.icon;
            const time = new Date(log.created_at).toLocaleString('vi-VN');
            
            let description = '';
            if (typeof log.details === 'object' && log.details !== null) {
               description = log.details.message || JSON.stringify(log.details);
            } else {
               description = log.details || `${actionConfig.label} ${log.resource_type} ${log.resource_id}`;
            }

            if (logs.length === index + 1) {
              return (
                <div
                  ref={lastLogElementRef}
                  key={log.id}
                  className="flex items-center gap-3 p-3 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors"
                >
                  <LogItem log={log} actionConfig={actionConfig} ActionIcon={ActionIcon} description={description} time={time} />
                </div>
              );
            } else {
              return (
                <div
                  key={log.id}
                  className="flex items-center gap-3 p-3 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors"
                >
                  <LogItem log={log} actionConfig={actionConfig} ActionIcon={ActionIcon} description={description} time={time} />
                </div>
              );
            }
          })}

          {logs.length === 0 && !loading && (
            <div className="p-8 text-center text-slate-500">
              Không tìm thấy hoạt động nào
            </div>
          )}
          
          {(loading || loadingMore) && (
            <div className="p-4 text-center text-sm text-slate-500">
              Đang tải...
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}

function LogItem({ log, actionConfig, ActionIcon, description, time }) {
  return (
    <>
      <div className={`w-9 h-9 rounded-lg ${actionConfig.color} flex items-center justify-center flex-shrink-0`}>
        <ActionIcon className="w-4 h-4 text-white" />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-slate-800 dark:text-slate-100 text-sm font-medium truncate">
            {description}
          </p>
        </div>
        <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-500 dark:text-slate-400">
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 font-medium">
            {actionConfig.label}
          </span>
          <span className="text-slate-400">•</span>
          <span className="font-semibold text-slate-700 dark:text-slate-300 truncate">{log.admin_username}</span>
          <span className="text-slate-400 hidden sm:inline">•</span>
          <span className="hidden sm:inline">{time}</span>
          {log.ip_address && (
            <>
              <span className="text-slate-400 hidden sm:inline">•</span>
              <span className="hidden sm:inline text-xs text-slate-400">IP: {log.ip_address}</span>
            </>
          )}
        </div>
      </div>
    </>
  );
}

