import { useState, useEffect } from 'react';
import {
  Plus, Search, Wallet, ArrowDownLeft, ArrowUpRight,
  TrendingDown, X, Upload, Calendar, ChevronDown, ChevronLeft, ChevronRight,
  Building2, Tag, Pencil, Trash2, Check, Bell
} from 'lucide-react';
import { useCashFlow, formatVND } from '../hooks/useApi';

// Color options for categories
const colorOptions = [
  { name: 'Xanh lá', value: '#10b981' },
  { name: 'Cam', value: '#f59e0b' },
  { name: 'Đỏ', value: '#ef4444' },
  { name: 'Tím', value: '#8b5cf6' },
  { name: 'Xanh dương', value: '#3b82f6' },
  { name: 'Hồng', value: '#ec4899' },
  { name: 'Xám', value: '#6b7280' },
  { name: 'Cyan', value: '#06b6d4' },
];

// Transaction type config
const txTypeConfig = {
  income: { label: 'Thu nhập', color: 'text-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-900/20', border: 'border-emerald-200 dark:border-emerald-800', icon: ArrowDownLeft },
  cashback: { label: 'Hoàn tiền', color: 'text-amber-600', bg: 'bg-amber-50 dark:bg-amber-900/20', border: 'border-amber-200 dark:border-amber-800', icon: ArrowUpRight },
  expense: { label: 'Chi phí', color: 'text-red-600', bg: 'bg-red-50 dark:bg-red-900/20', border: 'border-red-200 dark:border-red-800', icon: TrendingDown },
};

const typeLabels = { income: 'Thu nhập', cashback: 'Hoàn tiền', expense: 'Chi phí' };

const formatDateShort = (dateStr) => {
  const d = new Date(dateStr);
  if (isNaN(d)) return '--';
  return d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });
};
const formatTimeShort = (dateStr) => {
  const d = new Date(dateStr);
  if (isNaN(d)) return '';
  return d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
};
const toDateInput = (d) => {
  if (!d) return '';
  const dt = new Date(d);
  return isNaN(dt) ? '' : dt.toISOString().slice(0, 10);
};
const todayInput = () => new Date().toISOString().slice(0, 10);
const parseAmount = (v) => Number(String(v).replace(/[^\d]/g, '')) || 0;
const formatAmountInput = (v) => {
  const n = parseAmount(v);
  return n ? n.toLocaleString('vi-VN') : '';
};

export default function CashFlow() {
  const {
    summary, transactions, total, categories, suggestions, loading,
    filters, setFilters, perPage,
    createTransaction, updateTransaction, deleteTransaction, confirmCashback,
    createCategory, updateCategory, deleteCategory, uploadReceipt,
  } = useCashFlow();

  const [showTxModal, setShowTxModal] = useState(false);
  const [editingTx, setEditingTx] = useState(null);
  const [confirmTarget, setConfirmTarget] = useState(null);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [showDatePanel, setShowDatePanel] = useState(false);
  const [searchInput, setSearchInput] = useState('');

  // Debounced search → filters
  useEffect(() => {
    const t = setTimeout(() => setFilters((f) => ({ ...f, q: searchInput, page: 1 })), 350);
    return () => clearTimeout(t);
  }, [searchInput, setFilters]);

  const s = summary || {};
  const debt = s.cashbackDebt || { total: 0, paid: 0, pending: 0 };
  const quick = s.quickStats || { todayCount: 0, monthIncome: 0, monthExpense: 0, monthCashback: 0 };
  const spending = s.spendingByCategory || [];
  const totalPages = Math.max(1, Math.ceil(total / perPage));
  const debtPct = debt.total > 0 ? (debt.paid / debt.total) * 100 : 0;

  const openCreate = () => { setEditingTx(null); setShowTxModal(true); };
  const openEdit = (tx) => { setEditingTx(tx); setShowTxModal(true); };

  const handleDelete = async (tx) => {
    if (!window.confirm(`Xóa giao dịch "${tx.description || typeLabels[tx.type]}" (${formatVND(tx.amount)})?`)) return;
    try { await deleteTransaction(tx.id); } catch (err) { alert('Lỗi: ' + err.message); }
  };

  return (
    <div className="min-h-screen">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Quản Lý Quỹ</h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm">Sổ quỹ nội bộ Shopee Affiliate Cashback</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Tìm giao dịch..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="pl-9 pr-4 py-2 w-64 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <button
            onClick={openCreate}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-medium transition-colors shadow-lg shadow-blue-500/25"
          >
            <Plus className="w-4 h-4" />
            Tạo giao dịch
          </button>
        </div>
      </div>

      {/* Cashback suggestions banner */}
      {suggestions.length > 0 && (
        <div className="mb-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <Bell className="w-4 h-4 text-amber-600" />
            <span className="text-sm font-semibold text-amber-800 dark:text-amber-300">
              Có {suggestions.length} khoản hoàn tiền (Payouts) chưa ghi vào sổ quỹ
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {suggestions.slice(0, 8).map((sug) => (
              <button
                key={sug.id}
                onClick={() => setConfirmTarget(sug)}
                className="flex items-center gap-2 px-3 py-1.5 bg-white dark:bg-slate-800 border border-amber-200 dark:border-amber-700 rounded-lg text-xs hover:border-amber-400 transition-colors"
              >
                <span className="font-medium text-slate-700 dark:text-slate-200">{sug.user_name || sug.user_id}</span>
                <span className="font-semibold text-amber-600">{formatVND(sug.amount)}</span>
                <span className="text-slate-400">· {formatDateShort(sug.paid_at)}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Main Layout */}
      <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
        {/* Left Column */}
        <div className="xl:col-span-3 space-y-6">
          {/* Wallet Card */}
          <div className="bg-gradient-to-br from-emerald-600 to-teal-700 rounded-xl p-4 text-white shadow-lg shadow-emerald-500/20">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-emerald-100 text-xs">Số dư quỹ hiện tại</p>
                <p className="text-2xl font-bold">{formatVND(s.balance || 0)}</p>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <p className="text-emerald-100 text-xs">Đã nhận</p>
                  <p className="text-sm font-semibold">+{formatVND(s.received || 0)}</p>
                </div>
                <div className="text-right">
                  <p className="text-emerald-100 text-xs">Đã chi</p>
                  <p className="text-sm font-semibold">-{formatVND(s.spent || 0)}</p>
                </div>
                <div className="flex items-center gap-1.5 bg-white/20 rounded-lg px-2.5 py-1">
                  <Wallet className="w-3.5 h-3.5" />
                  <span className="text-xs font-medium">Quỹ</span>
                </div>
              </div>
            </div>
          </div>

          {/* Filters */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl">
                {[
                  { key: 'all', label: 'Tất cả' },
                  { key: 'income', label: 'Thu nhập' },
                  { key: 'cashback', label: 'Hoàn tiền' },
                  { key: 'expense', label: 'Chi phí' },
                ].map((filter) => (
                  <button
                    key={filter.key}
                    onClick={() => setFilters((f) => ({ ...f, type: filter.key, page: 1 }))}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${filters.type === filter.key
                      ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                      }`}
                  >
                    {filter.label}
                  </button>
                ))}
              </div>
              <div className="relative">
                <button
                  onClick={() => setShowDatePanel((v) => !v)}
                  className={`flex items-center gap-2 px-3 py-1.5 text-sm rounded-lg ${filters.from || filters.to ? 'text-blue-600 bg-blue-50 dark:bg-blue-900/20' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'}`}
                >
                  <Calendar className="w-4 h-4" />
                  {filters.from || filters.to ? `${filters.from || '…'} → ${filters.to || '…'}` : 'Khoảng thời gian'}
                  <ChevronDown className="w-3 h-3" />
                </button>
                {showDatePanel && (
                  <div className="absolute z-20 mt-2 p-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl space-y-3 w-64">
                    <div>
                      <label className="block text-xs text-slate-500 mb-1">Từ ngày</label>
                      <input type="date" value={toDateInput(filters.from)}
                        onChange={(e) => setFilters((f) => ({ ...f, from: e.target.value, page: 1 }))}
                        className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm" />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-500 mb-1">Đến ngày</label>
                      <input type="date" value={toDateInput(filters.to)}
                        onChange={(e) => setFilters((f) => ({ ...f, to: e.target.value, page: 1 }))}
                        className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm" />
                    </div>
                    <div className="flex justify-between">
                      <button onClick={() => setFilters((f) => ({ ...f, from: '', to: '', page: 1 }))}
                        className="text-xs text-slate-500 hover:text-red-500">Xóa lọc</button>
                      <button onClick={() => setShowDatePanel(false)}
                        className="text-xs text-blue-600 font-medium">Đóng</button>
                    </div>
                  </div>
                )}
              </div>
            </div>
            <button
              onClick={() => setShowCategoryModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800"
            >
              <Tag className="w-4 h-4" />
              Quản lý danh mục
            </button>
          </div>

          {/* Transaction Table */}
          <div className="bg-white dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-700/50 overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between">
              <h2 className="font-semibold text-slate-900 dark:text-white text-sm">Lịch sử giao dịch</h2>
              <span className="text-xs text-slate-500 dark:text-slate-400">{total} giao dịch</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-800/80">
                    <th className="px-3 py-2 text-xs font-medium text-slate-500 dark:text-slate-400 text-left whitespace-nowrap">Ngày</th>
                    <th className="px-3 py-2 text-xs font-medium text-slate-500 dark:text-slate-400 text-left whitespace-nowrap">Loại</th>
                    <th className="px-3 py-2 text-xs font-medium text-slate-500 dark:text-slate-400 text-left whitespace-nowrap">Đối tượng</th>
                    <th className="px-3 py-2 text-xs font-medium text-slate-500 dark:text-slate-400 text-right whitespace-nowrap">Số tiền</th>
                    <th className="px-3 py-2 text-xs font-medium text-slate-500 dark:text-slate-400 text-left whitespace-nowrap">Danh mục</th>
                    <th className="px-3 py-2 text-xs font-medium text-slate-500 dark:text-slate-400 text-left whitespace-nowrap">Người thực hiện</th>
                    <th className="px-3 py-2 text-xs font-medium text-slate-500 dark:text-slate-400 text-left whitespace-nowrap">Ghi chú</th>
                    <th className="px-3 py-2 text-xs font-medium text-slate-500 dark:text-slate-400 text-right whitespace-nowrap"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                  {transactions.map((tx) => {
                    const config = txTypeConfig[tx.type] || txTypeConfig.expense;
                    const Icon = config.icon;
                    return (
                      <tr key={tx.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/30">
                        <td className="px-3 py-2 whitespace-nowrap">
                          <span className="text-slate-900 dark:text-white">{formatDateShort(tx.occurred_at)}</span>
                          <span className="text-slate-400 ml-1">{formatTimeShort(tx.occurred_at)}</span>
                        </td>
                        <td className="px-3 py-2">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${config.bg} ${config.color}`}>
                            <Icon className="w-3 h-3" />
                            {config.label}
                          </span>
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap text-slate-700 dark:text-slate-300">
                          {tx.counterparty || '--'}
                        </td>
                        <td className="px-3 py-2 text-right whitespace-nowrap">
                          <span className={`font-semibold ${tx.type === 'income' ? 'text-emerald-600' : 'text-slate-900 dark:text-white'}`}>
                            {tx.type === 'income' ? '+' : '-'}{formatVND(tx.amount)}
                          </span>
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap">
                          {tx.category_name && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium"
                              style={{ backgroundColor: `${tx.category_color || '#6b7280'}20`, color: tx.category_color || '#6b7280' }}>
                              {tx.category_name}
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap text-slate-500 dark:text-slate-400 text-xs">{tx.created_by || '--'}</td>
                        <td className="px-3 py-2 max-w-[200px]">
                          <span className="text-slate-500 dark:text-slate-400 truncate block" title={tx.description}>{tx.description}</span>
                        </td>
                        <td className="px-3 py-2 text-right whitespace-nowrap">
                          {tx.type !== 'cashback' && (
                            <button onClick={() => openEdit(tx)} title="Sửa"
                              className="p-1 text-slate-400 hover:text-blue-600">
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                          )}
                          <button onClick={() => handleDelete(tx)} title="Xóa"
                            className="p-1 text-slate-400 hover:text-red-600">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {!loading && transactions.length === 0 && (
                <div className="px-4 py-8 text-center">
                  <p className="text-slate-500 dark:text-slate-400 text-sm">Không có giao dịch nào</p>
                </div>
              )}
              {loading && (
                <div className="px-4 py-8 text-center">
                  <p className="text-slate-500 dark:text-slate-400 text-sm">Đang tải...</p>
                </div>
              )}
            </div>
            {/* Pagination */}
            {totalPages > 1 && (
              <div className="px-4 py-3 border-t border-slate-100 dark:border-slate-700 flex items-center justify-between">
                <span className="text-xs text-slate-500 dark:text-slate-400">Trang {filters.page} / {totalPages}</span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setFilters((f) => ({ ...f, page: Math.max(1, f.page - 1) }))}
                    disabled={filters.page === 1}
                    className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <ChevronLeft className="w-4 h-4 text-slate-600 dark:text-slate-400" />
                  </button>
                  <button
                    onClick={() => setFilters((f) => ({ ...f, page: Math.min(totalPages, f.page + 1) }))}
                    disabled={filters.page === totalPages}
                    className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <ChevronRight className="w-4 h-4 text-slate-600 dark:text-slate-400" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Column */}
        <div className="space-y-4">
          {/* Cashback Debt — mirrors Payouts page */}
          <div className="bg-white dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-700/50 p-5">
            <h3 className="font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
              <Wallet className="w-4 h-4 text-amber-500" />
              Công nợ Cashback
            </h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-500 dark:text-slate-400">Tổng phải hoàn</span>
                <span className="font-semibold text-slate-900 dark:text-white">{formatVND(debt.total)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-500 dark:text-slate-400">Đã hoàn</span>
                <span className="font-semibold text-emerald-600">{formatVND(debt.paid)}</span>
              </div>
              <div className="h-px bg-slate-100 dark:bg-slate-700"></div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Còn chờ</span>
                <span className="font-bold text-amber-600">{formatVND(debt.pending)}</span>
              </div>
              <div className="h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${Math.min(100, debtPct)}%` }}></div>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 text-center">Đã hoàn {debtPct.toFixed(1)}%</p>
            </div>
          </div>

          {/* Quick Stats */}
          <div className="bg-white dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-700/50 p-5">
            <h3 className="font-semibold text-slate-900 dark:text-white mb-4">Thống kê nhanh</h3>
            <div className="space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-slate-500 dark:text-slate-400">Giao dịch hôm nay</span>
                <span className="font-semibold text-slate-900 dark:text-white">{quick.todayCount}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500 dark:text-slate-400">Thu nhập tháng này</span>
                <span className="font-semibold text-emerald-600">+{formatVND(quick.monthIncome)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500 dark:text-slate-400">Chi phí tháng này</span>
                <span className="font-semibold text-red-600">-{formatVND(quick.monthExpense)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500 dark:text-slate-400">Hoàn tiền tháng này</span>
                <span className="font-semibold text-amber-600">-{formatVND(quick.monthCashback)}</span>
              </div>
            </div>
          </div>

          {/* Spending by Category */}
          <div className="bg-white dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-700/50 p-5">
            <h3 className="font-semibold text-slate-900 dark:text-white mb-4 text-sm">Chi tiêu theo danh mục (tháng này)</h3>
            <div className="space-y-3">
              {spending.length === 0 && <p className="text-xs text-slate-400">Chưa có chi tiêu tháng này</p>}
              {spending.map((cat) => (
                <div key={cat.name}>
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="text-slate-600 dark:text-slate-400">{cat.name}</span>
                    <span className="font-medium text-slate-900 dark:text-white">{formatVND(cat.amount)}</span>
                  </div>
                  <div className="h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${cat.percent}%`, backgroundColor: cat.color }}></div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {showTxModal && (
        <TransactionModal
          onClose={() => { setShowTxModal(false); setEditingTx(null); }}
          categories={categories}
          editingTx={editingTx}
          onCreate={createTransaction}
          onUpdate={updateTransaction}
          uploadReceipt={uploadReceipt}
        />
      )}

      {confirmTarget && (
        <ConfirmCashbackModal
          suggestion={confirmTarget}
          categories={categories.filter((c) => c.type === 'cashback')}
          onClose={() => setConfirmTarget(null)}
          onConfirm={confirmCashback}
          uploadReceipt={uploadReceipt}
        />
      )}

      {showCategoryModal && (
        <CategoryManagerModal
          categories={categories}
          onClose={() => setShowCategoryModal(false)}
          onCreate={createCategory}
          onUpdate={updateCategory}
          onDelete={deleteCategory}
        />
      )}
    </div>
  );
}

// ─── Create / Edit Transaction (income & expense only) ───
function TransactionModal({ onClose, categories, editingTx, onCreate, onUpdate, uploadReceipt }) {
  const isEdit = !!editingTx;
  const [txType, setTxType] = useState(editingTx?.type === 'income' ? 'income' : 'expense');
  const [amount, setAmount] = useState(editingTx ? formatAmountInput(editingTx.amount) : '');
  const [categoryId, setCategoryId] = useState(editingTx?.category_id ? String(editingTx.category_id) : '');
  const [counterparty, setCounterparty] = useState(editingTx?.counterparty || '');
  const [occurredAt, setOccurredAt] = useState(editingTx ? toDateInput(editingTx.occurred_at) : todayInput());
  const [description, setDescription] = useState(editingTx?.description || '');
  const [receiptImage, setReceiptImage] = useState(editingTx?.receipt_image || '');
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  const availableTypes = { income: txTypeConfig.income, expense: txTypeConfig.expense };
  const filteredCategories = categories.filter((c) => c.type === txType);

  const handleFile = async (file) => {
    if (!file) return;
    setUploading(true);
    try {
      const r = await uploadReceipt(file);
      if (r.filename) setReceiptImage(r.filename);
    } catch (err) { alert('Upload lỗi: ' + err.message); }
    finally { setUploading(false); }
  };

  const handleSave = async () => {
    const amt = parseAmount(amount);
    if (amt <= 0) { alert('Vui lòng nhập số tiền hợp lệ'); return; }
    setSaving(true);
    try {
      const payload = {
        type: txType,
        amount: amt,
        categoryId: categoryId ? Number(categoryId) : null,
        counterparty: counterparty.trim(),
        occurredAt: occurredAt ? `${occurredAt}T12:00:00` : null,
        description: description.trim(),
        receiptImage,
      };
      if (isEdit) await onUpdate(editingTx.id, payload);
      else await onCreate(payload);
      onClose();
    } catch (err) { alert('Lỗi: ' + err.message); }
    finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose}></div>
      <div className="relative bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-700">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">{isEdit ? 'Sửa giao dịch' : 'Tạo giao dịch mới'}</h2>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-6 space-y-4">
          {/* Type */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Loại giao dịch</label>
            <div className="grid grid-cols-2 gap-2">
              {Object.entries(availableTypes).map(([key, cfg]) => {
                const Icon = cfg.icon;
                return (
                  <button key={key} onClick={() => { setTxType(key); setCategoryId(''); }}
                    disabled={isEdit}
                    className={`flex flex-col items-center gap-1 p-3 rounded-xl border-2 transition-colors ${txType === key ? `${cfg.border} ${cfg.bg}` : 'border-slate-200 dark:border-slate-700 hover:border-slate-300'} ${isEdit ? 'opacity-60 cursor-not-allowed' : ''}`}>
                    <Icon className={`w-5 h-5 ${txType === key ? cfg.color : 'text-slate-400'}`} />
                    <span className={`text-xs font-medium ${txType === key ? cfg.color : 'text-slate-500'}`}>{cfg.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
          {/* Amount */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Số tiền</label>
            <div className="relative">
              <input type="text" inputMode="numeric" placeholder="0" value={amount}
                onChange={(e) => setAmount(formatAmountInput(e.target.value))}
                className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-lg font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500" />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 font-medium">VNĐ</span>
            </div>
          </div>
          {/* Source */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Nguồn tiền</label>
            <div className="px-4 py-2.5 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-700 dark:text-slate-300 text-sm">
              {txType === 'income' ? (
                <span className="flex items-center gap-2"><Building2 className="w-4 h-4 text-orange-500" /> Shopee Affiliate</span>
              ) : (
                <span className="flex items-center gap-2"><Wallet className="w-4 h-4 text-emerald-500" /> Quỹ Cashback</span>
              )}
            </div>
          </div>
          {/* Counterparty */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">{txType === 'income' ? 'Nội dung nhận' : 'Chi cho'}</label>
            <input type="text" value={counterparty} onChange={(e) => setCounterparty(e.target.value)}
              placeholder={txType === 'income' ? 'VD: Shopee chuyển HH tháng 6' : 'VPS, Domain, Quảng cáo...'}
              className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          {/* Date + Category */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Ngày giao dịch</label>
              <input type="date" value={occurredAt} onChange={(e) => setOccurredAt(e.target.value)}
                className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Danh mục</label>
              <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}
                className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="">Chọn danh mục</option>
                {filteredCategories.map((cat) => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
              </select>
            </div>
          </div>
          {/* Note */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Ghi chú</label>
            <textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Mô tả giao dịch..."
              className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"></textarea>
          </div>
          {/* Upload */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Ảnh chứng từ</label>
            <label className="flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl cursor-pointer hover:border-blue-400 transition-colors">
              <Upload className="w-4 h-4 text-slate-400" />
              <span className="text-sm text-slate-500">{uploading ? 'Đang tải...' : receiptImage ? '✓ Đã có ảnh — đổi ảnh khác' : 'Chọn ảnh (PNG/JPG ≤5MB)'}</span>
              <input type="file" accept="image/*" className="hidden" onChange={(e) => handleFile(e.target.files?.[0])} />
            </label>
          </div>
        </div>
        <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-700 flex items-center justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl">Hủy</button>
          <button onClick={handleSave} disabled={saving || uploading}
            className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-xl shadow-lg shadow-blue-500/25 disabled:opacity-50 disabled:cursor-not-allowed">
            {saving ? 'Đang lưu...' : isEdit ? 'Cập nhật' : 'Lưu giao dịch'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Confirm Cashback (from a payout suggestion) ───
function ConfirmCashbackModal({ suggestion, categories, onClose, onConfirm, uploadReceipt }) {
  const [categoryId, setCategoryId] = useState('');
  const [description, setDescription] = useState(`Hoàn tiền ${suggestion.user_name || ''}`.trim());
  const [receiptImage, setReceiptImage] = useState('');
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleFile = async (file) => {
    if (!file) return;
    setUploading(true);
    try {
      const r = await uploadReceipt(file);
      if (r.filename) setReceiptImage(r.filename);
    } catch (err) { alert('Upload lỗi: ' + err.message); }
    finally { setUploading(false); }
  };

  const handleConfirm = async () => {
    setSaving(true);
    try {
      await onConfirm({ payoutId: suggestion.id, categoryId: categoryId ? Number(categoryId) : null, description: description.trim(), receiptImage });
      onClose();
    } catch (err) { alert('Lỗi: ' + err.message); }
    finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose}></div>
      <div className="relative bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-700">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Xác nhận ghi sổ hoàn tiền</h2>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-6 space-y-4">
          <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4 space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-500">User nhận</span>
              <span className="font-semibold text-slate-900 dark:text-white">{suggestion.user_name || suggestion.user_id}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-500">Số tiền</span>
              <span className="font-bold text-amber-600">{formatVND(suggestion.amount)}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-500">Ngày trả</span>
              <span className="text-slate-700 dark:text-slate-300">{formatDateShort(suggestion.paid_at)} {formatTimeShort(suggestion.paid_at)}</span>
            </div>
            {suggestion.role && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-500">Vai trò</span>
                <span className="text-slate-700 dark:text-slate-300 uppercase">{suggestion.role}</span>
              </div>
            )}
          </div>
          <p className="text-xs text-slate-400">Khoản này lấy từ trang Hoàn tiền (Payouts) — số liệu không sửa được tại đây.</p>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Danh mục</label>
            <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}
              className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="">Mặc định (Hoàn tiền)</option>
              {categories.map((cat) => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Ghi chú</label>
            <textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)}
              className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"></textarea>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Ảnh chứng từ (tùy chọn)</label>
            <label className="flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl cursor-pointer hover:border-blue-400 transition-colors">
              <Upload className="w-4 h-4 text-slate-400" />
              <span className="text-sm text-slate-500">{uploading ? 'Đang tải...' : receiptImage ? '✓ Đã có ảnh' : 'Chọn ảnh'}</span>
              <input type="file" accept="image/*" className="hidden" onChange={(e) => handleFile(e.target.files?.[0])} />
            </label>
          </div>
        </div>
        <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-700 flex items-center justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl">Hủy</button>
          <button onClick={handleConfirm} disabled={saving || uploading}
            className="px-6 py-2 bg-amber-600 hover:bg-amber-700 text-white text-sm font-medium rounded-xl shadow-lg shadow-amber-500/25 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2">
            <Check className="w-4 h-4" />{saving ? 'Đang ghi sổ...' : 'Xác nhận ghi sổ'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Category Manager (list + add/edit/delete per type) ───
function CategoryManagerModal({ categories, onClose, onCreate, onUpdate, onDelete }) {
  const [name, setName] = useState('');
  const [color, setColor] = useState('#10b981');
  const [type, setType] = useState('expense');
  const [editId, setEditId] = useState(null);
  const [editName, setEditName] = useState('');
  const [editColor, setEditColor] = useState('#10b981');
  const [busy, setBusy] = useState(false);

  const grouped = {
    income: categories.filter((c) => c.type === 'income'),
    cashback: categories.filter((c) => c.type === 'cashback'),
    expense: categories.filter((c) => c.type === 'expense'),
  };

  const handleAdd = async () => {
    if (!name.trim()) return;
    setBusy(true);
    try { await onCreate({ name: name.trim(), color, type }); setName(''); }
    catch (err) { alert('Lỗi: ' + err.message); }
    finally { setBusy(false); }
  };
  const startEdit = (cat) => { setEditId(cat.id); setEditName(cat.name); setEditColor(cat.color || '#6b7280'); };
  const saveEdit = async () => {
    if (!editName.trim()) return;
    setBusy(true);
    try { await onUpdate(editId, { name: editName.trim(), color: editColor }); setEditId(null); }
    catch (err) { alert('Lỗi: ' + err.message); }
    finally { setBusy(false); }
  };
  const handleDel = async (cat) => {
    if (!window.confirm(`Xóa danh mục "${cat.name}"?`)) return;
    setBusy(true);
    try { await onDelete(cat.id); } catch (err) { alert('Lỗi: ' + err.message); }
    finally { setBusy(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose}></div>
      <div className="relative bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-700">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Quản lý danh mục</h2>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-6 space-y-5">
          {/* Add form */}
          <div className="bg-slate-50 dark:bg-slate-900/50 rounded-xl p-4 space-y-3">
            <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Thêm danh mục</p>
            <div className="flex gap-2">
              <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Tên danh mục..."
                className="flex-1 px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              <select value={type} onChange={(e) => setType(e.target.value)}
                className="px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm">
                <option value="income">Thu nhập</option>
                <option value="cashback">Hoàn tiền</option>
                <option value="expense">Chi phí</option>
              </select>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex gap-1.5">
                {colorOptions.map((c) => (
                  <button key={c.value} onClick={() => setColor(c.value)} title={c.name}
                    className={`w-6 h-6 rounded-md ${color === c.value ? 'ring-2 ring-offset-1 ring-blue-500' : ''}`}
                    style={{ backgroundColor: c.value }} />
                ))}
              </div>
              <button onClick={handleAdd} disabled={busy || !name.trim()}
                className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg disabled:opacity-50">Thêm</button>
            </div>
          </div>
          {/* Lists by type */}
          {['income', 'cashback', 'expense'].map((t) => (
            <div key={t}>
              <p className="text-xs font-semibold text-slate-400 uppercase mb-2">{typeLabels[t]}</p>
              <div className="space-y-1.5">
                {grouped[t].length === 0 && <p className="text-xs text-slate-400">Chưa có danh mục</p>}
                {grouped[t].map((cat) => (
                  <div key={cat.id} className="flex items-center gap-2 px-3 py-2 bg-slate-50 dark:bg-slate-900/40 rounded-lg">
                    {editId === cat.id ? (
                      <>
                        <div className="flex gap-1">
                          {colorOptions.map((c) => (
                            <button key={c.value} onClick={() => setEditColor(c.value)}
                              className={`w-5 h-5 rounded ${editColor === c.value ? 'ring-2 ring-blue-500' : ''}`} style={{ backgroundColor: c.value }} />
                          ))}
                        </div>
                        <input value={editName} onChange={(e) => setEditName(e.target.value)}
                          className="flex-1 px-2 py-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-sm" />
                        <button onClick={saveEdit} disabled={busy} className="p-1 text-emerald-600"><Check className="w-4 h-4" /></button>
                        <button onClick={() => setEditId(null)} className="p-1 text-slate-400"><X className="w-4 h-4" /></button>
                      </>
                    ) : (
                      <>
                        <span className="w-3 h-3 rounded-full" style={{ backgroundColor: cat.color || '#6b7280' }}></span>
                        <span className="flex-1 text-sm text-slate-700 dark:text-slate-200">{cat.name}</span>
                        <button onClick={() => startEdit(cat)} className="p-1 text-slate-400 hover:text-blue-600"><Pencil className="w-3.5 h-3.5" /></button>
                        <button onClick={() => handleDel(cat)} className="p-1 text-slate-400 hover:text-red-600"><Trash2 className="w-3.5 h-3.5" /></button>
                      </>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
