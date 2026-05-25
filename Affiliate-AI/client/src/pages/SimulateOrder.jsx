import { useState, useEffect, useMemo } from 'react';
import { ShoppingCart, Link2, User, DollarSign, CheckCircle, AlertCircle, Package, Hash, Percent, Calendar, Building2, Zap, Gift } from 'lucide-react';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';

const API = '/api';
const STATUS_OPTIONS = ['Đang chờ xử lý', 'Hoàn thành', 'Đã huỷ', 'Chờ đối soát'];
const COMMISSION_TYPES = ['CPS', 'CPC'];
const fmtVND = v => new Intl.NumberFormat('vi-VN').format(Math.round(v || 0)) + 'đ';

function PercentInput({ value, onChange, placeholder = '0', max = 50 }) {
  return (
    <div className="relative">
      <input
        className={inputCls + ' pr-8'}
        type="number" min="0" max={max} step="0.1"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
      />
      <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-medium pointer-events-none">%</span>
    </div>
  );
}

function Field({ label, icon: Icon, children, hint }) {
  return (
    <div>
      <label className="flex items-center gap-1.5 text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
        {Icon && <Icon className="h-3.5 w-3.5 text-slate-400" />} {label}
      </label>
      {children}
      {hint && <p className="mt-1 text-xs text-slate-400">{hint}</p>}
    </div>
  );
}

const inputCls = 'w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all text-sm';
const selectCls = inputCls + ' appearance-none';

function PreviewRow({ label, value, color = '', bold = false, indent = false }) {
  return (
    <div className={`flex justify-between ${indent ? 'pl-4' : ''}`}>
      <span className="text-slate-500 text-xs">{label}</span>
      <span className={`text-sm ${bold ? 'font-bold' : 'font-medium'} ${color}`}>{value}</span>
    </div>
  );
}

export default function SimulateOrderPage() {
  const [users, setUsers] = useState([]);
  const [form, setForm] = useState({
    shopeeLink: '', itemId: '', itemName: '', shopId: '', shopName: '',
    price: '', quantity: 1,
    shopeeRate: '', sellerRate: '', xtraCommission: '',
    orderCommission: '', orderBonus: '',
    commissionType: 'CPS',
    status: 'Hoàn thành', subId1: '',
    orderTime: new Date().toISOString().slice(0, 16),
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

  const set = (key, val) => setForm(f => ({ ...f, [key]: val }));
  const selectedUser = useMemo(() => users.find(u => u.user_id === form.subId1), [users, form.subId1]);
  const referrerId = selectedUser?.referrer_id || '';
  const referrerName = selectedUser?.referrer_name || '';

  const extractFromLink = async (url) => {
    set('shopeeLink', url);
    const m = url.match(/shopee\.vn\/product\/(\d+)\/(\d+)/) || url.match(/shopee\.vn\/.*-i\.(\d+)\.(\d+)/) || url.match(/universal-link\/product\/(\d+)\/(\d+)/);
    if (m) { set('shopId', m[1]); set('itemId', m[2]); }
    if (!url.includes('shopee')) return;
    setExtracting(true);
    try {
      const res = await fetch(`${API}/shopee/extract`, { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url }) });
      const data = await res.json();
      if (data.success) {
        setForm(f => ({ ...f, itemName: data.productName || f.itemName, price: data.price || f.price, shopeeRate: data.commissionRate || f.shopeeRate, itemId: data.itemId || f.itemId, shopId: data.shopId || f.shopId }));
      }
    } catch {}
    setExtracting(false);
  };

  // ── Calculations ──
  const price = parseFloat(form.price) || 0;
  const qty = parseInt(form.quantity) || 1;
  const orderValue = price * qty;
  const shopeeRate = parseFloat(form.shopeeRate) || 0;
  const sellerRate = parseFloat(form.sellerRate) || 0;
  const shopeeComm = Math.round(orderValue * shopeeRate / 100);
  const sellerComm = Math.round(orderValue * sellerRate / 100);
  const xtraComm = parseFloat(form.xtraCommission) || 0;
  const totalProductComm = shopeeComm + sellerComm + xtraComm;
  const orderComm = parseFloat(form.orderCommission) || 0;
  const orderBonus = parseFloat(form.orderBonus) || 0;
  const totalOrderComm = totalProductComm + orderComm + orderBonus;
  const netCommission = totalOrderComm;

  // Cashback split
  const buyerRate = selectedUser?.cashback_buyer_rate || 60;
  const refRate = selectedUser?.cashback_referrer_rate || 20;
  const hasRef = !!referrerId;
  const buyerCashback = Math.round(netCommission * buyerRate / 100);
  const refCashback = hasRef ? Math.round(netCommission * refRate / 100) : 0;
  const adminProfit = netCommission - buyerCashback - refCashback;

  const handleSubmit = async () => {
    setError(''); setResult(null); setLoading(true);
    if (!form.itemName) { setError('Tên sản phẩm trống'); setLoading(false); return; }
    try {
      const res = await fetch(`${API}/orders/simulate`, {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          itemId: form.itemId, itemName: form.itemName, shopId: form.shopId, shopName: form.shopName,
          price, quantity: qty, status: form.status, subId1: form.subId1, subId2: referrerId,
          orderTime: new Date(form.orderTime).toISOString(),
          completeTime: form.status === 'Hoàn thành' ? new Date(form.completeTime).toISOString() : '',
          shopeeRate, sellerRate,
          xtraCommission: xtraComm, orderCommission: orderComm, orderBonus,
          commissionType: form.commissionType,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Failed');
      setResult(data);
    } catch (e) { setError(e.message); }
    setLoading(false);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <ShoppingCart className="h-7 w-7 text-accent" /> Mô phỏng Đơn hàng
        </h1>
        <p className="text-slate-500 dark:text-slate-400 mt-1">Tạo đơn test với đầy đủ các loại hoa hồng Shopee</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-5">
          {/* Step 1: Product */}
          <Card>
            <h2 className="text-base font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
              <span className="flex items-center justify-center w-6 h-6 rounded-full bg-accent text-white text-xs font-bold">1</span>
              Thông tin sản phẩm
            </h2>
            <div className="space-y-3">
              <Field label="Link Shopee" icon={Link2} hint={extracting ? '⏳ Đang lấy thông tin...' : 'Dán link để tự lấy tên, giá, % HH'}>
                <input className={inputCls} placeholder="https://shopee.vn/product/..." value={form.shopeeLink} onChange={e => extractFromLink(e.target.value)} />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Item ID" icon={Hash}><input className={inputCls} value={form.itemId} onChange={e => set('itemId', e.target.value)} /></Field>
                <Field label="Shop ID" icon={Hash}><input className={inputCls} value={form.shopId} onChange={e => set('shopId', e.target.value)} /></Field>
              </div>
              <Field label="Tên sản phẩm *" icon={Package}><input className={inputCls} value={form.itemName} onChange={e => set('itemName', e.target.value)} /></Field>
              <Field label="Tên Shop"><input className={inputCls} value={form.shopName} onChange={e => set('shopName', e.target.value)} /></Field>
            </div>
          </Card>

          {/* Step 2: User */}
          <Card>
            <h2 className="text-base font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
              <span className="flex items-center justify-center w-6 h-6 rounded-full bg-accent text-white text-xs font-bold">2</span>
              Chọn Buyer
            </h2>
            <Field label="User mua hàng *" icon={User}>
              <select className={selectCls} value={form.subId1} onChange={e => set('subId1', e.target.value)}>
                <option value="">-- Chọn user --</option>
                {users.map(u => <option key={u.user_id} value={u.user_id}>{u.display_name || u.zalo_name || u.user_id}</option>)}
              </select>
            </Field>
            {form.subId1 && (
              <div className="mt-3 p-3 rounded-lg bg-slate-50 dark:bg-slate-700/30 text-xs space-y-1">
                <p><span className="text-slate-500">Sub ID1:</span> <code className="bg-slate-200 dark:bg-slate-600 px-1 rounded">{form.subId1}</code></p>
                <p><span className="text-slate-500">Sub ID2 (Ref):</span> {referrerId ? <><code className="bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 px-1 rounded">{referrerId}</code> <span className="text-slate-400">({referrerName})</span></> : <span className="text-amber-500">Không có</span>}</p>
                <p><span className="text-slate-500">Buyer:</span> {buyerRate}% | <span className="text-slate-500">Referrer:</span> {refRate}%</p>
              </div>
            )}
          </Card>

          {/* Step 3: Order + Commission */}
          <Card>
            <h2 className="text-base font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
              <span className="flex items-center justify-center w-6 h-6 rounded-full bg-accent text-white text-xs font-bold">3</span>
              Giá trị & Hoa hồng
            </h2>
            <div className="space-y-4">
              {/* Price row */}
              <div className="grid grid-cols-2 gap-3">
                <Field label="Giá *" icon={DollarSign}><input className={inputCls} type="number" min="0" value={form.price} onChange={e => set('price', e.target.value)} placeholder="56000" /></Field>
                <Field label="Số lượng"><input className={inputCls} type="number" min="1" value={form.quantity} onChange={e => set('quantity', e.target.value)} /></Field>
              </div>

              {/* Commission rates */}
              <div className="p-4 rounded-xl bg-blue-50/50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-900/30 space-y-3">
                <p className="text-xs font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wider flex items-center gap-1"><Percent className="w-3 h-3" /> Hoa hồng sản phẩm (% × giá trị)</p>
                <div className="grid grid-cols-3 gap-3">
                  <Field label="% Shopee" icon={Percent} hint="Shopee trả theo ngành hàng">
                    <PercentInput value={form.shopeeRate} onChange={v => set('shopeeRate', v)} placeholder="7" />
                  </Field>
                  <Field label="% Seller" icon={Building2} hint="Shop tự cài thêm">
                    <PercentInput value={form.sellerRate} onChange={v => set('sellerRate', v)} placeholder="0" />
                  </Field>
                  <Field label="Xtra bonus (đ)" icon={Zap} hint="Bonus campaign Xtra">
                    <input className={inputCls} type="number" min="0" value={form.xtraCommission} onChange={e => set('xtraCommission', e.target.value)} placeholder="0" />
                  </Field>
                </div>
              </div>

              {/* Order-level commission */}
              <div className="p-4 rounded-xl bg-amber-50/50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-900/30 space-y-3">
                <p className="text-xs font-semibold text-amber-600 dark:text-amber-400 uppercase tracking-wider flex items-center gap-1"><Gift className="w-3 h-3" /> Hoa hồng cấp đơn hàng (số tiền cố định)</p>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Order Commission (đ)" hint="HH cấp đơn">
                    <input className={inputCls} type="number" min="0" value={form.orderCommission} onChange={e => set('orderCommission', e.target.value)} placeholder="0" />
                  </Field>
                  <Field label="Order Bonus (đ)" hint="Bonus đơn">
                    <input className={inputCls} type="number" min="0" value={form.orderBonus} onChange={e => set('orderBonus', e.target.value)} placeholder="0" />
                  </Field>
                </div>
              </div>

              {/* Status & time */}
              <div className="grid grid-cols-2 gap-3">
                <Field label="Trạng thái"><select className={selectCls} value={form.status} onChange={e => set('status', e.target.value)}>{STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}</select></Field>
                <Field label="Ngày đặt" icon={Calendar}><input className={inputCls} type="datetime-local" value={form.orderTime} onChange={e => set('orderTime', e.target.value)} /></Field>
              </div>
              {form.status === 'Hoàn thành' && (
                <Field label="Ngày hoàn thành" icon={Calendar}><input className={inputCls} type="datetime-local" value={form.completeTime} onChange={e => set('completeTime', e.target.value)} /></Field>
              )}
            </div>
          </Card>
        </div>

        {/* ── Preview Panel ── */}
        <div className="space-y-5">
          <Card className="sticky top-6">
            <h2 className="text-base font-semibold text-slate-900 dark:text-white mb-3">📋 Tổng hợp</h2>
            <div className="space-y-2">
              <PreviewRow label="Giá trị đơn" value={fmtVND(orderValue)} />

              <hr className="border-slate-200 dark:border-slate-700" />
              <p className="text-[10px] font-semibold text-blue-500 uppercase tracking-wider">HH Sản phẩm</p>
              <PreviewRow label={`Shopee (${shopeeRate}%)`} value={fmtVND(shopeeComm)} color="text-blue-500" indent />
              {sellerRate > 0 && <PreviewRow label={`Seller (${sellerRate}%)`} value={fmtVND(sellerComm)} color="text-teal-500" indent />}
              {xtraComm > 0 && <PreviewRow label="Xtra bonus" value={fmtVND(xtraComm)} color="text-cyan-500" indent />}
              <PreviewRow label="Tổng HH sản phẩm" value={fmtVND(totalProductComm)} bold />

              {(orderComm > 0 || orderBonus > 0) && (
                <>
                  <hr className="border-slate-200 dark:border-slate-700" />
                  <p className="text-[10px] font-semibold text-amber-500 uppercase tracking-wider">HH Đơn hàng</p>
                  {orderComm > 0 && <PreviewRow label="Order Commission" value={fmtVND(orderComm)} color="text-amber-500" indent />}
                  {orderBonus > 0 && <PreviewRow label="Order Bonus" value={fmtVND(orderBonus)} color="text-orange-500" indent />}
                </>
              )}

              <hr className="border-slate-200 dark:border-slate-700" />
              <div className="p-2 rounded-lg bg-emerald-50 dark:bg-emerald-900/20">
                <PreviewRow label="💰 NET Commission" value={fmtVND(netCommission)} color="text-emerald-600 dark:text-emerald-400" bold />
              </div>

              <hr className="border-slate-200 dark:border-slate-700" />
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Phân chia Cashback</p>
              <PreviewRow label={`👤 Buyer (${buyerRate}%)`} value={fmtVND(buyerCashback)} color="text-emerald-500" />
              <PreviewRow label={`🤝 Referrer (${hasRef ? refRate + '%' : '0%'})`} value={fmtVND(refCashback)} color={hasRef ? 'text-amber-500' : 'text-slate-400'} />
              <PreviewRow label={`🏢 Admin (${hasRef ? 100 - buyerRate - refRate : 40}%)`} value={fmtVND(adminProfit)} color="text-indigo-500" />
            </div>

            <Button className="w-full mt-5" onClick={handleSubmit} disabled={!form.subId1 || loading}>
              {loading ? '⏳ Đang tạo...' : '🛒 Tạo đơn mô phỏng'}
            </Button>

            {error && (
              <div className="mt-3 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 text-sm flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0" /> {error}
              </div>
            )}
            {result && (
              <div className="mt-3 p-3 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400 text-sm space-y-1">
                <div className="flex items-center gap-2 font-semibold"><CheckCircle className="h-4 w-4" /> Tạo thành công!</div>
                <p>Order: <code className="text-xs bg-emerald-100 dark:bg-emerald-900/40 px-1 rounded">{result.orderId}</code></p>
                <p>Shopee: {fmtVND(result.shopeeCommission)} | Seller: {fmtVND(result.sellerCommission)} | Xtra: {fmtVND(result.xtraCommission)}</p>
                <p>Order Comm: {fmtVND(result.orderCommission)} | Bonus: {fmtVND(result.orderBonus)}</p>
                <p className="font-bold">NET: {fmtVND(result.netCommission)}</p>
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
