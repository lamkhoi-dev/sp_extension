import { useState, useEffect } from 'react';
import { Download, Calendar, TrendingUp, TrendingDown, Loader2 } from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  Legend,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import Button from '../components/ui/Button';

const COLORS = ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444'];

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
              {typeof entry.value === 'number' ? entry.value.toLocaleString('vi-VN') : entry.value}
            </span>
          </div>
        ))}
      </div>
    );
  }
  return null;
};

export default function ReportsPage() {
  const [dateRange, setDateRange] = useState('30');
  const [reportData, setReportData] = useState({ summary: {}, chartData: [], topProducts: [] });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchReport() {
      setIsLoading(true);
      try {
        const res = await fetch(`/api/reports/dashboard?days=${dateRange}`);
        if (!res.ok) throw new Error('Network error');
        const data = await res.json();
        setReportData(data);
      } catch (err) {
        console.error('Failed to fetch report data', err);
      } finally {
        setIsLoading(false);
      }
    }
    fetchReport();
  }, [dateRange]);

  const handlePrint = () => {
    window.print();
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
      </div>
    );
  }

  const { summary, chartData, topProducts } = reportData;

  const shopeeTotal = summary.totalRevenue || 0;

  const comparisonData = [
    { name: 'Shopee', value: shopeeTotal, percentage: 100 },
  ];

  return (
    <div className="space-y-6 print-area">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
            Báo cáo & Analytics
          </h1>
          <p className="text-slate-500 dark:text-slate-400">
            Phân tích chi tiết hiệu suất affiliate
          </p>
        </div>
        <div className="flex gap-2 no-print">
          <select
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value)}
            className="px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="7">7 ngày qua</option>
            <option value="30">30 ngày qua</option>
            <option value="90">90 ngày qua</option>
          </select>
          <Button variant="outline" icon={Download} onClick={handlePrint}>
            Export PDF
          </Button>
        </div>
      </div>

      {/* Summary Cards - 2 columns on mobile */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-white dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700/50 p-3">
          <p className="text-xs text-slate-500 dark:text-slate-400">Tổng Giá Trị (GMV)</p>
          <p className="text-lg font-bold text-slate-900 dark:text-white mt-0.5">
            {(summary.totalOrderValue || 0).toLocaleString('vi-VN')}đ
          </p>
          <div className="flex items-center gap-1 text-emerald-500 text-xs mt-1">
            <TrendingUp className="w-3 h-3" />
            <span>Tăng trưởng</span>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700/50 p-3">
          <p className="text-xs text-slate-500 dark:text-slate-400">Hoa Hồng Dự Kiến</p>
          <p className="text-lg font-bold text-[#EE4D2D] mt-0.5">
            {(summary.totalRevenue || 0).toLocaleString('vi-VN')}đ
          </p>
          <div className="flex items-center gap-1 text-emerald-500 text-xs mt-1">
            <TrendingUp className="w-3 h-3" />
            <span>Dự kiến</span>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700/50 p-3">
          <p className="text-xs text-slate-500 dark:text-slate-400">Hoa Hồng Đã Nhận</p>
          <p className="text-lg font-bold text-emerald-500 mt-0.5">
            {(summary.receivedCommission || 0).toLocaleString('vi-VN')}đ
          </p>
          <div className="flex items-center gap-1 text-emerald-500 text-xs mt-1">
            <TrendingUp className="w-3 h-3" />
            <span>Đã đối soát</span>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700/50 p-3">
          <p className="text-xs text-slate-500 dark:text-slate-400">Tổng Đơn Hàng</p>
          <p className="text-lg font-bold text-[#00F2EA] mt-0.5">
            {(summary.totalOrders || 0).toLocaleString('vi-VN')}
          </p>
          <div className="flex items-center gap-1 text-slate-400 text-xs mt-1">
            <TrendingUp className="w-3 h-3 text-emerald-500" />
            <span>Chuyển đổi: {summary.conversionRate || 0}%</span>
          </div>
        </div>
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Commission Comparison */}
        <div className="bg-white dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700/50 p-4 sm:p-6">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-6">
            Hoa hồng theo ngày
          </h3>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.3} />
                <XAxis dataKey="date" stroke="#64748b" fontSize={12} />
                <YAxis stroke="#64748b" fontSize={12} tickFormatter={(v) => `${(v / 1000000).toFixed(1)}M`} />
                <Tooltip content={<CustomTooltip />} />
                <Legend />
                <Bar dataKey="commission" name="Shopee" fill="#EE4D2D" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Platform Distribution */}
        <div className="bg-white dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700/50 p-4 sm:p-6">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-6">
            Phân bổ doanh thu
          </h3>
          <div className="h-80 flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={comparisonData}
                  cx="50%"
                  cy="50%"
                  innerRadius={80}
                  outerRadius={120}
                  fill="#8884d8"
                  paddingAngle={5}
                  dataKey="value"
                  label={({ name, percentage }) => `${name}: ${percentage}%`}
                >
                  <Cell fill="#EE4D2D" />
                  <Cell fill="#00F2EA" />
                </Pie>
                <Tooltip content={<CustomTooltip />} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Top Products */}
      <div className="bg-white dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700/50 p-4 sm:p-6"
      >
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
            Top sản phẩm theo doanh thu
          </h3>
          <Button variant="outline" size="sm" icon={Download} onClick={handlePrint} className="no-print">
            Export
          </Button>
        </div>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={topProducts} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.3} horizontal={false} />
              <XAxis type="number" stroke="#64748b" fontSize={12} tickFormatter={(v) => `${(v / 1000000).toFixed(0)}M`} />
              <YAxis type="category" dataKey="name" stroke="#64748b" fontSize={12} width={140} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="revenue" name="Doanh thu" fill="url(#revenueGradient)" radius={[0, 4, 4, 0]} barSize={20} />
              <defs>
                <linearGradient id="revenueGradient" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#3b82f6" />
                  <stop offset="100%" stopColor="#8b5cf6" />
                </linearGradient>
              </defs>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Detailed Table */}
      <div className="bg-white dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700/50 p-4 sm:p-6">
        <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
          Chi tiết sản phẩm
        </h3>
        <div className="-mx-6 sm:mx-0 overflow-x-auto">
          <table className="w-full min-w-[500px]">
            <thead>
              <tr className="text-left text-[10px] sm:text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider border-b border-slate-200 dark:border-slate-700">
                <th className="pb-3 px-3 sm:px-0 sm:pr-4">Sản phẩm</th>
                <th className="pb-3 pr-2 sm:pr-4 whitespace-nowrap">Đơn</th>
                <th className="pb-3 pr-2 sm:pr-4 whitespace-nowrap">Doanh thu</th>
                <th className="pb-3 pr-2 sm:pr-4 whitespace-nowrap">Comm</th>
                <th className="pb-3 px-3 sm:px-0 hidden sm:table-cell">Tỷ lệ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
              {topProducts.map((product, index) => (
                <tr key={index}>
                  <td className="py-2.5 px-3 sm:px-0 sm:pr-4">
                    <span className="font-medium text-slate-900 dark:text-white text-sm">{product.name}</span>
                  </td>
                  <td className="py-2.5 pr-2 sm:pr-4 text-slate-600 dark:text-slate-400 text-sm">{product.sold}</td>
                  <td className="py-2.5 pr-2 sm:pr-4 font-medium text-slate-900 dark:text-white text-sm whitespace-nowrap">
                    {(product.revenue / 1000).toLocaleString('vi-VN')}k
                  </td>
                  <td className="py-2.5 pr-2 sm:pr-4 font-semibold text-emerald-500 text-sm whitespace-nowrap">
                    {(product.commission / 1000).toLocaleString('vi-VN')}k
                  </td>
                  <td className="py-2.5 px-3 sm:px-0 hidden sm:table-cell">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden max-w-[80px]">
                        <div
                          className="h-full bg-gradient-to-r from-blue-500 to-violet-500 rounded-full"
                          style={{ width: `${topProducts.length > 0 ? (product.commission / topProducts[0].commission) * 100 : 0}%` }}
                        />
                      </div>
                      <span className="text-xs text-slate-500">
                        {topProducts.length > 0 ? ((product.commission / topProducts.reduce((s, p) => s + p.commission, 0)) * 100).toFixed(0) : 0}%
                      </span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
