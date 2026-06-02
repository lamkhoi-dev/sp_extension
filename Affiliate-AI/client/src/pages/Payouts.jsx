import { useState, useCallback, useMemo } from 'react';
import { Wallet, Check, Clock, ChevronDown, ChevronUp, ChevronRight, Upload, RefreshCw, Building2, FileText, ExternalLink, History, QrCode, BanknoteIcon, X } from 'lucide-react';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import { usePayouts, formatVND, useCommissionRates } from '../hooks/useApi';
import { buildVietQrUrl, getBankLogoUrl, VIET_BANKS } from '../constants/banks';

// Tree connector line component
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

export default function PayoutsPage() {
  const { summary, history, withdrawalRequests, loading, refresh, getUserDetail, createPayout, uploadBill, markWithdrawalDone } = usePayouts();
  const { rates: commissionRates } = useCommissionRates();
  const [expandedUser, setExpandedUser] = useState(null);
  const [userDetail, setUserDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [showPayModal, setShowPayModal] = useState(false);
  const [payTarget, setPayTarget] = useState(null);
  const [billFile, setBillFile] = useState(null);
  const [paying, setPaying] = useState(false);
  const [payingUserId, setPayingUserId] = useState(null);
  const [adminNote, setAdminNote] = useState('');
  const [mainTab, setMainTab] = useState('pending');
  const [markingWithdrawalId, setMarkingWithdrawalId] = useState(null);
  const [expandedHistoryIds, setExpandedHistoryIds] = useState(new Set());

  // Build { [userId]: request } for O(1) lookup in render
  const withdrawalMap = useMemo(() => {
    const map = {};
    for (const req of withdrawalRequests) {
      if (req.user_id) map[req.user_id] = req;
    }
    return map;
  }, [withdrawalRequests]);
  const [historyTab, setHistoryTab] = useState('all');
  const [historyPage, setHistoryPage] = useState(1);
  const HISTORY_PAGE_SIZE = 15;
  const [userHistoryPage, setUserHistoryPage] = useState(1);
  const USER_HISTORY_PAGE_SIZE = 5;

  const toggleHistoryExpand = (id) => {
    setExpandedHistoryIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleExpand = useCallback(async (userId) => {
    if (expandedUser === userId) {
      setExpandedUser(null);
      setUserDetail(null);
      setUserHistoryPage(1);
      return;
    }
    setExpandedUser(userId);
    setUserHistoryPage(1);
    setDetailLoading(true);
    try {
      const detail = await getUserDetail(userId);
      setUserDetail(detail);
    } catch (err) {
      console.error('Detail fetch error:', err);
    } finally {
      setDetailLoading(false);
    }
  }, [expandedUser, getUserDetail]);

  const handlePay = useCallback(async () => {
    if (!payTarget) return;
    setPaying(true);
    setPayingUserId(payTarget.userId);
    try {
      let billImage = '';
      if (billFile) {
        const uploadResult = await uploadBill(null, billFile);
        billImage = uploadResult.filename || '';
      }
      await createPayout({
        userId: payTarget.userId,
        role: 'combined',
        paymentMethod: 'bank',
        adminNote,
        billImage,
      });
      setShowPayModal(false);
      setPayTarget(null);
      setBillFile(null);
      setAdminNote('');
      refresh();
      if (expandedUser === payTarget.userId) {
        const updatedDetail = await getUserDetail(payTarget.userId);
        setUserDetail(updatedDetail);
      }
    } catch (err) {
      alert('Lỗi: ' + err.message);
    } finally {
      setPaying(false);
      setPayingUserId(null);
    }
  }, [payTarget, billFile, adminNote, createPayout, uploadBill, expandedUser, getUserDetail, refresh]);

  const handleWithdrawalAction = useCallback(async (requestId, status, e) => {
    e?.stopPropagation();
    setMarkingWithdrawalId(requestId);
    try {
      await markWithdrawalDone(requestId, status);
    } catch (err) {
      alert('Lỗi: ' + err.message);
    } finally {
      setMarkingWithdrawalId(null);
    }
  }, [markWithdrawalDone]);

  const { users = [] } = summary;

  // Stats — unified buyer + referrer
  const totalCommission = users.reduce((s, u) => s + u.totalNetCommission, 0);
  const totalPending = users.reduce((s, u) => s + u.pendingPayment, 0);
  const totalPaid = users.reduce((s, u) => s + u.totalPaid, 0);

  const ROLE_CONFIG = {
    f0: { label: '🛒 F0', color: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20', dot: 'bg-emerald-400' },
    f1: { label: '🤝 F1', color: 'text-cyan-600 bg-cyan-50 dark:bg-cyan-900/20', dot: 'bg-cyan-400' },
    f2: { label: '🔗 F2', color: 'text-sky-600 bg-sky-50 dark:bg-sky-900/20', dot: 'bg-sky-400' },
    f3: { label: '🌐 F3', color: 'text-indigo-600 bg-indigo-50 dark:bg-indigo-900/20', dot: 'bg-indigo-400' },
    custom: { label: '⭐ Custom', color: 'text-amber-600 bg-amber-50 dark:bg-amber-900/20', dot: 'bg-amber-400' },
    buyer: { label: '🛒 F0', color: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20', dot: 'bg-emerald-400' },
    referrer: { label: '🤝 F1', color: 'text-cyan-600 bg-cyan-50 dark:bg-cyan-900/20', dot: 'bg-cyan-400' },
    combined: { label: '💰 Tổng', color: 'text-blue-600 bg-blue-50 dark:bg-blue-900/20', dot: 'bg-blue-400' },
  };
  const getRoleConfig = (role) => ROLE_CONFIG[role] || ROLE_CONFIG.f0;

  const filteredHistory = useMemo(() => history.filter(p => {
    if (historyTab === 'all') return true;
    const normalizedRole = p.role === 'buyer' ? 'f0' : p.role === 'referrer' ? 'f1' : p.role;
    return normalizedRole === historyTab;
  }), [history, historyTab]);

  const totalHistoryPages = Math.ceil(filteredHistory.length / HISTORY_PAGE_SIZE);
  const pagedHistory = useMemo(() => {
    const start = (historyPage - 1) * HISTORY_PAGE_SIZE;
    return filteredHistory.slice(start, start + HISTORY_PAGE_SIZE);
  }, [filteredHistory, historyPage, HISTORY_PAGE_SIZE]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Hoàn tiền</h1>
          <p className="text-slate-500 dark:text-slate-400">Quản lý cashback cho người dùng</p>
        </div>
        <Button variant="outline" icon={RefreshCw} onClick={refresh} disabled={loading}>
          {loading ? 'Đang tải...' : 'Refresh'}
        </Button>
      </div>

      {/* Main Tab Navigation */}
      <div className="flex gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl w-fit">
        {[
          { key: 'pending', label: 'Hoàn tiền', icon: Wallet },
          { key: 'history', label: 'Lịch sử Thanh toán', icon: History },
        ].map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setMainTab(key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              mainTab === key
                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
            }`}
          >
            <Icon className="w-4 h-4" />
            {label}
            {key === 'history' && history.length > 0 && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-200 dark:bg-slate-600 text-slate-600 dark:text-slate-300">{history.length}</span>
            )}
          </button>
        ))}
      </div>

      {mainTab === 'pending' && (<>
      {/* Stats */}
      <div className="grid grid-cols-3 gap-2 sm:gap-4">
        <div className="bg-white dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700/50 p-2.5 sm:p-4">
          <div className="flex items-center gap-1.5 mb-1">
            <Wallet className="w-3.5 h-3.5 text-slate-400" />
            <p className="text-[10px] sm:text-xs text-slate-500">Tổng HH</p>
          </div>
          <p className="text-lg sm:text-2xl font-bold text-slate-900 dark:text-white">{formatVND(totalCommission)}</p>
        </div>
        <div className="bg-white dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700/50 p-2.5 sm:p-4">
          <div className="flex items-center gap-1.5 mb-1">
            <Clock className="w-3.5 h-3.5 text-amber-500" />
            <p className="text-[10px] sm:text-xs text-slate-500">Cần trả</p>
          </div>
          <p className="text-lg sm:text-2xl font-bold text-amber-500">{formatVND(totalPending)}</p>
        </div>
        <div className="bg-white dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700/50 p-2.5 sm:p-4">
          <div className="flex items-center gap-1.5 mb-1">
            <Check className="w-3.5 h-3.5 text-emerald-500" />
            <p className="text-[10px] sm:text-xs text-slate-500">Đã trả</p>
          </div>
          <p className="text-lg sm:text-2xl font-bold text-emerald-500">{formatVND(totalPaid)}</p>
        </div>
      </div>

      {/* Payout List */}
      <div className="bg-white dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700/50 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <RefreshCw className="w-6 h-6 text-blue-500 animate-spin" />
          </div>
        ) : users.length === 0 ? (
          <div className="text-center py-12 text-slate-400">
            <Wallet className="w-10 h-10 mx-auto mb-3 opacity-50" />
            <p>Chưa có dữ liệu hoàn tiền</p>
            <p className="text-xs mt-1">Cần có đơn hàng match với convert logs</p>
          </div>
        ) : (
          <div>
            {/* Table Header */}
            <div className="hidden sm:grid grid-cols-12 gap-2 px-4 py-3 bg-slate-50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-700/50 text-xs text-slate-500 font-medium">
              <div className="col-span-3">User</div>
              <div className="col-span-2 text-right">Tổng HH</div>
              <div className="col-span-2 text-right">Chi tiết</div>
              <div className="col-span-2 text-right">Đã trả</div>
              <div className="col-span-2 text-right">Cần trả</div>
              <div className="col-span-1"></div>
            </div>

            {users.map((user) => (
              <div key={user.userId}>
                {/* Main Row */}
                <div
                  onClick={() => toggleExpand(user.userId)}
                  className={`grid grid-cols-12 gap-2 items-center px-4 py-3 border-b border-slate-100 dark:border-slate-700/30 cursor-pointer transition-colors
                    ${expandedUser === user.userId ? 'bg-blue-50/50 dark:bg-blue-900/10' : 'hover:bg-slate-50 dark:hover:bg-slate-800/30'}`}
                >
                  {/* User */}
                  <div className="col-span-5 sm:col-span-3 flex items-center gap-2">
                    <span className="text-slate-400">
                      {expandedUser === user.userId ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                    </span>
                    <div className="relative flex-shrink-0">
                      <img
                        src={user.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.userId}`}
                        alt={user.displayName}
                        className="w-8 h-8 rounded-lg bg-slate-200 object-cover"
                      />
                      {withdrawalMap[user.userId] && (
                        <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-red-500 border-2 border-white dark:border-slate-800 animate-pulse" title="Có yêu cầu rút tiền" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-slate-900 dark:text-white text-sm truncate">{user.displayName}</p>
                      <p className="text-[10px] text-slate-400">
                        {user.totalOrders > 0 ? `${user.totalOrders} đơn` : ''}
                        {user.referrerOrderCount > 0 ? `${user.totalOrders > 0 ? ' • ' : ''}${user.referrerOrderCount} GT` : ''}
                        {user.commissionMode === 'custom' ? <span className="text-amber-500 font-medium"> • ⭐ Custom {user.f0Rate}%</span> : ''}
                      </p>
                    </div>
                  </div>
                  {/* Total Net Commission */}
                  <div className="hidden sm:block col-span-2 text-right">
                    <p className="text-sm font-medium text-slate-900 dark:text-white">{formatVND(user.totalNetCommission)}</p>
                    {user.completedCount > 0 && <p className="text-[10px] text-slate-400">{user.completedCount}✓ {user.pendingCount}⏳</p>}
                  </div>
                  {/* Buyer+Referrer+Custom Cashback Breakdown */}
                  <div className="col-span-2 text-right space-y-0.5">
                    {user.pendingBuyerPayment > 0 && <p className="text-[10px] font-semibold text-emerald-500">🛒 F0 {formatVND(user.pendingBuyerPayment)}</p>}
                    {user.pendingF1Payment > 0 && <p className="text-[10px] font-semibold text-cyan-500">🤝 F1 {formatVND(user.pendingF1Payment)}</p>}
                    {user.pendingF2Payment > 0 && <p className="text-[10px] font-semibold text-sky-500">🔗 F2 {formatVND(user.pendingF2Payment)}</p>}
                    {user.pendingF3Payment > 0 && <p className="text-[10px] font-semibold text-indigo-500">🌐 F3 {formatVND(user.pendingF3Payment)}</p>}
                    {user.pendingCustomPayment > 0 && <p className="text-[10px] font-semibold text-amber-500">⭐ Custom {formatVND(user.pendingCustomPayment)}</p>}
                    {user.pendingBuyerPayment === 0 && !user.pendingF1Payment && !user.pendingF2Payment && !user.pendingF3Payment && !user.pendingCustomPayment && <p className="text-[10px] text-slate-400">—</p>}
                  </div>
                  {/* Paid */}
                  <div className="col-span-2 text-right">
                    <p className="text-sm text-slate-500">{formatVND(user.totalPaid)}</p>
                  </div>
                  {/* Pending Total + Rate */}
                  <div className="col-span-2 text-right">
                    <p className={`text-sm font-bold ${user.pendingPayment > 0 ? 'text-amber-500' : 'text-slate-400'}`}>
                      {formatVND(user.pendingPayment)}
                    </p>
                    {user.pendingPayment > 0 && user.commissionMode === 'custom' && (
                      <p className="text-[10px] text-amber-500 mt-0.5 font-medium">⭐ Custom {user.f0Rate}%</p>
                    )}
                  </div>
                  {/* Pay Button — per-user loading */}
                  <div className="col-span-1 flex justify-end">
                    {user.pendingPayment > 0 && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setPayTarget(user);
                          setShowPayModal(true);
                        }}
                        disabled={payingUserId === user.userId}
                        className={`font-semibold text-white rounded-lg transition-all shadow-sm hover:shadow ${
                          payingUserId === user.userId
                            ? 'px-2.5 py-1.5 text-xs bg-slate-400 cursor-not-allowed'
                            : expandedUser === user.userId
                              ? 'px-4 py-2 text-sm bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 ring-2 ring-amber-300/50 animate-pulse'
                              : 'px-2.5 py-1.5 text-xs bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-600 hover:to-cyan-600'
                        }`}
                      >
                        {payingUserId === user.userId
                          ? <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          : expandedUser === user.userId ? '💸 Trả ngay' : 'Trả'
                        }
                      </button>
                    )}
                  </div>
                </div>

                {/* Expanded Tree View */}
                {expandedUser === user.userId && (
                  <div className="bg-slate-50/50 dark:bg-slate-900/30 border-b border-slate-200 dark:border-slate-700/30">
                    {detailLoading ? (
                      <div className="flex items-center justify-center py-6">
                        <RefreshCw className="w-4 h-4 text-blue-500 animate-spin mr-2" />
                        <span className="text-sm text-slate-400">Đang tải chi tiết...</span>
                      </div>
                    ) : userDetail ? (
                      <div className="px-4 py-3 space-y-1">
                        {/* Completed Section — only show unpaid orders */}
                        {(() => {
                          // Compute order-to-payout allocation
                          let remainingOrders = [...(userDetail.completed || [])].reverse();
                          const payoutsAsc = [...(userDetail.payoutHistory || [])].reverse();

                          const enrichedPayouts = payoutsAsc.map(p => {
                            if (p.paid_orders && p.paid_orders.length > 0) {
                              const matched = p.paid_orders;
                              const matchedIds = new Set(matched.map(m => m.orderId));
                              remainingOrders = remainingOrders.filter(o => !matchedIds.has(o.orderId));
                              return { ...p, matchedOrders: matched };
                            } else {
                              let remaining = Number(p.amount || 0);
                              const matched = [];
                              const newRemainingOrders = [];
                              for (const o of remainingOrders) {
                                if (remaining > 0) {
                                  matched.push(o);
                                  remaining -= o.buyerCashback;
                                } else {
                                  newRemainingOrders.push(o);
                                }
                              }
                              remainingOrders = newRemainingOrders;
                              return { ...p, matchedOrders: matched };
                            }
                          }).reverse();

                          const unpaidCompleted = remainingOrders.reverse();
                          const completedReferrer = userDetail.completedReferrer || [];
                          const pendingReferrer = userDetail.pendingReferrer || [];
                          const completedF2 = userDetail.completedF2 || [];
                          const pendingF2 = userDetail.pendingF2 || [];
                          const completedF3 = userDetail.completedF3 || [];
                          const pendingF3 = userDetail.pendingF3 || [];
                          const completedCustom = userDetail.completedCustom || [];
                          const pendingCustom = userDetail.pendingCustom || [];
                          const customRate = userDetail.customRate || 0;
                          const totalCompleted = unpaidCompleted.length + completedReferrer.length + completedF2.length + completedF3.length + completedCustom.length;
                          const totalPending = (userDetail.pending?.length || 0) + pendingReferrer.length + pendingF2.length + pendingF3.length + pendingCustom.length;

                          // F-level branch config for DRY rendering
                          const F_BRANCHES = [
                            { key: 'f0', label: `🛒 F0 — Hoa hồng mua ${commissionRates.f0}%`, completed: unpaidCompleted, pending: userDetail.pending || [], dot: 'bg-emerald-400', text: 'text-emerald-500 dark:text-emerald-400', bg: 'bg-emerald-50/60 dark:bg-emerald-900/15', border: 'border-emerald-200/60 dark:border-emerald-800/30', cashbackField: 'buyerCashback', showBuyer: false },
                            { key: 'f1', label: `🤝 F1 — Giới thiệu cấp 1 ${commissionRates.f1}%`, completed: completedReferrer, pending: pendingReferrer, dot: 'bg-cyan-400', text: 'text-cyan-600 dark:text-cyan-400', bg: 'bg-cyan-50/60 dark:bg-cyan-900/15', border: 'border-cyan-200/60 dark:border-cyan-800/30', cashbackField: 'referrerCashback', showBuyer: true },
                            { key: 'f2', label: `🔗 F2 — Giới thiệu cấp 2 ${commissionRates.f2}%`, completed: completedF2, pending: pendingF2, dot: 'bg-sky-400', text: 'text-sky-600 dark:text-sky-400', bg: 'bg-sky-50/60 dark:bg-sky-900/15', border: 'border-sky-200/60 dark:border-sky-800/30', cashbackField: 'fCashback', showBuyer: true },
                            { key: 'f3', label: `🌐 F3 — Giới thiệu cấp 3 ${commissionRates.f3}%`, completed: completedF3, pending: pendingF3, dot: 'bg-indigo-400', text: 'text-indigo-600 dark:text-indigo-400', bg: 'bg-indigo-50/60 dark:bg-indigo-900/15', border: 'border-indigo-200/60 dark:border-indigo-800/30', cashbackField: 'fCashback', showBuyer: true },
                            { key: 'custom', label: `⭐ Hoa hồng Custom ${customRate}%`, completed: completedCustom, pending: pendingCustom, dot: 'bg-amber-400', text: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50/60 dark:bg-amber-900/15', border: 'border-amber-200/60 dark:border-amber-800/30', cashbackField: 'customCashback', showBuyer: false, showPhone: true },
                          ];
                          // Only show branches that have data (completed or pending)
                          const activeBranches = F_BRANCHES.filter(b => b.completed.length > 0 || b.pending.length > 0);

                          return (
                            <>
                              {/* ═══ COMPLETED SECTION ═══ */}
                              <div>
                                <div className="flex items-center gap-2 py-2">
                                  <div className="w-2 h-2 rounded-full bg-emerald-500" />
                                  <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
                                    Hoàn thành ({totalCompleted})
                                  </span>
                                </div>

                                {totalCompleted === 0 ? (
                                  <p className="text-xs text-slate-400 italic ml-8 py-1">— Trống (đã thanh toán hết hoặc chưa có đơn hoàn thành)</p>
                                ) : (
                                  <>
                                    {F_BRANCHES.map((branch, bIdx) => {
                                      if (branch.completed.length === 0) return null;
                                      const remainingBranches = F_BRANCHES.slice(bIdx + 1).filter(b => b.completed.length > 0);
                                      const isLastBranch = remainingBranches.length === 0;
                                      return (
                                        <div key={`c-${branch.key}`} className="flex items-stretch">
                                          <TreeLine isLast={isLastBranch} />
                                          <div className="flex-1 ml-1 mb-1">
                                            <div className="flex items-center gap-1.5 py-1 px-2">
                                              <div className={`w-1.5 h-1.5 rounded-full ${branch.dot}`} />
                                              <span className={`text-[10px] font-semibold ${branch.text} uppercase tracking-wider`}>
                                                {branch.label} ({branch.completed.length})
                                              </span>
                                            </div>
                                            {branch.completed.map((item, idx) => (
                                              <div key={`c-${branch.key}-${idx}`} className="flex items-stretch">
                                                <TreeLine isLast={idx === branch.completed.length - 1} />
                                                <div className={`flex-1 ml-1 mb-1 ${branch.bg} rounded-lg border ${branch.border} px-3 py-2`}>
                                                  <div className="flex items-center justify-between gap-2">
                                                    <div className="min-w-0 flex-1">
                                                      <p className="text-sm font-medium text-slate-900 dark:text-white truncate">{item.itemName}</p>
                                                      <div className="flex items-center gap-1.5 mt-0.5">
                                                        {branch.showBuyer && (
                                                          <>
                                                            {item.buyerAvatar ? (
                                                              <img src={item.buyerAvatar} alt="" className="w-4 h-4 rounded-full object-cover border border-slate-200" onError={e => e.target.style.display='none'} />
                                                            ) : (
                                                              <div className={`w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-bold ${branch.bg} ${branch.text}`}>
                                                                {(item.buyerName || '?').charAt(0).toUpperCase()}
                                                              </div>
                                                            )}
                                                          </>
                                                        )}
                                                        <p className="text-[10px] text-slate-400">
                                                          #{item.orderId} • {item.shopName}
                                                          {branch.showBuyer && item.buyerName ? ` • ${item.buyerName}` : ''}
                                                          {branch.showPhone ? ` • 📱 ${item.phone || '--'}` : ''}
                                                          {item.orderTime ? ` • ${item.orderTime}` : ''}
                                                        </p>
                                                      </div>
                                                    </div>
                                                    <div className="flex-shrink-0 text-right">
                                                      <p className="text-xs text-slate-500">HH: {formatVND(item.netCommission)}</p>
                                                      <p className={`text-sm font-bold ${branch.text}`}>→ {formatVND(item[branch.cashbackField])}</p>
                                                    </div>
                                                  </div>
                                                </div>
                                              </div>
                                            ))}
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </>
                                )}
                              </div>

                              {/* ═══ PENDING SECTION ═══ */}
                              <div className="mt-2">
                                <div className="flex items-center gap-2 py-2">
                                  <div className="w-2 h-2 rounded-full bg-amber-400" />
                                  <span className="text-xs font-semibold text-amber-600 dark:text-amber-400 uppercase tracking-wider">
                                    Đang xử lý ({totalPending})
                                  </span>
                                </div>

                                {totalPending === 0 ? (
                                  <p className="text-xs text-slate-400 italic ml-8 py-1">— Trống (không có đơn đang xử lý)</p>
                                ) : (
                                  <>
                                    {F_BRANCHES.map((branch, bIdx) => {
                                      if (branch.pending.length === 0) return null;
                                      const remainingBranches = F_BRANCHES.slice(bIdx + 1).filter(b => b.pending.length > 0);
                                      const isLastBranch = remainingBranches.length === 0;
                                      return (
                                        <div key={`p-${branch.key}`} className="flex items-stretch">
                                          <TreeLine isLast={isLastBranch} />
                                          <div className="flex-1 ml-1 mb-1">
                                            <div className="flex items-center gap-1.5 py-1 px-2">
                                              <div className={`w-1.5 h-1.5 rounded-full ${branch.dot} opacity-60`} />
                                              <span className={`text-[10px] font-semibold ${branch.text} uppercase tracking-wider opacity-80`}>
                                                {branch.label} ({branch.pending.length})
                                              </span>
                                            </div>
                                            {branch.pending.map((item, idx) => (
                                              <div key={`p-${branch.key}-${idx}`} className="flex items-stretch">
                                                <TreeLine isLast={idx === branch.pending.length - 1} />
                                                <div className={`flex-1 ml-1 mb-1 ${branch.bg} rounded-lg border ${branch.border} px-3 py-2 opacity-70`}>
                                                  <div className="flex items-center justify-between gap-2">
                                                    <div className="min-w-0 flex-1">
                                                      <p className="text-sm font-medium text-slate-900 dark:text-white truncate">{item.itemName}</p>
                                                      <div className="flex items-center gap-1.5 mt-0.5">
                                                        {branch.showBuyer && (
                                                          <>
                                                            {item.buyerAvatar ? (
                                                              <img src={item.buyerAvatar} alt="" className="w-4 h-4 rounded-full object-cover border border-slate-200" onError={e => e.target.style.display='none'} />
                                                            ) : (
                                                              <div className={`w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-bold ${branch.bg} ${branch.text}`}>
                                                                {(item.buyerName || '?').charAt(0).toUpperCase()}
                                                              </div>
                                                            )}
                                                          </>
                                                        )}
                                                        <p className="text-[10px] text-slate-400">
                                                          #{item.orderId} • {item.shopName}
                                                          {branch.showBuyer && item.buyerName ? ` • ${item.buyerName}` : ''}
                                                          {branch.showPhone ? ` • 📱 ${item.phone || '--'}` : ''}
                                                          {item.orderStatus ? ` • ${item.orderStatus}` : ''}
                                                        </p>
                                                      </div>
                                                    </div>
                                                    <div className="flex-shrink-0 text-right">
                                                      <p className="text-xs text-slate-500">HH: {formatVND(item.netCommission)}</p>
                                                      <p className={`text-sm font-medium ${branch.text}`}>→ {formatVND(item[branch.cashbackField])}</p>
                                                    </div>
                                                  </div>
                                                </div>
                                              </div>
                                            ))}
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </>
                                )}
                              </div>

                              {/* ═══ WITHDRAWAL REQUEST ═══ */}
                              {withdrawalMap[user.userId] && (() => {
                                const wr = withdrawalMap[user.userId];
                                const breakdown = typeof wr.breakdown === 'string' ? (() => { try { return JSON.parse(wr.breakdown); } catch { return {}; } })() : (wr.breakdown || {});
                                const isMarking = markingWithdrawalId === wr.id;
                                return (
                                  <div className="mt-2 pt-2 border-t border-red-200 dark:border-red-800/30">
                                    <div className="flex items-center gap-2 py-2">
                                      <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                                      <span className="text-xs font-semibold text-red-600 dark:text-red-400 uppercase tracking-wider">
                                        Yêu cầu rút tiền
                                      </span>
                                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 font-semibold">Chờ xử lý</span>
                                    </div>
                                    <div className="ml-4 bg-red-50/60 dark:bg-red-900/10 border border-red-200/60 dark:border-red-800/30 rounded-xl p-3">
                                      <div className="flex items-start justify-between gap-3 mb-3">
                                        <div className="space-y-1">
                                          <div className="flex items-center gap-1.5">
                                            <BanknoteIcon className="w-3.5 h-3.5 text-red-500" />
                                            <span className="text-base font-bold text-red-600 dark:text-red-400">{formatVND(wr.amount)}</span>
                                          </div>
                                          <p className="text-xs text-slate-600 dark:text-slate-400">
                                            <span className="font-medium">{wr.bank_name}</span>
                                            {wr.bank_account ? ` · ${wr.bank_account}` : ''}
                                          </p>
                                          {wr.account_holder && (
                                            <p className="text-xs text-slate-500">{wr.account_holder}</p>
                                          )}
                                          {wr.requested_at && (
                                            <p className="text-[10px] text-slate-400">
                                              Gửi lúc: {new Date(wr.requested_at).toLocaleString('vi-VN')}
                                            </p>
                                          )}
                                        </div>
                                        {Object.entries(breakdown).filter(([, v]) => v > 0).length > 0 && (
                                          <div className="text-right space-y-0.5">
                                            {breakdown.buyer > 0 && <p className="text-[10px] text-emerald-600">F0: {formatVND(breakdown.buyer)}</p>}
                                            {breakdown.f1 > 0 && <p className="text-[10px] text-cyan-600">F1: {formatVND(breakdown.f1)}</p>}
                                            {breakdown.f2 > 0 && <p className="text-[10px] text-sky-600">F2: {formatVND(breakdown.f2)}</p>}
                                            {breakdown.f3 > 0 && <p className="text-[10px] text-indigo-600">F3: {formatVND(breakdown.f3)}</p>}
                                            {breakdown.custom > 0 && <p className="text-[10px] text-amber-600">Custom: {formatVND(breakdown.custom)}</p>}
                                          </div>
                                        )}
                                      </div>
                                      <p className="text-[10px] text-slate-400 italic">Xử lý qua trang thanh toán bên dưới.</p>
                                    </div>
                                  </div>
                                );
                              })()}

                                {/* ═══ PAYOUT HISTORY ═══ */}
                                <div className="mt-2 pt-2 border-t border-slate-200 dark:border-slate-700/30">
                                  <div className="flex items-center gap-2 py-2">
                                    <div className="w-2 h-2 rounded-full bg-blue-500" />
                                    <span className="text-xs font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wider">
                                      Lịch sử thanh toán ({enrichedPayouts.length})
                                    </span>
                                  </div>
                                  
                                  {(() => {
                                    const totalUserHistoryPages = Math.ceil(enrichedPayouts.length / USER_HISTORY_PAGE_SIZE);
                                    const pagedEnrichedPayouts = enrichedPayouts.slice((userHistoryPage - 1) * USER_HISTORY_PAGE_SIZE, userHistoryPage * USER_HISTORY_PAGE_SIZE);

                                    return (
                                      <>
                                        {pagedEnrichedPayouts.length > 0 ? pagedEnrichedPayouts.map((p, idx) => (
                                          <div key={`ph-${idx}`} className="flex items-stretch">
                                            <TreeLine isLast={idx === pagedEnrichedPayouts.length - 1 && userHistoryPage === totalUserHistoryPages} />
                                            <div className="flex-1 ml-1 mb-1 bg-white dark:bg-slate-800/60 rounded-lg border border-blue-100 dark:border-blue-800/30">
                                              <div className="px-3 py-2 flex items-center justify-between gap-2">
                                                <div className="min-w-0 flex-1">
                                                  <p className="text-sm font-medium text-slate-900 dark:text-white">
                                                    {p.user_name || 'User'} — <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${getRoleConfig(p.role).color}`}>{getRoleConfig(p.role).label}</span>
                                                  </p>
                                                  <p className="text-[10px] text-slate-400">
                                                    {new Date(p.paid_at).toLocaleString('vi-VN')} • {p.payment_method || '—'}
                                                    {p.admin_note ? ` • ${p.admin_note}` : ''}
                                                  </p>
                                                </div>
                                                <div className="flex-shrink-0 text-right">
                                                  <p className="text-sm font-bold text-emerald-600">-{formatVND(p.amount)}</p>
                                                </div>
                                              </div>
                                              
                                              {/* Chi tiết đơn hàng trong lần thanh toán */}
                                              {p.matchedOrders?.length > 0 && (
                                                <div className="border-t border-blue-50 dark:border-blue-900/30 bg-blue-50/30 dark:bg-blue-900/10 px-3 py-2 rounded-b-lg space-y-1">
                                                  <p className="text-[10px] font-semibold text-blue-600/70 dark:text-blue-400/70 mb-1.5 uppercase">Đơn được thanh toán:</p>
                                                  {p.matchedOrders.map((mo, oIdx) => (
                                                    <div key={`mo-${oIdx}`} className="flex items-center justify-between gap-2 pl-2 border-l-2 border-blue-200 dark:border-blue-800/50">
                                                      <div className="min-w-0 flex-1">
                                                        <p className="text-xs text-slate-700 dark:text-slate-300 truncate">{mo.itemName}</p>
                                                      </div>
                                                      <div className="flex-shrink-0 text-right flex items-center gap-1.5">
                                                        {(() => { const moRc = getRoleConfig(mo.role); return mo.role && mo.role !== 'buyer' && mo.role !== 'f0' ? <span className={`text-[9px] px-1 py-0.5 rounded ${moRc.color}`}>{moRc.label}</span> : null; })()}
                                                        <p className={`text-[10px] font-medium ${getRoleConfig(mo.role).color.split(' ')[0]}`}>+{formatVND(mo.cashback || mo.buyerCashback || mo.referrerCashback || mo.fCashback || 0)}</p>
                                                      </div>
                                                    </div>
                                                  ))}
                                                </div>
                                              )}
                                            </div>
                                          </div>
                                        )) : (
                                          <p className="text-xs text-slate-400 italic ml-8 py-1">— Trống (chưa có lịch sử thanh toán)</p>
                                        )}

                                        {/* Pagination Controls */}
                                        {totalUserHistoryPages > 1 && (
                                          <div className="flex items-center justify-between ml-8 mt-2 mb-1 px-3 py-2 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700/50">
                                            <p className="text-xs text-slate-500">
                                              Trang {userHistoryPage} / {totalUserHistoryPages} ({enrichedPayouts.length} bản ghi)
                                            </p>
                                            <div className="flex items-center gap-1">
                                              <button
                                                onClick={(e) => { e.stopPropagation(); setUserHistoryPage(p => Math.max(1, p - 1)); }}
                                                disabled={userHistoryPage === 1}
                                                className="px-2 py-1 text-xs rounded border border-slate-200 dark:border-slate-700 disabled:opacity-40 hover:bg-white dark:hover:bg-slate-700 transition-colors"
                                              >
                                                ‹
                                              </button>
                                              <button
                                                onClick={(e) => { e.stopPropagation(); setUserHistoryPage(p => Math.min(totalUserHistoryPages, p + 1)); }}
                                                disabled={userHistoryPage === totalUserHistoryPages}
                                                className="px-2 py-1 text-xs rounded border border-slate-200 dark:border-slate-700 disabled:opacity-40 hover:bg-white dark:hover:bg-slate-700 transition-colors"
                                              >
                                                ›
                                              </button>
                                            </div>
                                          </div>
                                        )}
                                      </>
                                    );
                                  })()}
                                </div>
                            </>
                          );
                        })()}
                      </div>
                    ) : null}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      </>)}

      {mainTab === 'history' && (
      <div className="bg-white dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700/50 overflow-hidden">
        <div className="px-4 py-3 bg-slate-50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-700/50">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
              <Clock className="w-4 h-4" />
              Lịch sử thanh toán
            </h2>
            {history.length > 0 && expandedHistoryIds.size > 0 && (
              <button
                onClick={() => setExpandedHistoryIds(new Set())}
                className="text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 flex items-center gap-1 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-md transition-colors border border-slate-200 dark:border-slate-700"
              >
                <ChevronUp className="w-3 h-3" />
                Thu gọn
              </button>
            )}
          </div>
          {/* Tabs */}
          <div className="flex gap-1">
            {[
              { key: 'all', label: 'Tất cả', count: history.length, activeColor: 'bg-blue-500 text-white shadow-sm' },
              { key: 'f0', label: '🛒 F0', count: history.filter(h => h.role === 'buyer' || h.role === 'f0').length, activeColor: 'bg-emerald-500 text-white shadow-sm' },
              { key: 'f1', label: '🤝 F1', count: history.filter(h => h.role === 'referrer' || h.role === 'f1').length, activeColor: 'bg-cyan-500 text-white shadow-sm' },
              { key: 'custom', label: '⭐ Custom', count: history.filter(h => h.role === 'custom').length, activeColor: 'bg-amber-500 text-white shadow-sm' },
            ].map(tab => (
              <button
                key={tab.key}
                onClick={() => { setHistoryTab(tab.key); setHistoryPage(1); }}
                className={`px-3 py-1 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 ${
                  historyTab === tab.key
                    ? tab.activeColor
                    : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                {tab.label}
                <span className={`text-[10px] px-1 rounded-full ${
                  historyTab === tab.key ? 'bg-white/20 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-500'
                }`}>{tab.count}</span>
              </button>
            ))}
          </div>
        </div>

        {history.length === 0 ? (
          <div className="text-center py-10 text-slate-400">
            <FileText className="w-8 h-8 mx-auto mb-2 opacity-40" />
            <p className="text-sm">Chưa có lịch sử thanh toán</p>
          </div>
        ) : filteredHistory.length === 0 ? (
          <div className="text-center py-8 text-slate-400">
            <p className="text-sm">Không có dữ liệu cho tab này</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-700/30">
            {pagedHistory.map((p) => {
              const paidOrders = (() => {
                try {
                  if (typeof p.paid_orders === 'string') return JSON.parse(p.paid_orders);
                  return p.paid_orders || [];
                } catch { return []; }
              })();
              const paidDate = p.paid_at ? new Date(p.paid_at) : null;
              const rc = getRoleConfig(p.role);
              const isExpanded = expandedHistoryIds.has(p.id);

              return (
                <div key={p.id} className="border-b border-slate-100 dark:border-slate-700/30 last:border-0">
                  <div
                    className={`px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors cursor-pointer group ${isExpanded ? 'bg-slate-50 dark:bg-slate-800/20' : ''}`}
                    onClick={() => toggleHistoryExpand(p.id)}
                  >
                    <div className="flex items-start gap-3">
                      {/* Timeline dot */}
                      <div className="flex flex-col items-center mt-1">
                        <div className={`w-3 h-3 rounded-full flex-shrink-0 ${rc.dot}`} />
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-semibold text-slate-900 dark:text-white">{p.user_name || p.user_id}</span>
                          <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${rc.color}`}>{rc.label}</span>
                          <span className="text-sm font-bold text-emerald-600">−{formatVND(p.amount)}</span>
                          {p.payment_method && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-slate-500">
                              {p.payment_method === 'bank' ? '🏦 Bank' : p.payment_method === 'momo' ? '📱 MoMo' : `💳 ${p.payment_method}`}
                            </span>
                          )}
                          {p.bill_image && <span className="text-[10px] text-green-500">📄 Bill</span>}
                        </div>

                        {/* Time + note */}
                        <div className="flex items-center gap-2 mt-0.5">
                          {paidDate && (
                            <span className="text-[10px] text-slate-400">
                              {paidDate.toLocaleDateString('vi-VN')} {paidDate.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          )}
                          {p.admin_note && <span className="text-[10px] text-slate-400 italic truncate max-w-[200px]">— {p.admin_note}</span>}
                          <span className={`text-[10px] ml-auto flex items-center gap-1 transition-colors ${isExpanded ? 'text-blue-500' : 'text-slate-400 opacity-0 group-hover:opacity-100'}`}>
                            {paidOrders.length} đơn
                            {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Expandable Content (Accordion) */}
                  {isExpanded && (
                    <div className="px-4 py-3 bg-slate-50/80 dark:bg-slate-900/40 border-t border-slate-100 dark:border-slate-700/50 pl-11 shadow-inner">
                      {/* Notes and Bill Images */}
                      <div className="flex flex-wrap gap-3 mb-3">
                        {p.admin_note && (
                          <div className="bg-amber-50 dark:bg-amber-900/20 px-3 py-2 rounded-lg border border-amber-100 dark:border-amber-800/30">
                            <p className="text-xs text-amber-700 dark:text-amber-400 italic">💬 Ghi chú: {p.admin_note}</p>
                          </div>
                        )}
                        {p.bill_image && (
                          <div className="bg-white dark:bg-slate-800 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm flex items-center">
                            <a
                              href={`/api/payouts/bills/${p.bill_image}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-1.5 text-xs font-medium text-blue-500 hover:text-blue-600 transition-colors"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                              Xem ảnh Bill
                            </a>
                          </div>
                        )}
                      </div>

                      {/* Orders */}
                      <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700/50 overflow-hidden shadow-sm">
                        <div className="px-3 py-2 bg-slate-100/50 dark:bg-slate-700/30 border-b border-slate-200 dark:border-slate-700/50">
                          <p className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                            Chi tiết {paidOrders.length} đơn hàng
                          </p>
                        </div>
                        {paidOrders.length === 0 ? (
                          <div className="py-4 text-center text-slate-400">
                            <FileText className="w-5 h-5 mx-auto mb-1 opacity-30" />
                            <p className="text-xs">Không có dữ liệu đơn</p>
                          </div>
                        ) : (
                          <div className="divide-y divide-slate-100 dark:divide-slate-700/50 max-h-60 overflow-y-auto">
                            {paidOrders.map((o, idx) => (
                              <div key={idx} className="px-3 py-2 flex items-start gap-3 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                                <div className="w-5 h-5 rounded flex items-center justify-center flex-shrink-0 mt-0.5 bg-slate-100 dark:bg-slate-700 text-[10px] font-bold text-slate-500 border border-slate-200 dark:border-slate-600">
                                  {idx + 1}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-xs font-medium text-slate-800 dark:text-slate-200 line-clamp-1" title={o.itemName}>
                                    {o.itemName || '—'}
                                  </p>
                                  <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                                    <span className="text-[10px] text-slate-500 truncate max-w-[120px]" title={o.shopName}>{o.shopName}</span>
                                    {o.shopName && <span className="text-slate-300 dark:text-slate-600">•</span>}
                                    <span className="text-[10px] font-mono text-slate-400">{o.orderId}</span>
                                  </div>
                                </div>
                                <div className="text-right flex-shrink-0 pl-3">
                                  <div className="text-xs font-bold text-emerald-600">
                                    +{formatVND(o.cashback || o.buyerCashback || o.referrerCashback || 0)}
                                  </div>
                                  <div className="flex items-center justify-end gap-1 mt-0.5">
                                    {o.appliedRate > 0 && (
                                      <span className="text-[9px] px-1 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-slate-500 font-medium">
                                        {o.appliedRate}%
                                      </span>
                                    )}
                                    {o.netCommission > 0 && (
                                      <span className="text-[9px] text-slate-400 ml-1">
                                        NC: {formatVND(o.netCommission)}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
                )
            })}
          </div>
        )}

        {/* Pagination for History - always visible */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 dark:border-slate-700/50">
          <p className="text-xs text-slate-500">
            {filteredHistory.length === 0 ? '0' : (historyPage - 1) * HISTORY_PAGE_SIZE + 1}–{Math.min(historyPage * HISTORY_PAGE_SIZE, filteredHistory.length)} / {filteredHistory.length}
          </p>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setHistoryPage(p => Math.max(1, p - 1))}
              disabled={historyPage === 1}
              className="px-2.5 py-1 text-xs rounded-lg border border-slate-200 dark:border-slate-700 disabled:opacity-40 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
            >
              ‹
            </button>
            {Array.from({ length: totalHistoryPages }, (_, i) => i + 1)
              .filter(p => p === 1 || p === totalHistoryPages || Math.abs(p - historyPage) <= 1)
              .reduce((acc, p, i, arr) => {
                if (i > 0 && arr[i-1] !== p - 1) acc.push('...');
                acc.push(p);
                return acc;
              }, [])
              .map((p, i) => p === '...' ? (
                <span key={`e-${i}`} className="px-1 text-slate-400 text-xs">...</span>
              ) : (
                <button
                  key={p}
                  onClick={() => setHistoryPage(p)}
                  className={`w-7 h-7 text-xs rounded-lg transition-colors ${
                    historyPage === p
                      ? 'bg-blue-500 text-white font-semibold'
                      : 'border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400'
                  }`}
                >
                  {p}
                </button>
              ))
            }
            <button
              onClick={() => setHistoryPage(p => Math.min(totalHistoryPages, p + 1))}
              disabled={historyPage === totalHistoryPages || totalHistoryPages === 0}
              className="px-2.5 py-1 text-xs rounded-lg border border-slate-200 dark:border-slate-700 disabled:opacity-40 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
            >
              ›
            </button>
          </div>
        </div>
      </div>
      )}

      {showPayModal && payTarget && (() => {
        const bankCode = payTarget.bankName || '';
        const bankAccount = payTarget.bankAccount || '';
        const amount = payTarget.pendingPayment;
        const bankData = VIET_BANKS.find(b => b.code === bankCode);
        const qrUrl = buildVietQrUrl(
          bankCode, bankAccount, amount,
          `Hoan tien ${payTarget.displayName}`
        );
        return (
          <Modal
            title={`Chuyển khoản — ${payTarget.displayName}`}
            isOpen={showPayModal}
            onClose={() => { setShowPayModal(false); setPayTarget(null); }}
          >
            <div className="space-y-4">
              {/* Amount Breakdown */}
              <div className="rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700/50">
                {payTarget.pendingBuyerPayment > 0 && (
                  <div className="bg-emerald-50 dark:bg-emerald-900/20 px-4 py-2.5 flex items-center justify-between border-b border-emerald-100 dark:border-emerald-800/30">
                    <span className="text-xs font-medium text-emerald-600">🛒 HH Mua</span>
                    <span className="text-sm font-bold text-emerald-600">{formatVND(payTarget.pendingBuyerPayment)}</span>
                  </div>
                )}
                {payTarget.pendingReferrerPayment > 0 && (
                  <div className="bg-cyan-50 dark:bg-cyan-900/20 px-4 py-2.5 flex items-center justify-between border-b border-cyan-100 dark:border-cyan-800/30">
                    <span className="text-xs font-medium text-cyan-600">🤝 HH Giới thiệu</span>
                    <span className="text-sm font-bold text-cyan-600">{formatVND(payTarget.pendingReferrerPayment)}</span>
                  </div>
                )}
                {payTarget.pendingCustomPayment > 0 && (
                  <div className="bg-purple-50 dark:bg-purple-900/20 px-4 py-2.5 flex items-center justify-between border-b border-purple-100 dark:border-purple-800/30">
                    <span className="text-xs font-medium text-purple-600">✨ HH Tuỳ chỉnh</span>
                    <span className="text-sm font-bold text-purple-600">{formatVND(payTarget.pendingCustomPayment)}</span>
                  </div>
                )}
                <div className="bg-gradient-to-r from-emerald-500 via-cyan-500 to-purple-500 px-4 py-3 text-center">
                  <p className="text-xs text-white/80 mb-0.5">Tổng chuyển khoản</p>
                  <p className="text-2xl font-bold text-white">{formatVND(amount)}</p>
                </div>
              </div>

              {/* Bank Info card (read-only, set from User profile) */}
              {bankCode && bankAccount ? (
                <div className="flex items-center gap-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl px-4 py-3 border border-slate-200 dark:border-slate-700">
                  {bankData ? (
                    <img
                      src={getBankLogoUrl(bankData.code)}
                      alt={bankData.short}
                      className="w-10 h-10 rounded-xl object-contain bg-white p-1 border border-slate-200 flex-shrink-0"
                      onError={e => { e.target.style.display = 'none'; }}
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center flex-shrink-0">
                      <Building2 className="w-5 h-5 text-blue-500" />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-slate-500 mb-0.5">Ngân hàng nhận</p>
                    <p className="text-sm font-semibold text-slate-900 dark:text-white">{bankData?.name || bankCode}</p>
                    <p className="text-xs font-mono text-slate-600 dark:text-slate-400">{bankAccount}</p>
                  </div>
                </div>
              ) : payTarget.customQr ? (
                <div className="flex items-center gap-3 bg-amber-50 dark:bg-amber-900/20 rounded-xl px-4 py-3 border border-amber-200 dark:border-amber-800/40">
                  <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center flex-shrink-0">
                    <QrCode className="w-5 h-5 text-amber-500" />
                  </div>
                  <div>
                    <p className="text-xs font-medium text-amber-700 dark:text-amber-400">QR tùy chỉnh</p>
                    <p className="text-[10px] text-amber-600 dark:text-amber-500">Nhập số tiền thủ công khi chuyển khoản</p>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-3 bg-amber-50 dark:bg-amber-900/20 rounded-xl px-4 py-3 border border-amber-200 dark:border-amber-800/40">
                  <Building2 className="w-5 h-5 text-amber-500 flex-shrink-0" />
                  <div>
                    <p className="text-xs font-medium text-amber-700 dark:text-amber-400">Chưa có thông tin ngân hàng</p>
                    <p className="text-[10px] text-amber-600 dark:text-amber-500">Vào trang Users → chi tiết user để cập nhật</p>
                  </div>
                </div>
              )}

              {/* QR — VietQR auto or custom fallback */}
              {(qrUrl || payTarget.customQr) ? (
                <div className="flex flex-col items-center gap-2 bg-slate-50 dark:bg-slate-900/40 rounded-xl p-4 border border-slate-200 dark:border-slate-700">
                  {qrUrl && !payTarget.customQr ? (
                    <>
                      <p className="text-xs font-medium text-slate-500">Quét QR để chuyển tiền</p>
                      <img
                        src={qrUrl}
                        alt="VietQR"
                        className="w-56 h-56 object-contain rounded-lg border border-slate-200 dark:border-slate-600 bg-white"
                        onError={e => { e.target.style.display = 'none'; }}
                      />
                      <p className="text-[10px] text-slate-400">
                        Số tiền đã điền sẵn: <strong className="text-slate-600 dark:text-slate-300">{formatVND(amount)}</strong>
                      </p>
                    </>
                  ) : payTarget.customQr ? (
                    <>
                      <div className="flex items-center gap-1.5 mb-1">
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 font-medium">QR tùy chỉnh</span>
                        {qrUrl && <span className="text-[10px] text-slate-400">• VietQR cũng có sẵn</span>}
                      </div>
                      <img
                        src={payTarget.customQr}
                        alt="Custom QR"
                        className="w-56 h-56 object-contain rounded-lg border border-amber-200 dark:border-amber-800/40 bg-white shadow-sm"
                      />
                      <p className="text-[10px] text-amber-600 dark:text-amber-400">
                        ⚠️ Nhập số tiền thủ công: <strong>{formatVND(amount)}</strong>
                      </p>
                    </>
                  ) : null}
                </div>
              ) : null}

              {/* Bill Upload */}
              <div>
                <p className="text-sm font-medium text-slate-900 dark:text-white mb-1.5">Ảnh bill (tuỳ chọn)</p>
                <label className="flex items-center justify-center gap-2 px-4 py-2.5 border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-xl cursor-pointer hover:border-blue-400 transition-colors">
                  <Upload className="w-4 h-4 text-slate-400" />
                  <span className="text-sm text-slate-500">{billFile ? billFile.name : 'Chọn ảnh...'}</span>
                  <input type="file" accept="image/*" className="hidden" onChange={e => setBillFile(e.target.files?.[0] || null)} />
                </label>
              </div>

              {/* Note */}
              <div>
                <p className="text-sm font-medium text-slate-900 dark:text-white mb-1.5">Ghi chú</p>
                <textarea
                  value={adminNote}
                  onChange={e => setAdminNote(e.target.value)}
                  placeholder="Ghi chú thêm..."
                  rows={2}
                  className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl resize-none"
                />
              </div>

              {/* Actions */}
              <div className="flex items-center gap-3">
                <Button variant="outline" className="flex-1" onClick={() => setShowPayModal(false)}>Huỷ</Button>
                <Button
                  variant="primary" className="flex-1"
                  disabled={paying}
                  onClick={handlePay}
                >
                  {paying ? 'Đang xử lý...' : `Xác nhận trả ${formatVND(amount)}`}
                </Button>
              </div>
            </div>
          </Modal>
        );
      })()}
    </div>
  );
}
