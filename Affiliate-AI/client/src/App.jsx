import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider } from './context/ThemeContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import MainLayout from './components/layout/MainLayout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import UsersPage from './pages/Users';
import ConvertLogsPage from './pages/ConvertLogs';
import OrdersPage from './pages/Orders';
import PayoutsPage from './pages/Payouts';
import ReportsPage from './pages/Reports';
import SettingsPage from './pages/Settings';
import SystemHistoryPage from './pages/SystemHistory';
import SimulateOrderPage from './pages/SimulateOrder';
import TestReportPage from './pages/TestReport';
import CashFlowPage from './pages/CashFlow';

function ProtectedRoute({ children }) {
  const { admin, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950">
        <div className="animate-spin w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full" />
      </div>
    );
  }
  if (!admin) return <Navigate to="/login" replace />;
  return children;
}

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            {/* Login page - no layout, no auth */}
            <Route path="/login" element={<Login />} />

            {/* Main app with layout — protected */}
            <Route
              element={
                <ProtectedRoute>
                  <MainLayout />
                </ProtectedRoute>
              }
            >
              <Route path="/" element={<Dashboard />} />
              <Route path="/users" element={<UsersPage />} />
              <Route path="/convert-logs" element={<ConvertLogsPage />} />
              <Route path="/orders" element={<OrdersPage />} />
              <Route path="/payouts" element={<PayoutsPage />} />
              <Route path="/reports" element={<ReportsPage />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="/system-history" element={<SystemHistoryPage />} />
              <Route path="/simulate" element={<SimulateOrderPage />} />
              <Route path="/test-report" element={<TestReportPage />} />
              <Route path="/cash-flow" element={<CashFlowPage />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
