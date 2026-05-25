import { useState, useEffect } from 'react';
import {
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Area, AreaChart
} from 'recharts';
import clsx from 'clsx';

const formatCurrency = (value) => {
  if (value >= 1000000) return (value / 1000000).toFixed(1) + 'M';
  if (value >= 1000) return (value / 1000).toFixed(0) + 'K';
  return value;
};

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-xl">
        <p className="text-sm font-medium text-slate-900 dark:text-white mb-2">{label}</p>
        {payload.map((entry, index) => (
          <div key={index} className="flex items-center gap-2 text-sm">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: entry.color }} />
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
  const [timeRange, setTimeRange] = useState(30);
  const [chartData, setChartData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const fetchData = async () => {
      try {
        setLoading(true);
        const res = await fetch(`/api/reports/dashboard?days=${timeRange}`, { credentials: 'include' });
        const data = await res.json();
        if (!cancelled) {
          // Format date labels: "2026-05-20" → "20/05"
          const formatted = (data.chartData || []).map(d => ({
            ...d,
            commission: Number(d.commission || 0),
          }));
          setChartData(formatted);
        }
      } catch (err) {
        console.error('CommissionChart fetch error:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetchData();
    return () => { cancelled = true; };
  }, [timeRange]);

  const totalCommission = chartData.reduce((s, d) => s + d.commission, 0);

  return (
    <div className="bg-white dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700/50 p-4 sm:p-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <div>
          <h3 className="text-base sm:text-lg font-semibold text-slate-900 dark:text-white">
            Hoa hồng theo thời gian
          </h3>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
            Tổng: {totalCommission.toLocaleString('vi-VN')}đ ({timeRange} ngày gần nhất)
          </p>
        </div>
        <div className="flex gap-1">
          {[7, 14, 30, 90].map(d => (
            <button
              key={d}
              onClick={() => setTimeRange(d)}
              className={clsx(
                'px-3 py-1.5 text-xs sm:text-sm font-medium rounded-lg transition-all',
                timeRange === d
                  ? 'bg-blue-500 text-white'
                  : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'
              )}
            >
              {d}d
            </button>
          ))}
        </div>
      </div>

      <div className="h-80">
        {loading ? (
          <div className="flex items-center justify-center h-full text-slate-400 text-sm">Đang tải...</div>
        ) : chartData.length === 0 ? (
          <div className="flex items-center justify-center h-full text-slate-400 text-sm">Chưa có dữ liệu</div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="colorCommission" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#EE4D2D" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#EE4D2D" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.3} />
              <XAxis dataKey="date" stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
              <YAxis stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} tickFormatter={formatCurrency} />
              <Tooltip content={<CustomTooltip />} />
              <Area
                type="monotone"
                dataKey="commission"
                name="Hoa hồng"
                stroke="#EE4D2D"
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#colorCommission)"
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
