import { useState, useEffect, useCallback } from 'react';

const API_BASE = '/api';

async function apiFetch(url, options = {}) {
  const res = await fetch(`${API_BASE}${url}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return res.json();
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
  const [search, setSearch] = useState('');

  const fetchLogs = useCallback(async (query = '') => {
    setLoading(true);
    try {
      const params = query ? `?search=${encodeURIComponent(query)}&limit=100` : '?limit=100';
      const [logsData, statsData] = await Promise.all([
        apiFetch(`/convert-logs${params}`),
        apiFetch('/convert-logs/stats'),
      ]);
      setLogs(logsData);
      setStats(statsData);
    } catch (err) {
      console.error('Convert logs error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchLogs(search); }, [fetchLogs, search]);

  return { logs, stats, loading, search, setSearch, refresh: () => fetchLogs(search) };
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
    return params.toString();
  }, []);

  const fetchOrders = useCallback(async (f) => {
    setLoading(true);
    try {
      const qs = buildQueryParams(f);
      const [ordersData, statsData] = await Promise.all([
        apiFetch(`/orders?${qs}`),
        apiFetch('/orders/stats'),
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
  const [summary, setSummary] = useState({ buyers: [], referrers: [] });
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [summaryData, historyData] = await Promise.all([
        apiFetch('/payouts/summary'),
        apiFetch('/payouts/history?limit=100'),
      ]);
      setSummary(summaryData);
      setHistory(historyData);
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

  return { summary, history, loading, refresh, getUserDetail, createPayout, uploadBill };
}

// Update user cashback rates
export async function updateUserCashbackRates(userId, buyerRate, referrerRate) {
  return apiFetch(`/users/${userId}/cashback-rates`, {
    method: 'PATCH',
    body: JSON.stringify({ buyerRate, referrerRate }),
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

