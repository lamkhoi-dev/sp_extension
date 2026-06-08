import { useState } from 'react';
import { ChevronLeft, ChevronRight, Search, Filter } from 'lucide-react';
import clsx from 'clsx';

export default function DataTable({
  columns,
  data,
  searchable = true,
  searchPlaceholder = 'Tìm kiếm...',
  pageSize = 10,
  onRowClick,
  getRowClassName,
  // Server-side pagination props
  serverSide = false,
  totalCount = 0,
  currentPage = 1,
  onPageChange,
  onSearchChange,
  searchValue = '',
}) {
  const [search, setSearch] = useState('');
  const [currentPageState, setCurrentPageState] = useState(1);
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });

  const searchVal = serverSide ? searchValue : search;
  const activePage = serverSide ? currentPage : currentPageState;

  // Filter data based on search
  const filteredData = serverSide
    ? data
    : data.filter((row) =>
        columns.some((col) => {
          const value = row[col.key];
          if (value === null || value === undefined) return false;
          return String(value).toLowerCase().includes(searchVal.toLowerCase());
        })
      );

  // Sort data
  const sortedData = serverSide
    ? filteredData
    : [...filteredData].sort((a, b) => {
        if (!sortConfig.key) return 0;
        const aVal = a[sortConfig.key];
        const bVal = b[sortConfig.key];
        if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });

  // Pagination
  const totalPages = serverSide
    ? Math.ceil(totalCount / pageSize)
    : Math.ceil(sortedData.length / pageSize);
  const startIndex = (activePage - 1) * pageSize;
  const paginatedData = serverSide ? data : sortedData.slice(startIndex, startIndex + pageSize);

  const handleSort = (key) => {
    if (serverSide) return; // Disable client-side sorting in server-side mode
    setSortConfig((prev) => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc',
    }));
  };

  return (
    <div className="w-full">
      {/* Search */}
      {searchable && (
        <div className="mb-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder={searchPlaceholder}
              value={searchVal}
              onChange={(e) => {
                if (serverSide) {
                  onSearchChange?.(e.target.value);
                } else {
                  setSearch(e.target.value);
                  setCurrentPageState(1);
                }
              }}
              className="w-full md:w-80 pl-10 pr-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      )}

      {/* Table - full width on mobile, no padding */}
      <div className="-mx-4 sm:mx-0 overflow-x-auto sm:rounded-xl border-y sm:border border-slate-200 dark:border-slate-700">
        <table className="w-full min-w-[400px]">
          <thead>
            <tr className="bg-slate-50 dark:bg-slate-800/80">
              {columns.map((col) => (
                <th
                  key={col.key}
                  onClick={() => col.sortable !== false && handleSort(col.key)}
                  className={clsx(
                    'px-3 py-2.5 text-left text-[10px] sm:text-xs font-semibold uppercase tracking-wider whitespace-nowrap',
                    'text-slate-600 dark:text-slate-400',
                    col.sortable !== false && 'cursor-pointer hover:text-slate-900 dark:hover:text-white',
                    col.hideOnMobile && 'hidden sm:table-cell'
                  )}
                >
                  <div className="flex items-center gap-1">
                    {col.label}
                    {sortConfig.key === col.key && (
                      <span>{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
            {paginatedData.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length}
                  className="px-3 py-8 text-center text-slate-500"
                >
                  Không có dữ liệu
                </td>
              </tr>
            ) : (
              paginatedData.map((row, idx) => (
                <tr
                  key={row.id || idx}
                  onClick={() => onRowClick?.(row)}
                  className={clsx(
                    getRowClassName?.(row) || 'bg-white dark:bg-slate-800/30',
                    'hover:bg-slate-50 dark:hover:bg-slate-700/50',
                    'transition-colors',
                    onRowClick && 'cursor-pointer',
                  )}
                >
                  {columns.map((col) => (
                    <td
                      key={col.key}
                      className={clsx(
                        'px-3 py-2.5 text-xs sm:text-sm text-slate-700 dark:text-slate-300',
                        col.hideOnMobile && 'hidden sm:table-cell'
                      )}
                    >
                      {col.render ? col.render(row[col.key], row) : row[col.key]}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination - always visible */}
      <div className="flex items-center justify-between mt-4">
        <p className="text-sm text-slate-500">
          Hiển thị {serverSide ? (totalCount === 0 ? 0 : startIndex + 1) : (sortedData.length === 0 ? 0 : startIndex + 1)}–
          {serverSide ? Math.min(startIndex + pageSize, totalCount) : Math.min(startIndex + pageSize, sortedData.length)} / 
          {serverSide ? totalCount : sortedData.length} kết quả
        </p>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              const newPage = Math.max(1, activePage - 1);
              if (serverSide) {
                onPageChange?.(newPage);
              } else {
                setCurrentPageState(newPage);
              }
            }}
            disabled={activePage === 1}
            className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 disabled:opacity-40 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="px-3 py-1 text-sm text-slate-600 dark:text-slate-400">
            {totalPages === 0 ? '0 / 0' : `${activePage} / ${totalPages}`}
          </span>
          <button
            onClick={() => {
              const newPage = Math.min(totalPages, activePage + 1);
              if (serverSide) {
                onPageChange?.(newPage);
              } else {
                setCurrentPageState(newPage);
              }
            }}
            disabled={activePage === totalPages || totalPages === 0}
            className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 disabled:opacity-40 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
