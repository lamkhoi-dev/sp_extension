import { useState } from 'react';
import { Sun, Moon, Palette, Bell, Shield, User, Check, Key, Eye, EyeOff, X, Lock } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';

function ChangePasswordModal({ onClose }) {
  const { changePassword } = useAuth();
  const [form, setForm] = useState({ oldPw: '', newPw: '', confirmPw: '' });
  const [show, setShow] = useState({ old: false, new: false, confirm: false });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const inputCls = 'w-full px-3 py-2.5 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 transition-colors pr-10';

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

  const PwField = ({ label, field, showKey }) => (
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
            <PwField label="Mật khẩu hiện tại" field="oldPw" showKey="old" />
            <PwField label="Mật khẩu mới" field="newPw" showKey="new" />
            <PwField label="Xác nhận mật khẩu mới" field="confirmPw" showKey="confirm" />

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

export default function SettingsPage() {
  const { isDark, toggleTheme, accentColor, setAccentColor, themeColors } = useTheme();
  const { admin } = useAuth();
  const [notifications, setNotifications] = useState({
    email: true,
    push: true,
    orders: true,
    payouts: false,
  });
  const [showChangePw, setShowChangePw] = useState(false);

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
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
              Tài khoản
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Thông tin tài khoản admin
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl mb-5">
          <img
            src={admin?.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${admin?.username || 'Admin'}`}
            alt="Admin"
            className="w-16 h-16 rounded-xl object-cover border-2 border-slate-200 dark:border-slate-700"
          />
          <div>
            <p className="font-semibold text-slate-900 dark:text-white">{admin?.username || 'Admin'}</p>
            <p className="text-sm text-slate-500 dark:text-slate-400">{admin?.email || 'admin@affiliatehub.vn'}</p>
            <span className="inline-flex items-center gap-1 mt-1 text-[10px] px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 font-medium">
              {admin?.role || 'Admin'}
            </span>
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
        </div>
      </Card>

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
