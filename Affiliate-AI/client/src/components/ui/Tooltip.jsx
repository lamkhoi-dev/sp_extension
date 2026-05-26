import { useState, useRef, useEffect } from 'react';
import { Info } from 'lucide-react';

export default function Tooltip({ text, children, className = '' }) {
  const [show, setShow] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const triggerRef = useRef(null);
  const tooltipRef = useRef(null);

  useEffect(() => {
    if (!show || !triggerRef.current || !tooltipRef.current) return;

    const trigger = triggerRef.current.getBoundingClientRect();
    const tooltip = tooltipRef.current.getBoundingClientRect();
    const viewport = { w: window.innerWidth, h: window.innerHeight };

    let top = trigger.bottom + 6;
    let left = trigger.left + trigger.width / 2 - tooltip.width / 2;

    // Clamp horizontal
    if (left < 8) left = 8;
    if (left + tooltip.width > viewport.w - 8) left = viewport.w - tooltip.width - 8;

    // Flip above if no room below
    if (top + tooltip.height > viewport.h - 8) {
      top = trigger.top - tooltip.height - 6;
    }

    setPos({ top, left });
  }, [show]);

  if (!text) {
    return children || null;
  }

  // If children provided, wrap them; otherwise render an info icon
  const trigger = children ? (
    <span
      ref={triggerRef}
      className={`inline-flex ${className}`}
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
      onClick={() => setShow(s => !s)}
    >
      {children}
    </span>
  ) : (
    <button
      ref={triggerRef}
      type="button"
      className={`inline-flex items-center justify-center w-3.5 h-3.5 rounded-full text-slate-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors cursor-help ${className}`}
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
      onClick={(e) => { e.stopPropagation(); setShow(s => !s); }}
      aria-label="Xem giải thích"
    >
      <Info className="w-3 h-3" />
    </button>
  );

  return (
    <>
      {trigger}
      {show && (
        <div
          ref={tooltipRef}
          className="fixed z-[9999] max-w-[280px] px-3 py-2.5 text-xs leading-relaxed text-slate-200 bg-slate-900 dark:bg-slate-950 border border-slate-700 rounded-lg shadow-xl pointer-events-none animate-in fade-in duration-150"
          style={{ top: pos.top, left: pos.left }}
        >
          {text}
        </div>
      )}
    </>
  );
}
