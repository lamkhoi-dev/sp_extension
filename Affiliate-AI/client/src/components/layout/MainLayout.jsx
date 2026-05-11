import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';

export default function MainLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <Sidebar
        collapsed={collapsed}
        setCollapsed={setCollapsed}
        mobileOpen={mobileOpen}
        setMobileOpen={setMobileOpen}
      />

      {/* Main content area */}
      <div
        className="min-h-screen flex flex-col transition-all duration-300 ease-in-out"
        style={{ marginLeft: collapsed ? 80 : 260 }}
      >
        {/* Desktop Header */}
        <div
          className="hidden lg:block fixed top-0 right-0 z-30 transition-all duration-300 ease-in-out"
          style={{ left: collapsed ? 80 : 260 }}
        >
          <Header />
        </div>

        {/* Mobile Header */}
        <div className="lg:hidden">
          <Header />
        </div>

        <main className="flex-1 p-4 lg:p-6 lg:mt-16">
          <Outlet />
        </main>
      </div>

      {/* Mobile: Reset margin */}
      <style>{`
        @media (max-width: 1023px) {
          .min-h-screen.flex.flex-col {
            margin-left: 0 !important;
          }
        }
      `}</style>
    </div>
  );
}
