import { useState, useRef, useMemo, useEffect } from 'react';
import Tooltip from '../components/ui/Tooltip';
import {
  RefreshCw, ShoppingCart, CheckCircle, DollarSign, Percent,
  Download, Upload, AlertCircle, ChevronDown, ChevronRight,
  Search, X, MousePointerClick, Package, UserPlus,
} from 'lucide-react';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';
import DateRangePicker from '../components/ui/DateRangePicker';
import { useOrders, formatVND, formatShortVND, useProductImages, useUsers } from '../hooks/useApi';

// ─── Status Config ──────────────────────────────────────
const STATUS_OPTIONS = ['Tất cả', 'Đang chờ xử lý', 'Đang giao hàng', 'Hoàn thành'];

const statusStyle = {
  'Hoàn thành':      { bg: 'bg-emerald-100 dark:bg-emerald-900/30', text: 'text-emerald-700 dark:text-emerald-400', dot: 'bg-emerald-500' },
  'Đang giao hàng':  { bg: 'bg-blue-100 dark:bg-blue-900/30',      text: 'text-blue-700 dark:text-blue-400',      dot: 'bg-blue-500' },
  'Đang chờ xử lý':  { bg: 'bg-amber-100 dark:bg-amber-900/30',    text: 'text-amber-700 dark:text-amber-400',    dot: 'bg-amber-500' },
};

function StatusBadge({ status }) {
  const s = statusStyle[status] || { bg: 'bg-slate-100', text: 'text-slate-600', dot: 'bg-slate-400' };
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium ${s.bg} ${s.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
      {status || '--'}
    </span>
  );
}

// ─── Tree Line Component ────────────────────────────────
function TreeLine({ isLast, color = 'bg-slate-300 dark:bg-slate-600' }) {
  return (
    <div className="flex items-stretch w-7 flex-shrink-0">
      <div className="relative w-full">
        <div className={`absolute left-1/2 top-0 w-0.5 ${color} ${isLast ? 'h-1/2' : 'h-full'} rounded-full`} />
        <div className={`absolute left-1/2 top-1/2 w-3.5 h-0.5 ${color} rounded-full`} />
        <div className={`absolute left-[calc(50%+14px)] top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full ${color}`} />
      </div>
    </div>
  );
}

// ─── Helpers ────────────────────────────────────────────
function fmtTime(dt) {
  if (!dt) return '--';
  const d = new Date(dt);
  if (isNaN(d)) return dt;
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const mo = String(d.getMonth() + 1).padStart(2, '0');
  return `${hh}:${mm} ${dd}-${mo}-${d.getFullYear()}`;
}

function fmtPrice(v) {
  if (!v && v !== 0) return '₫0';
  return '₫' + new Intl.NumberFormat('vi-VN').format(Math.round(v));
}

function fmtRate(v) {
  if (!v && v !== 0) return '0%';
  const n = parseFloat(v);
  if (isNaN(n)) return String(v);
  return n.toFixed(n % 1 === 0 ? 0 : 1) + '%';
}

function imgUrl(imgCode) {
  if (!imgCode) return null;
  return `https://down-vn.img.susercontent.com/file/${imgCode}`;
}

// Aggregates commission_chain values across all items in the order group
function aggregateCommissionChain(items) {
  const firstWithChain = items.find(item => item.commission_chain);
  if (!firstWithChain || !firstWithChain.commission_chain) return null;

  const chain = firstWithChain.commission_chain;
  const aggregated = {
    mode: chain.mode,
    buyer: {
      userId: chain.buyer.userId,
      displayName: chain.buyer.displayName,
      rate: chain.buyer.rate,
      amount: 0,
      paid: chain.buyer.paid,
    },
    referrers: chain.referrers.map(r => ({
      userId: r.userId,
      displayName: r.displayName,
      level: r.level,
      rate: r.rate,
      amount: 0,
      paid: r.paid,
    }))
  };

  for (const item of items) {
    if (item.commission_chain) {
      aggregated.buyer.amount += item.commission_chain.buyer.amount || 0;
      item.commission_chain.referrers.forEach((r, idx) => {
        if (aggregated.referrers[idx]) {
          aggregated.referrers[idx].amount += r.amount || 0;
        }
      });
    }
  }

  return aggregated;
}

// Visual Referral Tree Component for first column
function ReferralTree({ items, isUnmatched }) {
  const chain = useMemo(() => aggregateCommissionChain(items), [items]);

  if (!chain) {
    return (
      <div className="text-center py-4 text-slate-400 text-xs italic">
        {isUnmatched ? 'Không có user' : 'Bỏ qua (N/A)'}
      </div>
    );
  }

  // Unmatched orders: only show F0, no amount (won't be paid)
  const nodes = isUnmatched
    ? [{ label: 'F0', name: chain.buyer.displayName, rate: chain.buyer.rate, amount: null, paid: false }]
    : [
        { label: 'F0', name: chain.buyer.displayName, rate: chain.buyer.rate, amount: chain.buyer.amount, paid: chain.buyer.paid },
        ...chain.referrers.map(r => ({ label: `F${r.level}`, name: r.displayName, rate: r.rate, amount: r.amount, paid: r.paid })),
      ];

  return (
    <div className="flex flex-col gap-1 py-0.5">
      {nodes.map((node, idx) => {
        if (idx === 0) {
          return (
            <div key={idx} className={`relative flex items-center gap-1.5 px-2 py-1 rounded border overflow-hidden ${
              node.paid
                ? 'border-emerald-400 dark:border-emerald-600 bg-emerald-100/80 dark:bg-emerald-900/40'
                : 'border-emerald-100 dark:border-emerald-900/30 bg-emerald-50/50 dark:bg-emerald-950/10'
            }`}>
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 flex-shrink-0" />
              <div className="min-w-0 flex-1 text-[11px] pr-6">
                <p className="font-semibold text-emerald-800 dark:text-emerald-300 truncate flex items-center gap-1">
                  <span className="truncate">{node.name}</span>
                  <span className="text-[9px] px-1 rounded bg-emerald-100 dark:bg-emerald-900 text-emerald-600 dark:text-emerald-400 font-mono font-bold flex-shrink-0">F0</span>
                </p>
                {!isUnmatched && (
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">
                    {node.rate}% • {fmtPrice(node.amount)}
                  </p>
                )}
              </div>
              {node.paid && (
                <CheckCircle className="absolute right-1.5 top-1/2 -translate-y-1/2 w-7 h-7 text-emerald-500/50 dark:text-emerald-400/50 flex-shrink-0 pointer-events-none" strokeWidth={2} />
              )}
            </div>
          );
        }

        const isLast = idx === nodes.length - 1;
        return (
          <div key={idx} className="flex items-stretch select-none">
            <TreeLine isLast={isLast} />
            <div className={`relative flex-1 ml-1 mb-1 px-2 py-1 rounded border min-w-0 overflow-hidden ${
              node.paid
                ? 'border-emerald-300 dark:border-emerald-700 bg-emerald-100/70 dark:bg-emerald-900/30'
                : 'border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/30'
            }`}>
              <div className="min-w-0 text-[11px] pr-6">
                <p className="font-medium text-slate-700 dark:text-slate-300 truncate flex items-center gap-1">
                  <span className="truncate">{node.name}</span>
                  <span className="text-[9px] px-1 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 font-mono font-bold flex-shrink-0">{node.label}</span>
                </p>
                <p className="text-[10px] text-slate-500 dark:text-slate-400">
                  {node.rate}% • {fmtPrice(node.amount)}
                </p>
              </div>
              {node.paid && (
                <CheckCircle className="absolute right-1.5 top-1/2 -translate-y-1/2 w-7 h-7 text-emerald-500/50 dark:text-emerald-400/50 flex-shrink-0 pointer-events-none" strokeWidth={2} />
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// Searchable user dropdown component
function SearchableUserSelect({ value, onChange }) {
  const { users, search, setSearch, loading } = useUsers();
  const [isOpen, setIsOpen] = useState(false);
  const [inputText, setInputText] = useState('');
  const wrapperRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (!value) {
      setInputText('');
    } else {
      const selectedUser = users.find(u => u.user_id === value);
      if (selectedUser) {
        setInputText(selectedUser.display_name || selectedUser.zalo_name || selectedUser.user_id);
      }
    }
  }, [value, users]);

  const handleInputChange = (e) => {
    const text = e.target.value;
    setInputText(text);
    setSearch(text);
    setIsOpen(true);
    if (!text) {
      onChange('');
    }
  };

  const handleSelectUser = (user) => {
    onChange(user.user_id);
    setInputText(user.display_name || user.zalo_name || user.user_id);
    setIsOpen(false);
  };

  const handleClear = () => {
    onChange('');
    setInputText('');
    setSearch('');
    setIsOpen(false);
  };

  return (
    <div ref={wrapperRef} className="relative w-full">
      <label className={labelCls}>User mua hàng</label>
      <div className="relative">
        <input
          type="text"
          value={inputText}
          onChange={handleInputChange}
          onFocus={() => setIsOpen(true)}
          placeholder="Tìm kiếm user..."
          className={inputCls}
        />
        {value ? (
          <button
            type="button"
            onClick={handleClear}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        ) : (
          <Search className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
        )}
      </div>

      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg max-h-60 overflow-y-auto">
          {loading && users.length === 0 ? (
            <div className="px-3 py-2 text-xs text-slate-400">Đang tìm...</div>
          ) : users.length === 0 ? (
            <div className="px-3 py-2 text-xs text-slate-400">Không tìm thấy user nào</div>
          ) : (
            users.map(u => (
              <button
                key={u.user_id}
                type="button"
                onClick={() => handleSelectUser(u)}
                className="w-full text-left px-3 py-2 text-xs hover:bg-slate-50 dark:hover:bg-slate-700/50 text-slate-700 dark:text-slate-200 border-b border-slate-100 dark:border-slate-800 last:border-0"
              >
                <p className="font-semibold">{u.display_name || u.zalo_name || 'Không tên'}</p>
                <p className="text-[10px] text-slate-400 font-mono truncate">{u.user_id}</p>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

// ─── Group rows by order_id ─────────────────────────────
function groupByOrder(rows) {
  const map = new Map();
  for (const row of rows) {
    const key = row.order_id;
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(row);
  }
  return [...map.entries()]; // [[orderId, [items]], ...]
}

// ─── Filter Field Components ────────────────────────────
const TIME_FIELD_OPTIONS = [
  { value: 'order_time', label: 'Thời Gian Đặt Hàng' },
  { value: 'complete_time', label: 'Thời gian hoàn thành' },
  { value: 'click_time', label: 'Thời gian Click' },
];

const inputCls = 'w-full px-2.5 py-1.5 text-[13px] rounded border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-800 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-orange-400/50 focus:border-orange-400 transition-colors';
const selectCls = `${inputCls} appearance-none cursor-pointer pr-7`;
const labelCls = 'text-[12px] font-medium text-slate-500 dark:text-slate-400 mb-1 block whitespace-nowrap';

function FilterSelect({ label, value, onChange, options, className = '' }) {
  return (
    <div className={className}>
      <label className={labelCls}>{label}</label>
      <div className="relative">
        <select value={value} onChange={e => onChange(e.target.value)} className={selectCls}>
          {options.map(o => typeof o === 'string'
            ? <option key={o} value={o}>{o}</option>
            : <option key={o.value} value={o.value}>{o.label}</option>
          )}
        </select>
        <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
      </div>
    </div>
  );
}

function FilterInput({ label, value, onChange, placeholder, className = '' }) {
  return (
    <div className={className}>
      <label className={labelCls}>{label}</label>
      <input
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className={inputCls}
      />
    </div>
  );
}

// ─── Main Component ─────────────────────────────────────
export default function OrdersPage() {
  const {
    orders, stats, loading, filters, setFilters, filterOptions,
    syncing, syncResult, syncOrders, importCSV,
    applyFilters, resetFilters, refresh,
  } = useOrders();

  const [expandedRows, setExpandedRows] = useState(new Set());
  const fileInputRef = useRef(null);

  const updateFilter = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const applyDatePreset = (days) => {
    const now = new Date();
    const from = new Date();
    from.setDate(now.getDate() - days + 1);
    const toStr = now.toISOString().slice(0, 10);
    const fromStr = from.toISOString().slice(0, 10);
    setFilters(prev => ({ ...prev, dateFrom: fromStr, dateTo: toStr }));
  };

  const toggleExpand = (key) => {
    setExpandedRows(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  const filteredOrders = orders || [];
  const grouped = useMemo(() => groupByOrder(filteredOrders), [filteredOrders]);

  // Collect all item_ids for batch image lookup
  const allItemIds = useMemo(() => filteredOrders.map(o => o.item_id).filter(Boolean), [filteredOrders]);
  const imgMap = useProductImages(allItemIds);

  const handleCSVUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => importCSV(ev.target.result);
    reader.readAsText(file, 'utf-8');
    e.target.value = '';
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') applyFilters();
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Báo cáo chuyển đổi</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">Dữ liệu đơn hàng từ Shopee Affiliate</p>
        </div>
        <div className="flex items-center gap-2">
          <input ref={fileInputRef} type="file" accept=".csv" onChange={handleCSVUpload} className="hidden" />
          <Button variant="outline" icon={Upload} onClick={() => fileInputRef.current?.click()} disabled={syncing}>
            Import CSV
          </Button>
          <Button
            variant="primary"
            icon={syncing ? RefreshCw : Download}
            onClick={syncOrders}
            disabled={syncing}
            className={syncing ? 'animate-pulse' : ''}
          >
            {syncing ? 'Đang sync...' : 'Sync Shopee'}
          </Button>
        </div>
      </div>

      {/* Sync Result */}
      {syncResult && (
        <div className={`rounded-xl p-3 flex items-start gap-3 text-sm ${
          syncResult.success
            ? 'bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800'
            : 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800'
        }`}>
          {syncResult.success
            ? <CheckCircle className="w-4 h-4 text-emerald-500 flex-shrink-0 mt-0.5" />
            : <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
          }
          <span className={syncResult.success ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-700 dark:text-red-400'}>
            {syncResult.success
              ? `Sync thành công! ${syncResult.inserted}/${syncResult.total} đơn đã import.`
              : syncResult.error}
          </span>
        </div>
      )}

      {/* Stats — 5 cards giống Shopee Affiliate Dashboard */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <StatCard icon={MousePointerClick} label="Clicks" value={stats?.clicks || 0} color="text-red-500"
          tooltip="Số lượt chuyển đổi link trong khoảng thời gian đã chọn." />
        <StatCard icon={ShoppingCart} label="Đơn hàng" value={stats?.uniqueOrders || 0}
          tooltip="Số đơn hàng duy nhất trong khoảng thời gian đã chọn." />
        <StatCard icon={DollarSign} label="Hoa hồng ước tính" value={formatShortVND(stats?.totalEstimatedCommission || 0)} color="text-emerald-500" unit="đ"
          tooltip="= order_commission + order_bonus. Khớp với chỉ số Shopee Affiliate Dashboard." />
        <StatCard icon={Package} label="Số lượng đã bán" value={stats?.totalQuantity || 0}
          tooltip="Tổng số sản phẩm đã bán (tính theo số lượng của mỗi dòng đơn)." />
        <StatCard icon={Percent} label="Giá trị đơn hàng" value={formatShortVND(stats?.totalOrderValue || 0)} color="text-blue-500" unit="đ"
          tooltip="Tổng giá trị các đơn hàng. Là doanh số gốc chưa trừ phí." />
      </div>

      {/* ═══ Shopee-style Filter Panel ═══ */}
      <div className="bg-white dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700/50 p-4" onKeyDown={handleKeyDown}>

        {/* Row 1: Time + Date range + Status + Order ID */}
        <div className="grid grid-cols-4 gap-x-4 gap-y-3 mb-3">
          <div className="col-span-2">
            <label className={labelCls}>Thời Gian Đặt Hàng</label>
            <DateRangePicker
              from={filters.dateFrom}
              to={filters.dateTo}
              onChange={({ from, to }) => setFilters(prev => ({ ...prev, dateFrom: from, dateTo: to }))}
              timeField={filters.timeField}
              timeOptions={TIME_FIELD_OPTIONS}
              onTimeFieldChange={v => updateFilter('timeField', v)}
            />
          </div>
          <FilterSelect
            label="Trạng thái đơn hàng"
            value={filters.status}
            onChange={v => updateFilter('status', v)}
            options={['Tất cả', ...STATUS_OPTIONS.slice(1)]}
          />
          <FilterInput
            label="Order ID"
            value={filters.orderId}
            onChange={v => updateFilter('orderId', v)}
            placeholder="Tìm kiếm ID đơn hàng"
          />
        </div>

        {/* Row 2: Shop name + Shop type + Product type + (empty) */}
        <div className="grid grid-cols-4 gap-x-4 gap-y-3 mb-3">
          <FilterInput
            label="Tên Shop"
            value={filters.shopName}
            onChange={v => updateFilter('shopName', v)}
            placeholder="Tìm kiếm theo tên shop"
          />
          <FilterSelect
            label="Loại Shop"
            value={filters.shopType}
            onChange={v => updateFilter('shopType', v)}
            options={['Tất cả', ...(filterOptions.shopTypes || [])]}
          />
          <FilterSelect
            label="Loại sản phẩm"
            value={filters.commissionType}
            onChange={v => updateFilter('commissionType', v)}
            options={['Tất cả', ...(filterOptions.commissionTypes || [])]}
          />
          <SearchableUserSelect
            value={filters.userId}
            onChange={v => updateFilter('userId', v)}
          />
        </div>

        {/* Row 3: Product name + Channel + Reset + Search */}
        <div className="grid grid-cols-4 gap-x-4 gap-y-3 items-end">
          <FilterInput
            label="Tên sản phẩm"
            value={filters.productName}
            onChange={v => updateFilter('productName', v)}
            placeholder="Tìm kiếm theo tên sản phẩm"
          />
          <FilterSelect
            label="Ngành hàng toàn cầu"
            value={filters.channel}
            onChange={v => updateFilter('channel', v)}
            options={['Tất cả', ...(filterOptions.channels || [])]}
          />
          {/* Spacer + action buttons */}
          <div />
          <div className="flex items-center justify-end gap-2">
            <button
              onClick={resetFilters}
              className="inline-flex items-center gap-1.5 px-3 py-[7px] text-[13px] font-medium text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-lg border border-slate-200 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors whitespace-nowrap"
            >
              Thiết lập lại
            </button>
            <button
              onClick={applyFilters}
              className="inline-flex items-center gap-1.5 px-5 py-[7px] text-[13px] font-semibold text-white bg-orange-500 hover:bg-orange-600 rounded-lg shadow-sm transition-colors whitespace-nowrap"
            >
              <Search className="w-3.5 h-3.5" />
              Tìm kiếm
            </button>
          </div>
        </div>
      </div>

      {/* Shopee-style Table */}
      <div className="bg-white dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700/50 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <RefreshCw className="w-6 h-6 text-blue-500 animate-spin" />
          </div>
        ) : grouped.length === 0 ? (
          <div className="text-center py-16 text-slate-400">
            <ShoppingCart className="w-10 h-10 mx-auto mb-3 opacity-40" />
            <p>Chưa có đơn hàng nào</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse min-w-[1100px]">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-700/50 border-b border-slate-200 dark:border-slate-700">
                  {['Sơ đồ', 'Chi tiết đơn hàng','Thông tin cửa hàng','Thông tin sản phẩm','Thông tin ưu đãi','Giá trị đơn hàng','Hoa hồng sản phẩm','Hoa hồng đơn hàng'].map(h => (
                    <th key={h} className="px-3 py-2.5 text-left text-xs font-semibold text-slate-600 dark:text-slate-300 whitespace-nowrap border-r border-slate-200 dark:border-slate-700 last:border-r-0">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {grouped.map(([orderId, items]) => (
                  <OrderGroup
                    key={orderId}
                    orderId={orderId}
                    items={items}
                    expanded={expandedRows.has(orderId)}
                    onToggle={() => toggleExpand(orderId)}
                    imgMap={imgMap}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Total count */}
      {!loading && grouped.length > 0 && (
        <p className="text-xs text-slate-400 text-right">
          Hiển thị {filteredOrders.length} dòng • {grouped.length} đơn hàng
        </p>
      )}
    </div>
  );
}

// ─── Order Group (rowspan logic) ────────────────────────
function OrderGroup({ orderId, items, expanded, onToggle, imgMap }) {
  const count = items.length;
  const first = items[0];
  const isUnmatched = !!first.is_unmatched;
  const anyPaid = !isUnmatched && items.some(item => {
    const c = item.commission_chain;
    return c && (c.buyer?.paid || c.referrers?.some(r => r.paid));
  });

  return (
    <>
      {items.map((item, idx) => {
        const isFirst = idx === 0;
        const rowKey = `${orderId}_${item.item_id}`;

        return (
          <tr
            key={rowKey}
            className={`border-b border-slate-100 dark:border-slate-700/50 align-top ${
              isFirst ? 'border-t-2 border-t-slate-200 dark:border-t-slate-600' : ''
            } ${
              isUnmatched
                ? 'bg-purple-50/70 dark:bg-purple-900/15 hover:bg-purple-100/60 dark:hover:bg-purple-900/25'
                : 'hover:bg-slate-50/50 dark:hover:bg-slate-700/20'
            }`}
          >
            {/* ⓪ Sơ đồ cây hoa hồng F0 -> F3 */}
            {isFirst && (
              <td rowSpan={count} className={`px-3 py-2.5 border-r border-slate-100 dark:border-slate-700/50 align-top min-w-[210px] max-w-[230px] transition-colors ${
                anyPaid ? 'bg-emerald-50 dark:bg-emerald-950/25' : ''
              }`}>
                <ReferralTree items={items} isUnmatched={isUnmatched} />
              </td>
            )}

            {/* ① Chi tiết đơn hàng — rowspan */}
            {isFirst && (
              <td rowSpan={count} className="px-3 py-2.5 border-r border-slate-100 dark:border-slate-700/50 align-top min-w-[200px]">
                <div className="space-y-1">
                  <p className="text-[11px] text-slate-400">Order id:</p>
                  <p className="font-mono text-xs font-semibold text-slate-800 dark:text-white">{orderId}</p>
                  <div className="mt-1">
                    <StatusBadge status={first.order_status} />
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1.5">Checkout id:&nbsp;
                    <span className="text-slate-600 dark:text-slate-300">{first.checkout_id || '--'}</span>
                  </p>
                  <p className="text-[11px] text-slate-400">Thời Gian Đặt Hàng:&nbsp;
                    <span className="text-slate-600 dark:text-slate-300">{fmtTime(first.order_time)}</span>
                  </p>
                  <p className="text-[11px] text-slate-400">Thời gian hoàn thành:&nbsp;
                    <span className="text-slate-600 dark:text-slate-300">{fmtTime(first.complete_time)}</span>
                  </p>
                  <p className="text-[11px] text-slate-400">Thời gian Click:&nbsp;
                    <span className="text-slate-600 dark:text-slate-300">{fmtTime(first.click_time)}</span>
                  </p>
                  {/* Expand toggle */}
                  <button
                    onClick={onToggle}
                    className="mt-1.5 flex items-center gap-1 text-[11px] text-blue-500 hover:text-blue-600 transition-colors"
                  >
                    {expanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                    Chi tiết
                  </button>
                </div>
              </td>
            )}

            {/* ② Thông tin cửa hàng — rowspan */}
            {isFirst && (
              <td rowSpan={count} className="px-3 py-2.5 border-r border-slate-100 dark:border-slate-700/50 align-top min-w-[140px]">
                <p className="text-xs font-medium text-slate-800 dark:text-white leading-snug">{first.shop_name || '--'}</p>
                <p className="text-[11px] text-slate-400 mt-1">Shop id:&nbsp;
                  <span className="text-slate-500">{first.shop_id || '--'}</span>
                </p>
                <p className="text-[11px] text-slate-400">Loại Shop:&nbsp;
                  <span className="text-slate-500">{first.shop_type || '--'}</span>
                </p>
              </td>
            )}

            {/* ③ Thông tin sản phẩm — per item */}
            <td className="px-3 py-2.5 border-r border-slate-100 dark:border-slate-700/50 min-w-[260px]">
              <div className="flex gap-2">
                <ProductThumb imgCode={imgMap?.[item.item_id]} />
                <div className="min-w-0 flex-1 space-y-0.5">
                  <p className="text-xs font-medium text-slate-800 dark:text-white leading-snug line-clamp-2">{item.item_name || '--'}</p>
                  <p className="text-[11px] text-slate-400">Item id: <span className="text-slate-500">{item.item_id || '--'}</span></p>
                  <p className="text-[11px] text-slate-400">ID Model:&nbsp;<span className="text-slate-500">{item.model_id || '--'}</span></p>
                  <p className="text-[11px] text-slate-400">Loại sản phẩm:&nbsp;<span className="text-slate-500">{item.product_type || '--'}</span></p>
                  {item.promotion_id && (
                    <p className="text-[11px] text-slate-400">Promotion id:&nbsp;<span className="text-slate-500">{item.promotion_id}</span></p>
                  )}
                  <p className="text-[11px] text-slate-400">Ngành hàng:&nbsp;
                    <span className="text-slate-500">
                      {[item.category_l1, item.category_l2, item.category_l3].filter(Boolean).join(' > ') || '--'}
                    </span>
                  </p>
                  <p className="text-xs font-medium text-slate-700 dark:text-slate-200 mt-1">
                    {fmtPrice(item.price)} <span className="text-slate-400">x{item.quantity || 1}</span>
                  </p>
                </div>
              </div>
            </td>

            {/* ④ Thông tin ưu đãi — per item */}
            <td className="px-3 py-2.5 border-r border-slate-100 dark:border-slate-700/50 align-top min-w-[90px]">
              <p className="text-xs text-slate-700 dark:text-slate-300">{item.commission_type || '--'}</p>
              {item.campaign_partner && (
                <p className="text-[11px] text-slate-400 mt-0.5">{item.campaign_partner}</p>
              )}
            </td>

            {/* ⑤ Giá trị đơn hàng — per item */}
            <td className="px-3 py-2.5 border-r border-slate-100 dark:border-slate-700/50 align-top text-right min-w-[100px]">
              <p className="text-xs font-medium text-slate-800 dark:text-white">{fmtPrice(item.order_value)}</p>
              {item.refund_amount > 0 && (
                <p className="text-[11px] text-red-500 mt-0.5">Hoàn: {fmtPrice(item.refund_amount)}</p>
              )}
            </td>

            {/* ⑥ Hoa hồng sản phẩm — per item */}
            <td className="px-3 py-2.5 border-r border-slate-100 dark:border-slate-700/50 align-top text-right min-w-[130px]">
              <p className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">{fmtPrice(item.total_product_commission)}</p>
              {(item.xtra_product_commission > 0 || item.seller_product_commission_rate) && (
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Hoa hồng Xtra({fmtRate(item.seller_product_commission_rate)}):&nbsp;
                  <span className="text-slate-600 dark:text-slate-300">{fmtPrice(item.xtra_product_commission)}</span>
                </p>
              )}
              {(item.shopee_product_commission > 0 || item.shopee_product_commission_rate) && (
                <p className="text-[11px] text-slate-400">
                  Hoa hồng từ Shopee({fmtRate(item.shopee_product_commission_rate)}):&nbsp;
                  <span className="text-slate-600 dark:text-slate-300">{fmtPrice(item.shopee_product_commission)}</span>
                </p>
              )}
            </td>

            {/* ⑦ Hoa hồng đơn hàng — rowspan */}
            {isFirst && (
              <td rowSpan={count} className="px-3 py-2.5 align-top text-right min-w-[130px]">
                <p className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">
                  {fmtPrice(first.total_order_commission || first.order_commission)}
                </p>
                {first.order_bonus > 0 && (
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Hoa hồng Xtra:&nbsp;
                    <span className="text-slate-600 dark:text-slate-300">{fmtPrice(first.order_bonus)}</span>
                  </p>
                )}
                {first.order_commission > 0 && (
                  <p className="text-[11px] text-slate-400">
                    Hoa hồng từ Shopee:&nbsp;
                    <span className="text-slate-600 dark:text-slate-300">{fmtPrice(first.order_commission)}</span>
                  </p>
                )}
              </td>
            )}
          </tr>
        );
      })}

      {/* Expandable Detail Row */}
      {expanded && (
        <tr className="border-b-2 border-slate-200 dark:border-slate-600">
          <td colSpan={8} className="px-4 py-3 bg-slate-50/80 dark:bg-slate-800/80">
            <ExpandedDetail items={items} />
          </td>
        </tr>
      )}
    </>
  );
}

// ─── Product Thumbnail ──────────────────────────────────
function ProductThumb({ imgCode }) {
  const [err, setErr] = useState(false);
  const url = imgUrl(imgCode);

  if (!url || err) {
    return (
      <div className="w-12 h-12 rounded-md bg-slate-100 dark:bg-slate-700 flex items-center justify-center flex-shrink-0">
        <ShoppingCart className="w-4 h-4 text-slate-400" />
      </div>
    );
  }

  return (
    <img
      src={url}
      alt=""
      loading="lazy"
      onError={() => setErr(true)}
      className="w-12 h-12 rounded-md object-cover flex-shrink-0 border border-slate-200 dark:border-slate-600"
    />
  );
}

// ─── Expanded Detail (16 cột phụ) ───────────────────────
function ExpandedDetail({ items }) {
  const first = items[0];
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-2 text-[12px]">
      <DetailSection title="MCN">
        <DField label="Tên MNC" value={first.mcn_name} />
        <DField label="Mã HĐ MCN" value={first.mcn_contract} />
        <DField label="Phí QL MCN" value={first.mcn_fee_rate ? `${fmtRate(first.mcn_fee_rate)} / ${fmtPrice(first.mcn_fee_amount)}` : null} />
      </DetailSection>
      <DetailSection title="Affiliate">
        <DField label="Mức HH liên kết" value={first.agreed_commission_rate ? fmtRate(first.agreed_commission_rate) : null} />
        <DField label="HH ròng" value={first.net_commission ? fmtPrice(first.net_commission) : null} />
      </DetailSection>
      <DetailSection title="Trạng thái">
        <DField label="TT SP liên kết" value={first.product_status} />
        <DField label="Ghi chú SP" value={first.product_note} />
        <DField label="Loại thuộc tính" value={first.attribute_type} />
        <DField label="TT người mua" value={first.buyer_status} />
      </DetailSection>
      <DetailSection title="Tracking (SubIDs)">
        {items.map((item, i) => (
          <div key={i} className="flex flex-wrap gap-x-3 gap-y-0.5">
            {[item.sub_id1, item.sub_id2, item.sub_id3, item.sub_id4, item.sub_id5].map((v, j) => (
              v ? <span key={j} className="text-slate-500">sub{j+1}: <span className="text-slate-700 dark:text-slate-300 font-mono">{v}</span></span> : null
            ))}
          </div>
        ))}
      </DetailSection>
      <DetailSection title="Kênh">
        <DField label="Kênh" value={first.channel} />
      </DetailSection>
    </div>
  );
}

function DetailSection({ title, children }) {
  return (
    <div>
      <p className="font-semibold text-slate-600 dark:text-slate-300 mb-0.5">{title}</p>
      <div className="space-y-0.5 text-slate-500">{children}</div>
    </div>
  );
}

function DField({ label, value }) {
  if (!value) return null;
  return (
    <p>
      <span className="text-slate-400">{label}: </span>
      <span className="text-slate-700 dark:text-slate-300">{value}</span>
    </p>
  );
}

// ─── Stat Card ──────────────────────────────────────────
function StatCard({ icon: Icon, label, value, color = '', unit = '', tooltip = '' }) {
  return (
    <div className="bg-white dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700/50 p-3">
      <div className="flex items-center gap-1.5 mb-1">
        <Icon className="w-3.5 h-3.5 text-slate-400" />
        <p className="text-[10px] sm:text-xs text-slate-500 dark:text-slate-400 truncate">{label}</p>
        {tooltip && <Tooltip text={tooltip} />}
      </div>
      <p className={`text-base sm:text-xl font-bold ${color || 'text-slate-900 dark:text-white'}`}>
        {typeof value === 'number' ? value.toLocaleString('vi-VN') : value}
        {unit && <span className="text-xs font-normal text-slate-400 ml-0.5">{unit}</span>}
      </p>
    </div>
  );
}
