import { useState, useEffect, useMemo } from 'react';
import { ShoppingCart, Link2, User, DollarSign, CheckCircle, AlertCircle, Package, Hash, Percent, Calendar } from 'lucide-react';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';

const API = '/api';
const STATUS_OPTIONS = ['Đang chờ xử lý', 'Hoàn thành'];
const fmtVND = v => new Intl.NumberFormat('vi-VN').format(Math.round(v || 0)) + 'đ';

function Field({ label, icon: Icon, children, hint }) {
  return (
    <div>
      <label className="flex items-center gap-1.5 text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
        {Icon && <Icon className="h-4 w-4 text-slate-400" />} {label}
      </label>
      {children}
      {hint && <p className="mt-1 text-xs text-slate-400">{hint}</p>}
    </div>
  );
}

const inputCls = 'w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all';
const selectCls = inputCls + ' appearance-none';

export default function SimulateOrderPage() {
  const [users, setUsers] = useState([]);
  const [form, setForm] = useState({
    shopeeLink: '', itemId: '', itemName: '', shopId: '', shopName: '',
    price: '', quantity: 1, commissionRate: '', status: 'Hoàn thành',
    subId1: '', orderTime: new Date().toISOString().slice(0, 16),
    completeTime: new Date().toISOString().slice(0, 16),
  });
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [extracting, setExtracting] = useState(false);

  useEffect(() => {
    fetch(`${API}/users/select`, { credentials: 'include' })
      .then(r => r.json()).then(setUsers).catch(() => {});
  }, []);

  const selectedUser = useMemo(() => users.find(u => u.user_id === form.subId1), [users, form.subId1]);
  const referrerId = selectedUser?.referrer_id || '';
  const referrerName = selectedUser?.referrer_name || '';

  // Extract product info from Shopee link via backend
  const extractFromLink = async (url) => {
    setForm(f => ({ ...f, shopeeLink: url }));
    // Quick regex parse for IDs
    const m1 = url.match(/shopee\.vn\/product\/(\d+)\/(\d+)/);
    const m2 = url.match(/shopee\.vn\/.*-i\.(\d+)\.(\d+)/);
    const m3 = url.match(/universal-link\/product\/(\d+)\/(\d+)/);
    const match = m1 || m2 || m3;
    if (match) setForm(f => ({ ...f, shopId: match[1], itemId: match[2] }));

    // Call backend to extract full product info
    if (!url.includes('shopee')) return;
    setExtracting(true);
    try {
      const res = await fetch(`${API}/shopee/extract`, {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });
      const data = await res.json();
      if (data.success) {
        setForm(f => ({
          ...f,
          itemName: data.productName || f.itemName,
          price: data.price || f.price,
          commissionRate: data.commissionRate || f.commissionRate,
          itemId: data.itemId || f.itemId,
          shopId: data.shopId || f.shopId,
        }));
      }
    } catch { /* ignore */ }
    setExtracting(false);
  };

  // Calculations
  const orderValue = (parseFloat(form.price) || 0) * (parseInt(form.quantity) || 1);
  const netCommission = Math.round(orderValue * (parseFloat(form.commissionRate) || 0) / 100);
  const buyerRate = selectedUser?.cashback_buyer_rate || 60;
  const refRate = selectedUser?.cashback_referrer_rate || 20;
  const hasRef = !!referrerId;
  const buyerCashback = Math.round(netCommission * buyerRate / 100);
  const refCashback = hasRef ? Math.round(netCommission * refRate / 100) : 0;
  const adminProfit = netCommission - buyerCashback - refCashback;

  const handleSubmit = async () => {
    setError(''); setResult(null); setLoading(true);
    const finalItemName = form.itemName || '';
    const finalPrice = parseFloat(form.price) || 0;
    const finalRate = parseFloat(form.commissionRate) || 0;
    if (!finalItemName) { setError('Tên sản phẩm trống — dán link Shopee để tự lấy hoặc nhập tay'); setLoading(false); return; }
    try {
      const res = await fetch(`${API}/orders/simulate`, {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          itemId: form.itemId, itemName: finalItemName, shopId: form.shopId,
          shopName: form.shopName, price: finalPrice, quantity: parseInt(form.quantity) || 1,
          commissionRate: finalRate, status: form.status,
          subId1: form.subId1, subId2: referrerId,
          orderTime: new Date(form.orderTime).toISOString(),
          completeTime: form.status === 'Hoàn thành' ? new Date(form.completeTime).toISOString() : '',
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Failed');
      setResult(data);
    } catch (e) { setError(e.message); }
    setLoading(false);
  };

  const canSubmit = !!form.subId1;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <ShoppingCart className="h-7 w-7 text-accent" /> Mô phỏng Đơn hàng
        </h1>
        <p className="text-slate-500 dark:text-slate-400 mt-1">Tạo đơn test để kiểm tra luồng cashback mà không cần mua hàng thật</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Form */}
        <div className="lg:col-span-2 space-y-6">
          {/* Step 1: Link */}
          <Card>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
              <span className="flex items-center justify-center w-7 h-7 rounded-full bg-accent text-white text-sm font-bold">1</span>
              Thông tin sản phẩm
            </h2>
            <div className="space-y-4">
              <Field label="Link Shopee" icon={Link2} hint={extracting ? '⏳ Đang lấy thông tin sản phẩm...' : 'Dán link để tự extract tên SP, giá, % hoa hồng'}>
                <input className={inputCls} placeholder="https://shopee.vn/product/..." value={form.shopeeLink}
                  onChange={e => extractFromLink(e.target.value)} />
              </Field>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Item ID" icon={Hash}>
                  <input className={inputCls} value={form.itemId} onChange={e => setForm(f => ({ ...f, itemId: e.target.value }))} placeholder="VD: 26326757902" />
                </Field>
                <Field label="Shop ID" icon={Hash}>
                  <input className={inputCls} value={form.shopId} onChange={e => setForm(f => ({ ...f, shopId: e.target.value }))} placeholder="VD: 1391725226" />
                </Field>
              </div>
              <Field label="Tên sản phẩm *" icon={Package}>
                <input className={inputCls} value={form.itemName} onChange={e => setForm(f => ({ ...f, itemName: e.target.value }))} placeholder="Nhập tên sản phẩm (phải khớp convert_log)" />
              </Field>
              <Field label="Tên Shop">
                <input className={inputCls} value={form.shopName} onChange={e => setForm(f => ({ ...f, shopName: e.target.value }))} placeholder="Tên shop (tùy chọn)" />
              </Field>
            </div>
          </Card>

          {/* Step 2: User */}
          <Card>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
              <span className="flex items-center justify-center w-7 h-7 rounded-full bg-accent text-white text-sm font-bold">2</span>
              Chọn Buyer
            </h2>
            <div className="space-y-4">
              <Field label="User mua hàng *" icon={User}>
                <select className={selectCls} value={form.subId1} onChange={e => setForm(f => ({ ...f, subId1: e.target.value }))}>
                  <option value="">-- Chọn user --</option>
                  {users.map(u => (
                    <option key={u.user_id} value={u.user_id}>
                      {u.display_name || u.zalo_name || u.user_id}
                    </option>
                  ))}
                </select>
              </Field>
              {form.subId1 && (
                <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-700/30 text-sm space-y-1">
                  <p><span className="text-slate-500">Sub ID1 (Buyer):</span> <code className="text-xs bg-slate-200 dark:bg-slate-600 px-1.5 py-0.5 rounded">{form.subId1}</code></p>
                  <p><span className="text-slate-500">Sub ID2 (Referrer):</span> {referrerId
                    ? <><code className="text-xs bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 px-1.5 py-0.5 rounded">{referrerId}</code> <span className="text-slate-400">({referrerName})</span></>
                    : <span className="text-amber-500">Không có</span>}
                  </p>
                  <p><span className="text-slate-500">Buyer Rate:</span> {buyerRate}% &nbsp;|&nbsp; <span className="text-slate-500">Referrer Rate:</span> {refRate}%</p>
                </div>
              )}
            </div>
          </Card>

          {/* Step 3: Order details */}
          <Card>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
              <span className="flex items-center justify-center w-7 h-7 rounded-full bg-accent text-white text-sm font-bold">3</span>
              Chi tiết đơn hàng
            </h2>
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <Field label="Giá *" icon={DollarSign}>
                  <input className={inputCls} type="number" min="0" value={form.price} onChange={e => setForm(f => ({ ...f, price: e.target.value }))} placeholder="100000" />
                </Field>
                <Field label="Số lượng">
                  <input className={inputCls} type="number" min="1" value={form.quantity} onChange={e => setForm(f => ({ ...f, quantity: e.target.value }))} />
                </Field>
                <Field label="% Hoa hồng Shopee *" icon={Percent}>
                  <input className={inputCls} type="number" min="0" max="50" step="0.1" value={form.commissionRate} onChange={e => setForm(f => ({ ...f, commissionRate: e.target.value }))} placeholder="5.5" />
                </Field>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <Field label="Trạng thái">
                  <select className={selectCls} value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
                    {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </Field>
                <Field label="Ngày đặt" icon={Calendar}>
                  <input className={inputCls} type="datetime-local" value={form.orderTime} onChange={e => setForm(f => ({ ...f, orderTime: e.target.value }))} />
                </Field>
                {form.status === 'Hoàn thành' && (
                  <Field label="Ngày hoàn thành" icon={Calendar}>
                    <input className={inputCls} type="datetime-local" value={form.completeTime} onChange={e => setForm(f => ({ ...f, completeTime: e.target.value }))} />
                  </Field>
                )}
              </div>
            </div>
          </Card>
        </div>

        {/* Preview Panel */}
        <div className="space-y-6">
          <Card className="sticky top-6">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">📋 Preview</h2>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between"><span className="text-slate-500">Giá trị đơn</span><span className="font-semibold">{fmtVND(orderValue)}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Hoa hồng Shopee ({form.commissionRate || 0}%)</span><span className="font-semibold text-blue-500">{fmtVND(netCommission)}</span></div>
              <hr className="border-slate-200 dark:border-slate-700" />
              <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Phân chia Cashback</p>
              <div className="flex justify-between"><span className="text-slate-500">👤 Buyer ({buyerRate}%)</span><span className="font-semibold text-emerald-500">{fmtVND(buyerCashback)}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">🤝 Referrer ({hasRef ? refRate + '%' : '0%'})</span><span className={hasRef ? 'font-semibold text-amber-500' : 'text-slate-400'}>{fmtVND(refCashback)}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">🏢 Admin ({hasRef ? (100 - buyerRate - refRate) : 40}%)</span><span className="font-semibold text-purple-500">{fmtVND(adminProfit)}</span></div>
              <hr className="border-slate-200 dark:border-slate-700" />
              <div className="flex justify-between font-semibold"><span>Tổng</span><span>{fmtVND(netCommission)}</span></div>
            </div>

            <Button className="w-full mt-6" onClick={handleSubmit} disabled={!canSubmit || loading}>
              {loading ? '⏳ Đang tạo...' : '🛒 Tạo đơn mô phỏng'}
            </Button>

            {error && (
              <div className="mt-4 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 text-sm flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0" /> {error}
              </div>
            )}
            {result && (
              <div className="mt-4 p-3 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400 text-sm">
                <div className="flex items-center gap-2 font-semibold"><CheckCircle className="h-4 w-4" /> Tạo thành công!</div>
                <p className="mt-1">Order ID: <code className="text-xs bg-emerald-100 dark:bg-emerald-900/40 px-1.5 py-0.5 rounded">{result.orderId}</code></p>
                <p>Net Commission: <strong>{fmtVND(result.netCommission)}</strong></p>
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
