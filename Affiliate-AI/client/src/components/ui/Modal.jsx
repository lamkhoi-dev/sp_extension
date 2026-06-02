import { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import clsx from 'clsx';

export default function Modal({
  isOpen,
  onClose,
  title,
  children,
  size = 'md',
  showClose = true,
  footer
}) {
  const sizes = {
    sm: 'max-w-md',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl',
    full: 'max-w-[90vw]',
    tree: 'w-[96vw] max-w-[96vw]',
  };

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
          />

          {/* Modal - slide up on mobile */}
          <motion.div
            initial={{ opacity: 0, y: '100%' }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed inset-x-0 bottom-0 sm:inset-0 z-50 sm:flex sm:items-center sm:justify-center sm:p-2 md:p-4"
          >
            <div
              className={clsx(
                'w-full bg-white dark:bg-slate-800 shadow-2xl',
                'border border-slate-200 dark:border-slate-700',
                'rounded-t-2xl sm:rounded-2xl',
                size === 'tree'
                  ? 'max-h-[96vh] sm:max-h-[94vh] flex flex-col'
                  : 'max-h-[90vh] sm:max-h-[85vh] flex flex-col',
                sizes[size]
              )}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Drag handle for mobile */}
              <div className="flex justify-center pt-2 pb-1 sm:hidden">
                <div className="w-10 h-1 bg-slate-300 dark:bg-slate-600 rounded-full" />
              </div>

              {/* Header */}
              {(title || showClose) && (
                <div className="flex items-center justify-between px-4 sm:px-6 py-2 sm:py-4 border-b border-slate-200 dark:border-slate-700 flex-shrink-0">
                  {title && (
                    <h3 className="text-base sm:text-lg font-semibold text-slate-900 dark:text-white">
                      {title}
                    </h3>
                  )}
                  {showClose && (
                    <button
                      onClick={onClose}
                      className="p-2 rounded-lg text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                    >
                      <X className="h-5 w-5" />
                    </button>
                  )}
                </div>
              )}

              {/* Content */}
              <div className="p-4 sm:p-6 overflow-y-auto flex-1">
                {children}
              </div>

              {/* Footer - sticky buttons */}
              {footer && (
                <div className="flex-shrink-0 px-4 sm:px-6 py-3 sm:py-4 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 rounded-b-2xl">
                  {footer}
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
