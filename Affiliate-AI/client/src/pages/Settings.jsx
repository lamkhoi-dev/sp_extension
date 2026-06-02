import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { Sun, Moon, Palette, Bell, Shield, User, Check, Key, Eye, EyeOff, X, Lock, Upload, Loader2, Camera, Server, Clock, Save, AlertTriangle, Percent, RotateCcw } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { useCommissionRates } from '../hooks/useApi';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';

const inputCls = 'w-full px-3 py-2.5 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 transition-colors pr-10';

// ⚠️ Must be defined OUTSIDE ChangePasswordModal to prevent re-mount on every keystroke
function PwField({ label, field, showKey, form, setForm, show, setShow }) {
  return (
    <div>
      <label className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5 block">{label}</label>
      <div className="relative">
        <input
          type={show[showKey] ? 'text' : 'password'}
          value={form[field]}
          onChange={e => setForm(prev => ({ ...prev, [field]: e.target.value }))}
          className={inputCls}
          placeholder="••••••••"
          autoComplete="new-password"
        />
        <button
          type="button"
          onClick={() => setShow(prev => ({ ...prev, [showKey]: !prev[showKey] }))}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
        >
          {show[showKey] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
        </button>
      </div>
    </div>
  );
}

function ChangePasswordModal({ onClose }) {
  const { changePassword } = useAuth();
  const [form, setForm] = useState({ oldPw: '', newPw: '', confirmPw: '' });
  const [show, setShow] = useState({ old: false, new: false, confirm: false });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!form.oldPw || !form.newPw || !form.confirmPw) {
      setError('Vui lòng điền đầy đủ thông tin');
      return;
    }
    if (form.newPw.length < 6) {
      setError('Mật khẩu mới phải ít nhất 6 ký tự');
      return;
    }
    if (form.newPw !== form.confirmPw) {
      setError('Mật khẩu xác nhận không khớp');
      return;
    }
    setLoading(true);
    try {
      await changePassword(form.oldPw, form.newPw);
      setSuccess(true);
      setTimeout(onClose, 1500);
    } catch (err) {
      setError(err.message || 'Đổi mật khẩu thất bại');
    } finally {
      setLoading(false);
    }
  };


  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
              <Lock className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            </div>
            <h3 className="text-base font-semibold text-slate-900 dark:text-white">Đổi mật khẩu</h3>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {success ? (
          <div className="px-6 py-10 text-center">
            <div className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center mx-auto mb-4">
              <Check className="w-8 h-8 text-emerald-500" />
            </div>
            <p className="font-semibold text-slate-900 dark:text-white">Đổi mật khẩu thành công!</p>
            <p className="text-sm text-slate-500 mt-1">Đang đóng...</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
            <PwField label="Mật khẩu hiện tại" field="oldPw" showKey="old" form={form} setForm={setForm} show={show} setShow={setShow} />
            <PwField label="Mật khẩu mới" field="newPw" showKey="new" form={form} setForm={setForm} show={show} setShow={setShow} />
            <PwField label="Xác nhận mật khẩu mới" field="confirmPw" showKey="confirm" form={form} setForm={setForm} show={show} setShow={setShow} />

            {error && (
              <div className="px-3 py-2.5 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl">
                <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-4 py-2.5 text-sm font-medium text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
              >
                Huỷ
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 px-4 py-2.5 text-sm font-semibold text-white bg-blue-500 hover:bg-blue-600 rounded-xl transition-colors disabled:opacity-60"
              >
                {loading ? 'Đang xử lý...' : 'Xác nhận'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

const RATE_FIELDS = [
  { key: 'f0', label: '🛒 F0 — Người mua', accent: 'emerald' },
  { key: 'f1', label: '🤝 F1 — Giới thiệu cấp 1', accent: 'cyan' },
  { key: 'f2', label: '🔗 F2 — Giới thiệu cấp 2', accent: 'sky' },
  { key: 'f3', label: '🌐 F3 — Giới thiệu cấp 3', accent: 'indigo' },
  { key: 'admin', label: '🏢 Admin', accent: 'slate' },
];

function CommissionRatesCard() {
  const { rates, defaults, loading, save } = useCommissionRates();
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  // Sync form only when initial fetch completes (loading: true → false)
  // Avoids setting form from DEFAULTS before real DB values arrive
  const wasLoading = useRef(true);
  useEffect(() => {
    if (wasLoading.current && !loading && rates) {
      setForm({ ...rates });
    }
    wasLoading.current = loading;
  }, [loading, rates]);

  const sum = useMemo(() => {
    if (!form) return 0;
    return RATE_FIELDS.reduce((s, f) => s + (Number(form[f.key]) || 0), 0);
  }, [form]);

  const isValid = Math.abs(sum - 100) < 0.01;
  const dirty = form && rates && RATE_FIELDS.some(f => Number(form[f.key]) !== Number(rates[f.key]));

  const handleSave = async () => {
    if (!isValid) { setError('Tổng phải bằng 100%'); return; }
    setSaving(true); setError(''); setSuccess(false);
    try {
      await save({
        admin: Number(form.admin),
        f0: Number(form.f0),
        f1: Number(form.f1),
        f2: Number(form.f2),
        f3: Number(form.f3),
      });
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setError(err.message || 'Lưu thất bại');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    if (defaults) setForm({ ...defaults });
    setError('');
  };

  if (loading || !form) {
    return (
      <Card className="p-6">
        <div className="flex items-center gap-2 text-sm text-slate-400">
          <Loader2 className="w-4 h-4 animate-spin" /> Đang tải tỷ lệ hoa hồng...
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 rounded-lg bg-violet-100 dark:bg-violet-900/30">
          <Percent className="w-5 h-5 text-violet-600 dark:text-violet-400" />
        </div>
        <div className="flex-1">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Tỷ lệ Hoa hồng</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">Cấu hình % chia cho F0 → F3 và Admin (áp dụng toàn hệ thống)</p>
        </div>
        {success && (
          <span className="inline-flex items-center gap-1 text-xs text-emerald-500 font-medium">
            <Check className="w-3.5 h-3.5" /> Đã lưu!
          </span>
        )}
      </div>

      <div className="space-y-3 mb-4">
        {RATE_FIELDS.map(({ key, label }) => (
          <div key={key} className="flex items-center justify-between gap-3">
            <label className="text-sm text-slate-600 dark:text-slate-300 flex-1 font-medium">{label}</label>
            <div className="relative">
              <input
                type="number"
                min="0"
                max="100"
                step="0.5"
                value={form[key]}
                onChange={e => {
                  const v = e.target.value;
                  setForm(p => ({ ...p, [key]: v === '' ? 0 : Number(v) }));
                  setError('');
                }}
                className="w-24 px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500/40 focus:border-violet-500 text-right font-semibold tabular-nums"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 pointer-events-none">%</span>
            </div>
          </div>
        ))}
      </div>

      {/* Live total */}
      <div className={`flex items-center justify-between px-4 py-3 rounded-xl mb-4 border ${
        isValid
          ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800'
          : 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800'
      }`}>
        <span className={`text-sm font-medium ${isValid ? 'text-emerald-700 dark:text-emerald-400' : 'text-amber-700 dark:text-amber-400'}`}>
          Tổng
        </span>
        <span className={`text-lg font-bold tabular-nums ${isValid ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}`}>
          {sum.toFixed(2)}% {isValid ? '✓' : '⚠ phải = 100%'}
        </span>
      </div>

      {error && (
        <div className="px-3 py-2 mb-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl">
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        </div>
      )}

      <p className="text-xs text-slate-400 dark:text-slate-500 mb-4 italic">
        Áp dụng ngay cho mọi đơn chưa thanh toán. Đơn đã pay giữ nguyên số tiền cũ.
      </p>

      <div className="flex gap-2">
        <button
          onClick={handleSave}
          disabled={saving || !isValid || !dirty}
          className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-violet-500 hover:bg-violet-600 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {saving ? 'Đang lưu...' : 'Lưu tỷ lệ'}
        </button>
        <button
          onClick={handleReset}
          disabled={saving}
          className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors disabled:opacity-50"
          title={`Khôi phục mặc định (F0 ${defaults?.f0 ?? 40}%, F1 ${defaults?.f1 ?? 20}%, F2 ${defaults?.f2 ?? 7}%, F3 ${defaults?.f3 ?? 3}%, Admin ${defaults?.admin ?? 30}%)`}
        >
          <RotateCcw className="w-4 h-4" /> Mặc định
        </button>
      </div>
    </Card>
  );
}

export default function SettingsPage() {
  const { isDark, toggleTheme, accentColor, setAccentColor, themeColors } = useTheme();
  const { admin, checkAuth } = useAuth();
  const [notifications, setNotifications] = useState({
    email: true,
    push: true,
    orders: true,
    payouts: false,
  });
  const [showChangePw, setShowChangePw] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarError, setAvatarError] = useState('');
  const [avatarSuccess, setAvatarSuccess] = useState(false);

  // VPS Management state
  const [vpsForm, setVpsForm] = useState({ expiryDate: '', provider: '', ipAddress: '', note: '' });
  const [vpsLoading, setVpsLoading] = useState(false);
  const [vpsSaving, setVpsSaving] = useState(false);
  const [vpsSuccess, setVpsSuccess] = useState(false);
  const [vpsError, setVpsError] = useState('');
  const [countdown, setCountdown] = useState(null);

  // Fetch VPS config on mount
  useEffect(() => {
    (async () => {
      setVpsLoading(true);
      try {
        const res = await fetch('/api/settings/vps');
        if (res.ok) {
          const data = await res.json();
          if (data.expiryDate) {
            setVpsForm({ expiryDate: data.expiryDate, provider: data.provider || '', ipAddress: data.ipAddress || '', note: data.note || '' });
          }
        }
      } catch (e) { console.error('VPS fetch error', e); }
      finally { setVpsLoading(false); }
    })();
  }, []);

  // Live countdown timer
  useEffect(() => {
    if (!vpsForm.expiryDate) { setCountdown(null); return; }
    const calc = () => {
      const now = new Date();
      const exp = new Date(vpsForm.expiryDate + 'T23:59:59');
      const diff = exp - now;
      if (diff <= 0) return { days: 0, hours: 0, minutes: 0, seconds: 0, expired: true, totalDays: 0 };
      const days = Math.floor(diff / 86400000);
      const hours = Math.floor((diff % 86400000) / 3600000);
      const minutes = Math.floor((diff % 3600000) / 60000);
      const seconds = Math.floor((diff % 60000) / 1000);
      return { days, hours, minutes, seconds, expired: false, totalDays: diff / 86400000 };
    };
    setCountdown(calc());
    const timer = setInterval(() => setCountdown(calc()), 1000);
    return () => clearInterval(timer);
  }, [vpsForm.expiryDate]);

  const handleVpsSave = async () => {
    if (!vpsForm.expiryDate) { setVpsError('Vui lòng chọn ngày hết hạn'); return; }
    setVpsSaving(true); setVpsError(''); setVpsSuccess(false);
    try {
      const res = await fetch('/api/settings/vps', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(vpsForm),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Lỗi lưu'); }
      setVpsSuccess(true);
      setTimeout(() => setVpsSuccess(false), 3000);
    } catch (e) { setVpsError(e.message); }
    finally { setVpsSaving(false); }
  };

  const getCountdownColor = () => {
    if (!countdown || countdown.expired) return { bg: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-600 dark:text-red-400', border: 'border-red-200 dark:border-red-800', ring: 'ring-red-500/20' };
    if (countdown.totalDays <= 7) return { bg: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-600 dark:text-red-400', border: 'border-red-200 dark:border-red-800', ring: 'ring-red-500/20' };
    if (countdown.totalDays <= 30) return { bg: 'bg-amber-100 dark:bg-amber-900/30', text: 'text-amber-600 dark:text-amber-400', border: 'border-amber-200 dark:border-amber-800', ring: 'ring-amber-500/20' };
    return { bg: 'bg-emerald-100 dark:bg-emerald-900/30', text: 'text-emerald-600 dark:text-emerald-400', border: 'border-emerald-200 dark:border-emerald-800', ring: 'ring-emerald-500/20' };
  };

  const handleAvatarUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setAvatarError('Chỉ chấp nhận file ảnh');
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      setAvatarError('Ảnh tối đa 20MB');
      return;
    }
    setAvatarUploading(true);
    setAvatarError('');
    setAvatarSuccess(false);
    try {
      const fd = new FormData();
      fd.append('avatar', file);
      const res = await fetch('/api/auth/avatar', { method: 'POST', body: fd, credentials: 'include' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Upload thất bại');
      await checkAuth(); // refresh admin state
      setAvatarSuccess(true);
      setTimeout(() => setAvatarSuccess(false), 3000);
    } catch (err) {
      setAvatarError(err.message);
    } finally {
      setAvatarUploading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl">
      {showChangePw && <ChangePasswordModal onClose={() => setShowChangePw(false)} />}

      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
          Cài đặt
        </h1>
        <p className="text-slate-500 dark:text-slate-400">
          Quản lý cài đặt tài khoản và giao diện
        </p>
      </div>

      {/* Appearance Settings */}
      <Card className="p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30">
            <Palette className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
              Giao diện
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Tùy chỉnh theme và màu sắc
            </p>
          </div>
        </div>

        {/* Dark/Light Mode */}
        <div className="mb-6">
          <label className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-3 block">
            Chế độ hiển thị
          </label>
          <div className="flex gap-3">
            <button
              onClick={() => isDark && toggleTheme()}
              className={`flex-1 flex items-center justify-center gap-3 p-4 rounded-xl border-2 transition-all ${
                !isDark
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                  : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
              }`}
            >
              <Sun className={`w-5 h-5 ${!isDark ? 'text-blue-500' : 'text-slate-400'}`} />
              <span className={`font-medium ${!isDark ? 'text-blue-600' : 'text-slate-600 dark:text-slate-400'}`}>
                Sáng
              </span>
              {!isDark && <Check className="w-4 h-4 text-blue-500 ml-auto" />}
            </button>
            <button
              onClick={() => !isDark && toggleTheme()}
              className={`flex-1 flex items-center justify-center gap-3 p-4 rounded-xl border-2 transition-all ${
                isDark
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                  : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
              }`}
            >
              <Moon className={`w-5 h-5 ${isDark ? 'text-blue-500' : 'text-slate-400'}`} />
              <span className={`font-medium ${isDark ? 'text-blue-400' : 'text-slate-600 dark:text-slate-400'}`}>
                Tối
              </span>
              {isDark && <Check className="w-4 h-4 text-blue-500 ml-auto" />}
            </button>
          </div>
        </div>

        {/* Accent Color */}
        <div>
          <label className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-3 block">
            Màu chủ đạo
          </label>
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
            {Object.entries(themeColors).map(([key, color]) => (
              <button
                key={key}
                onClick={() => setAccentColor(key)}
                className={`relative flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition-all ${
                  accentColor === key
                    ? 'border-blue-500 bg-slate-50 dark:bg-slate-800'
                    : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
                }`}
              >
                <div
                  className="w-8 h-8 rounded-full shadow-lg"
                  style={{ backgroundColor: color.primary }}
                />
                <span className="text-xs font-medium text-slate-600 dark:text-slate-400">
                  {color.name}
                </span>
                {accentColor === key && (
                  <div className="absolute top-1 right-1 w-4 h-4 bg-blue-500 rounded-full flex items-center justify-center">
                    <Check className="w-3 h-3 text-white" />
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>
      </Card>

      {/* Notification Settings */}
      <Card className="p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 rounded-lg bg-amber-100 dark:bg-amber-900/30">
            <Bell className="w-5 h-5 text-amber-600 dark:text-amber-400" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
              Thông báo
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Quản lý cách nhận thông báo
            </p>
          </div>
        </div>

        <div className="space-y-4">
          {[
            { key: 'email', label: 'Thông báo qua Email', desc: 'Nhận email khi có đơn hàng mới' },
            { key: 'push', label: 'Push Notification', desc: 'Thông báo trên trình duyệt' },
            { key: 'orders', label: 'Đơn hàng mới', desc: 'Thông báo khi có đơn hàng từ affiliate' },
            { key: 'payouts', label: 'Thanh toán', desc: 'Thông báo khi có yêu cầu thanh toán' },
          ].map((item) => (
            <div key={item.key} className="flex items-center justify-between py-3 border-b border-slate-100 dark:border-slate-800 last:border-0">
              <div>
                <p className="font-medium text-slate-900 dark:text-white">{item.label}</p>
                <p className="text-sm text-slate-500 dark:text-slate-400">{item.desc}</p>
              </div>
              <button
                onClick={() => setNotifications({ ...notifications, [item.key]: !notifications[item.key] })}
                className={`relative w-12 h-6 rounded-full transition-colors ${
                  notifications[item.key] ? 'bg-blue-500' : 'bg-slate-300 dark:bg-slate-600'
                }`}
              >
                <div
                  className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                    notifications[item.key] ? 'translate-x-7' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
          ))}
        </div>
      </Card>

      {/* Account Settings */}
      <Card className="p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30">
            <User className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Tài khoản</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">Thông tin và ảnh đại diện</p>
          </div>
        </div>

        {/* Avatar section */}
        <div className="flex items-center gap-5 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl mb-5">
          <div className="relative flex-shrink-0">
            <img
              src={admin?.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${admin?.username || 'Admin'}`}
              alt="Admin"
              className="w-20 h-20 rounded-2xl object-cover border-2 border-slate-200 dark:border-slate-700 bg-slate-200"
              onError={e => { e.target.src = `https://api.dicebear.com/7.x/avataaars/svg?seed=${admin?.username}`; }}
            />
            <label
              htmlFor="avatar-upload"
              className="absolute -bottom-1 -right-1 w-7 h-7 bg-blue-500 hover:bg-blue-600 rounded-full flex items-center justify-center cursor-pointer shadow-lg transition-colors"
            >
              {avatarUploading
                ? <Loader2 className="w-3.5 h-3.5 text-white animate-spin" />
                : <Camera className="w-3.5 h-3.5 text-white" />
              }
            </label>
            <input
              id="avatar-upload"
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleAvatarUpload}
              disabled={avatarUploading}
            />
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-slate-900 dark:text-white">{admin?.displayName || admin?.username || 'Admin'}</p>
            <p className="text-sm text-slate-500 font-mono">@{admin?.username}</p>
            <span className="inline-flex items-center gap-1 mt-1 text-[10px] px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 font-medium">
              Admin
            </span>
            {avatarSuccess && (
              <p className="text-xs text-emerald-500 mt-1 flex items-center gap-1"><Check className="w-3 h-3" /> Đã cập nhật ảnh!</p>
            )}
            {avatarError && (
              <p className="text-xs text-red-500 mt-1">{avatarError}</p>
            )}
          </div>
        </div>

        <div className="flex gap-3">
          <button
            onClick={() => setShowChangePw(true)}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
          >
            <Key className="w-4 h-4" />
            Đổi mật khẩu
          </button>
          <label
            htmlFor="avatar-upload"
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-blue-600 border border-blue-200 dark:border-blue-800 rounded-xl hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors cursor-pointer"
          >
            <Upload className="w-4 h-4" />
            {avatarUploading ? 'Đang upload...' : 'Đổi ảnh đại diện'}
          </label>
        </div>
      </Card>

      {/* VPS Management */}
      <Card className="p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 rounded-lg bg-cyan-100 dark:bg-cyan-900/30">
            <Server className="w-5 h-5 text-cyan-600 dark:text-cyan-400" />
          </div>
          <div className="flex-1">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Quản lý VPS</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">Theo dõi hạn & gia hạn máy chủ</p>
          </div>
          {vpsSuccess && (
            <span className="inline-flex items-center gap-1 text-xs text-emerald-500 font-medium">
              <Check className="w-3.5 h-3.5" /> Đã lưu!
            </span>
          )}
        </div>

        {/* Countdown */}
        {countdown && (
          <div className={`mb-5 p-4 rounded-xl border ${getCountdownColor().border} ${getCountdownColor().bg} ring-1 ${getCountdownColor().ring}`}>
            <div className="flex items-center gap-2 mb-3">
              {countdown.expired || countdown.totalDays <= 7
                ? <AlertTriangle className={`w-4 h-4 ${getCountdownColor().text}`} />
                : <Clock className={`w-4 h-4 ${getCountdownColor().text}`} />
              }
              <span className={`text-sm font-semibold ${getCountdownColor().text}`}>
                {countdown.expired ? '⚠️ VPS ĐÃ HẾT HẠN!' : 'Thời gian còn lại'}
              </span>
            </div>
            {!countdown.expired && (
              <div className="grid grid-cols-4 gap-2">
                {[
                  { val: countdown.days, label: 'Ngày' },
                  { val: countdown.hours, label: 'Giờ' },
                  { val: countdown.minutes, label: 'Phút' },
                  { val: countdown.seconds, label: 'Giây' },
                ].map(({ val, label }) => (
                  <div key={label} className="text-center">
                    <div className={`text-2xl font-bold tabular-nums ${getCountdownColor().text}`}>
                      {String(val).padStart(2, '0')}
                    </div>
                    <div className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-wider mt-0.5">{label}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Form */}
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5 block">Ngày hết hạn *</label>
              <input
                type="date"
                value={vpsForm.expiryDate}
                onChange={e => setVpsForm(p => ({ ...p, expiryDate: e.target.value }))}
                className="w-full px-3 py-2.5 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-cyan-500/40 focus:border-cyan-500 transition-colors"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5 block">Nhà cung cấp</label>
              <input
                type="text"
                value={vpsForm.provider}
                onChange={e => setVpsForm(p => ({ ...p, provider: e.target.value }))}
                placeholder="VD: Vultr, DigitalOcean, Aiven..."
                className="w-full px-3 py-2.5 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-cyan-500/40 focus:border-cyan-500 transition-colors"
              />
            </div>
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5 block">Địa chỉ IP</label>
            <input
              type="text"
              value={vpsForm.ipAddress}
              onChange={e => setVpsForm(p => ({ ...p, ipAddress: e.target.value }))}
              placeholder="VD: 103.xxx.xxx.xxx"
              className="w-full px-3 py-2.5 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-cyan-500/40 focus:border-cyan-500 transition-colors"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5 block">Ghi chú</label>
            <textarea
              value={vpsForm.note}
              onChange={e => setVpsForm(p => ({ ...p, note: e.target.value }))}
              placeholder="VD: RAM 4GB, 2 vCPU, Ubuntu 22.04..."
              rows={2}
              className="w-full px-3 py-2.5 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-cyan-500/40 focus:border-cyan-500 transition-colors resize-none"
            />
          </div>

          {vpsError && (
            <div className="px-3 py-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl">
              <p className="text-sm text-red-600 dark:text-red-400">{vpsError}</p>
            </div>
          )}

          <button
            onClick={handleVpsSave}
            disabled={vpsSaving}
            className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-cyan-500 hover:bg-cyan-600 rounded-xl transition-colors disabled:opacity-60"
          >
            {vpsSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {vpsSaving ? 'Đang lưu...' : 'Lưu cài đặt VPS'}
          </button>
        </div>
      </Card>

      <CommissionRatesCard />

      {/* Security Settings */}
      <Card className="p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 rounded-lg bg-emerald-100 dark:bg-emerald-900/30">
            <Shield className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
              Bảo mật
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Cài đặt bảo mật tài khoản
            </p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between py-3 border-b border-slate-100 dark:border-slate-800">
            <div>
              <p className="font-medium text-slate-900 dark:text-white">Xác thực 2 bước (2FA)</p>
              <p className="text-sm text-slate-500 dark:text-slate-400">Bảo vệ tài khoản với xác thực 2 bước</p>
            </div>
            <Button variant="outline" size="sm">Bật</Button>
          </div>
          <div className="flex items-center justify-between py-3">
            <div>
              <p className="font-medium text-slate-900 dark:text-white">Phiên đăng nhập</p>
              <p className="text-sm text-slate-500 dark:text-slate-400">Quản lý các thiết bị đang đăng nhập</p>
            </div>
            <Button variant="outline" size="sm">Xem</Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
