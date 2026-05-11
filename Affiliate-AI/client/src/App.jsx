import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { ThemeProvider } from './context/ThemeContext';
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

function App() {
  return (
    <ThemeProvider>
      <BrowserRouter>
        <Routes>
          {/* Login page - no layout */}
          <Route path="/login" element={<Login />} />

          {/* Main app with layout */}
          <Route element={<MainLayout />}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/users" element={<UsersPage />} />
            <Route path="/convert-logs" element={<ConvertLogsPage />} />
            <Route path="/orders" element={<OrdersPage />} />
            <Route path="/payouts" element={<PayoutsPage />} />
            <Route path="/reports" element={<ReportsPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/system-history" element={<SystemHistoryPage />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </ThemeProvider>
  );
}

export default App;
