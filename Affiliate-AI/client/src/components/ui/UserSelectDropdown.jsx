import { useState, useEffect, useRef } from 'react';
import { ChevronDown, Users } from 'lucide-react';

function norm(u) {
  return {
    id: u.user_id || u.userId || '',
    name: u.display_name || u.displayName || u.zalo_name || u.zaloName || '',
    avatar: u.avatar || '',
  };
}

export default function UserSelectDropdown({ users = [], value = '', onChange, placeholder = 'Tất cả user' }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const normed = users.map(norm);
  const filtered = normed.filter(u => !search || u.name.toLowerCase().includes(search.toLowerCase()));
  const selected = value ? normed.find(u => u.id === value) : null;

  function select(id) { onChange(id); setOpen(false); setSearch(''); }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-2 px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-left focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        {selected ? (
          <>
            {selected.avatar ? (
              <img src={selected.avatar} alt={selected.name} className="w-5 h-5 rounded-full object-cover flex-shrink-0 border border-slate-200 dark:border-slate-600" onError={e => { e.target.style.display = 'none'; }} />
            ) : (
              <div className="w-5 h-5 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-[9px] font-semibold text-slate-500 flex-shrink-0">
                {selected.name.charAt(0).toUpperCase()}
              </div>
            )}
            <span className="truncate flex-1 text-slate-900 dark:text-white">{selected.name}</span>
          </>
        ) : (
          <>
            <Users className="w-4 h-4 text-slate-400 flex-shrink-0" />
            <span className="flex-1 text-slate-400">{placeholder}</span>
          </>
        )}
        <ChevronDown className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
      </button>

      {open && (
        <div className="absolute z-50 top-full mt-1 w-full min-w-[200px] bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg overflow-hidden">
          <div className="p-2 border-b border-slate-100 dark:border-slate-700">
            <input
              autoFocus
              type="text"
              placeholder="Tìm user..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full px-2 py-1.5 text-sm border border-slate-200 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500 placeholder-slate-400"
            />
          </div>
          <div className="max-h-52 overflow-y-auto">
            <button
              onClick={() => select('')}
              className={`w-full flex items-center gap-2 px-3 py-2 text-sm text-left transition-colors ${!value ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400' : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700'}`}
            >
              <div className="w-6 h-6 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center flex-shrink-0">
                <Users className="w-3.5 h-3.5 text-slate-400" />
              </div>
              Tất cả user
            </button>
            {filtered.map(u => (
              <button
                key={u.id}
                onClick={() => select(u.id)}
                className={`w-full flex items-center gap-2 px-3 py-2 text-sm text-left transition-colors ${value === u.id ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400' : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700'}`}
              >
                {u.avatar ? (
                  <img src={u.avatar} alt={u.name} className="w-6 h-6 rounded-full object-cover flex-shrink-0 border border-slate-200 dark:border-slate-600" onError={e => { e.target.style.display = 'none'; }} />
                ) : (
                  <div className="w-6 h-6 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-[10px] font-semibold text-slate-500 dark:text-slate-400 flex-shrink-0">
                    {u.name.charAt(0).toUpperCase()}
                  </div>
                )}
                <span className="truncate">{u.name}</span>
              </button>
            ))}
            {filtered.length === 0 && (
              <p className="px-3 py-4 text-xs text-center text-slate-400">Không tìm thấy</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
