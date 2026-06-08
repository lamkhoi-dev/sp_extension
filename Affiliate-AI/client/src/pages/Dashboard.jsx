import { useState, useEffect, useCallback } from 'react';
import {
  DollarSign, Users, ShoppingCart, TrendingUp, Percent, BarChart3,
  RefreshCw, Wifi, WifiOff, MessageSquare, Link2, Server, AlertTriangle
} from 'lucide-react';
import KPICard from '../components/ui/KPICard';
import Tooltip from '../components/ui/Tooltip';
import CommissionChart from '../components/charts/CommissionChart';
import PlatformPieChart from '../components/charts/PlatformPieChart';
import TopProductsChart from '../components/charts/TopProductsChart';
import Badge from '../components/ui/Badge';
import { useDashboardStats, formatShortVND, formatVND } from '../hooks/useApi';

export default function Dashboard() {
  const { stats, loading, refresh } = useDashboardStats(15000);

  // VPS expiry banner
  const [vpsDays, setVpsDays] = useState(null);
  const [vpsExpired, setVpsExpired] = useState(false);
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/settings/vps');
        if (!res.ok) return;
        const data = await res.json();
        if (!data.expiryDate) return;
        const diff = new Date(data.expiryDate + 'T23:59:59') - new Date();
        if (diff <= 0) { setVpsExpired(true); setVpsDays(0); }
        else { setVpsDays(Math.ceil(diff / 86400000)); }
      } catch (e) { /* ignore */ }
    })();
  }, []);

  if (loading || !stats) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="text-center">
          <RefreshCw className="w-8 h-8 text-blue-500 animate-spin mx-auto mb-3" />
          <p className="text-slate-500">Đang tải dữ liệu...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Dashboard</h1>
          <p className="text-slate-500 dark:text-slate-400">
            Tổng quan hệ thống Affiliate Marketing
          </p>
        </div>
        <div className="flex items-center gap-3 text-sm">
          {/* Extension Status */}
          <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium
            ${stats.extension?.connected
              ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
              : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
            }`}
          >
            {stats.extension?.connected ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
            Extension
          </div>
          <button onClick={refresh}
            className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 hover:text-blue-500 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* VPS Expiry Banner */}
      {(vpsDays !== null && vpsDays <= 30) && (
        <a href="/settings" className={`flex items-center gap-3 p-3 rounded-xl border transition-colors no-underline ${
          vpsExpired || vpsDays <= 7
            ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 hover:bg-red-100 dark:hover:bg-red-900/30'
            : 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800 hover:bg-amber-100 dark:hover:bg-amber-900/30'
        }`}>
          <div className={`p-1.5 rounded-lg ${
            vpsExpired || vpsDays <= 7 ? 'bg-red-100 dark:bg-red-900/40' : 'bg-amber-100 dark:bg-amber-900/40'
          }`}>
            {vpsExpired || vpsDays <= 7
              ? <AlertTriangle className="w-4 h-4 text-red-500" />
              : <Server className="w-4 h-4 text-amber-500" />
            }
          </div>
          <div className="flex-1 min-w-0">
            <p className={`text-sm font-semibold ${
              vpsExpired || vpsDays <= 7 ? 'text-red-700 dark:text-red-400' : 'text-amber-700 dark:text-amber-400'
            }`}>
              {vpsExpired ? '⚠️ VPS đã hết hạn!' : `VPS còn ${vpsDays} ngày`}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400">Bấm để xem chi tiết & gia hạn</p>
          </div>
          <span className={`text-xs font-medium px-2 py-1 rounded-full ${
            vpsExpired || vpsDays <= 7
              ? 'bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400'
              : 'bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400'
          }`}>
            {vpsExpired ? 'Hết hạn' : `${vpsDays} ngày`}
          </span>
        </a>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3 sm:gap-4">
        <KPICard
          title="Tổng hoa hồng"
          value={formatVND(stats.orders?.totalEstimatedCommission || 0)}
          icon={DollarSign}
          iconBg="bg-gradient-to-br from-emerald-500 to-emerald-600"
          tooltip="Tổng net_commission từ tất cả đơn không huỷ. Bao gồm cả XTRA Comm."
          delay={0}
        />
        <KPICard
          title="Lợi nhuận Admin"
          value={formatVND(stats.admin?.adminProfit || 0)}
          subtitle={`${stats.admin?.profitPercent || 0}% tổng HH`}
          icon={Percent}
          iconBg="bg-gradient-to-br from-amber-500 to-orange-500"
          tooltip="Phần admin thực nhận sau khi chia hết cho user theo chuỗi F0→F1→F2→F3. Đơn không có đủ chain (thiếu F1/F2/F3) thì admin giữ thêm phần đó."
          delay={0.1}
        />
        <KPICard
          title="Users"
          value={stats.users?.total || 0}
          icon={Users}
          iconBg="bg-gradient-to-br from-blue-500 to-blue-600"
          tooltip="Tổng số người dùng đã đăng ký trong hệ thống."
          delay={0.2}
        />
        <KPICard
          title="Đơn hàng"
          value={stats.orders?.uniqueOrders || 0}
          icon={ShoppingCart}
          iconBg="bg-gradient-to-br from-teal-500 to-cyan-600"
          tooltip="Số đơn hàng duy nhất (không trùng mã đơn). Một đơn nhiều sản phẩm chỉ đếm 1 lần."
          delay={0.3}
        />
        <KPICard
          title="Convert hôm nay"
          value={`${stats.converts?.todaySuccess || 0}/${stats.converts?.today || 0}`}
          icon={Link2}
          iconBg="bg-gradient-to-br from-rose-500 to-pink-600"
          tooltip="Số link chuyển đổi thành công / tổng link đã chuyển đổi trong hôm nay."
          delay={0.4}
        />
        <KPICard
          title="GMV"
          value={formatVND(stats.orders?.totalValue || 0)}
          icon={BarChart3}
          iconBg="bg-gradient-to-br from-cyan-500 to-blue-600"
          tooltip="Tổng giá trị hàng hóa đã bán (trước khi trừ phí, hoa hồng). Cộng dồn giá trị mỗi đơn hàng."
          delay={0.5}
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <CommissionChart />
        </div>
        <div>
          <PlatformPieChart />
        </div>
      </div>

      {/* Bottom Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Quick Stats */}
        <div className="bg-white dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700/50 p-4 sm:p-6">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
            Thống kê nhanh
          </h3>
          <div className="space-y-3">
            <StatRow label="Tổng convert" value={stats.converts?.total || 0} icon={Link2}
              tooltip="Tổng số lần chuyển đổi link Shopee thành link affiliate (bao gồm cả lỗi)." />
            <StatRow label="Convert thành công" value={stats.converts?.success || 0} icon={TrendingUp} color="text-emerald-500"
              tooltip="Số link đã chuyển đổi thành công, tạo được link affiliate hợp lệ." />
            <StatRow label="Convert lỗi" value={stats.converts?.failed || 0} icon={TrendingUp} color="text-red-500"
              tooltip="Số link chuyển đổi thất bại (sản phẩm không hoa hồng, link lỗi...)." />
            <StatRow label="Users convert" value={stats.converts?.uniqueUsers || 0} icon={Users}
              tooltip="Số người dùng khác nhau đã từng chuyển đổi ít nhất 1 link." />
            <StatRow label="Shops bán hàng" value={stats.orders?.uniqueShops || 0} icon={ShoppingCart}
              tooltip="Số shop Shopee khác nhau có đơn hàng phát sinh qua hệ thống." />
            <StatRow label="Tin nhắn hôm nay" value={stats.messages?.today || 0} icon={MessageSquare}
              tooltip="Số tin nhắn Zalo Bot nhận và xử lý trong ngày hôm nay." />
          </div>
        </div>

        {/* System Status */}
        <div className="bg-white dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700/50 p-4 sm:p-6">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
            Trạng thái hệ thống
          </h3>
          <div className="space-y-4">
            <StatusItem
              label="Chrome Extension"
              connected={stats.extension?.connected}
              detail={stats.extension?.lastSeen ? `Lần cuối: ${new Date(stats.extension.lastSeen).toLocaleTimeString('vi-VN')}` : ''}
            />
            <StatusItem
              label="Zalo Bot"
              connected={stats.zalo?.isLoggedIn}
              detail={stats.zalo?.displayName || ''}
            />
            <div className="pt-3 border-t border-slate-100 dark:border-slate-700">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-slate-500">Tổng tin nhắn</p>
                  <p className="font-semibold text-slate-900 dark:text-white">{stats.messages?.total || 0}</p>
                </div>
                <div>
                  <p className="text-slate-500">Tỷ lệ HH TB</p>
                  <p className="font-semibold text-slate-900 dark:text-white">
                    {(stats.converts?.avgRate || 0).toFixed(1)}%
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Top Products Chart */}
      <TopProductsChart />
    </div>
  );
}

function StatRow({ label, value, icon: Icon, color = '', tooltip = '' }) {
  return (
    <div className="flex items-center justify-between py-1.5">
      <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400 text-sm">
        <Icon className="w-4 h-4" />
        <span>{label}</span>
        {tooltip && <Tooltip text={tooltip} />}
      </div>
      <span className={`font-semibold text-sm ${color || 'text-slate-900 dark:text-white'}`}>
        {typeof value === 'number' ? value.toLocaleString('vi-VN') : value}
      </span>
    </div>
  );
}

function StatusItem({ label, connected, detail }) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <div className={`w-2.5 h-2.5 rounded-full ${connected ? 'bg-emerald-500' : 'bg-red-500'}`} />
        <span className="text-sm font-medium text-slate-900 dark:text-white">{label}</span>
      </div>
      <div className="text-right">
        <Badge variant={connected ? 'success' : 'danger'} dot>
          {connected ? 'Online' : 'Offline'}
        </Badge>
        {detail && <p className="text-[10px] text-slate-400 mt-0.5">{detail}</p>}
      </div>
    </div>
  );
}
