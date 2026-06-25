import { useState } from 'react';
import {
  Plus, Search, Wallet, ArrowRight, ArrowDownLeft, ArrowUpRight,
  TrendingDown, X, Upload, Calendar, ChevronDown, ChevronLeft, ChevronRight,
  Building2, Tag
} from 'lucide-react';

// Mock categories
const defaultCategories = [
  { id: 1, name: 'Hoa hồng', color: '#10b981', type: 'income' },
  { id: 2, name: 'Cashback', color: '#f59e0b', type: 'cashback' },
  { id: 3, name: 'Vận hành', color: '#ef4444', type: 'expense' },
  { id: 4, name: 'Marketing', color: '#8b5cf6', type: 'expense' },
  { id: 5, name: 'Khác', color: '#6b7280', type: 'expense' },
];

// Mock users
const mockUsers = [
  { id: 1, name: 'Nguyễn Văn A', phone: '0901234567' },
  { id: 2, name: 'Trần Văn B', phone: '0901234568' },
  { id: 3, name: 'Phạm Văn D', phone: '0901234569' },
  { id: 4, name: 'Lê Văn C', phone: '0901234570' },
  { id: 5, name: 'Hoàng Thị E', phone: '0901234571' },
  { id: 6, name: 'Đỗ Văn F', phone: '0901234572' },
];

// Mock data
const mockData = {
  wallet: {
    name: 'Quỹ Cashback',
    owner: 'C',
    balance: 19000000,
    received: 120000000,
    spent: 101000000,
    color: '#10b981',
  },
  cashbackDebt: {
    total: 95000000,
    paid: 80000000,
    pending: 15000000,
  },
  transactions: [
    { id: 1, date: '2024-06-27', time: '14:30', type: 'income', from: 'Shopee', to: 'Quỹ', amount: 50000000, executor: 'Hệ thống', note: 'Thanh toán hoa hồng tháng 6', categoryId: 1 },
    { id: 2, date: '2024-06-27', time: '16:20', type: 'cashback', from: 'Quỹ', to: 'Nguyễn Văn A', amount: 500000, executor: 'C', note: 'Hoàn tiền đơn #12345', categoryId: 2 },
    { id: 3, date: '2024-06-27', time: '16:45', type: 'cashback', from: 'Quỹ', to: 'Trần Văn B', amount: 300000, executor: 'C', note: 'Hoàn tiền đơn #12346', categoryId: 2 },
    { id: 4, date: '2024-06-27', time: '17:00', type: 'cashback', from: 'Quỹ', to: 'Phạm Văn D', amount: 750000, executor: 'C', note: 'Hoàn tiền đơn #12347', categoryId: 2 },
    { id: 5, date: '2024-06-26', time: '09:00', type: 'expense', from: 'Quỹ', to: 'VPS Hosting', amount: 300000, executor: 'C', note: 'Gia hạn VPS tháng 7', categoryId: 3 },
    { id: 6, date: '2024-06-26', time: '10:30', type: 'expense', from: 'Quỹ', to: 'Facebook Ads', amount: 1500000, executor: 'C', note: 'Quảng cáo tuần 4', categoryId: 4 },
    { id: 7, date: '2024-06-26', time: '14:00', type: 'cashback', from: 'Quỹ', to: 'Lê Văn C', amount: 1200000, executor: 'C', note: 'Hoàn tiền đơn #12340', categoryId: 2 },
    { id: 8, date: '2024-06-25', time: '11:00', type: 'income', from: 'Shopee', to: 'Quỹ', amount: 35000000, executor: 'Hệ thống', note: 'Thanh toán bổ sung', categoryId: 1 },
    { id: 9, date: '2024-06-25', time: '15:30', type: 'expense', from: 'Quỹ', to: 'Domain', amount: 250000, executor: 'C', note: 'Gia hạn domain 1 năm', categoryId: 3 },
    { id: 10, date: '2024-06-24', time: '09:15', type: 'cashback', from: 'Quỹ', to: 'Hoàng Thị E', amount: 2100000, executor: 'C', note: 'Hoàn tiền đơn #12335', categoryId: 2 },
    { id: 11, date: '2024-06-24', time: '14:00', type: 'income', from: 'Shopee', to: 'Quỹ', amount: 35000000, executor: 'Hệ thống', note: 'Thanh toán hoa hồng tháng 5', categoryId: 1 },
    { id: 12, date: '2024-06-23', time: '10:00', type: 'cashback', from: 'Quỹ', to: 'Đỗ Văn F', amount: 450000, executor: 'C', note: 'Hoàn tiền đơn #12330', categoryId: 2 },
    { id: 13, date: '2024-06-22', time: '15:00', type: 'expense', from: 'Quỹ', to: 'SSL Certificate', amount: 200000, executor: 'C', note: 'Gia hạn SSL', categoryId: 3 },
  ],
};

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

// Format VND
const formatVND = (amount) => {
  return new Intl.NumberFormat('vi-VN', {
    style: 'decimal',
    maximumFractionDigits: 0,
  }).format(amount) + 'đ';
};

// Format date short (DD/MM)
const formatDateShort = (dateStr) => {
  const date = new Date(dateStr);
  return date.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });
};

// Transaction type config
const txTypeConfig = {
  income: { label: 'Thu nhập', color: 'text-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-900/20', border: 'border-emerald-200 dark:border-emerald-800', icon: ArrowDownLeft, sign: '+' },
  transfer: { label: 'Chuyển quỹ', color: 'text-blue-600', bg: 'bg-blue-50 dark:bg-blue-900/20', border: 'border-blue-200 dark:border-blue-800', icon: ArrowRight, sign: '' },
  cashback: { label: 'Hoàn tiền', color: 'text-amber-600', bg: 'bg-amber-50 dark:bg-amber-900/20', border: 'border-amber-200 dark:border-amber-800', icon: ArrowUpRight, sign: '-' },
  expense: { label: 'Chi phí', color: 'text-red-600', bg: 'bg-red-50 dark:bg-red-900/20', border: 'border-red-200 dark:border-red-800', icon: TrendingDown, sign: '-' },
};

const ITEMS_PER_PAGE = 8;

export default function CashFlow() {
  const [showModal, setShowModal] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [activeFilter, setActiveFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [categories, setCategories] = useState(defaultCategories);

  // Filter transactions
  const filteredTransactions = mockData.transactions.filter(tx => {
    if (activeFilter !== 'all' && tx.type !== activeFilter) return false;
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return tx.from.toLowerCase().includes(query) ||
        tx.to.toLowerCase().includes(query) ||
        tx.note.toLowerCase().includes(query) ||
        tx.executor.toLowerCase().includes(query);
    }
    return true;
  });

  // Pagination
  const totalPages = Math.ceil(filteredTransactions.length / ITEMS_PER_PAGE);
  const paginatedTransactions = filteredTransactions.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  // Reset page when filter changes
  const handleFilterChange = (filter) => {
    setActiveFilter(filter);
    setCurrentPage(1);
  };

  // Add new category
  const handleAddCategory = (newCategory) => {
    setCategories([...categories, { ...newCategory, id: categories.length + 1 }]);
    setShowCategoryModal(false);
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
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Tìm giao dịch..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-4 py-2 w-64 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          {/* Create Transaction Button */}
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-medium transition-colors shadow-lg shadow-blue-500/25"
          >
            <Plus className="w-4 h-4" />
            Tạo giao dịch
          </button>
        </div>
      </div>

      {/* Main Layout */}
      <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
        {/* Left Column - Main Content */}
        <div className="xl:col-span-3 space-y-6">
          {/* Main Wallet Card */}
          <div className="bg-gradient-to-br from-emerald-600 to-teal-700 rounded-xl p-4 text-white shadow-lg shadow-emerald-500/20">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-emerald-100 text-xs">Số dư quỹ hiện tại</p>
                <p className="text-2xl font-bold">{formatVND(mockData.wallet.balance)}</p>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <p className="text-emerald-100 text-xs">Đã nhận</p>
                  <p className="text-sm font-semibold">+{formatVND(mockData.wallet.received)}</p>
                </div>
                <div className="text-right">
                  <p className="text-emerald-100 text-xs">Đã chi</p>
                  <p className="text-sm font-semibold">-{formatVND(mockData.wallet.spent)}</p>
                </div>
                <div className="flex items-center gap-1.5 bg-white/20 rounded-lg px-2.5 py-1">
                  <Wallet className="w-3.5 h-3.5" />
                  <span className="text-xs font-medium">{mockData.wallet.owner}</span>
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
                    onClick={() => handleFilterChange(filter.key)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${activeFilter === filter.key
                      ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                      }`}
                  >
                    {filter.label}
                  </button>
                ))}
              </div>
              <button className="flex items-center gap-2 px-3 py-1.5 text-sm text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white">
                <Calendar className="w-4 h-4" />
                Khoảng thời gian
                <ChevronDown className="w-3 h-3" />
              </button>
            </div>
            {/* Add Category Button */}
            <button
              onClick={() => setShowCategoryModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800"
            >
              <Tag className="w-4 h-4" />
              Tạo danh mục
            </button>
          </div>

          {/* Transaction Table */}
          <div className="bg-white dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-700/50 overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between">
              <h2 className="font-semibold text-slate-900 dark:text-white text-sm">Lịch sử giao dịch</h2>
              <span className="text-xs text-slate-500 dark:text-slate-400">{filteredTransactions.length} giao dịch</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-800/80">
                    <th className="px-3 py-2 text-xs font-medium text-slate-500 dark:text-slate-400 text-left whitespace-nowrap">Ngày</th>
                    <th className="px-3 py-2 text-xs font-medium text-slate-500 dark:text-slate-400 text-left whitespace-nowrap">Loại</th>
                    <th className="px-3 py-2 text-xs font-medium text-slate-500 dark:text-slate-400 text-left whitespace-nowrap">Từ → Đến</th>
                    <th className="px-3 py-2 text-xs font-medium text-slate-500 dark:text-slate-400 text-right whitespace-nowrap">Số tiền</th>
                    <th className="px-3 py-2 text-xs font-medium text-slate-500 dark:text-slate-400 text-left whitespace-nowrap">Danh mục</th>
                    <th className="px-3 py-2 text-xs font-medium text-slate-500 dark:text-slate-400 text-left whitespace-nowrap">Ghi chú</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                  {paginatedTransactions.map((tx) => {
                    const config = txTypeConfig[tx.type];
                    const Icon = config.icon;
                    const category = categories.find(c => c.id === tx.categoryId);
                    return (
                      <tr key={tx.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/30">
                        <td className="px-3 py-2 whitespace-nowrap">
                          <span className="text-slate-900 dark:text-white">{formatDateShort(tx.date)}</span>
                          <span className="text-slate-400 ml-1">{tx.time}</span>
                        </td>
                        <td className="px-3 py-2">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${config.bg} ${config.color}`}>
                            <Icon className="w-3 h-3" />
                            {config.label}
                          </span>
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap text-slate-700 dark:text-slate-300">
                          {tx.from} → {tx.to}
                        </td>
                        <td className="px-3 py-2 text-right whitespace-nowrap">
                          <span className={`font-semibold ${tx.type === 'income' ? 'text-emerald-600' : 'text-slate-900 dark:text-white'}`}>
                            {tx.type === 'income' ? '+' : '-'}{formatVND(tx.amount)}
                          </span>
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap">
                          {category && (
                            <span
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium"
                              style={{ backgroundColor: `${category.color}20`, color: category.color }}
                            >
                              {category.name}
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2 max-w-[200px]">
                          <span className="text-slate-500 dark:text-slate-400 truncate block" title={tx.note}>{tx.note}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {filteredTransactions.length === 0 && (
                <div className="px-4 py-8 text-center">
                  <p className="text-slate-500 dark:text-slate-400 text-sm">Không có giao dịch nào</p>
                </div>
              )}
            </div>
            {/* Pagination */}
            {totalPages > 1 && (
              <div className="px-4 py-3 border-t border-slate-100 dark:border-slate-700 flex items-center justify-between">
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  Trang {currentPage} / {totalPages}
                </span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <ChevronLeft className="w-4 h-4 text-slate-600 dark:text-slate-400" />
                  </button>
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                    <button
                      key={page}
                      onClick={() => setCurrentPage(page)}
                      className={`w-8 h-8 rounded-lg text-sm font-medium transition-colors ${currentPage === page
                        ? 'bg-blue-600 text-white'
                        : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'
                        }`}
                    >
                      {page}
                    </button>
                  ))}
                  <button
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <ChevronRight className="w-4 h-4 text-slate-600 dark:text-slate-400" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Column - Sidebar */}
        <div className="space-y-4">
          {/* Cashback Debt Card */}
          <div className="bg-white dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-700/50 p-5">
            <h3 className="font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
              <Wallet className="w-4 h-4 text-amber-500" />
              Công nợ Cashback
            </h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-500 dark:text-slate-400">Tổng phải hoàn</span>
                <span className="font-semibold text-slate-900 dark:text-white">{formatVND(mockData.cashbackDebt.total)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-500 dark:text-slate-400">Đã hoàn</span>
                <span className="font-semibold text-emerald-600">{formatVND(mockData.cashbackDebt.paid)}</span>
              </div>
              <div className="h-px bg-slate-100 dark:bg-slate-700"></div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Còn chờ</span>
                <span className="font-bold text-amber-600">{formatVND(mockData.cashbackDebt.pending)}</span>
              </div>
              {/* Progress bar */}
              <div className="h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-emerald-500 rounded-full"
                  style={{ width: `${(mockData.cashbackDebt.paid / mockData.cashbackDebt.total) * 100}%` }}
                ></div>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 text-center">
                Đã hoàn {((mockData.cashbackDebt.paid / mockData.cashbackDebt.total) * 100).toFixed(1)}%
              </p>
            </div>
          </div>

          {/* Quick Stats */}
          <div className="bg-white dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-700/50 p-5">
            <h3 className="font-semibold text-slate-900 dark:text-white mb-4">Thống kê nhanh</h3>
            <div className="space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-slate-500 dark:text-slate-400">Giao dịch hôm nay</span>
                <span className="font-semibold text-slate-900 dark:text-white">4</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500 dark:text-slate-400">Thu nhập tháng này</span>
                <span className="font-semibold text-emerald-600">+85.000.000đ</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500 dark:text-slate-400">Chi phí tháng này</span>
                <span className="font-semibold text-red-600">-2.050.000đ</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500 dark:text-slate-400">Hoàn tiền tháng này</span>
                <span className="font-semibold text-amber-600">-2.000.000đ</span>
              </div>
            </div>
          </div>

          {/* Spending by Category */}
          <div className="bg-white dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-700/50 p-5">
            <h3 className="font-semibold text-slate-900 dark:text-white mb-4 text-sm">Chi tiêu theo danh mục</h3>
            <div className="space-y-3">
              {[
                { name: 'Cashback', amount: 4850000, color: 'bg-amber-500', percent: 70 },
                { name: 'Vận hành', amount: 550000, color: 'bg-red-500', percent: 20 },
                { name: 'Marketing', amount: 1500000, color: 'bg-purple-500', percent: 10 },
              ].map((cat) => (
                <div key={cat.name}>
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="text-slate-600 dark:text-slate-400">{cat.name}</span>
                    <span className="font-medium text-slate-900 dark:text-white">{formatVND(cat.amount)}</span>
                  </div>
                  <div className="h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                    <div className={`h-full ${cat.color} rounded-full`} style={{ width: `${cat.percent}%` }}></div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Create Transaction Modal */}
      {showModal && <CreateTransactionModal onClose={() => setShowModal(false)} categories={categories} />}

      {/* Create Category Modal */}
      {showCategoryModal && <CreateCategoryModal onClose={() => setShowCategoryModal(false)} onSave={handleAddCategory} />}
    </div>
  );
}

// Create Transaction Modal - Single wallet (C holds fund from Shopee)
function CreateTransactionModal({ onClose, categories }) {
  const [txType, setTxType] = useState('cashback');
  const [selectedUser, setSelectedUser] = useState('');

  // Only show relevant transaction types for single wallet
  const availableTypes = {
    income: txTypeConfig.income,
    cashback: txTypeConfig.cashback,
    expense: txTypeConfig.expense,
  };

  // Filter categories by transaction type
  const filteredCategories = categories.filter(c => c.type === txType);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose}></div>

      {/* Modal */}
      <div className="relative bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-700">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Tạo giao dịch mới</h2>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4">
          {/* Transaction Type */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Loại giao dịch
            </label>
            <div className="grid grid-cols-3 gap-2">
              {Object.entries(availableTypes).map(([key, cfg]) => {
                const Icon = cfg.icon;
                return (
                  <button
                    key={key}
                    onClick={() => setTxType(key)}
                    className={`flex flex-col items-center gap-1 p-3 rounded-xl border-2 transition-colors ${txType === key
                      ? `${cfg.border} ${cfg.bg}`
                      : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
                      }`}
                  >
                    <Icon className={`w-5 h-5 ${txType === key ? cfg.color : 'text-slate-400'}`} />
                    <span className={`text-xs font-medium ${txType === key ? cfg.color : 'text-slate-500 dark:text-slate-400'}`}>
                      {cfg.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Amount */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Số tiền
            </label>
            <div className="relative">
              <input
                type="text"
                placeholder="0"
                className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-lg font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 font-medium">VNĐ</span>
            </div>
          </div>

          {/* Source - Auto filled based on type */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Nguồn tiền
            </label>
            <div className="px-4 py-2.5 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-700 dark:text-slate-300 text-sm">
              {txType === 'income' ? (
                <span className="flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-orange-500" />
                  Shopee Affiliate
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <Wallet className="w-4 h-4 text-emerald-500" />
                  Quỹ Cashback (C)
                </span>
              )}
            </div>
          </div>

          {/* Destination - User select for cashback */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              {txType === 'income' ? 'Đến' : txType === 'cashback' ? 'User nhận hoàn tiền' : 'Chi cho'}
            </label>
            {txType === 'income' ? (
              <div className="px-4 py-2.5 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-700 dark:text-slate-300 text-sm">
                <span className="flex items-center gap-2">
                  <Wallet className="w-4 h-4 text-emerald-500" />
                  Quỹ Cashback (C)
                </span>
              </div>
            ) : txType === 'cashback' ? (
              <select
                value={selectedUser}
                onChange={(e) => setSelectedUser(e.target.value)}
                className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
              >
                <option value="">Chọn user</option>
                {mockUsers.map(user => (
                  <option key={user.id} value={user.id}>{user.name} - {user.phone}</option>
                ))}
              </select>
            ) : (
              <input
                type="text"
                placeholder="VPS, Domain, Quảng cáo..."
                className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
              />
            )}
          </div>

          {/* Category - Select from categories */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Danh mục
            </label>
            <select className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm">
              <option value="">Chọn danh mục</option>
              {filteredCategories.map(cat => (
                <option key={cat.id} value={cat.id}>{cat.name}</option>
              ))}
            </select>
          </div>

          {/* Note */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Ghi chú
            </label>
            <textarea
              rows={2}
              placeholder="Mô tả giao dịch..."
              className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
            ></textarea>
          </div>

          {/* Upload */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Ảnh hóa đơn / Bằng chứng
            </label>
            <div className="border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl p-6 text-center hover:border-blue-400 dark:hover:border-blue-500 transition-colors cursor-pointer">
              <Upload className="w-8 h-8 text-slate-400 mx-auto mb-2" />
              <p className="text-sm text-slate-500 dark:text-slate-400">Kéo thả hoặc click để upload</p>
              <p className="text-xs text-slate-400 mt-1">PNG, JPG tối đa 5MB</p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-700 flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition-colors"
          >
            Hủy
          </button>
          <button className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-xl transition-colors shadow-lg shadow-blue-500/25">
            Lưu giao dịch
          </button>
        </div>
      </div>
    </div>
  );
}

// Create Category Modal
function CreateCategoryModal({ onClose, onSave }) {
  const [name, setName] = useState('');
  const [color, setColor] = useState('#10b981');
  const [type, setType] = useState('expense');

  const handleSave = () => {
    if (!name.trim()) return;
    onSave({ name: name.trim(), color, type });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose}></div>

      {/* Modal */}
      <div className="relative bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-md">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-700">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Tạo danh mục mới</h2>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4">
          {/* Category Name */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Tên danh mục
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nhập tên danh mục..."
              className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
            />
          </div>

          {/* Category Type */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Loại giao dịch
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { key: 'income', label: 'Thu nhập' },
                { key: 'cashback', label: 'Hoàn tiền' },
                { key: 'expense', label: 'Chi phí' },
              ].map((t) => (
                <button
                  key={t.key}
                  onClick={() => setType(t.key)}
                  className={`px-3 py-2 rounded-xl text-sm font-medium border-2 transition-colors ${type === t.key
                      ? 'border-blue-500 bg-blue-50 text-blue-600 dark:bg-blue-900/20'
                      : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                    }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Color Picker */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Màu sắc
            </label>
            <div className="flex flex-wrap gap-2">
              {colorOptions.map((c) => (
                <button
                  key={c.value}
                  onClick={() => setColor(c.value)}
                  className={`w-8 h-8 rounded-lg transition-all ${color === c.value ? 'ring-2 ring-offset-2 ring-blue-500' : ''
                    }`}
                  style={{ backgroundColor: c.value }}
                  title={c.name}
                />
              ))}
            </div>
          </div>

          {/* Preview */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Xem trước
            </label>
            <div className="flex items-center gap-2">
              <span
                className="inline-flex items-center gap-1 px-3 py-1 rounded-lg text-sm font-medium"
                style={{ backgroundColor: `${color}20`, color: color }}
              >
                <Tag className="w-3.5 h-3.5" />
                {name || 'Tên danh mục'}
              </span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-700 flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition-colors"
          >
            Hủy
          </button>
          <button
            onClick={handleSave}
            disabled={!name.trim()}
            className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-xl transition-colors shadow-lg shadow-blue-500/25 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Tạo danh mục
          </button>
        </div>
      </div>
    </div>
  );
}
