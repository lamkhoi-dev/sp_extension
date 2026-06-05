import { useState, useEffect, useCallback } from 'react';
import { FileText, ExternalLink, RefreshCw, Search, User } from 'lucide-react';
import Card from '../components/ui/Card';

const API = '/api';

export default function TestReportPage() {
  const [users, setUsers] = useState([]);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [history, setHistory] = useState([]); // recent generated reports

  useEffect(() => {
    fetch(`${API}/users/select`, { credentials: 'include' })
      .then(r => r.json()).then(setUsers).catch(() => {});
  }, []);

  const filtered = users.filter(u => {
    const q = search.toLowerCase();
    return !q || (u.display_name || u.zalo_name || '').toLowerCase().includes(q);
  });

  const generate = useCallback(async () => {
    if (!selected) return;
    setLoading(true); setError(''); setResult(null);
    try {
      const res = await fetch(`${API}/reports/generate`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: selected.user_id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      setResult(data);
      setHistory(prev => [data, ...prev.slice(0, 9)]);
      // Auto-open in new tab
      window.open(data.url, '_blank');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [selected]);

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Test /thongke</h1>
        <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
          Tạo báo cáo thống kê cho bất kỳ user — link có hiệu lực 24 giờ.
        </p>
      </div>

      <Card className="p-6 space-y-5">
        {/* Search */}
        <div>
          <label className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5 block">
            Chọn user
          </label>
          <div className="relative mb-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Tìm tên user..."
              className="w-full pl-9 pr-3 py-2.5 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/40"
            />
          </div>

          {/* User list */}
          <div className="max-h-56 overflow-y-auto border border-slate-200 dark:border-slate-700 rounded-xl divide-y divide-slate-100 dark:divide-slate-700/50">
            {filtered.length === 0 ? (
              <p className="text-center py-6 text-sm text-slate-400">Không tìm thấy</p>
            ) : filtered.map(u => (
              <button
                key={u.user_id}
                onClick={() => { setSelected(u); setResult(null); setError(''); }}
                className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                  selected?.user_id === u.user_id
                    ? 'bg-blue-50 dark:bg-blue-900/20'
                    : 'hover:bg-slate-50 dark:hover:bg-slate-800/40'
                }`}
              >
                <img
                  src={u.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${u.user_id}`}
                  alt=""
                  className="w-8 h-8 rounded-full object-cover flex-shrink-0 bg-slate-200"
                  onError={e => { e.target.src = `https://api.dicebear.com/7.x/avataaars/svg?seed=${u.user_id}`; }}
                />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-slate-900 dark:text-white truncate">
                    {u.display_name || u.zalo_name || u.user_id}
                  </p>
                  <p className="text-[10px] text-slate-400 font-mono">{u.user_id}</p>
                </div>
                {selected?.user_id === u.user_id && (
                  <div className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0" />
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Selected + Generate */}
        {selected && (
          <div className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700">
            <User className="w-4 h-4 text-slate-400 flex-shrink-0" />
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300 flex-1 truncate">
              {selected.display_name || selected.zalo_name}
            </span>
            <button
              onClick={generate}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-blue-500 hover:bg-blue-600 rounded-lg transition-colors disabled:opacity-60"
            >
              {loading
                ? <><RefreshCw className="w-3.5 h-3.5 animate-spin" /> Đang tạo...</>
                : <><FileText className="w-3.5 h-3.5" /> Tạo báo cáo</>
              }
            </button>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="px-3 py-2.5 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl">
            <p className="text-sm text-red-600 dark:text-red-400">❌ {error}</p>
          </div>
        )}

        {/* Result */}
        {result && (
          <div className="p-4 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-xl space-y-2">
            <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">
              ✅ Báo cáo cho {result.displayName}
            </p>
            <div className="flex items-center gap-2">
              <input
                readOnly
                value={result.url}
                className="flex-1 text-xs font-mono bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-slate-600 dark:text-slate-300"
              />
              <a
                href={result.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-white bg-emerald-500 hover:bg-emerald-600 rounded-lg transition-colors whitespace-nowrap"
              >
                <ExternalLink className="w-3 h-3" /> Mở
              </a>
            </div>
            <p className="text-[10px] text-slate-400">Link hết hạn sau 24 giờ · Token: {result.token}</p>
          </div>
        )}
      </Card>

      {/* Recent history */}
      {history.length > 0 && (
        <Card className="p-5">
          <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">
            Gần đây
          </h2>
          <div className="space-y-2">
            {history.map((r, i) => (
              <div key={i} className="flex items-center gap-3">
                <span className="text-sm text-slate-600 dark:text-slate-400 flex-1 truncate">
                  {r.displayName}
                </span>
                <a
                  href={r.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-xs text-blue-500 hover:text-blue-600"
                >
                  <ExternalLink className="w-3 h-3" /> Mở
                </a>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
