/**
 * Commission Rates Store
 *
 * Single source of truth for the global F0-F3 + Admin commission split.
 * Persisted in system_settings (key = 'commission_rates'), with a small
 * in-memory cache (TTL 30s) so hot paths in payout-store don't hit the DB
 * for every order.
 *
 * Rates are percentages (0-100). Sum of all five MUST equal 100.
 *
 * Usage:
 *   const rates = await commissionRatesStore.getRates();
 *   // rates.admin / rates.f0 / rates.f1 / rates.f2 / rates.f3
 */

const db = require('../db');
const logger = require('../logger');

const KEY = 'commission_rates';
const DEFAULTS = Object.freeze({ admin: 30, f0: 40, f1: 20, f2: 7, f3: 3 });
const FIELDS = ['admin', 'f0', 'f1', 'f2', 'f3'];
const TTL_MS = 30_000;

let cache = null;
let cacheAt = 0;

function _normalise(raw) {
  if (!raw) return { ...DEFAULTS };
  const obj = typeof raw === 'string' ? (() => { try { return JSON.parse(raw); } catch { return null; } })() : raw;
  if (!obj || typeof obj !== 'object') return { ...DEFAULTS };
  const out = {};
  for (const k of FIELDS) {
    const v = Number(obj[k]);
    out[k] = Number.isFinite(v) ? v : DEFAULTS[k];
  }
  return out;
}

function _validate(rates) {
  for (const k of FIELDS) {
    const v = Number(rates?.[k]);
    if (!Number.isFinite(v) || v < 0 || v > 100) {
      throw new Error(`Tỷ lệ "${k}" không hợp lệ (phải là số 0-100)`);
    }
  }
  const sum = FIELDS.reduce((s, k) => s + Number(rates[k]), 0);
  if (Math.abs(sum - 100) > 0.01) {
    throw new Error(`Tổng các tỷ lệ phải bằng 100% (hiện tại ${sum}%)`);
  }
}

async function getRates() {
  if (cache && Date.now() - cacheAt < TTL_MS) return cache;
  try {
    const row = await db.get(`SELECT value FROM system_settings WHERE key = $1`, [KEY]);
    cache = _normalise(row?.value);
    cacheAt = Date.now();
    return cache;
  } catch (err) {
    logger.warn('CommissionRates', `getRates failed, falling back to defaults: ${err.message}`);
    return { ...DEFAULTS };
  }
}

async function updateRates(input, adminUser) {
  const next = {};
  for (const k of FIELDS) next[k] = Number(input?.[k]);
  _validate(next);

  const before = await getRates();

  await db.run(
    `INSERT INTO system_settings (key, value, updated_at, updated_by)
     VALUES ($1, $2, NOW(), $3)
     ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = NOW(), updated_by = $3`,
    [KEY, JSON.stringify(next), adminUser || 'system']
  );

  cache = { ...next };
  cacheAt = Date.now();
  return { before, after: cache };
}

function invalidateCache() {
  cache = null;
  cacheAt = 0;
}

module.exports = { getRates, updateRates, invalidateCache, DEFAULTS, KEY };
