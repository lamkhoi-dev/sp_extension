import { useState } from 'react';
import { Eye, Users, UserCheck, DollarSign, RefreshCw, Search, MessageSquare, Edit2 } from 'lucide-react';
import DataTable from '../components/ui/DataTable';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import { useUsers, formatVND, updateUserCashbackRates } from '../hooks/useApi';

export default function UsersPage() {
  const { users, loading, search, setSearch, refresh } = useUsers();
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [editingRates, setEditingRates] = useState({ buyer: 40, referrer: 30 });
  const [savingRates, setSavingRates] = useState(false);

  const columns = [
    {
      key: 'displayName',
      label: 'User',
      render: (value, row) => (
        <div className="flex items-center gap-2">
          <img
            src={row.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${row.userId || value}`}
            alt={value}
            className="w-8 h-8 rounded-lg bg-slate-200 flex-shrink-0 object-cover"
          />
          <div className="min-w-0">
            <p className="font-medium text-slate-900 dark:text-white text-sm truncate">{value || '--'}</p>
            <p className="text-[10px] text-slate-500">{row.userId ? String(row.userId).slice(0, 12) + '...' : '--'}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'phoneNumber',
      label: 'Số Zalo',
      hideOnMobile: true,
      render: (value) => (
        <span className="text-slate-600 dark:text-slate-400 text-sm">{value || '--'}</span>
      ),
    },
    {
      key: 'messageCount',
      label: 'Tin nhắn',
      render: (value) => (
        <div className="flex items-center gap-1">
          <MessageSquare className="w-3 h-3 text-slate-400" />
          <span className="font-medium text-slate-900 dark:text-white text-sm">{value || 0}</span>
        </div>
      ),
    },
    {
      key: 'referrerName',
      label: 'Người mời',
      hideOnMobile: true,
      render: (value, row) => (
        value ? (
          <div className="min-w-0">
            <p className="text-sm text-blue-500 truncate">{value}</p>
            <p className="text-[10px] text-slate-400">{row.referrerId ? row.referrerId.slice(0, 10) : ''}</p>
          </div>
        ) : <span className="text-slate-400 text-sm">--</span>
      ),
    },
    {
      key: 'lastSeen',
      label: 'Lần cuối',
      hideOnMobile: true,
      render: (value) => (
        <span className="text-slate-500 text-xs whitespace-nowrap">
          {value ? new Date(value).toLocaleDateString('vi-VN') : '--'}
        </span>
      ),
    },
    {
      key: 'actions',
      label: '',
      render: (_, row) => (
        <button
          onClick={(e) => {
            e.stopPropagation();
            setSelectedUser(row);
            setEditingRates({
              buyer: row.cashbackBuyerRate ?? 40,
              referrer: row.cashbackReferrerRate ?? 30,
            });
            setShowDetailModal(true);
          }}
          className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 hover:text-blue-500"
        >
          <Eye className="w-4 h-4" />
        </button>
      ),
    },
  ];

  const activeUsers = users.filter(u => {
    if (!u.lastSeen) return false;
    const diff = Date.now() - new Date(u.lastSeen).getTime();
    return diff < 7 * 24 * 3600 * 1000; // active within 7 days
  });

  const referredUsers = users.filter(u => u.referrerId);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Quản lý Users</h1>
          <p className="text-slate-500 dark:text-slate-400">
            Danh sách người dùng từ Zalo Bot
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
            <Users className="w-3.5 h-3.5 text-slate-400" />
            <p className="text-[10px] sm:text-xs text-slate-500">Tổng Users</p>
          </div>
          <p className="text-lg sm:text-2xl font-bold text-slate-900 dark:text-white">{users.length}</p>
        </div>
        <div className="bg-white dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700/50 p-2.5 sm:p-4">
          <div className="flex items-center gap-1.5 mb-1">
            <UserCheck className="w-3.5 h-3.5 text-emerald-500" />
            <p className="text-[10px] sm:text-xs text-slate-500">Active (7 ngày)</p>
          </div>
          <p className="text-lg sm:text-2xl font-bold text-emerald-500">{activeUsers.length}</p>
        </div>
        <div className="bg-white dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700/50 p-2.5 sm:p-4">
          <div className="flex items-center gap-1.5 mb-1">
            <DollarSign className="w-3.5 h-3.5 text-blue-500" />
            <p className="text-[10px] sm:text-xs text-slate-500">Có referrer</p>
          </div>
          <p className="text-lg sm:text-2xl font-bold text-blue-500">{referredUsers.length}</p>
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
            data={users}
            searchPlaceholder="Tìm kiếm user..."
          />
        )}
      </div>

      {/* User Detail Modal */}
      {showDetailModal && selectedUser && (
        <Modal
          title="Chi tiết User"
          isOpen={showDetailModal}
          onClose={() => setShowDetailModal(false)}
        >
          <div className="space-y-6">
            <div className="flex items-center gap-4">
              <img
                src={selectedUser.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${selectedUser.userId || selectedUser.displayName}`}
                alt={selectedUser.displayName}
                className="w-16 h-16 rounded-xl bg-slate-200 object-cover"
              />
              <div>
                <h3 className="text-xl font-bold text-slate-900 dark:text-white">{selectedUser.displayName || '--'}</h3>
                <p className="text-sm text-slate-500 mb-2">{selectedUser.userId}</p>
                <Badge variant="success" dot>Active</Badge>
              </div>
            </div>

            {/* Người giới thiệu */}
            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4 border border-blue-100 dark:border-blue-800/30 flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-800/50 flex items-center justify-center flex-shrink-0">
                <UserCheck className="w-4 h-4 text-blue-500" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs text-blue-500 dark:text-blue-400 mb-0.5">Người giới thiệu</p>
                {selectedUser.referrerName ? (
                  <>
                    <p className="text-sm font-semibold text-blue-700 dark:text-blue-300 truncate">{selectedUser.referrerName}</p>
                    <p className="text-[10px] text-blue-400 dark:text-blue-500 font-mono">{selectedUser.referrerId || '--'}</p>
                  </>
                ) : (
                  <p className="text-sm text-slate-400 italic">Chưa có người giới thiệu</p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-4 border border-slate-200 dark:border-slate-700/50">
                <p className="text-xs text-slate-500 mb-1">Số Zalo</p>
                <p className="font-medium text-slate-900 dark:text-white">{selectedUser.phoneNumber || '--'}</p>
              </div>
              <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-4 border border-slate-200 dark:border-slate-700/50">
                <p className="text-xs text-slate-500 mb-1">Sub ID</p>
                <p className="font-medium text-slate-900 dark:text-white break-all">{selectedUser.userId ? String(selectedUser.userId) : '--'}</p>
              </div>
              <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded-xl p-4 border border-emerald-100 dark:border-emerald-800/30">
                <p className="text-xs text-emerald-600 dark:text-emerald-400 mb-1">Tổng Commission</p>
                <p className="text-xl font-bold text-emerald-600 dark:text-emerald-400">{selectedUser.totalCommission != null ? formatVND(selectedUser.totalCommission) : '--'}</p>
              </div>
              <div className="bg-amber-50 dark:bg-amber-900/20 rounded-xl p-4 border border-amber-100 dark:border-amber-800/30">
                <p className="text-xs text-amber-600 dark:text-amber-400 mb-1">Đã hoàn</p>
                <p className="text-xl font-bold text-amber-600 dark:text-amber-400">{selectedUser.totalRefunded != null ? formatVND(selectedUser.totalRefunded) : '--'}</p>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-200 dark:border-slate-700/50">
              <h4 className="text-sm font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                <span className="w-4 h-4 rounded border border-slate-400 flex items-center justify-center text-[10px]">💰</span>
                Tỷ lệ Cashback
              </h4>
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded-xl p-3 border border-emerald-100 dark:border-emerald-800/30">
                  <p className="text-xs text-emerald-600 dark:text-emerald-400 mb-2">Buyer nhận</p>
                  <div className="flex items-center gap-1">
                    <input
                      type="number" min="0" max="100" step="5"
                      value={editingRates.buyer}
                      onChange={(e) => setEditingRates(r => ({ ...r, buyer: Number(e.target.value) }))}
                      className="w-full px-2 py-1 text-lg font-bold text-emerald-600 bg-white dark:bg-slate-800 rounded-lg border border-emerald-200 dark:border-emerald-700 text-center"
                    />
                    <span className="text-emerald-600 font-bold">%</span>
                  </div>
                </div>
                <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-3 border border-blue-100 dark:border-blue-800/30">
                  <p className="text-xs text-blue-600 dark:text-blue-400 mb-2">Referrer nhận</p>
                  <div className="flex items-center gap-1">
                    <input
                      type="number" min="0" max="100" step="5"
                      value={editingRates.referrer}
                      onChange={(e) => setEditingRates(r => ({ ...r, referrer: Number(e.target.value) }))}
                      className="w-full px-2 py-1 text-lg font-bold text-blue-600 bg-white dark:bg-slate-800 rounded-lg border border-blue-200 dark:border-blue-700 text-center"
                    />
                    <span className="text-blue-600 font-bold">%</span>
                  </div>
                </div>
                <div className="bg-amber-50 dark:bg-amber-900/20 rounded-xl p-3 border border-amber-100 dark:border-amber-800/30">
                  <p className="text-xs text-amber-600 dark:text-amber-400 mb-2">Admin giữ</p>
                  <p className="text-lg font-bold text-amber-600 dark:text-amber-400 text-center py-1">
                    {Math.max(0, 100 - editingRates.buyer - editingRates.referrer)}%
                  </p>
                </div>
              </div>
              {(100 - editingRates.buyer - editingRates.referrer) < 0 && (
                <p className="text-xs text-red-500 mt-2">⚠️ Tổng vượt quá 100%!</p>
              )}
            </div>

            <div className="pt-4 border-t border-slate-200 dark:border-slate-700/50">
              <h4 className="text-sm font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                <span className="w-4 h-4 rounded border border-slate-400 flex items-center justify-center text-[10px]">🏦</span>
                Thông tin thanh toán
              </h4>
              <div className="flex gap-4">
                <div className="flex-1 space-y-4">
                  <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-4 border border-slate-200 dark:border-slate-700/50">
                    <p className="text-xs text-slate-500 mb-1">Ngân hàng</p>
                    <p className="font-medium text-slate-900 dark:text-white">{selectedUser.bankName || '--'}</p>
                  </div>
                  <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-4 border border-slate-200 dark:border-slate-700/50">
                    <p className="text-xs text-slate-500 mb-1">Số tài khoản</p>
                    <p className="font-medium text-slate-900 dark:text-white">{selectedUser.bankAccount || '--'}</p>
                  </div>
                </div>
                {selectedUser.qrCode ? (
                  <div className="w-32 flex-shrink-0 flex flex-col items-center">
                    <div className="w-full aspect-square bg-white rounded-xl p-2 border border-slate-200 dark:border-slate-700/50 mb-2">
                      <img src={selectedUser.qrCode} alt="QR Code" className="w-full h-full object-contain" />
                    </div>
                    <span className="text-[10px] text-slate-500">QR Code</span>
                  </div>
                ) : (
                  <div className="w-32 flex-shrink-0 flex flex-col items-center">
                    <div className="w-full aspect-square bg-slate-50 dark:bg-slate-800/50 rounded-xl p-2 border border-slate-200 dark:border-slate-700/50 flex items-center justify-center mb-2">
                      <span className="text-xs text-slate-400">No QR</span>
                    </div>
                    <span className="text-[10px] text-slate-500">QR Code</span>
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <Button variant="outline" className="flex-1" onClick={() => setShowDetailModal(false)}>
                Đóng
              </Button>
              <Button
                variant="primary" className="flex-1" icon={Edit2}
                disabled={savingRates || (100 - editingRates.buyer - editingRates.referrer) < 0}
                onClick={async () => {
                  setSavingRates(true);
                  try {
                    await updateUserCashbackRates(selectedUser.userId, editingRates.buyer, editingRates.referrer);
                    setShowDetailModal(false);
                    refresh();
                  } catch (err) {
                    alert('Lỗi: ' + err.message);
                  } finally {
                    setSavingRates(false);
                  }
                }}
              >
                {savingRates ? 'Đang lưu...' : 'Lưu tỷ lệ'}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
