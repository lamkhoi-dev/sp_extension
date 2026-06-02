import { useState, useEffect, useMemo } from 'react';
import { ShoppingCart, Link2, User, DollarSign, CheckCircle, AlertCircle, Package, Hash, Percent, Calendar, Building2, Zap, Gift, Phone, ToggleLeft, ToggleRight } from 'lucide-react';
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
  const [isCustomMode, setIsCustomMode] = useState(false);
  const [customPhone, setCustomPhone] = useState('');
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

  // Filter users by commission_mode
  const filteredUsers = useMemo(() => users.filter(u =>
    isCustomMode ? u.commission_mode === 'custom' : u.commission_mode !== 'custom'
  ), [users, isCustomMode]);

  const selectedUser = useMemo(() => users.find(u => u.user_id === form.subId1), [users, form.subId1]);

  // F0-F3 chain tracing (frontend-side, matches backend resolveCommissionChain)
  const chain = useMemo(() => {
    if (!selectedUser || isCustomMode) return { f1: null, f2: null, f3: null };
    const f1User = users.find(u => u.user_id === selectedUser.referrer_id);
    if (!f1User || f1User.commission_mode === 'custom') return { f1: null, f2: null, f3: null };
    const f2User = users.find(u => u.user_id === f1User.referrer_id);
    if (!f2User || f2User.commission_mode === 'custom') return { f1: f1User, f2: null, f3: null };
    const f3User = users.find(u => u.user_id === f2User.referrer_id);
    if (!f3User || f3User.commission_mode === 'custom') return { f1: f1User, f2: f2User, f3: null };
    return { f1: f1User, f2: f2User, f3: f3User };
  }, [selectedUser, users, isCustomMode]);

  // Fixed commission rates (match backend COMMISSION_RATES)
  const RATES = { f0: 40, f1: 20, f2: 7, f3: 3 };
  const customRate = isCustomMode ? (selectedUser?.custom_rate ?? 0) : 0;

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

  // F0-F3 cashback split (fixed rates)
  const f0Amount = isCustomMode ? 0 : Math.round(netCommission * RATES.f0 / 100);
  const f1Amount = !isCustomMode && chain.f1 ? Math.round(netCommission * RATES.f1 / 100) : 0;
  const f2Amount = !isCustomMode && chain.f2 ? Math.round(netCommission * RATES.f2 / 100) : 0;
  const f3Amount = !isCustomMode && chain.f3 ? Math.round(netCommission * RATES.f3 / 100) : 0;
  const customCashback = isCustomMode ? Math.round(netCommission * customRate / 100) : 0;
  const adminProfit = netCommission - f0Amount - f1Amount - f2Amount - f3Amount - customCashback;

  const handleSubmit = async () => {
    setError(''); setResult(null); setLoading(true);
    if (!form.itemName) { setError('Tên sản phẩm trống'); setLoading(false); return; }
    if (isCustomMode && !customPhone) { setError('Nhập số điện thoại khách hàng'); setLoading(false); return; }
    try {
      const res = await fetch(`${API}/orders/simulate`, {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          itemId: form.itemId, itemName: form.itemName, shopId: form.shopId, shopName: form.shopName,
          price, quantity: qty, status: form.status,
          subId1: form.subId1,
          subId2: isCustomMode ? customPhone : (selectedUser?.referrer_id || ''),
          subId4: isCustomMode ? 'from_custom' : 'from_direct',
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

        {/* Mode Toggle */}
        <button
          onClick={() => { setIsCustomMode(m => !m); setCustomPhone(''); }}
          className={`mt-3 inline-flex items-center gap-2 px-4 py-2 rounded-xl border-2 font-semibold text-sm transition-all ${
            isCustomMode
              ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400'
              : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300'
          }`}
        >
          {isCustomMode
            ? <ToggleRight className="w-5 h-5 text-purple-500" />
            : <ToggleLeft className="w-5 h-5 text-slate-400" />}
          {isCustomMode ? '✨ Chế độ: Custom (/custom)' : '🛒 Chế độ: Standard'}
        </button>
        {isCustomMode && (
          <p className="text-xs text-purple-500 mt-1">Sub1=Người mua, Sub2=SĐT khách hàng, Sub4=from_custom</p>
        )}
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
            <Field label={isCustomMode ? 'Người mua Custom *' : 'User mua hàng (F0) *'} icon={User}>
              <select className={selectCls} value={form.subId1} onChange={e => set('subId1', e.target.value)}>
                <option value="">-- Chọn user --</option>
                {filteredUsers.map(u => <option key={u.user_id} value={u.user_id}>{u.display_name || u.zalo_name || u.user_id}{u.commission_mode === 'custom' ? ` (${u.custom_rate}%)` : ''}</option>)}
              </select>
            </Field>

            {/* Custom mode: phone of F2 customer */}
            {isCustomMode && (
              <Field label="SĐT Khách hàng *" icon={Phone} hint="Sub ID2 — số điện thoại khách hàng">
                <input
                  className={inputCls}
                  type="tel"
                  placeholder="0912345678"
                  value={customPhone}
                  onChange={e => setCustomPhone(e.target.value)}
                />
              </Field>
            )}

            {form.subId1 && (
              <div className={`mt-3 p-3 rounded-lg text-xs space-y-1 ${
                isCustomMode ? 'bg-purple-50 dark:bg-purple-900/20' : 'bg-slate-50 dark:bg-slate-700/30'
              }`}>
                <p><span className="text-slate-500">Sub ID1 (Buyer):</span> <code className="bg-slate-200 dark:bg-slate-600 px-1 rounded">{form.subId1}</code></p>
                {isCustomMode ? (
                  <>
                    <p><span className="text-slate-500">Sub ID2 (SĐT KH):</span> {customPhone ? <code className="bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 px-1 rounded">{customPhone}</code> : <span className="text-red-400">Chưa nhập</span>}</p>
                    <p><span className="text-slate-500">Sub ID4:</span> <code className="bg-purple-100 dark:bg-purple-900/30 text-purple-700 px-1 rounded">from_custom</code></p>
                    <p><span className="text-slate-500">Custom rate:</span> <span className="text-purple-600 font-semibold">{selectedUser?.custom_rate ?? 0}%</span></p>
                  </>
                ) : (
                  <>
                    <p><span className="text-slate-500">🛒 F0:</span> <span className="text-emerald-500 font-semibold">{RATES.f0}%</span></p>
                    {chain.f1 && <p><span className="text-slate-500">🤝 F1:</span> <code className="bg-cyan-100 dark:bg-cyan-900/30 text-cyan-700 dark:text-cyan-400 px-1 rounded">{chain.f1.display_name || chain.f1.user_id}</code> <span className="text-cyan-500 font-semibold">{RATES.f1}%</span></p>}
                    {chain.f2 && <p><span className="text-slate-500">🔗 F2:</span> <code className="bg-sky-100 dark:bg-sky-900/30 text-sky-700 dark:text-sky-400 px-1 rounded">{chain.f2.display_name || chain.f2.user_id}</code> <span className="text-sky-500 font-semibold">{RATES.f2}%</span></p>}
                    {chain.f3 && <p><span className="text-slate-500">🌐 F3:</span> <code className="bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 px-1 rounded">{chain.f3.display_name || chain.f3.user_id}</code> <span className="text-indigo-500 font-semibold">{RATES.f3}%</span></p>}
                    {!chain.f1 && <p className="text-amber-500 text-[10px]">Không có referrer → Admin nhận phần dư</p>}
                  </>
                )}
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
              {isCustomMode ? (
                <>
                  <PreviewRow label={`✨ Custom (${customRate}%)`} value={fmtVND(customCashback)} color="text-purple-500" />
                  <PreviewRow label="🏢 Admin" value={fmtVND(adminProfit)} color="text-indigo-500" />
                </>
              ) : (
                <>
                  <PreviewRow label={`🛒 F0 (${RATES.f0}%)`} value={fmtVND(f0Amount)} color="text-emerald-500" />
                  {chain.f1 && <PreviewRow label={`🤝 F1 (${RATES.f1}%)`} value={fmtVND(f1Amount)} color="text-cyan-500" />}
                  {chain.f2 && <PreviewRow label={`🔗 F2 (${RATES.f2}%)`} value={fmtVND(f2Amount)} color="text-sky-500" />}
                  {chain.f3 && <PreviewRow label={`🌐 F3 (${RATES.f3}%)`} value={fmtVND(f3Amount)} color="text-indigo-500" />}
                  <PreviewRow label={`🏢 Admin (${100 - RATES.f0 - (chain.f1 ? RATES.f1 : 0) - (chain.f2 ? RATES.f2 : 0) - (chain.f3 ? RATES.f3 : 0)}%)`} value={fmtVND(adminProfit)} color="text-slate-500" />
                </>
              )}
            </div>

            <Button
              className={`w-full mt-5 ${isCustomMode ? '!bg-purple-600 hover:!bg-purple-700' : ''}`}
              onClick={handleSubmit}
              disabled={!form.subId1 || loading || (isCustomMode && !customPhone)}
            >
              {loading ? '⏳ Đang tạo...' : isCustomMode ? '✨ Tạo đơn Custom' : '🛒 Tạo đơn mô phỏng'}
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
