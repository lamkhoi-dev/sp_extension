import { useState } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  Area,
  AreaChart
} from 'recharts';
import { dailyCommissionData, monthlyCommissionData, yearlyCommissionData } from '../../data/dummyData';
import clsx from 'clsx';

const formatCurrency = (value) => {
  if (value >= 1000000) {
    return (value / 1000000).toFixed(1) + 'M';
  }
  if (value >= 1000) {
    return (value / 1000).toFixed(0) + 'K';
  }
  return value;
};

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-xl">
        <p className="text-sm font-medium text-slate-900 dark:text-white mb-2">{label}</p>
        {payload.map((entry, index) => (
          <div key={index} className="flex items-center gap-2 text-sm">
            <div
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: entry.color }}
            />
            <span className="text-slate-600 dark:text-slate-400">{entry.name}:</span>
            <span className="font-medium text-slate-900 dark:text-white">
              {entry.value.toLocaleString('vi-VN')}đ
            </span>
          </div>
        ))}
      </div>
    );
  }
  return null;
};

export default function CommissionChart() {
  const [timeRange, setTimeRange] = useState('7days');
  const [selectedYear, setSelectedYear] = useState(null);

  const years = [2024, 2025, 2026];

  const getData = () => {
    if (selectedYear) {
      return yearlyCommissionData[selectedYear] || [];
    }
    return timeRange === '7days' ? dailyCommissionData : monthlyCommissionData;
  };

  const data = getData();

  const handleYearChange = (e) => {
    const year = e.target.value;
    if (year === '') {
      setSelectedYear(null);
    } else {
      setSelectedYear(Number(year));
      setTimeRange(null);
    }
  };

  const handleTimeRangeChange = (range) => {
    setTimeRange(range);
    setSelectedYear(null);
  };

  return (
    <div className="bg-white dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700/50 p-4 sm:p-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <div>
          <h3 className="text-base sm:text-lg font-semibold text-slate-900 dark:text-white">
            Hoa hồng theo thời gian
          </h3>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
            {selectedYear ? `Năm ${selectedYear} - 12 tháng` : 'So sánh Shopee vs TikTok'}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={selectedYear || ''}
            onChange={handleYearChange}
            className={clsx(
              'px-3 py-1.5 text-sm rounded-lg border bg-white dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500',
              selectedYear
                ? 'border-blue-500 text-blue-600 dark:text-blue-400 font-medium'
                : 'border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white'
            )}
          >
            <option value="">Chọn năm</option>
            {years.map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
          <div className="flex gap-1">
            <button
              onClick={() => handleTimeRangeChange('7days')}
              className={clsx(
                'px-3 py-1.5 text-xs sm:text-sm font-medium rounded-lg transition-all',
                timeRange === '7days' && !selectedYear
                  ? 'bg-blue-500 text-white'
                  : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'
              )}
            >
              7 ngày
            </button>
            <button
              onClick={() => handleTimeRangeChange('30days')}
              className={clsx(
                'px-3 py-1.5 text-xs sm:text-sm font-medium rounded-lg transition-all',
                timeRange === '30days' && !selectedYear
                  ? 'bg-blue-500 text-white'
                  : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'
              )}
            >
              30 ngày
            </button>
          </div>
        </div>
      </div>

      <div className="h-80">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="colorShopee" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#EE4D2D" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#EE4D2D" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="colorTiktok" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#00F2EA" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#00F2EA" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.3} />
            <XAxis
              dataKey="date"
              stroke="#64748b"
              fontSize={12}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              stroke="#64748b"
              fontSize={12}
              tickLine={false}
              axisLine={false}
              tickFormatter={formatCurrency}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend
              wrapperStyle={{ paddingTop: '20px' }}
              formatter={(value) => <span className="text-slate-600 dark:text-slate-300">{value}</span>}
            />
            <Area
              type="monotone"
              dataKey="shopee"
              name="Shopee"
              stroke="#EE4D2D"
              strokeWidth={2}
              fillOpacity={1}
              fill="url(#colorShopee)"
            />
            <Area
              type="monotone"
              dataKey="tiktok"
              name="TikTok"
              stroke="#00F2EA"
              strokeWidth={2}
              fillOpacity={1}
              fill="url(#colorTiktok)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
