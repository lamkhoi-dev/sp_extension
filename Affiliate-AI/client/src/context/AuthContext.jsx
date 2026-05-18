import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { apiLogin, apiLogout, apiGetMe, apiChangePassword } from '../hooks/useApi';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [admin, setAdmin] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const checkAuth = useCallback(async () => {
    try {
      const data = await apiGetMe();
      setAdmin(data);
    } catch {
      setAdmin(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  const login = async (username, password, remember = false) => {
    setError('');
    try {
      const data = await apiLogin(username, password, remember);
      setAdmin(data);
      return data;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  };

  const logout = async () => {
    await apiLogout();
    setAdmin(null);
  };

  const changePassword = async (oldPw, newPw) => {
    return apiChangePassword(oldPw, newPw);
  };

  return (
    <AuthContext.Provider value={{ admin, loading, error, login, logout, changePassword, checkAuth }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
