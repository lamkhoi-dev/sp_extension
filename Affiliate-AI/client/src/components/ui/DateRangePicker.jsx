import { useState, useRef, useEffect, useCallback } from 'react';
import { ChevronDown, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';

// ─── Constants ──────────────────────────────────────────
const VN_DAYS = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN']; // Mon → Sun
const VN_MONTHS = [
  'Thg 1', 'Thg 2', 'Thg 3', 'Thg 4', 'Thg 5', 'Thg 6',
  'Thg 7', 'Thg 8', 'Thg 9', 'Thg 10', 'Thg 11', 'Thg 12',
];

const PRESETS = [
  { label: '7 ngày qua',  days: 7 },
  { label: '15 ngày qua', days: 15 },
  { label: '30 ngày qua', days: 30 },
];

// ─── Helpers ────────────────────────────────────────────
/** yyyy-mm-dd → Date at midnight local */
function parseISO(str) {
  if (!str) return null;
  const [y, m, d] = str.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/** Date → yyyy-mm-dd */
function toISO(d) {
  if (!d) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** yyyy-mm-dd → DD-MM-YYYY */
function toDisplay(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return `${d}-${m}-${y}`;
}

/** Compare dates ignoring time */
function isSameDay(a, b) {
  return a && b && a.toDateString() === b.toDateString();
}

/** First Mon of the display week-grid for month */
function getGridStart(year, month) {
  const first = new Date(year, month, 1);
  // getDay(): 0=Sun, 1=Mon, ..., 6=Sat  →  shift so Mon=0
  const dow = (first.getDay() + 6) % 7;
  const start = new Date(first);
  start.setDate(1 - dow);
  return start;
}

// ─── Mini Calendar ───────────────────────────────────────
function MiniCalendar({
  year, month, onPrevYear, onNextYear, onPrevMonth, onNextMonth,
  hoverDay, onHover, onSelect,
  startDate, endDate, selecting,
}) {
  const gridStart = getGridStart(year, month);
  const today = new Date(); today.setHours(0, 0, 0, 0);

  const rows = [];
  const cursor = new Date(gridStart);
  for (let r = 0; r < 6; r++) {
    const cells = [];
    for (let c = 0; c < 7; c++) {
      const day = new Date(cursor);
      const iso = toISO(day);
      const isCurrentMonth = day.getMonth() === month;
      const isToday = isSameDay(day, today);
      const isStart = startDate && isSameDay(day, startDate);
      const isEnd = endDate && isSameDay(day, endDate);

      // Range highlight
      let inRange = false;
      if (startDate && endDate) {
        inRange = day > startDate && day < endDate;
      } else if (startDate && selecting && hoverDay) {
        const hov = hoverDay > startDate
          ? { lo: startDate, hi: hoverDay }
          : { lo: hoverDay, hi: startDate };
        inRange = day > hov.lo && day < hov.hi;
      }

      const isEdge = isStart || isEnd;

      cells.push(
        <td key={iso} className="p-0 text-center">
          <button
            type="button"
            onMouseEnter={() => onHover(day)}
            onMouseLeave={() => onHover(null)}
            onClick={() => onSelect(day)}
            className={[
              'w-8 h-8 rounded-full text-[13px] leading-none transition-colors mx-auto block',
              !isCurrentMonth ? 'text-slate-300 dark:text-slate-600' : 'text-slate-700 dark:text-slate-200',
              isEdge ? 'bg-orange-500 text-white font-semibold hover:bg-orange-600' : '',
              !isEdge && inRange ? 'bg-orange-100 dark:bg-orange-900/30 rounded-none' : '',
              !isEdge && !inRange && isCurrentMonth ? 'hover:bg-slate-100 dark:hover:bg-slate-700' : '',
              isToday && !isEdge ? 'border border-slate-400 dark:border-slate-400 font-medium' : '',
            ].filter(Boolean).join(' ')}
          >
            {day.getDate()}
          </button>
        </td>
      );
      cursor.setDate(cursor.getDate() + 1);
    }
    rows.push(<tr key={r}>{cells}</tr>);
  }

  return (
    <div className="min-w-[230px]">
      {/* Month nav */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-0.5">
          {onPrevYear && (
            <button type="button" onClick={onPrevYear}
              className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400">
              <ChevronsLeft className="w-3.5 h-3.5" />
            </button>
          )}
          {onPrevMonth && (
            <button type="button" onClick={onPrevMonth}
              className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400">
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        <span className="text-[13px] font-semibold text-slate-800 dark:text-slate-100">
          {VN_MONTHS[month]} {year}
        </span>
        <div className="flex items-center gap-0.5">
          {onNextMonth && (
            <button type="button" onClick={onNextMonth}
              className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400">
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          )}
          {onNextYear && (
            <button type="button" onClick={onNextYear}
              className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400">
              <ChevronsRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Day headers */}
      <table className="w-full border-collapse">
        <thead>
          <tr>
            {VN_DAYS.map(d => (
              <th key={d} className="w-8 pb-1 text-[11px] font-medium text-slate-400 dark:text-slate-500 text-center">
                {d}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{rows}</tbody>
      </table>
    </div>
  );
}

// ─── Main DateRangePicker ────────────────────────────────
/**
 * Props:
 *   from        string  yyyy-mm-dd
 *   to          string  yyyy-mm-dd
 *   onChange    fn({ from, to })
 *   timeField   string  (value for time type dropdown)
 *   timeOptions [{value, label}]  list of time field options
 *   onTimeFieldChange fn(value)
 */
export default function DateRangePicker({
  from, to,
  onChange,
  timeField,
  timeOptions = [],
  onTimeFieldChange,
}) {
  const [open, setOpen] = useState(false);
  const [selecting, setSelecting] = useState(false); // true = waiting for end date
  const [tempStart, setTempStart] = useState(null);
  const [hoverDay, setHoverDay] = useState(null);

  // Left calendar month
  const initMonth = () => {
    const base = from ? parseISO(from) : new Date();
    return { year: base.getFullYear(), month: base.getMonth() };
  };
  const [leftCal, setLeftCal] = useState(initMonth);

  const rightCal = (() => {
    let { year, month } = leftCal;
    month += 1;
    if (month > 11) { month = 0; year += 1; }
    return { year, month };
  })();

  const wrapRef = useRef(null);

  // Click outside → close
  useEffect(() => {
    function handle(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) {
        setOpen(false);
        setSelecting(false);
        setTempStart(null);
      }
    }
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, []);

  const startDate = tempStart || parseISO(from);
  const endDate = selecting ? null : parseISO(to);

  const handleDaySelect = useCallback((day) => {
    if (!selecting) {
      // First click → pick start
      setTempStart(day);
      setSelecting(true);
    } else {
      // Second click → pick end
      let lo = tempStart, hi = day;
      if (lo > hi) [lo, hi] = [hi, lo];
      onChange({ from: toISO(lo), to: toISO(hi) });
      setTempStart(null);
      setSelecting(false);
      setOpen(false);
    }
  }, [selecting, tempStart, onChange]);

  const applyPreset = (days) => {
    const now = new Date(); now.setHours(0, 0, 0, 0);
    const from = new Date(now); from.setDate(now.getDate() - days + 1);
    onChange({ from: toISO(from), to: toISO(now) });
    setSelecting(false);
    setTempStart(null);
    setOpen(false);
  };

  const applyThisMonth = () => {
    const now = new Date(); now.setHours(0, 0, 0, 0);
    const first = new Date(now.getFullYear(), now.getMonth(), 1);
    onChange({ from: toISO(first), to: toISO(now) });
    setSelecting(false);
    setTempStart(null);
    setOpen(false);
  };

  // Navigation
  const shiftLeft = (dy, dm) => {
    setLeftCal(prev => {
      let { year, month } = prev;
      month += dm; year += dy;
      if (month < 0) { month = 11; year -= 1; }
      if (month > 11) { month = 0; year += 1; }
      return { year, month };
    });
  };

  // Display text
  const displayText = from || to
    ? `${toDisplay(from) || '---'} ~ ${toDisplay(to) || '---'}`
    : '';

  const selectedLabel = timeOptions.find(o => o.value === timeField)?.label || 'Thời gian';

  return (
    <div ref={wrapRef} className="relative">
      {/* Trigger row: [TimeField dropdown] [Date Range input] */}
      <div className="flex items-stretch">
        {/* Time field dropdown button */}
        {timeOptions.length > 0 && (
          <div className="relative group">
            <select
              value={timeField}
              onChange={e => onTimeFieldChange?.(e.target.value)}
              className="appearance-none h-full pl-3 pr-7 text-[13px] font-medium text-slate-700 dark:text-slate-200 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 border-r-0 rounded-l-lg cursor-pointer focus:outline-none focus:ring-1 focus:ring-orange-400 hover:bg-slate-100 dark:hover:bg-slate-600 transition-colors min-w-[148px]"
            >
              {timeOptions.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
          </div>
        )}

        {/* Date range input */}
        <button
          type="button"
          onClick={() => setOpen(v => !v)}
          className={[
            'flex items-center gap-2 px-3 py-2 text-[13px] border border-slate-200 dark:border-slate-600',
            'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200',
            'hover:border-orange-400 focus:outline-none focus:ring-1 focus:ring-orange-400',
            'transition-colors min-w-[210px]',
            timeOptions.length > 0 ? 'rounded-r-lg' : 'rounded-lg',
            open ? 'border-orange-400 ring-1 ring-orange-400' : '',
          ].join(' ')}
        >
          <span className={displayText ? 'text-slate-800 dark:text-slate-100' : 'text-slate-400'}>
            {displayText || 'Chọn khoảng thời gian'}
          </span>
          {/* Clear button */}
          {(from || to) && (
            <span
              role="button"
              tabIndex={0}
              onClick={e => { e.stopPropagation(); onChange({ from: '', to: '' }); }}
              onKeyDown={e => e.key === 'Enter' && onChange({ from: '', to: '' })}
              className="ml-auto text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 text-xs leading-none"
            >
              ×
            </span>
          )}
        </button>
      </div>

      {/* Popup */}
      {open && (
        <div className="absolute z-50 top-full left-0 mt-1 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-2xl flex">
          {/* ── Left: Presets ── */}
          <div className="w-36 border-r border-slate-100 dark:border-slate-700 py-2 flex-shrink-0">
            <p className="px-4 py-1 text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
              Nhanh
            </p>
            {PRESETS.map(p => (
              <button
                key={p.label}
                type="button"
                onClick={() => applyPreset(p.days)}
                className="w-full text-left px-4 py-2 text-[13px] text-slate-700 dark:text-slate-300 hover:bg-orange-50 dark:hover:bg-orange-900/20 hover:text-orange-600 dark:hover:text-orange-400 transition-colors"
              >
                {p.label}
              </button>
            ))}
            <button
              type="button"
              onClick={applyThisMonth}
              className="w-full text-left px-4 py-2 text-[13px] text-slate-700 dark:text-slate-300 hover:bg-orange-50 dark:hover:bg-orange-900/20 hover:text-orange-600 dark:hover:text-orange-400 transition-colors"
            >
              Tháng này
            </button>
          </div>

          {/* ── Right: Dual calendar ── */}
          <div className="p-4 flex gap-6">
            {/* Left month */}
            <MiniCalendar
              year={leftCal.year}
              month={leftCal.month}
              onPrevYear={() => shiftLeft(-1, 0)}
              onPrevMonth={() => shiftLeft(0, -1)}
              onNextMonth={null}  // no individual next on left (handled by right)
              onNextYear={null}
              hoverDay={hoverDay}
              onHover={setHoverDay}
              onSelect={handleDaySelect}
              startDate={startDate}
              endDate={endDate}
              selecting={selecting}
            />

            {/* Divider */}
            <div className="w-px bg-slate-100 dark:bg-slate-700" />

            {/* Right month */}
            <MiniCalendar
              year={rightCal.year}
              month={rightCal.month}
              onPrevMonth={null}
              onPrevYear={null}
              onNextMonth={() => shiftLeft(0, 1)}
              onNextYear={() => shiftLeft(1, 0)}
              hoverDay={hoverDay}
              onHover={setHoverDay}
              onSelect={handleDaySelect}
              startDate={startDate}
              endDate={endDate}
              selecting={selecting}
            />
          </div>
        </div>
      )}

      {/* Hint text when selecting */}
      {selecting && (
        <p className="absolute -bottom-5 left-0 text-[11px] text-orange-500 whitespace-nowrap pointer-events-none">
          Chọn ngày kết thúc...
        </p>
      )}
    </div>
  );
}
