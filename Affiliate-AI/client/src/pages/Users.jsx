import { useState } from 'react';
import { Eye, Users, UserCheck, DollarSign, RefreshCw, MessageSquare, Edit2, ChevronLeft, ChevronRight, Save, Building2 } from 'lucide-react';
import DataTable from '../components/ui/DataTable';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import { useUsers, formatVND, updateUserCashbackRates, updateUserBankInfo } from '../hooks/useApi';
import { VIET_BANKS, getBankLogoUrl, buildVietQrUrl } from '../constants/banks';

const PAGE_SIZE = 20;

export default function UsersPage() {
  const { users, loading, search, setSearch, refresh } = useUsers();
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [editingRates, setEditingRates] = useState({ buyer: 40, referrer: 30 });
  const [savingRates, setSavingRates] = useState(false);
  const [rateSaved, setRateSaved] = useState(false);

  // Bank info edit state
  const [editingBank, setEditingBank] = useState({ bankName: '', bankAccount: '' });
  const [savingBank, setSavingBank] = useState(false);
  const [bankSaved, setBankSaved] = useState(false);

  const openDetail = (row) => {
    setSelectedUser(row);
    setEditingRates({
      buyer: row.cashback_buyer_rate ?? 60,
      referrer: row.referrer_earn_rate ?? 20,
    });
    setEditingBank({
      bankName: row.bank_name || '',
      bankAccount: row.bank_account || '',
    });
    setBankSaved(false);
    setRateSaved(false);
    setShowDetailModal(true);
  };

  const columns = [
    {
      key: 'display_name',
      label: 'User',
      render: (value, row) => (
        <div className="flex items-center gap-2">
          <div className="relative flex-shrink-0">
            <img
              src={row.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${row.user_id || value}`}
              alt={value}
              className={`w-8 h-8 rounded-lg bg-slate-200 object-cover ${row.is_special ? 'ring-2 ring-amber-400 ring-offset-1' : ''}`}
            />
            {row.is_special ? (
              <span className="absolute -top-1 -right-1 text-[10px]" title="Tỷ lệ đặc biệt">⭐</span>
            ) : null}
          </div>
          <div className="min-w-0">
            <p className="font-medium text-slate-900 dark:text-white text-sm truncate">{value || '--'}</p>
            <p className="text-[10px] text-slate-500">{row.user_id ? String(row.user_id).slice(0, 12) + '...' : '--'}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'phone_number',
      label: 'Số Zalo',
      hideOnMobile: true,
      render: (value) => (
        <span className="text-slate-600 dark:text-slate-400 text-sm">{value || '--'}</span>
      ),
    },
    {
      key: 'message_count',
      label: 'Tin nhắn',
      render: (value) => (
        <div className="flex items-center gap-1">
          <MessageSquare className="w-3 h-3 text-slate-400" />
          <span className="font-medium text-slate-900 dark:text-white text-sm">{value || 0}</span>
        </div>
      ),
    },
    {
      key: 'referrer_name',
      label: 'Người mời',
      hideOnMobile: true,
      render: (value, row) => (
        value ? (
          <div className="flex items-center gap-2 min-w-0">
            {row.referrer_avatar ? (
              <img
                src={row.referrer_avatar}
                alt={value}
                className="w-6 h-6 rounded-full flex-shrink-0 object-cover border border-slate-200 dark:border-slate-700"
                onError={(e) => { e.target.style.display = 'none'; }}
              />
            ) : (
              <div className="w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center text-[10px] font-semibold text-blue-500 flex-shrink-0">
                {(value || '?').charAt(0).toUpperCase()}
              </div>
            )}
            <div className="min-w-0">
              <p className="text-sm text-blue-500 truncate">{value}</p>
              <p className="text-[10px] text-slate-400">{row.referrer_id ? row.referrer_id.slice(0, 10) : ''}</p>
            </div>
          </div>
        ) : <span className="text-slate-400 text-sm">--</span>
      ),
    },
    {
      key: 'last_seen',
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
          onClick={(e) => { e.stopPropagation(); openDetail(row); }}
          className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 hover:text-blue-500"
        >
          <Eye className="w-4 h-4" />
        </button>
      ),
    },
  ];

  const activeUsers = users.filter(u => {
    if (!u.last_seen) return false;
    const diff = Date.now() - new Date(u.last_seen).getTime();
    return diff < 7 * 24 * 3600 * 1000;
  });

  const referredUsers = users.filter(u => u.referrer_id);

  // VietQR preview URL (uses current edit state, no amount)
  const vietQrPreview = buildVietQrUrl(editingBank.bankName, editingBank.bankAccount);
  const selectedBankData = VIET_BANKS.find(b => b.code === editingBank.bankName);

  const handleSaveBank = async () => {
    if (!editingBank.bankName || !editingBank.bankAccount) return;
    setSavingBank(true);
    try {
      const result = await updateUserBankInfo(selectedUser.user_id, editingBank.bankName, editingBank.bankAccount);
      setSelectedUser(prev => ({ ...prev, bank_name: editingBank.bankName, bank_account: editingBank.bankAccount, qr_code: result.qrCode }));
      setBankSaved(true);
      refresh();
    } catch (err) {
      alert('Lỗi: ' + err.message);
    } finally {
      setSavingBank(false);
    }
  };

  const handleSaveRates = async () => {
    setSavingRates(true);
    try {
      const result = await updateUserCashbackRates(selectedUser.user_id, editingRates.buyer, editingRates.referrer);
      if (result && result.success === false) {
        alert('Lỗi: ' + (result.error || 'Không thể cập nhật'));
        return;
      }
      setRateSaved(true);
      setSelectedUser(prev => ({
        ...prev,
        cashback_buyer_rate: editingRates.buyer,
        referrer_earn_rate: editingRates.referrer,
      }));
      refresh();
    } catch (err) {
      alert('Lỗi: ' + err.message);
    } finally {
      setSavingRates(false);
    }
  };

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
            getRowClassName={(row) => row.is_special ? '!bg-amber-50/80 dark:!bg-amber-900/15 border-l-[3px] border-l-amber-400' : ''}
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
                src={selectedUser.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${selectedUser.user_id || selectedUser.display_name}`}
                alt={selectedUser.display_name}
                className="w-16 h-16 rounded-xl bg-slate-200 object-cover"
              />
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-xl font-bold text-slate-900 dark:text-white">{selectedUser.display_name || '--'}</h3>
                  {selectedUser.is_special && (
                    <Badge variant="warning" className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border border-amber-200 dark:border-amber-800/50">⭐ Đặc biệt</Badge>
                  )}
                </div>
                <p className="text-sm text-slate-500 mb-2">{selectedUser.user_id}</p>
                <Badge variant="success" dot>Active</Badge>
              </div>
            </div>

            {/* Người giới thiệu — with avatar */}
            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4 border border-blue-100 dark:border-blue-800/30 flex items-center gap-3">
              {selectedUser.referrer_avatar ? (
                <img
                  src={selectedUser.referrer_avatar}
                  alt={selectedUser.referrer_name}
                  className="w-9 h-9 rounded-lg flex-shrink-0 object-cover border border-blue-200 dark:border-blue-700"
                  onError={(e) => { e.target.style.display = 'none'; }}
                />
              ) : (
                <div className="w-9 h-9 rounded-lg bg-blue-100 dark:bg-blue-800/50 flex items-center justify-center flex-shrink-0">
                  <UserCheck className="w-4 h-4 text-blue-500" />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="text-xs text-blue-500 dark:text-blue-400 mb-0.5">Người giới thiệu</p>
                {selectedUser.referrer_name ? (
                  <>
                    <p className="text-sm font-semibold text-blue-700 dark:text-blue-300 truncate">{selectedUser.referrer_name}</p>
                    <p className="text-[10px] text-blue-400 dark:text-blue-500 font-mono">{selectedUser.referrer_id || '--'}</p>
                  </>
                ) : (
                  <p className="text-sm text-slate-400 italic">Chưa có người giới thiệu</p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-4 border border-slate-200 dark:border-slate-700/50">
                <p className="text-xs text-slate-500 mb-1">Số Zalo</p>
                <p className="font-medium text-slate-900 dark:text-white">{selectedUser.phone_number || '--'}</p>
              </div>
              <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-4 border border-slate-200 dark:border-slate-700/50">
                <p className="text-xs text-slate-500 mb-1">Sub ID</p>
                <p className="font-medium text-slate-900 dark:text-white break-all">{selectedUser.user_id ? String(selectedUser.user_id) : '--'}</p>
              </div>
              <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded-xl p-4 border border-emerald-100 dark:border-emerald-800/30">
                <p className="text-xs text-emerald-600 dark:text-emerald-400 mb-1">Tổng Commission</p>
                <p className="text-xl font-bold text-emerald-600 dark:text-emerald-400">{selectedUser.total_commission != null ? formatVND(selectedUser.total_commission) : '--'}</p>
              </div>
              <div className="bg-amber-50 dark:bg-amber-900/20 rounded-xl p-4 border border-amber-100 dark:border-amber-800/30">
                <p className="text-xs text-amber-600 dark:text-amber-400 mb-1">Đã hoàn</p>
                <p className="text-xl font-bold text-amber-600 dark:text-amber-400">{selectedUser.total_refunded != null ? formatVND(selectedUser.total_refunded) : '--'}</p>
              </div>
            </div>

            {/* Cashback Rates */}
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
                      onChange={(e) => { setEditingRates(r => ({ ...r, buyer: Number(e.target.value) })); setRateSaved(false); }}
                      className="w-full px-2 py-1 text-lg font-bold text-emerald-600 bg-white dark:bg-slate-800 rounded-lg border border-emerald-200 dark:border-emerald-700 text-center"
                    />
                    <span className="text-emerald-600 font-bold">%</span>
                  </div>
                </div>
                <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-3 border border-blue-100 dark:border-blue-800/30">
                  <p className="text-xs text-blue-600 dark:text-blue-400 mb-2">Tỷ lệ nhận khi con mua</p>
                  <div className="flex items-center gap-1">
                    <input
                      type="number" min="0" max="100" step="5"
                      value={editingRates.referrer}
                      onChange={(e) => { setEditingRates(r => ({ ...r, referrer: Number(e.target.value) })); setRateSaved(false); }}
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

            {/* Bank Info + VietQR */}
            <div className="pt-4 border-t border-slate-200 dark:border-slate-700/50">
              <h4 className="text-sm font-semibold text-slate-900 dark:text-white mb-3 flex items-center gap-2">
                <Building2 className="w-4 h-4 text-slate-400" />
                Thông tin ngân hàng
              </h4>

              {/* Bank Dropdown with Logo */}
              <div className="space-y-3">
                <div>
                  <label className="text-xs text-slate-500 mb-1.5 block">Ngân hàng</label>
                  <div className="relative">
                    {selectedBankData && (
                      <div className="absolute left-3 top-1/2 -translate-y-1/2 flex items-center gap-2 pointer-events-none">
                        <img
                          src={getBankLogoUrl(selectedBankData.code)}
                          alt={selectedBankData.short}
                          className="w-5 h-5 rounded object-contain"
                          onError={e => { e.target.style.display = 'none'; }}
                        />
                      </div>
                    )}
                    <select
                      value={editingBank.bankName}
                      onChange={e => { setEditingBank(b => ({ ...b, bankName: e.target.value })); setBankSaved(false); }}
                      className={`w-full py-2.5 pr-3 text-sm text-slate-900 dark:text-white bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 appearance-none ${
                        selectedBankData ? 'pl-9' : 'pl-3'
                      }`}
                    >
                      <option value="">— Chọn ngân hàng —</option>
                      {VIET_BANKS.map(b => (
                        <option key={b.code} value={b.code}>
                          {b.short} — {b.name}
                        </option>
                      ))}
                    </select>
                    <div className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400 text-xs">▼</div>
                  </div>
                </div>

                {/* Bank Account Number */}
                <div>
                  <label className="text-xs text-slate-500 mb-1.5 block">Số tài khoản</label>
                  <input
                    type="text"
                    value={editingBank.bankAccount}
                    onChange={e => { setEditingBank(b => ({ ...b, bankAccount: e.target.value })); setBankSaved(false); }}
                    placeholder="VD: 1234567890"
                    className="w-full px-3 py-2.5 text-sm font-mono text-slate-900 dark:text-white bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400"
                  />
                </div>

                {/* QR Preview + Save row */}
                <div className="flex gap-3 items-start">
                  {/* VietQR */}
                  <div className="w-28 flex-shrink-0">
                    <div className="w-full aspect-square bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center justify-center overflow-hidden">
                      {vietQrPreview ? (
                        <img
                          src={vietQrPreview}
                          alt="VietQR"
                          className="w-full h-full object-contain"
                          onError={e => { e.target.style.display = 'none'; e.target.parentElement.innerHTML = '<p class="text-[10px] text-slate-400 text-center p-1">QR lỗi</p>'; }}
                        />
                      ) : (
                        <span className="text-[10px] text-slate-400 text-center px-2 leading-tight">Chọn NH & nhập STK</span>
                      )}
                    </div>
                    <p className="text-center text-[9px] text-slate-400 mt-1">VietQR Preview</p>
                  </div>

                  {/* Right side: bank name confirm + save button */}
                  <div className="flex-1 flex flex-col justify-between h-28">
                    {selectedBankData ? (
                      <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-800/60 rounded-xl px-3 py-2 border border-slate-200 dark:border-slate-700">
                        <img
                          src={getBankLogoUrl(selectedBankData.code)}
                          alt={selectedBankData.short}
                          className="w-8 h-8 rounded-lg object-contain bg-white p-0.5 border border-slate-200"
                          onError={e => { e.target.style.display = 'none'; }}
                        />
                        <div>
                          <p className="text-xs font-semibold text-slate-900 dark:text-white">{selectedBankData.name}</p>
                          <p className="text-[10px] text-slate-500 font-mono">{editingBank.bankAccount || '—'}</p>
                        </div>
                      </div>
                    ) : (
                      <div className="bg-slate-50 dark:bg-slate-800/40 rounded-xl px-3 py-2 border border-dashed border-slate-300 dark:border-slate-600">
                        <p className="text-xs text-slate-400 italic">Chưa chọn ngân hàng</p>
                      </div>
                    )}

                    <button
                      onClick={handleSaveBank}
                      disabled={savingBank || !editingBank.bankName || !editingBank.bankAccount}
                      className={`w-full flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-medium transition-all ${
                        bankSaved
                          ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 border border-emerald-200'
                          : 'bg-blue-500 hover:bg-blue-600 text-white disabled:opacity-40 disabled:cursor-not-allowed'
                      }`}
                    >
                      <Save className="w-3.5 h-3.5" />
                      {savingBank ? 'Đang lưu...' : bankSaved ? '✓ Đã lưu' : 'Lưu ngân hàng'}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-3 pt-2">
              <Button variant="outline" className="flex-1" onClick={() => setShowDetailModal(false)}>
                Đóng
              </Button>
              <Button
                variant={rateSaved ? 'outline' : 'primary'}
                className={`flex-1 ${rateSaved ? '!bg-emerald-50 dark:!bg-emerald-900/20 !text-emerald-600 !border-emerald-200' : ''}`}
                icon={rateSaved ? Save : Edit2}
                disabled={savingRates || (100 - editingRates.buyer - editingRates.referrer) < 0}
                onClick={handleSaveRates}
              >
                {savingRates ? 'Đang lưu...' : rateSaved ? '✓ Đã lưu thành công' : 'Lưu tỷ lệ'}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
