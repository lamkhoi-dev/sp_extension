import { useState, useEffect, useCallback } from 'react';

const API_BASE = '/api';

async function apiFetch(url, options = {}) {
  const res = await fetch(`${API_BASE}${url}`, {
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    ...options,
  });
  if (res.status === 401) {
    if (!window.location.pathname.includes('/login')) {
      window.location.href = '/login';
    }
    throw new Error('Unauthorized');
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return res.json();
}

// Auth helpers
export async function apiLogin(username, password, remember = false) {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ username, password, remember }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Login failed');
  return data;
}

export async function apiLogout() {
  await fetch(`${API_BASE}/auth/logout`, {
    method: 'POST',
    credentials: 'include',
  });
}

export async function apiGetMe() {
  return apiFetch('/auth/me');
}

export async function apiChangePassword(oldPassword, newPassword) {
  return apiFetch('/auth/change-password', {
    method: 'PATCH',
    body: JSON.stringify({ oldPassword, newPassword }),
  });
}

// Dashboard stats
export function useDashboardStats(refreshInterval = 30000) {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const data = await apiFetch('/dashboard-stats');
      setStats(data);
    } catch (err) {
      console.error('Dashboard stats error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    const timer = setInterval(refresh, refreshInterval);
    return () => clearInterval(timer);
  }, [refresh, refreshInterval]);

  return { stats, loading, refresh };
}

// Dashboard reports (charts)
export function useDashboardReports(days = 30) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchReports = useCallback(async () => {
    setLoading(true);
    try {
      const result = await apiFetch(`/reports/dashboard?days=${days}`);
      setData(result);
    } catch (err) {
      console.error('Dashboard reports error:', err);
    } finally {
      setLoading(false);
    }
  }, [days]);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  return { data, loading, refresh: fetchReports };
}

// Users
export function useUsers() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const fetch_ = useCallback(async (query = '') => {
    setLoading(true);
    try {
      const params = query ? `?search=${encodeURIComponent(query)}&limit=100` : '?limit=100';
      const data = await apiFetch(`/users${params}`);
      setUsers(data);
    } catch (err) {
      console.error('Users fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetch_(search); }, [fetch_, search]);

  return { users, loading, search, setSearch, refresh: () => fetch_(search) };
}

// Convert Logs
export function useConvertLogs() {
  const [logs, setLogs] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  // Immediate input values (typed by user)
  const [productInput, setProductInput] = useState('');
  const [userInput, setUserInput] = useState('');

  // Debounced values sent to API
  const [product, setProduct] = useState('');
  const [userName, setUserName] = useState('');

  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [totalCount, setTotalCount] = useState(0);

  useEffect(() => {
    const t = setTimeout(() => { setProduct(productInput); setCurrentPage(1); }, 400);
    return () => clearTimeout(t);
  }, [productInput]);

  useEffect(() => {
    const t = setTimeout(() => { setUserName(userInput); setCurrentPage(1); }, 400);
    return () => clearTimeout(t);
  }, [userInput]);

  const fetchLogs = useCallback(async (page, size, prod = '', usr = '') => {
    setLoading(true);
    try {
      const offset = (page - 1) * size;
      const params = new URLSearchParams({ limit: String(size), offset: String(offset) });
      if (prod) params.set('product', prod);
      if (usr) params.set('user', usr);
      const [logsResponse, statsData] = await Promise.all([
        apiFetch(`/convert-logs?${params}`),
        apiFetch('/convert-logs/stats'),
      ]);
      setLogs(logsResponse.logs || []);
      setTotalCount(logsResponse.total || 0);
      setStats(statsData);
    } catch (err) {
      console.error('Convert logs error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLogs(currentPage, pageSize, product, userName);
  }, [fetchLogs, currentPage, pageSize, product, userName]);

  return {
    logs,
    stats,
    loading,
    productInput,
    setProductInput,
    userInput,
    setUserInput,
    currentPage,
    setCurrentPage,
    pageSize,
    setPageSize,
    totalCount,
    refresh: () => fetchLogs(currentPage, pageSize, product, userName),
  };
}

// Click Events for redirect analytics
export function useClickEvents() {
  const [clicks, setClicks] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);

  const fetchClicks = useCallback(async (token) => {
    if (!token) return;
    setLoading(true);
    try {
      const data = await apiFetch(`/redirect-clicks/${encodeURIComponent(token)}`);
      setClicks(data.clicks || []);
      setTotal(data.total || 0);
    } catch (err) {
      console.error('Click events error:', err);
      setClicks([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, []);

  return { clicks, total, loading, fetchClicks, reset: () => { setClicks([]); setTotal(0); } };
}

// Orders
export function useOrders() {
  const [orders, setOrders] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState(null);
  const [filterOptions, setFilterOptions] = useState({
    shopTypes: [], commissionTypes: [], channels: [], statuses: [],
  });

  // Multi-filter state
  const [filters, setFilters] = useState({
    timeField: 'order_time',
    dateFrom: '',
    dateTo: '',
    status: 'Tất cả',
    orderId: '',
    shopName: '',
    shopType: 'Tất cả',
    productName: '',
    commissionType: 'Tất cả',
    channel: 'Tất cả',
    userId: '',
  });

  const buildQueryParams = useCallback((f) => {
    const params = new URLSearchParams();
    params.set('limit', '200');
    if (f.timeField && f.timeField !== 'order_time') params.set('timeField', f.timeField);
    if (f.dateFrom) params.set('dateFrom', f.dateFrom);
    if (f.dateTo) params.set('dateTo', f.dateTo);
    if (f.status && f.status !== 'Tất cả') params.set('status', f.status);
    if (f.orderId) params.set('orderId', f.orderId);
    if (f.shopName) params.set('shopName', f.shopName);
    if (f.shopType && f.shopType !== 'Tất cả') params.set('shopType', f.shopType);
    if (f.productName) params.set('productName', f.productName);
    if (f.commissionType && f.commissionType !== 'Tất cả') params.set('commissionType', f.commissionType);
    if (f.channel && f.channel !== 'Tất cả') params.set('channel', f.channel);
    if (f.userId) params.set('userId', f.userId);
    return params.toString();
  }, []);

  const fetchOrders = useCallback(async (f) => {
    setLoading(true);
    try {
      const qs = buildQueryParams(f);
      const [ordersData, statsData] = await Promise.all([
        apiFetch(`/orders?${qs}`),
        apiFetch(`/orders/stats?${qs}`),  // sync stats with active filter
      ]);
      setOrders(ordersData);
      setStats(statsData);
    } catch (err) {
      console.error('Orders fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [buildQueryParams]);

  const fetchFilterOptions = useCallback(async () => {
    try {
      const opts = await apiFetch('/orders/filter-options');
      setFilterOptions(opts);
    } catch (err) {
      console.error('Filter options error:', err);
    }
  }, []);

  const syncOrders = useCallback(async () => {
    setSyncing(true);
    setSyncResult(null);
    try {
      const result = await apiFetch('/orders/sync', {
        method: 'POST',
        body: JSON.stringify({}),
      });
      setSyncResult(result);
      await fetchOrders(filters);
      await fetchFilterOptions();
    } catch (err) {
      setSyncResult({ success: false, error: err.message });
    } finally {
      setSyncing(false);
    }
  }, [fetchOrders, fetchFilterOptions, filters]);

  const importCSV = useCallback(async (csvText) => {
    setSyncing(true);
    setSyncResult(null);
    try {
      const result = await apiFetch('/orders/import-csv', {
        method: 'POST',
        body: JSON.stringify({ csv: csvText }),
      });
      setSyncResult(result);
      await fetchOrders(filters);
      await fetchFilterOptions();
    } catch (err) {
      setSyncResult({ success: false, error: err.message });
    } finally {
      setSyncing(false);
    }
  }, [fetchOrders, fetchFilterOptions, filters]);

  // Initial load
  useEffect(() => {
    fetchOrders(filters);
    fetchFilterOptions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const applyFilters = useCallback(() => {
    fetchOrders(filters);
  }, [fetchOrders, filters]);

  const resetFilters = useCallback(() => {
    const defaults = {
      timeField: 'order_time', dateFrom: '', dateTo: '',
      status: 'Tất cả', orderId: '', shopName: '',
      shopType: 'Tất cả', productName: '',
      commissionType: 'Tất cả', channel: 'Tất cả',
    };
    setFilters(defaults);
    fetchOrders(defaults);
  }, [fetchOrders]);

  return {
    orders, stats, loading, filters, setFilters, filterOptions,
    syncing, syncResult, syncOrders, importCSV,
    applyFilters, resetFilters,
    refresh: () => fetchOrders(filters),
  };
}

// Format VND currency
export function formatVND(value) {
  if (!value && value !== 0) return '--';
  return new Intl.NumberFormat('vi-VN').format(Math.round(value)) + 'đ';
}

export function formatShortVND(value) {
  if (!value && value !== 0) return '--';
  if (value >= 1000000) return (value / 1000000).toFixed(1) + 'M';
  if (value >= 1000) return (value / 1000).toFixed(0) + 'K';
  return value.toFixed(0) + 'đ';
}

// Payouts
export function usePayouts() {
  const [summary, setSummary] = useState({ users: [] });
  const [history, setHistory] = useState([]);
  const [withdrawalRequests, setWithdrawalRequests] = useState([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [summaryData, historyData, withdrawalData] = await Promise.all([
        apiFetch('/payouts/summary'),
        apiFetch('/payouts/history?limit=100'),
        apiFetch('/withdrawal-requests?status=pending').catch(() => ({ requests: [] })),
      ]);
      setSummary(summaryData);
      setHistory(historyData);
      setWithdrawalRequests(withdrawalData.requests || []);
    } catch (err) {
      console.error('Payouts fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const getUserDetail = useCallback(async (userId) => {
    return apiFetch(`/payouts/user/${userId}`);
  }, []);

  const createPayout = useCallback(async (data) => {
    const result = await apiFetch('/payouts/create', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    await refresh();
    return result;
  }, [refresh]);

  const uploadBill = useCallback(async (payoutId, file) => {
    const formData = new FormData();
    formData.append('bill', file);
    if (payoutId) formData.append('payoutId', String(payoutId));
    const res = await fetch(`${API_BASE}/payouts/upload-bill`, {
      method: 'POST',
      body: formData,
    });
    return res.json();
  }, []);

  const markWithdrawalDone = useCallback(async (requestId, status, adminNote = '') => {
    await apiFetch(`/withdrawal-requests/${requestId}`, {
      method: 'PATCH',
      body: JSON.stringify({ status, adminNote }),
    });
    await refresh();
  }, [refresh]);

  return { summary, history, withdrawalRequests, loading, refresh, getUserDetail, createPayout, uploadBill, markWithdrawalDone };
}

// Update user cashback rates
export async function updateUserCashbackRates(userId, buyerRate, referrerEarnRate, customRate) {
  return apiFetch(`/users/${userId}/cashback-rates`, {
    method: 'PATCH',
    body: JSON.stringify({ buyerRate, referrerEarnRate, customRate }),
  });
}

// Update user commission mode (normal/custom) and custom rate
export async function updateUserCommissionMode(userId, commissionMode, customRate) {
  return apiFetch(`/users/${userId}/commission-mode`, {
    method: 'PATCH',
    body: JSON.stringify({ commissionMode, customRate }),
  });
}

// Update user bank info (generates VietQR on server side)
export async function updateUserBankInfo(userId, bankName, bankAccount) {
  return apiFetch(`/users/${userId}/bank-info`, {
    method: 'PATCH',
    body: JSON.stringify({ bankName, bankAccount }),
  });
}

// Upload custom QR image (base64 data URL) for special banks
export async function updateUserCustomQr(userId, customQr) {
  return apiFetch(`/users/${userId}/custom-qr`, {
    method: 'PATCH',
    body: JSON.stringify({ customQr }),
  });
}

// Product Images — batch lookup with local cache
const imgCache = {};

export function useProductImages(itemIds) {
  const [imgMap, setImgMap] = useState({});

  useEffect(() => {
    if (!itemIds || itemIds.length === 0) return;

    // Filter to only uncached IDs
    const uncached = [...new Set(itemIds)].filter(id => id && !imgCache[id]);

    if (uncached.length === 0) {
      // All cached already
      const result = {};
      for (const id of itemIds) {
        if (id && imgCache[id]) result[id] = imgCache[id];
      }
      setImgMap(result);
      return;
    }

    apiFetch('/product-images/batch', {
      method: 'POST',
      body: JSON.stringify({ itemIds: uncached }),
    }).then(map => {
      // Merge into local cache
      for (const [k, v] of Object.entries(map)) {
        imgCache[k] = v;
      }
      // Build full result from cache
      const result = {};
      for (const id of itemIds) {
        if (id && imgCache[id]) result[id] = imgCache[id];
      }
      setImgMap(result);
    }).catch(() => {});
  }, [itemIds?.join(',')]);

  return imgMap;
}

// Trigger manual image fetch
export async function triggerProductImageFetch() {
  return apiFetch('/product-images/fetch', { method: 'POST' });
}

// Audit Logs
export function useAuditLogs() {
  const [logs, setLogs] = useState([]);
  const [stats, setStats] = useState([]);
  const [admins, setAdmins] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  
  const [filters, setFilters] = useState({
    action: '',
    admin: '',
    dateFrom: '',
    dateTo: '',
    limit: 50,
  });

  const loadData = useCallback(async (reset = false) => {
    try {
      const isInitial = reset || logs.length === 0;
      if (isInitial) setLoading(true);
      else setLoadingMore(true);

      const offset = reset ? 0 : logs.length;
      const queryParams = new URLSearchParams({
        limit: filters.limit,
        offset: offset,
      });

      if (filters.action) queryParams.append('action', filters.action);
      if (filters.admin) queryParams.append('admin', filters.admin);
      if (filters.dateFrom) queryParams.append('dateFrom', filters.dateFrom);
      if (filters.dateTo) queryParams.append('dateTo', filters.dateTo);

      const data = await apiFetch(`/audit-logs?${queryParams.toString()}`);
      
      setLogs(prev => reset ? data.logs : [...prev, ...data.logs]);
      setHasMore(data.hasMore);

      if (isInitial) {
        const statsData = await apiFetch('/audit-logs/stats');
        setStats(statsData.stats || []);
        
        const adminsData = await apiFetch('/audit-logs/admins');
        setAdmins(adminsData.admins || []);
      }
    } catch (err) {
      console.error('Audit logs fetch error:', err);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [filters, logs.length]);

  useEffect(() => {
    loadData(true);
  }, [loadData]);

  const loadMore = () => {
    if (!loading && !loadingMore && hasMore) {
      loadData(false);
    }
  };

  return { logs, stats, admins, loading, loadingMore, hasMore, filters, setFilters, loadMore };
}

// Commission Rates (F0-F3 + Admin) — global config from Settings
export const COMMISSION_RATE_DEFAULTS = { admin: 30, f0: 40, f1: 20, f2: 7, f3: 3 };

export function useCommissionRates() {
  const [rates, setRates] = useState(COMMISSION_RATE_DEFAULTS);
  const [defaults, setDefaults] = useState(COMMISSION_RATE_DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const data = await apiFetch('/settings/commission-rates');
      if (data?.rates) setRates(data.rates);
      if (data?.defaults) setDefaults(data.defaults);
      setError('');
    } catch (err) {
      console.error('Commission rates fetch error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const save = useCallback(async (next) => {
    const data = await apiFetch('/settings/commission-rates', {
      method: 'PATCH',
      body: JSON.stringify(next),
    });
    if (data?.rates) setRates(data.rates);
    return data;
  }, []);

  return { rates, defaults, loading, error, refresh: load, save };
}
