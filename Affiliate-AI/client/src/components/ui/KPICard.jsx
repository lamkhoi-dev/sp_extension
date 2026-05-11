import clsx from 'clsx';

export default function KPICard({
  title,
  value,
  change,
  changeType = 'increase',
  icon: Icon,
  iconBg = 'bg-blue-500'
}) {
  const formatValue = (val) => {
    if (typeof val === 'number') {
      if (val >= 1000000) {
        return (val / 1000000).toFixed(1) + 'M';
      }
      if (val >= 1000) {
        return (val / 1000).toFixed(1) + 'K';
      }
      return val.toLocaleString('vi-VN');
    }
    return val;
  };

  return (
    <div className="bg-white dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700/50 p-3 sm:p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400 truncate">
            {title}
          </p>
          <p className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white mt-0.5">
            {formatValue(value)}
          </p>
          {change !== undefined && (
            <div className="flex items-center gap-1 mt-1">
              <span
                className={clsx(
                  'text-[10px] sm:text-xs font-medium',
                  changeType === 'increase' ? 'text-emerald-500' : 'text-red-500'
                )}
              >
                {changeType === 'increase' ? '↑' : '↓'} {change}%
              </span>
            </div>
          )}
        </div>
        {Icon && (
          <div className={clsx('p-2 sm:p-2.5 rounded-lg flex-shrink-0', iconBg)}>
            <Icon className="h-4 w-4 sm:h-5 sm:w-5 text-white" />
          </div>
        )}
      </div>
    </div>
  );
}
