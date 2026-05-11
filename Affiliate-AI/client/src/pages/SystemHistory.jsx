import { useState } from 'react';
import {
  History,
  Terminal,
  UserPlus,
  UserMinus,
  Edit,
  CreditCard,
  RefreshCw,
  Settings,
  FileText,
  AlertCircle,
  AlertTriangle,
  CheckCircle,
  Info,
  Search,
  Filter,
  Clock
} from 'lucide-react';
import Card from '../components/ui/Card';
import { systemHistory, systemLogs } from '../data/dummyData';

const actionIcons = {
  create_user: { icon: UserPlus, color: 'bg-emerald-500', label: 'Thêm user' },
  update_user: { icon: Edit, color: 'bg-blue-500', label: 'Cập nhật' },
  delete_user: { icon: UserMinus, color: 'bg-red-500', label: 'Xóa user' },
  payout: { icon: CreditCard, color: 'bg-violet-500', label: 'Thanh toán' },
  sync: { icon: RefreshCw, color: 'bg-cyan-500', label: 'Đồng bộ' },
  settings: { icon: Settings, color: 'bg-amber-500', label: 'Cài đặt' },
  update_order: { icon: FileText, color: 'bg-orange-500', label: 'Đơn hàng' },
};

const logLevelConfig = {
  info: { icon: Info, color: 'text-blue-400', bg: 'bg-blue-500/5 dark:bg-blue-500/10', label: 'INFO', dot: 'bg-blue-500' },
  warning: { icon: AlertTriangle, color: 'text-amber-400', bg: 'bg-amber-500/5 dark:bg-amber-500/10', label: 'WARN', dot: 'bg-amber-500' },
  error: { icon: AlertCircle, color: 'text-red-400', bg: 'bg-red-500/5 dark:bg-red-500/10', label: 'ERROR', dot: 'bg-red-500' },
  success: { icon: CheckCircle, color: 'text-emerald-400', bg: 'bg-emerald-500/5 dark:bg-emerald-500/10', label: 'OK', dot: 'bg-emerald-500' },
};

export default function SystemHistoryPage() {
  const [activeTab, setActiveTab] = useState('history');
  const [searchTerm, setSearchTerm] = useState('');
  const [logFilter, setLogFilter] = useState('all');

  const filteredHistory = systemHistory.filter(item =>
    item.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.adminName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.target.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredLogs = systemLogs.filter(log => {
    const matchesSearch = log.message.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.service.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFilter = logFilter === 'all' || log.level === logFilter;
    return matchesSearch && matchesFilter;
  });

  const logCounts = {
    all: systemLogs.length,
    info: systemLogs.filter(l => l.level === 'info').length,
    warning: systemLogs.filter(l => l.level === 'warning').length,
    error: systemLogs.filter(l => l.level === 'error').length,
    success: systemLogs.filter(l => l.level === 'success').length,
  };

  return (
    <div className="space-y-4">
      {/* Tabs + Search + Filter - All in one row */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Compact Tabs */}
        <div className="flex gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
          <button
            onClick={() => setActiveTab('history')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${activeTab === 'history'
              ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
              : 'text-slate-600 dark:text-slate-400'
              }`}
          >
            <History className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Hoạt động</span>
          </button>
          <button
            onClick={() => setActiveTab('logs')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${activeTab === 'logs'
              ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
              : 'text-slate-600 dark:text-slate-400'
              }`}
          >
            <Terminal className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Logs</span>
            {logCounts.error > 0 && (
              <span className="w-4 h-4 text-[10px] bg-red-500 text-white rounded-full flex items-center justify-center">
                {logCounts.error}
              </span>
            )}
          </button>
        </div>

        {/* Search */}
        <div className="relative flex-1 min-w-[150px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Tìm kiếm..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Filter - only for logs */}
        {activeTab === 'logs' && (
          <select
            value={logFilter}
            onChange={(e) => setLogFilter(e.target.value)}
            className="px-3 py-1.5 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">Tất cả ({logCounts.all})</option>
            <option value="info">Info ({logCounts.info})</option>
            <option value="success">OK ({logCounts.success})</option>
            <option value="warning">Warn ({logCounts.warning})</option>
            <option value="error">Error ({logCounts.error})</option>
          </select>
        )}
      </div>

      {/* Content */}
      {activeTab === 'history' ? (
        <Card className="-mx-4 sm:mx-0 p-0 overflow-hidden rounded-none sm:rounded-xl border-x-0 sm:border-x">
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {filteredHistory.map((item) => {
              const actionConfig = actionIcons[item.action] || { icon: History, color: 'bg-slate-500', label: 'Khác' };
              const ActionIcon = actionConfig.icon;
              const time = item.timestamp.split(' ')[1];

              return (
                <div
                  key={item.id}
                  className="flex items-center gap-3 p-3 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors"
                >
                  {/* Action icon */}
                  <div className={`w-9 h-9 rounded-lg ${actionConfig.color} flex items-center justify-center flex-shrink-0`}>
                    <ActionIcon className="w-4 h-4 text-white" />
                  </div>

                  {/* Content - 2 lines only */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-slate-800 dark:text-slate-100 text-sm font-medium truncate">
                        {item.description}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 font-medium">
                        {actionConfig.label}
                      </span>
                      <span className="text-slate-400">•</span>
                      <img src={item.adminAvatar} alt="" className="w-4 h-4 rounded-full" />
                      <span className="truncate">{item.adminName}</span>
                      <span className="text-slate-400 hidden sm:inline">•</span>
                      <span className="hidden sm:inline">{time}</span>
                    </div>
                  </div>
                </div>
              );
            })}

            {filteredHistory.length === 0 && (
              <div className="p-8 text-center text-slate-500">
                Không tìm thấy hoạt động nào
              </div>
            )}
          </div>
        </Card>
      ) : (
        <div className="-mx-4 sm:mx-0 bg-slate-950 sm:rounded-xl text-xs font-mono h-[calc(100vh-200px)] overflow-y-auto">
          {filteredLogs.map((log) => {
            const levelConfig = logLevelConfig[log.level];
            const time = log.timestamp.split(' ')[1];

            return (
              <div
                key={log.id}
                className="px-3 py-2.5 hover:bg-slate-900/50 border-b border-slate-800/50"
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-slate-500 w-16 flex-shrink-0">{time}</span>
                  <span className={`w-14 text-center px-1.5 py-0.5 rounded text-[10px] font-semibold flex-shrink-0 ${log.level === 'error' ? 'bg-red-500/20 text-red-400' :
                    log.level === 'warning' ? 'bg-amber-500/20 text-amber-400' :
                      log.level === 'success' ? 'bg-emerald-500/20 text-emerald-400' :
                        'bg-blue-500/20 text-blue-400'
                    }`}>
                    {levelConfig.label}
                  </span>
                  <span className="text-cyan-400 text-[11px] truncate">[{log.service}]</span>
                </div>
                <p className="text-slate-300 text-xs leading-relaxed">{log.message}</p>
              </div>
            );
          })}

          {filteredLogs.length === 0 && (
            <div className="p-8 text-center text-slate-500">
              Không tìm thấy logs nào
            </div>
          )}
        </div>
      )}
    </div>
  );
}
