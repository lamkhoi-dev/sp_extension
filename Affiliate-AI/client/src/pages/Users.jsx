import { useState, useMemo } from 'react';
import { Eye, Users, UserCheck, DollarSign, RefreshCw, MessageSquare, Edit2, Save, Building2, Trophy, ShoppingBag, Upload } from 'lucide-react';
import { Avatar, Tooltip } from 'antd';
import DataTable from '../components/ui/DataTable';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import { useUsers, formatVND, updateUserCashbackRates, updateUserBankInfo, updateUserCustomQr } from '../hooks/useApi';
import { VIET_BANKS, getBankLogoUrl, buildVietQrUrl } from '../constants/banks';
import BankSelect from '../components/ui/BankSelect';

const PAGE_SIZE = 20;

export default function UsersPage() {
  const { users, loading, search, setSearch, refresh } = useUsers();
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [editingRates, setEditingRates] = useState({ buyer: 60, referrer: 20, custom: 0 });
  const [savingAll, setSavingAll] = useState(false);
  const [allSaved, setAllSaved] = useState(false);

  // Bank info edit state
  const [editingBank, setEditingBank] = useState({ bankName: '', bankAccount: '' });
  const [customQrPreview, setCustomQrPreview] = useState(''); // base64 data URL for custom QR
  const [savingCustomQr, setSavingCustomQr] = useState(false);

  const openDetail = (row) => {
    setSelectedUser(row);
    setEditingRates({
      buyer: row.cashback_buyer_rate ?? 60,
      referrer: row.referrer_earn_rate ?? 20,
      custom: row.custom_rate ?? 0,
    });
    setEditingBank({
      bankName: row.bank_name || '',
      bankAccount: row.bank_account || '',
    });
    // Load existing custom QR if any (only if it's a data URL, not a VietQR URL)
    const stored = row.qr_code || '';
    setCustomQrPreview(stored.startsWith('data:') ? stored : '');
    setAllSaved(false);
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
      key: 'invited_count',
      label: 'Cộng Tác Viên',
      hideOnMobile: true,
      render: (value, row) => {
        const members = Array.isArray(row.invited_avatars) ? row.invited_avatars : [];
        if (members.length === 0 && !value) return <span className="text-slate-400 text-sm">--</span>;
        return (
          <div className="flex items-center gap-2">
            <Avatar.Group max={{ count: 4, style: { fontSize: '11px', width: 24, height: 24 } }} size={24}>
              {members.map((m, i) => (
                <Tooltip key={i} title={m.name || ''} placement="top">
                  <Avatar
                    src={m.avatar}
                    size={24}
                    style={{ backgroundColor: '#3b82f6', fontSize: '10px' }}
                  >
                    {!m.avatar && (m.name?.[0] || '?')}
                  </Avatar>
                </Tooltip>
              ))}
            </Avatar.Group>
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{value || 0}</span>
          </div>
        );
      },
    },
    {
      key: 'total_orders_count',
      label: 'Đơn hàng',
      hideOnMobile: true,
      render: (value) => (
        <div className="flex items-center gap-1">
          <ShoppingBag className="w-3 h-3 text-slate-400" />
          <span className="text-sm font-medium text-slate-900 dark:text-white">{value || 0}</span>
        </div>
      ),
    },
    {
      key: 'total_commission',
      label: 'Commission',
      hideOnMobile: true,
      render: (value) => (
        <span className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">
          {value ? formatVND(value) : '--'}
        </span>
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

  // Leaderboard top 3 per category (client-side sort)
  const topByOrders = useMemo(() =>
    [...users].sort((a, b) => (b.total_orders_count || 0) - (a.total_orders_count || 0)).slice(0, 3)
  , [users]);
  const topByCommission = useMemo(() =>
    [...users].sort((a, b) => (b.total_commission || 0) - (a.total_commission || 0)).slice(0, 3)
  , [users]);
  const topByReferral = useMemo(() =>
    [...users].sort((a, b) => (b.invited_count || 0) - (a.invited_count || 0)).slice(0, 3)
  , [users]);

  // VietQR preview URL (uses current edit state, no amount)
  const vietQrPreview = buildVietQrUrl(editingBank.bankName, editingBank.bankAccount);
  const selectedBankData = VIET_BANKS.find(b => b.code === editingBank.bankName);

  // Unified save handler — bank + rates in one click
  const handleSaveAll = async () => {
    setSavingAll(true);
    try {
      const tasks = [];
      if (editingBank.bankName && editingBank.bankAccount) {
        tasks.push(
          updateUserBankInfo(selectedUser.user_id, editingBank.bankName, editingBank.bankAccount)
            .then(result => {
              setSelectedUser(prev => ({ ...prev, bank_name: editingBank.bankName, bank_account: editingBank.bankAccount, qr_code: result.qrCode }));
            })
        );
      }
      // Save custom QR if changed
      if (customQrPreview !== (selectedUser.qr_code?.startsWith('data:') ? selectedUser.qr_code : '')) {
        tasks.push(
          updateUserCustomQr(selectedUser.user_id, customQrPreview || null)
            .then(() => {
              setSelectedUser(prev => ({ ...prev, qr_code: customQrPreview || null }));
            })
        );
      }
      tasks.push(
        updateUserCashbackRates(selectedUser.user_id, editingRates.buyer, editingRates.referrer, editingRates.custom)
          .then(() => {
            setSelectedUser(prev => ({
              ...prev,
              cashback_buyer_rate: editingRates.buyer,
              referrer_earn_rate: editingRates.referrer,
              custom_rate: editingRates.custom,
            }));
          })
      );
      const results = await Promise.allSettled(tasks);
      const failed = results.filter(r => r.status === 'rejected');
      if (failed.length > 0) {
        alert('Lưu có lỗi: ' + failed.map(f => f.reason?.message).join(', '));
      } else {
        setAllSaved(true);
        refresh();
      }
    } catch (err) {
      alert('Lỗi: ' + err.message);
    } finally {
      setSavingAll(false);
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

      {/* Top Leaderboard */}
      {!loading && users.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            { title: '🏆 Top Mua Nhiều', icon: ShoppingBag, color: 'blue', data: topByOrders, valueKey: 'total_orders_count', valueLabel: 'đơn' },
            { title: '💰 Top Commission', icon: DollarSign, color: 'emerald', data: topByCommission, valueKey: 'total_commission', valueFn: formatVND },
            { title: '🤝 Top Giới Thiệu', icon: Trophy, color: 'amber', data: topByReferral, valueKey: 'invited_count', valueLabel: 'CTV' },
          ].map(({ title, color, data, valueKey, valueFn, valueLabel }) => (
            <div key={title} className="bg-white dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700/50 p-4">
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">{title}</p>
              <div className="space-y-2">
                {data.map((u, idx) => (
                  <div key={u.user_id} className="flex items-center gap-2.5">
                    <span className={`text-xs font-bold w-4 ${
                      idx === 0 ? 'text-amber-500' : idx === 1 ? 'text-slate-400' : 'text-amber-700'
                    }`}>{idx + 1}</span>
                    <img
                      src={u.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${u.user_id}`}
                      alt={u.display_name}
                      className="w-7 h-7 rounded-lg object-cover flex-shrink-0 bg-slate-200"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-slate-900 dark:text-white truncate">{u.display_name || '--'}</p>
                    </div>
                    <span className={`text-xs font-bold text-${color}-600 dark:text-${color}-400 whitespace-nowrap`}>
                      {valueFn ? valueFn(u[valueKey] || 0) : `${u[valueKey] || 0}${valueLabel ? ' ' + valueLabel : ''}`}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

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
                  <p className="text-xs text-emerald-600 dark:text-emerald-400 mb-2">Hoa hồng mua</p>
                  <div className="flex items-center gap-1">
                    <input
                      type="number" min="0" max="100" step="5"
                      value={editingRates.buyer}
                      onChange={(e) => { setEditingRates(r => ({ ...r, buyer: Number(e.target.value) })); setAllSaved(false); }}
                      className="w-full px-2 py-1 text-lg font-bold text-emerald-600 bg-white dark:bg-slate-800 rounded-lg border border-emerald-200 dark:border-emerald-700 text-center"
                    />
                    <span className="text-emerald-600 font-bold">%</span>
                  </div>
                </div>
                <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-3 border border-blue-100 dark:border-blue-800/30">
                  <p className="text-xs text-blue-600 dark:text-blue-400 mb-2">Hoa hồng giới thiệu</p>
                  <div className="flex items-center gap-1">
                    <input
                      type="number" min="0" max="100" step="5"
                      value={editingRates.referrer}
                      onChange={(e) => { setEditingRates(r => ({ ...r, referrer: Number(e.target.value) })); setAllSaved(false); }}
                      className="w-full px-2 py-1 text-lg font-bold text-blue-600 bg-white dark:bg-slate-800 rounded-lg border border-blue-200 dark:border-blue-700 text-center"
                    />
                    <span className="text-blue-600 font-bold">%</span>
                  </div>
                </div>
                <div className="bg-amber-50 dark:bg-amber-900/20 rounded-xl p-3 border border-amber-100 dark:border-amber-800/30">
                  <p className="text-xs text-amber-600 dark:text-amber-400 mb-2">Admin</p>
                  <p className="text-lg font-bold text-amber-600 dark:text-amber-400 text-center py-1">
                    {Math.max(0, 100 - editingRates.buyer - editingRates.referrer)}%
                  </p>
                </div>
              </div>
              {/* Custom commission row */}
              <div className="grid grid-cols-2 gap-3 mt-3">
                <div className="bg-purple-50 dark:bg-purple-900/20 rounded-xl p-3 border border-purple-100 dark:border-purple-800/30">
                  <p className="text-xs text-purple-600 dark:text-purple-400 mb-2">Hoa hồng tuỳ chỉnh (/custom)</p>
                  <div className="flex items-center gap-1">
                    <input
                      type="number" min="0" max="100" step="5"
                      value={editingRates.custom}
                      onChange={(e) => { setEditingRates(r => ({ ...r, custom: Number(e.target.value) })); setAllSaved(false); }}
                      className="w-full px-2 py-1 text-lg font-bold text-purple-600 bg-white dark:bg-slate-800 rounded-lg border border-purple-200 dark:border-purple-700 text-center"
                    />
                    <span className="text-purple-600 font-bold">%</span>
                  </div>
                  <p className="text-[10px] text-purple-400 mt-1">Áp dụng cho đơn từ lệnh /custom</p>
                </div>
                <div className="bg-amber-50 dark:bg-amber-900/20 rounded-xl p-3 border border-amber-100 dark:border-amber-800/30 flex flex-col justify-center">
                  <p className="text-xs text-amber-600 dark:text-amber-400 mb-1">Ghi chú</p>
                  <p className="text-[11px] text-amber-600 dark:text-amber-400">
                    Hoa hồng tuỳ chỉnh độc lập với buyer/referrer.<br/>CTV F1 nhận % này cho toàn bộ đơn custom.
                  </p>
                </div>
              </div>
              {(100 - editingRates.buyer - editingRates.referrer) < 0 && (
                <p className="text-xs text-red-500 mt-2">⚠️ Tổng Buyer + Referrer vượt quá 100%!</p>
              )}
              {editingRates.custom > 100 && (
                <p className="text-xs text-red-500 mt-1">⚠️ Hoa hồng tuỳ chỉnh không được vượt 100%!</p>
              )}
            </div>

            {/* Bank Info + VietQR */}
            <div className="pt-4 border-t border-slate-200 dark:border-slate-700/50">
              <h4 className="text-sm font-semibold text-slate-900 dark:text-white mb-3 flex items-center gap-2">
                <Building2 className="w-4 h-4 text-slate-400" />
                Thông tin ngân hàng
              </h4>

              {/* Bank Dropdown with Logo + Search */}
              <div className="space-y-3">
                <div>
                  <label className="text-xs text-slate-500 mb-1.5 block">Ngân hàng</label>
                  <BankSelect
                    value={editingBank.bankName}
                    onChange={code => { setEditingBank(b => ({ ...b, bankName: code })); setAllSaved(false); }}
                  />
                </div>

                {/* Bank Account Number */}
                <div>
                  <label className="text-xs text-slate-500 mb-1.5 block">Số tài khoản</label>
                  <input
                    type="text"
                    value={editingBank.bankAccount}
                    onChange={e => { setEditingBank(b => ({ ...b, bankAccount: e.target.value })); setAllSaved(false); }}
                    placeholder="VD: 1234567890"
                    className="w-full px-3 py-2.5 text-sm font-mono text-slate-900 dark:text-white bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400"
                  />
                </div>

                {/* QR Preview — larger, no inline save button */}
                <div className="flex justify-center">
                  <div className="w-44 flex-shrink-0">
                    <div className="w-full aspect-square bg-white dark:bg-slate-900 rounded-xl border-2 border-slate-200 dark:border-slate-700 flex items-center justify-center overflow-hidden shadow-sm">
                      {vietQrPreview ? (
                        <img
                          src={vietQrPreview}
                          alt="VietQR"
                          className="w-full h-full object-contain"
                          onError={e => { e.target.style.display = 'none'; e.target.parentElement.innerHTML = '<p class="text-[10px] text-slate-400 text-center p-1">QR lỗi</p>'; }}
                        />
                      ) : (
                        <span className="text-[10px] text-slate-400 text-center px-2 leading-tight">Chọn NH & nhập STK<br/>để xem QR</span>
                      )}
                    </div>
                    {selectedBankData && (
                      <div className="flex items-center gap-1.5 mt-2 justify-center">
                        <img src={getBankLogoUrl(selectedBankData.code)} alt={selectedBankData.short}
                          className="w-4 h-4 rounded object-contain" onError={e => { e.target.style.display = 'none'; }} />
                        <p className="text-[10px] text-slate-500">{selectedBankData.short} · {editingBank.bankAccount || '—'}</p>
                      </div>
                    )}
                    <p className="text-center text-[9px] text-slate-400 mt-0.5">VietQR Preview</p>
                  </div>
                </div>
                {/* Custom QR Upload — for banks without VietQR support */}
                <div className="pt-3 border-t border-slate-200 dark:border-slate-700/50">
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs text-slate-500">QR tùy chỉnh <span className="text-slate-400">(Timo, MoMo, ví điện tử...)</span></label>
                    {customQrPreview && (
                      <button
                        type="button"
                        onClick={async () => {
                          setSavingCustomQr(true);
                          try {
                            await updateUserCustomQr(selectedUser.user_id, null);
                            setCustomQrPreview('');
                          } finally { setSavingCustomQr(false); }
                        }}
                        className="text-[10px] text-red-400 hover:text-red-500 transition-colors"
                      >
                        ✕ Xoá QR
                      </button>
                    )}
                  </div>

                  {customQrPreview ? (
                    <div className="flex items-center gap-3">
                      <img
                        src={customQrPreview}
                        alt="Custom QR"
                        className="w-24 h-24 rounded-xl object-contain bg-white border border-slate-200 dark:border-slate-700 shadow-sm"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-emerald-600 mb-1">✓ Đã có QR tùy chỉnh</p>
                        <label className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors">
                          🔄 Thay ảnh
                          <input type="file" accept="image/*" className="hidden" onChange={e => {
                            const file = e.target.files?.[0];
                            if (!file) return;
                            const reader = new FileReader();
                            reader.onload = ev => setCustomQrPreview(ev.target.result);
                            reader.readAsDataURL(file);
                          }} />
                        </label>
                        <p className="text-[10px] text-slate-400 mt-1">Lưu bằng nút "Lưu tất cả"</p>
                      </div>
                    </div>
                  ) : (
                    <label className="flex flex-col items-center justify-center gap-1.5 py-4 px-3 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl cursor-pointer hover:border-blue-400 dark:hover:border-blue-500 transition-colors group">
                      <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-700 flex items-center justify-center group-hover:bg-blue-50 dark:group-hover:bg-blue-900/30 transition-colors">
                        <Upload className="w-4 h-4 text-slate-400 group-hover:text-blue-500" />
                      </div>
                      <p className="text-xs text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-300">Tải ảnh QR lên</p>
                      <p className="text-[10px] text-slate-300 dark:text-slate-600">PNG / JPG · tối đa 300KB</p>
                      <input type="file" accept="image/*" className="hidden" onChange={e => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        if (file.size > 300000) { alert('Ảnh quá lớn! Tối đa 300KB.'); return; }
                        const reader = new FileReader();
                        reader.onload = ev => setCustomQrPreview(ev.target.result);
                        reader.readAsDataURL(file);
                      }} />
                    </label>
                  )}
                </div>
              </div>
            </div>

            {/* Action Buttons — unified save */}
            <div className="flex items-center gap-3 pt-2">
              <Button variant="outline" className="flex-1" onClick={() => setShowDetailModal(false)}>
                Đóng
              </Button>
              <Button
                variant={allSaved ? 'outline' : 'primary'}
                className={`flex-1 ${allSaved ? '!bg-emerald-50 dark:!bg-emerald-900/20 !text-emerald-600 !border-emerald-200' : ''}`}
                icon={allSaved ? Save : Edit2}
                disabled={savingAll || (100 - editingRates.buyer - editingRates.referrer) < 0 || editingRates.custom > 100}
                onClick={handleSaveAll}
              >
                {savingAll ? 'Đang lưu...' : allSaved ? '✓ Đã lưu thành công' : 'Lưu tất cả'}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
