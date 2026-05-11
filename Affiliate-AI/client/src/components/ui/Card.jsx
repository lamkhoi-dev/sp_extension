import clsx from 'clsx';

export default function Card({ 
  children, 
  className = '', 
  hover = false,
  glass = false,
  padding = 'md',
  ...props 
}) {
  const paddings = {
    none: '',
    sm: 'p-4',
    md: 'p-6',
    lg: 'p-8',
  };

  return (
    <div
      className={clsx(
        'rounded-xl border',
        'bg-white dark:bg-slate-800/50',
        'border-slate-200 dark:border-slate-700/50',
        hover && 'card-hover cursor-pointer',
        glass && 'glass',
        paddings[padding],
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}
