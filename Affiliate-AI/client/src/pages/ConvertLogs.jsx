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
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text)
        .then(() => {
          setCopiedId(id);
          setTimeout(() => setCopiedId(null), 2000);
        })
        .catch(() => fallbackCopy(text, id));
    } else {
      fallbackCopy(text, id);
    }
  };

  const fallbackCopy = (text, id) => {
    try {
      const textArea = document.createElement("textarea");
      textArea.value = text;
      textArea.style.top = "0";
      textArea.style.left = "0";
      textArea.style.position = "fixed";
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      const successful = document.execCommand('copy');
      document.body.removeChild(textArea);
      if (successful) {
        setCopiedId(id);
        setTimeout(() => setCopiedId(null), 2000);
      }
    } catch (err) {
      console.error("Fallback copy error:", err);
    }
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
              src={row.user_avatar} 
              alt="" 
              className="w-8 h-8 rounded-full flex-shrink-0 object-cover border border-slate-200 dark:border-slate-700" 
              onError={(e) => { e.target.style.display = 'none'; }}
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
                src={refAvatar}
                alt={refName}
                className="w-6 h-6 rounded-full flex-shrink-0 object-cover border border-slate-200 dark:border-slate-700"
                onError={(e) => { e.target.style.display = 'none'; }}
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
      label: 'Link rút gọn',
      hideOnMobile: true,
      render: (value, row) => {
        const displayLink = row.short_link || row.affiliate_link || row.original_link;
        const copyLink = row.short_link || row.affiliate_link;
        const showCopy = row.status === 'success' && copyLink;
        return displayLink ? (
          <div className="flex items-center gap-2 max-w-[200px]">
            <a
              href={displayLink}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-500 hover:text-blue-600 text-xs truncate hover:underline flex-grow"
              title={displayLink}
            >
              {displayLink}
            </a>
            {showCopy && (
              <button
                onClick={(e) => { e.stopPropagation(); copyToClipboard(copyLink, row.id); }}
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
