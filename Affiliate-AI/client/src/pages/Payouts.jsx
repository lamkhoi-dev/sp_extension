import { useState, useCallback } from 'react';
import { Wallet, Check, Clock, ChevronDown, ChevronRight, Upload, RefreshCw, CreditCard, Smartphone, Building2 } from 'lucide-react';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import { usePayouts, formatVND } from '../hooks/useApi';

const paymentMethods = [
  { id: 'momo', name: 'Momo', icon: Smartphone, color: 'bg-pink-500' },
  { id: 'zalopay', name: 'ZaloPay', icon: CreditCard, color: 'bg-blue-500' },
  { id: 'bank', name: 'Chuyển khoản', icon: Building2, color: 'bg-emerald-500' },
];

// Tree connector line component
function TreeLine({ isLast }) {
  return (
    <div className="flex items-stretch w-6 flex-shrink-0">
      <div className="relative w-full">
        <div className={`absolute left-1/2 top-0 w-px bg-slate-300 dark:bg-slate-600 ${isLast ? 'h-1/2' : 'h-full'}`} />
        <div className="absolute left-1/2 top-1/2 w-3 h-px bg-slate-300 dark:bg-slate-600" />
      </div>
    </div>
  );
}

export default function PayoutsPage() {
  const { summary, history, loading, refresh, getUserDetail, createPayout, uploadBill } = usePayouts();
  const [expandedUser, setExpandedUser] = useState(null);
  const [userDetail, setUserDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [showPayModal, setShowPayModal] = useState(false);
  const [payTarget, setPayTarget] = useState(null);
  const [selectedMethod, setSelectedMethod] = useState(null);
  const [billFile, setBillFile] = useState(null);
  const [paying, setPaying] = useState(false);
  const [adminNote, setAdminNote] = useState('');

  const toggleExpand = useCallback(async (userId) => {
    if (expandedUser === userId) {
      setExpandedUser(null);
      setUserDetail(null);
      return;
    }
    setExpandedUser(userId);
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
    if (!payTarget || !selectedMethod) return;
    setPaying(true);
    try {
      let billImage = '';
      if (billFile) {
        const uploadResult = await uploadBill(null, billFile);
        billImage = uploadResult.filename || '';
      }
      await createPayout({
        userId: payTarget.userId,
        userName: payTarget.displayName,
        role: 'buyer',
        amount: payTarget.pendingPayment,
        paymentMethod: selectedMethod,
        adminNote,
      });
      // If we got a bill image, update it
      setShowPayModal(false);
      setPayTarget(null);
      setSelectedMethod(null);
      setBillFile(null);
      setAdminNote('');
      // Refresh detail if expanded
      if (expandedUser === payTarget.userId) {
        const detail = await getUserDetail(payTarget.userId);
        setUserDetail(detail);
      }
    } catch (err) {
      alert('Lỗi: ' + err.message);
    } finally {
      setPaying(false);
    }
  }, [payTarget, selectedMethod, billFile, adminNote, createPayout, uploadBill, expandedUser, getUserDetail]);

  const { buyers = [] } = summary;

  // Stats
  const totalCommission = buyers.reduce((s, b) => s + b.totalNetCommission, 0);
  const totalPending = buyers.reduce((s, b) => s + b.pendingPayment, 0);
  const totalPaid = buyers.reduce((s, b) => s + b.totalPaid, 0);

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
        ) : buyers.length === 0 ? (
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
              <div className="col-span-2 text-right">Buyer nhận</div>
              <div className="col-span-2 text-right">Đã trả</div>
              <div className="col-span-2 text-right">Cần trả</div>
              <div className="col-span-1"></div>
            </div>

            {buyers.map((buyer) => (
              <div key={buyer.userId}>
                {/* Main Row */}
                <div
                  onClick={() => toggleExpand(buyer.userId)}
                  className={`grid grid-cols-12 gap-2 items-center px-4 py-3 border-b border-slate-100 dark:border-slate-700/30 cursor-pointer transition-colors
                    ${expandedUser === buyer.userId ? 'bg-blue-50/50 dark:bg-blue-900/10' : 'hover:bg-slate-50 dark:hover:bg-slate-800/30'}`}
                >
                  {/* User */}
                  <div className="col-span-5 sm:col-span-3 flex items-center gap-2">
                    <span className="text-slate-400">
                      {expandedUser === buyer.userId ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                    </span>
                    <img
                      src={buyer.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${buyer.userId}`}
                      alt={buyer.displayName}
                      className="w-8 h-8 rounded-lg bg-slate-200 flex-shrink-0 object-cover"
                    />
                    <div className="min-w-0">
                      <p className="font-medium text-slate-900 dark:text-white text-sm truncate">{buyer.displayName}</p>
                      <p className="text-[10px] text-slate-400">{buyer.totalOrders} đơn • {buyer.buyerRate}/{buyer.referrerRate}/{buyer.adminRate}%</p>
                    </div>
                  </div>
                  {/* Total Net Commission */}
                  <div className="hidden sm:block col-span-2 text-right">
                    <p className="text-sm font-medium text-slate-900 dark:text-white">{formatVND(buyer.totalNetCommission)}</p>
                    <p className="text-[10px] text-slate-400">{buyer.completedCount}✓ {buyer.pendingCount}⏳</p>
                  </div>
                  {/* Buyer Cashback */}
                  <div className="col-span-2 text-right">
                    <p className="text-sm font-medium text-emerald-600">{formatVND(buyer.totalBuyerCashback)}</p>
                  </div>
                  {/* Paid */}
                  <div className="col-span-2 text-right">
                    <p className="text-sm text-slate-500">{formatVND(buyer.totalPaid)}</p>
                  </div>
                  {/* Pending */}
                  <div className="col-span-2 text-right">
                    <p className={`text-sm font-bold ${buyer.pendingPayment > 0 ? 'text-amber-500' : 'text-slate-400'}`}>
                      {formatVND(buyer.pendingPayment)}
                    </p>
                  </div>
                  {/* Pay Button */}
                  <div className="col-span-1 flex justify-end">
                    {buyer.pendingPayment > 0 && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setPayTarget(buyer);
                          setShowPayModal(true);
                        }}
                        className="px-2 py-1 text-xs font-medium text-white bg-emerald-500 hover:bg-emerald-600 rounded-lg transition-colors"
                      >
                        Trả
                      </button>
                    )}
                  </div>
                </div>

                {/* Expanded Tree View */}
                {expandedUser === buyer.userId && (
                  <div className="bg-slate-50/50 dark:bg-slate-900/30 border-b border-slate-200 dark:border-slate-700/30">
                    {detailLoading ? (
                      <div className="flex items-center justify-center py-6">
                        <RefreshCw className="w-4 h-4 text-blue-500 animate-spin mr-2" />
                        <span className="text-sm text-slate-400">Đang tải chi tiết...</span>
                      </div>
                    ) : userDetail ? (
                      <div className="px-4 py-3 space-y-1">
                        {/* Completed Section */}
                        {userDetail.completed.length > 0 && (
                          <div>
                            <div className="flex items-center gap-2 py-2">
                              <div className="w-2 h-2 rounded-full bg-emerald-500" />
                              <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
                                Hoàn thành ({userDetail.completed.length})
                              </span>
                            </div>
                            {userDetail.completed.map((item, idx) => (
                              <div key={`c-${idx}`} className="flex items-stretch">
                                <TreeLine isLast={idx === userDetail.completed.length - 1} />
                                <div className="flex-1 ml-1 mb-1 bg-white dark:bg-slate-800/60 rounded-lg border border-emerald-100 dark:border-emerald-800/30 px-3 py-2">
                                  <div className="flex items-center justify-between gap-2">
                                    <div className="min-w-0 flex-1">
                                      <p className="text-sm font-medium text-slate-900 dark:text-white truncate">{item.itemName}</p>
                                      <p className="text-[10px] text-slate-400">
                                        #{item.orderId} • {item.shopName} • {item.orderTime}
                                      </p>
                                    </div>
                                    <div className="flex-shrink-0 text-right">
                                      <p className="text-xs text-slate-500">HH: {formatVND(item.netCommission)}</p>
                                      <p className="text-sm font-bold text-emerald-600">→ {formatVND(item.buyerCashback)}</p>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Pending Section */}
                        {userDetail.pending.length > 0 && (
                          <div className="mt-2">
                            <div className="flex items-center gap-2 py-2">
                              <div className="w-2 h-2 rounded-full bg-amber-400" />
                              <span className="text-xs font-semibold text-amber-600 dark:text-amber-400 uppercase tracking-wider">
                                Đang xử lý ({userDetail.pending.length})
                              </span>
                            </div>
                            {userDetail.pending.map((item, idx) => (
                              <div key={`p-${idx}`} className="flex items-stretch">
                                <TreeLine isLast={idx === userDetail.pending.length - 1} />
                                <div className="flex-1 ml-1 mb-1 bg-white dark:bg-slate-800/60 rounded-lg border border-amber-100 dark:border-amber-800/30 px-3 py-2 opacity-70">
                                  <div className="flex items-center justify-between gap-2">
                                    <div className="min-w-0 flex-1">
                                      <p className="text-sm font-medium text-slate-900 dark:text-white truncate">{item.itemName}</p>
                                      <p className="text-[10px] text-slate-400">
                                        #{item.orderId} • {item.shopName} • {item.orderStatus}
                                      </p>
                                    </div>
                                    <div className="flex-shrink-0 text-right">
                                      <p className="text-xs text-slate-500">HH: {formatVND(item.netCommission)}</p>
                                      <p className="text-sm font-medium text-amber-500">→ {formatVND(item.buyerCashback)}</p>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Payout History */}
                        {userDetail.payoutHistory?.length > 0 && (
                          <div className="mt-2 pt-2 border-t border-slate-200 dark:border-slate-700/30">
                            <p className="text-xs font-semibold text-slate-500 mb-1">Lịch sử thanh toán:</p>
                            {userDetail.payoutHistory.map((p, idx) => (
                              <div key={`ph-${idx}`} className="flex items-center justify-between py-1 text-xs">
                                <span className="text-slate-500">{new Date(p.paid_at).toLocaleDateString('vi-VN')} • {p.payment_method}</span>
                                <span className="font-medium text-emerald-600">-{formatVND(p.amount)}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ) : null}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Pay Modal */}
      {showPayModal && payTarget && (
        <Modal
          title={`Thanh toán cho ${payTarget.displayName}`}
          isOpen={showPayModal}
          onClose={() => { setShowPayModal(false); setPayTarget(null); }}
        >
          <div className="space-y-5">
            {/* Amount */}
            <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded-xl p-4 border border-emerald-100 dark:border-emerald-800/30 text-center">
              <p className="text-xs text-emerald-600 mb-1">Số tiền thanh toán</p>
              <p className="text-2xl font-bold text-emerald-600">{formatVND(payTarget.pendingPayment)}</p>
              <p className="text-[10px] text-slate-400 mt-1">Từ {payTarget.completedCount} đơn hoàn thành</p>
            </div>

            {/* Payment Method */}
            <div>
              <p className="text-sm font-medium text-slate-900 dark:text-white mb-2">Phương thức</p>
              <div className="grid grid-cols-3 gap-2">
                {paymentMethods.map((m) => {
                  const Icon = m.icon;
                  return (
                    <button
                      key={m.id}
                      onClick={() => setSelectedMethod(m.id)}
                      className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border transition-all
                        ${selectedMethod === m.id
                          ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 ring-1 ring-blue-500'
                          : 'border-slate-200 dark:border-slate-700 hover:border-slate-300'
                        }`}
                    >
                      <div className={`w-8 h-8 ${m.color} rounded-lg flex items-center justify-center`}>
                        <Icon className="w-4 h-4 text-white" />
                      </div>
                      <span className="text-xs text-slate-600 dark:text-slate-400">{m.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Bill Upload */}
            <div>
              <p className="text-sm font-medium text-slate-900 dark:text-white mb-2">Ảnh bill (tuỳ chọn)</p>
              <label className="flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-xl cursor-pointer hover:border-blue-400 transition-colors">
                <Upload className="w-4 h-4 text-slate-400" />
                <span className="text-sm text-slate-500">{billFile ? billFile.name : 'Chọn ảnh...'}</span>
                <input
                  type="file" accept="image/*" className="hidden"
                  onChange={(e) => setBillFile(e.target.files?.[0] || null)}
                />
              </label>
            </div>

            {/* Note */}
            <div>
              <p className="text-sm font-medium text-slate-900 dark:text-white mb-2">Ghi chú</p>
              <textarea
                value={adminNote}
                onChange={(e) => setAdminNote(e.target.value)}
                placeholder="Ghi chú thêm..."
                rows={2}
                className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl resize-none"
              />
            </div>

            {/* Actions */}
            <div className="flex items-center gap-3">
              <Button variant="outline" className="flex-1" onClick={() => setShowPayModal(false)}>
                Huỷ
              </Button>
              <Button
                variant="primary" className="flex-1"
                disabled={!selectedMethod || paying}
                onClick={handlePay}
              >
                {paying ? 'Đang xử lý...' : `Xác nhận trả ${formatVND(payTarget.pendingPayment)}`}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
