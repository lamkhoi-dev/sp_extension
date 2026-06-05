import { NavLink, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard,
  Users,
  Link2,
  ShoppingCart,
  Wallet,
  BarChart3,
  Settings,
  History,
  ChevronLeft,
  ChevronRight,
  Zap,
  Menu,
  X,
  FlaskConical,
  FileSearch
} from 'lucide-react';
import clsx from 'clsx';

const menuItems = [
  { path: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { path: '/users', icon: Users, label: 'Quản lý User' },
  { path: '/convert-logs', icon: Link2, label: 'Lịch sử Convert' },
  { path: '/orders', icon: ShoppingCart, label: 'Đơn hàng' },
  { path: '/payouts', icon: Wallet, label: 'Hoàn tiền' },
  { path: '/reports', icon: BarChart3, label: 'Báo cáo' },
  { path: '/system-history', icon: History, label: 'Lịch sử hệ thống' },
  { path: '/settings', icon: Settings, label: 'Cài đặt' },
  { path: '/simulate', icon: FlaskConical, label: 'Mô phỏng Đơn' },
  { path: '/test-report', icon: FileSearch, label: 'Test /thongke' },
];

function SidebarContent({ isMobile, collapsed, setCollapsed, setMobileOpen, location }) {
  return (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 py-6 border-b border-slate-200 dark:border-slate-700/50">
        <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-accent shadow-accent">
          <Zap className="h-6 w-6 text-white" />
        </div>
        <AnimatePresence>
          {(!collapsed || isMobile) && (
            <motion.div
              initial={{ opacity: 0, width: 0 }}
              animate={{ opacity: 1, width: 'auto' }}
              exit={{ opacity: 0, width: 0 }}
              className="overflow-hidden"
            >
              <h1 className="text-lg font-bold gradient-text whitespace-nowrap">
                Affiliate AI
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">
                Admin Dashboard
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {menuItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <NavLink
              key={item.path}
              to={item.path}
              onClick={() => isMobile && setMobileOpen(false)}
              className={clsx(
                'flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200',
                'group relative',
                isActive
                  ? 'sidebar-active text-accent'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700/50 hover:text-slate-900 dark:hover:text-white'
              )}
            >
              {isActive && (
                <motion.div
                  layoutId={isMobile ? 'activeIndicatorMobile' : 'activeIndicator'}
                  className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 sidebar-active-indicator rounded-r-full"
                />
              )}
              <item.icon className={clsx('h-5 w-5 flex-shrink-0', isActive && 'text-accent')} />
              <AnimatePresence>
                {(!collapsed || isMobile) && (
                  <motion.span
                    initial={{ opacity: 0, width: 0 }}
                    animate={{ opacity: 1, width: 'auto' }}
                    exit={{ opacity: 0, width: 0 }}
                    className="font-medium whitespace-nowrap overflow-hidden"
                  >
                    {item.label}
                  </motion.span>
                )}
              </AnimatePresence>

              {/* Tooltip for collapsed state */}
              {collapsed && !isMobile && (
                <div className="absolute left-full ml-2 px-2 py-1 bg-slate-800 text-white text-sm rounded-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all whitespace-nowrap z-50">
                  {item.label}
                </div>
              )}
            </NavLink>
          );
        })}
      </nav>

      {/* Collapse button - Desktop only */}
      {!isMobile && (
        <div className="px-3 py-4 border-t border-slate-200 dark:border-slate-700/50">
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="flex items-center justify-center w-full gap-2 px-3 py-2 rounded-xl text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700/50 hover:text-slate-700 dark:hover:text-slate-300 transition-colors"
          >
            {collapsed ? (
              <ChevronRight className="h-5 w-5" />
            ) : (
              <>
                <ChevronLeft className="h-5 w-5" />
                <span className="text-sm font-medium">Thu gọn</span>
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}

export default function Sidebar({ collapsed, setCollapsed, mobileOpen, setMobileOpen }) {
  const location = useLocation();

  return (
    <>
      {/* Desktop Sidebar */}
      <motion.aside
        initial={false}
        animate={{ width: collapsed ? 80 : 260 }}
        transition={{ duration: 0.3, ease: 'easeInOut' }}
        className="hidden lg:flex flex-col fixed left-0 top-0 h-screen bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-700/50 z-40"
      >
        <SidebarContent
          isMobile={false}
          collapsed={collapsed}
          setCollapsed={setCollapsed}
          setMobileOpen={setMobileOpen}
          location={location}
        />
      </motion.aside>

      {/* Mobile Menu Button */}
      <button
        onClick={() => setMobileOpen(true)}
        className="lg:hidden fixed top-4 left-4 z-50 p-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-lg"
      >
        <Menu className="h-6 w-6 text-slate-700 dark:text-slate-300" />
      </button>

      {/* Mobile Sidebar Overlay */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMobileOpen(false)}
              className="lg:hidden fixed inset-0 bg-black/50 backdrop-blur-sm z-40"
            />
            <motion.aside
              initial={{ x: -280 }}
              animate={{ x: 0 }}
              exit={{ x: -280 }}
              transition={{ duration: 0.3, ease: 'easeInOut' }}
              className="lg:hidden fixed left-0 top-0 h-screen w-[280px] bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-700/50 z-50"
            >
              <button
                onClick={() => setMobileOpen(false)}
                className="absolute top-4 right-4 p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700"
              >
                <X className="h-5 w-5 text-slate-500" />
              </button>
              <SidebarContent
                isMobile={true}
                collapsed={false}
                setCollapsed={setCollapsed}
                setMobileOpen={setMobileOpen}
                location={location}
              />
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
