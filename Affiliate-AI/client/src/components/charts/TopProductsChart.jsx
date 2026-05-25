import { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const formatCurrency = (value) => {
  if (value >= 1000000) return (value / 1000000).toFixed(1) + 'M';
  if (value >= 1000) return (value / 1000).toFixed(0) + 'K';
  return value;
};

const CustomTooltip = ({ active, payload }) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-xl">
        <p className="text-sm font-medium text-slate-900 dark:text-white mb-2 max-w-[200px] truncate">{data.name}</p>
        <div className="space-y-1 text-sm">
          <div className="flex justify-between gap-4">
            <span className="text-slate-500">Số lượng:</span>
            <span className="font-medium text-slate-900 dark:text-white">{data.sold}</span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-slate-500">Doanh thu:</span>
            <span className="font-medium text-slate-900 dark:text-white">
              {(data.revenue || 0).toLocaleString('vi-VN')}đ
            </span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-slate-500">Hoa hồng:</span>
            <span className="font-medium text-emerald-500">
              {(data.commission || 0).toLocaleString('vi-VN')}đ
            </span>
          </div>
        </div>
      </div>
    );
  }
  return null;
};

export default function TopProductsChart() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const fetchData = async () => {
      try {
        const res = await fetch('/api/reports/dashboard?days=90', { credentials: 'include' });
        const data = await res.json();
        if (!cancelled) {
          // Truncate long names for chart readability
          const formatted = (data.topProducts || []).map(p => ({
            ...p,
            name: p.name && p.name.length > 20 ? p.name.substring(0, 20) + '…' : (p.name || 'N/A'),
            orders: p.sold || 0,
          }));
          setProducts(formatted);
        }
      } catch (err) {
        console.error('TopProductsChart fetch error:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetchData();
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="bg-white dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700/50 p-6">
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
          Top sản phẩm bán chạy
        </h3>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Theo hoa hồng (90 ngày gần nhất)
        </p>
      </div>

      <div className="h-72">
        {loading ? (
          <div className="flex items-center justify-center h-full text-slate-400 text-sm">Đang tải...</div>
        ) : products.length === 0 ? (
          <div className="flex items-center justify-center h-full text-slate-400 text-sm">Chưa có dữ liệu sản phẩm</div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={products} layout="vertical" margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.3} horizontal={false} />
              <XAxis type="number" stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} tickFormatter={formatCurrency} />
              <YAxis type="category" dataKey="name" stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} width={130} tick={{ fill: '#94a3b8' }} />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(59, 130, 246, 0.1)' }} />
              <Bar dataKey="commission" fill="url(#barGradient)" radius={[0, 4, 4, 0]} barSize={24} />
              <defs>
                <linearGradient id="barGradient" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#3b82f6" />
                  <stop offset="100%" stopColor="#8b5cf6" />
                </linearGradient>
              </defs>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
