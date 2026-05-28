import { useState, useRef, useEffect } from 'react';
import { ChevronDown, Search, X } from 'lucide-react';
import { VIET_BANKS, getBankLogoUrl } from '../../constants/banks';

/**
 * BankSelect — Custom dropdown with logo + search
 * Props:
 *   value: string (bank code, e.g. 'VCB')
 *   onChange: (code: string) => void
 *   placeholder?: string
 *   className?: string
 */
export default function BankSelect({ value, onChange, placeholder = '— Chọn ngân hàng —', className = '' }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const containerRef = useRef(null);
  const searchRef = useRef(null);

  const selected = VIET_BANKS.find(b => b.code === value) || null;

  const filtered = VIET_BANKS.filter(b => {
    if (!query.trim()) return true;
    const q = query.toLowerCase();
    return (
      b.short.toLowerCase().includes(q) ||
      b.name.toLowerCase().includes(q) ||
      b.code.toLowerCase().includes(q) ||
      b.bin.includes(q)
    );
  });

  // Close on outside click
  useEffect(() => {
    const handler = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
        setQuery('');
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Focus search when open
  useEffect(() => {
    if (open && searchRef.current) {
      setTimeout(() => searchRef.current?.focus(), 50);
    }
  }, [open]);

  const handleSelect = (bank) => {
    onChange(bank.code);
    setOpen(false);
    setQuery('');
  };

  const handleClear = (e) => {
    e.stopPropagation();
    onChange('');
    setQuery('');
  };

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {/* Trigger */}
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className={`
          w-full flex items-center gap-2.5 px-3 py-2.5 text-sm rounded-xl border
          bg-white dark:bg-slate-800 text-slate-900 dark:text-white
          transition-all duration-150 text-left
          ${open
            ? 'border-blue-400 ring-2 ring-blue-500/20'
            : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
          }
        `}
      >
        {selected ? (
          <>
            <BankLogo code={selected.code} size={20} />
            <span className="flex-1 truncate font-medium">{selected.short}</span>
            <span className="text-xs text-slate-400 truncate hidden sm:block">{selected.name}</span>
          </>
        ) : (
          <span className="flex-1 text-slate-400">{placeholder}</span>
        )}

        <div className="flex items-center gap-1 ml-auto flex-shrink-0">
          {selected && (
            <span
              role="button"
              onClick={handleClear}
              className="p-0.5 rounded hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 hover:text-slate-600"
            >
              <X className="w-3.5 h-3.5" />
            </span>
          )}
          <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} />
        </div>
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute z-50 mt-1.5 w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl overflow-hidden">
          {/* Search input */}
          <div className="p-2 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2 px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800/70 rounded-lg">
              <Search className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
              <input
                ref={searchRef}
                type="text"
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Tìm tên, mã ngân hàng..."
                className="flex-1 bg-transparent text-sm text-slate-900 dark:text-white placeholder:text-slate-400 outline-none min-w-0"
              />
              {query && (
                <button onClick={() => setQuery('')} className="text-slate-400 hover:text-slate-600">
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* List */}
          <ul className="max-h-80 overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <li className="px-3 py-3 text-sm text-slate-400 text-center">Không tìm thấy ngân hàng</li>
            ) : (
              filtered.map(bank => {
                const isSelected = bank.code === value;
                return (
                  <li key={bank.code}>
                    <button
                      type="button"
                      onClick={() => handleSelect(bank)}
                      className={`
                        w-full flex items-center gap-2.5 px-3 py-2 text-left transition-colors
                        ${isSelected
                          ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                          : 'hover:bg-slate-50 dark:hover:bg-slate-800/60 text-slate-900 dark:text-white'
                        }
                      `}
                    >
                      <BankLogo code={bank.code} size={24} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{bank.short}</p>
                        <p className="text-[11px] text-slate-400 dark:text-slate-500 truncate">{bank.name}</p>
                      </div>
                      {isSelected && (
                        <span className="text-blue-500 text-xs font-bold ml-auto flex-shrink-0">✓</span>
                      )}
                    </button>
                  </li>
                );
              })
            )}
          </ul>
        </div>
      )}
    </div>
  );
}

/**
 * Bank logo with graceful fallback to initials
 */
function BankLogo({ code, size = 24 }) {
  const [errored, setErrored] = useState(false);
  const logoUrl = getBankLogoUrl(code);

  if (!code || errored) {
    return (
      <div
        style={{ width: size, height: size }}
        className="rounded bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-[10px] font-bold text-slate-500 dark:text-slate-400 flex-shrink-0"
      >
        {code?.slice(0, 2) || '?'}
      </div>
    );
  }

  return (
    <img
      src={logoUrl}
      alt={code}
      style={{ width: size, height: size }}
      className="rounded object-contain flex-shrink-0 bg-white dark:bg-slate-800"
      onError={() => setErrored(true)}
    />
  );
}
