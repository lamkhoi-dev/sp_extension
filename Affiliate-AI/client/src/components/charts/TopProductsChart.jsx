import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { topProducts } from '../../data/dummyData';

const CustomTooltip = ({ active, payload }) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-xl">
        <p className="text-sm font-medium text-slate-900 dark:text-white mb-2">{data.name}</p>
        <div className="space-y-1 text-sm">
          <div className="flex justify-between gap-4">
            <span className="text-slate-500">Số đơn:</span>
            <span className="font-medium text-slate-900 dark:text-white">{data.orders}</span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-slate-500">Doanh thu:</span>
            <span className="font-medium text-slate-900 dark:text-white">
              {data.revenue.toLocaleString('vi-VN')}đ
            </span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-slate-500">Hoa hồng:</span>
            <span className="font-medium text-emerald-500">
              {data.commission.toLocaleString('vi-VN')}đ
            </span>
          </div>
        </div>
      </div>
    );
  }
  return null;
};

export default function TopProductsChart() {
  return (
    <div className="bg-white dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700/50 p-6">
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
          Top sản phẩm bán chạy
        </h3>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Theo số lượng đơn hàng
        </p>
      </div>

      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={topProducts}
            layout="vertical"
            margin={{ top: 0, right: 0, left: 0, bottom: 0 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.3} horizontal={false} />
            <XAxis
              type="number"
              stroke="#64748b"
              fontSize={12}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              type="category"
              dataKey="name"
              stroke="#64748b"
              fontSize={12}
              tickLine={false}
              axisLine={false}
              width={120}
              tick={{ fill: '#94a3b8' }}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(59, 130, 246, 0.1)' }} />
            <Bar
              dataKey="orders"
              fill="url(#barGradient)"
              radius={[0, 4, 4, 0]}
              barSize={24}
            />
            <defs>
              <linearGradient id="barGradient" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#3b82f6" />
                <stop offset="100%" stopColor="#8b5cf6" />
              </linearGradient>
            </defs>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
