import { useState } from 'react';
import { Link2, ExternalLink, Copy, Check, Filter, CheckCircle, XCircle, RefreshCw, AlertCircle } from 'lucide-react';
import DataTable from '../components/ui/DataTable';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';
import { useConvertLogs, formatVND } from '../hooks/useApi';

export default function ConvertLogsPage() {
  const { logs, stats, loading, search, setSearch, refresh } = useConvertLogs();
  const [copiedId, setCopiedId] = useState(null);

  const copyToClipboard = (text, id) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const columns = [
    {
      key: 'created_at',
      label: 'Time',
      render: (value) => (
        <span className="text-slate-600 dark:text-slate-400 text-xs whitespace-nowrap">
          {value ? new Date(value).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : '--'}
        </span>
      ),
    },
    {
      key: 'user_name',
      label: 'User',
      render: (value, row) => (
        <div className="min-w-0">
          <p className="font-medium text-slate-900 dark:text-white text-sm truncate">{value || '--'}</p>
          <p className="text-[10px] text-slate-500">{row.sub_id1 ? row.sub_id1.slice(0, 10) : '--'}</p>
        </div>
      ),
    },
    {
      key: 'product_name',
      label: 'Sản phẩm',
      hideOnMobile: true,
      render: (value) => (
        <span className="text-slate-600 dark:text-slate-400 text-xs max-w-[150px] truncate block">
          {value || '--'}
        </span>
      ),
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
      render: (value, row) => (
        value ? (
          <div className="flex items-center gap-2 max-w-[150px]">
            <span className="text-blue-500 text-xs truncate">{value}</span>
            <button
              onClick={(e) => { e.stopPropagation(); copyToClipboard(value, row.id); }}
              className="text-slate-400 hover:text-blue-500 flex-shrink-0"
            >
              {copiedId === row.id
                ? <Check className="w-3 h-3 text-emerald-500" />
                : <Copy className="w-3 h-3" />
              }
            </button>
          </div>
        ) : <span className="text-slate-400 text-sm">-</span>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      render: (value) => (
        <Badge
          variant={value === 'success' ? 'success' : value === 'no_commission' ? 'warning' : 'danger'}
          dot
        >
          {value === 'success' ? 'OK' : value === 'no_commission' ? 'No HH' : 'Error'}
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
          </div>
          <p className="text-lg sm:text-2xl font-bold text-slate-900 dark:text-white">
            {stats?.total || 0}
          </p>
        </div>
        <div className="bg-white dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700/50 p-2.5 sm:p-4">
          <div className="flex items-center gap-1.5 mb-1">
            <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />
            <p className="text-[10px] sm:text-xs text-slate-500 dark:text-slate-400">Thành công</p>
          </div>
          <p className="text-lg sm:text-2xl font-bold text-emerald-500">{stats?.success || 0}</p>
        </div>
        <div className="bg-white dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700/50 p-2.5 sm:p-4">
          <div className="flex items-center gap-1.5 mb-1">
            <XCircle className="w-3.5 h-3.5 text-red-500" />
            <p className="text-[10px] sm:text-xs text-slate-500 dark:text-slate-400">Lỗi</p>
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
    </div>
  );
}
