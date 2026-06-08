/**
 * Withdrawal Request Store
 *
 * Handles the `/ruttien` Zalo command end-to-end:
 *   1. Parses bank info from user input (with alias tolerance)
 *   2. Computes the user's currently withdrawable amount (re-uses payout-store)
 *   3. Validates against existing pending requests
 *   4. Persists requests for admin to fulfil via the Payouts page
 *
 * Schema: see `withdrawal_requests` table in src/db/migrations.js.
 */

const db = require('../db');
const logger = require('../logger');
const payoutStore = require('./payout-store');

// ─── Bank codes (subset of constants/banks.js + common aliases) ─
// Maps lower-cased alias → official VietQR code.
const BANK_ALIASES = {
  vcb: 'VCB', vietcombank: 'VCB', ngoaithuong: 'VCB',
  icb: 'ICB', vtb: 'ICB', vietinbank: 'ICB', vietin: 'ICB', congthuong: 'ICB',
  bidv: 'BIDV', dautu: 'BIDV',
  vba: 'VBA', agribank: 'VBA', agri: 'VBA', nongnghiep: 'VBA',
  tcb: 'TCB', techcombank: 'TCB', techcom: 'TCB',
  mb: 'MB', mbbank: 'MB', mbb: 'MB', quandoi: 'MB',
  acb: 'ACB', achau: 'ACB',
  vpb: 'VPB', vpbank: 'VPB',
  tpb: 'TPB', tpbank: 'TPB', tienphong: 'TPB',
  stb: 'STB', sacombank: 'STB', saigonthuongtin: 'STB',
  hdb: 'HDB', hdbank: 'HDB',
  vib: 'VIB',
  shb: 'SHB', saigonhanoi: 'SHB',
  eib: 'EIB', eximbank: 'EIB',
  msb: 'MSB', hanghai: 'MSB', maritime: 'MSB',
  ocb: 'OCB', phuongdong: 'OCB',
  lpb: 'LPB', lpbank: 'LPB', locphat: 'LPB',
  seab: 'SEAB', seabank: 'SEAB',
  abb: 'ABB', abbank: 'ABB', anbinh: 'ABB',
  bab: 'BAB', bacabank: 'BAB', baca: 'BAB',
  ncb: 'NCB',
  pgb: 'PGB', pgbank: 'PGB',
  scb: 'SCB', saigon: 'SCB',
  vab: 'VAB', vietabank: 'VAB', vieta: 'VAB',
  pvcb: 'PVCB', pvcombank: 'PVCB',
  momo: 'momo',
  cake: 'CAKE',
  ubank: 'Ubank',
  timo: 'TIMO',
  shinhan: 'SHBVN', shinhanbank: 'SHBVN',
};

// Quick display-name lookup (for user-facing messages)
const BANK_DISPLAY = {
  VCB: 'Vietcombank', ICB: 'VietinBank', BIDV: 'BIDV', VBA: 'Agribank',
  TCB: 'Techcombank', MB: 'MBBank', ACB: 'ACB', VPB: 'VPBank',
  TPB: 'TPBank', STB: 'Sacombank', HDB: 'HDBank', VIB: 'VIB',
  SHB: 'SHB', EIB: 'Eximbank', MSB: 'MSB', OCB: 'OCB',
  LPB: 'LPBank', SEAB: 'SeABank', ABB: 'ABBANK', BAB: 'BacABank',
  NCB: 'NCB', PGB: 'PGBank', SCB: 'SCB', VAB: 'VietABank',
  PVCB: 'PVcomBank', momo: 'MoMo', CAKE: 'CAKE', Ubank: 'Ubank',
  TIMO: 'Timo', SHBVN: 'ShinhanBank',
};

const VALID_CODES = new Set(Object.values(BANK_ALIASES));

/**
 * Normalise a bank token to its canonical VietQR code, or return null if unknown.
 * Accepts both alias ("vietcombank") and code ("VCB") forms, case-insensitive,
 * with diacritics/spaces stripped.
 */
function normaliseBankCode(input) {
  if (!input) return null;
  const key = String(input)
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '') // strip Vietnamese accents
    .replace(/[^a-z0-9]/g, '');
  if (BANK_ALIASES[key]) return BANK_ALIASES[key];
  // Also accept raw codes (e.g. user types "MSB")
  const upper = String(input).toUpperCase().trim();
  if (VALID_CODES.has(upper)) return upper;
  return null;
}

function bankDisplayName(code) {
  return BANK_DISPLAY[code] || code || '';
}

/**
 * Parse `/ruttien <BANK> <STK> <Tên đầy đủ>` form.
 * Returns:
 *   { ok: true, bankCode, accountNumber, accountHolder } on success
 *   { ok: false, error } on failure
 *   { ok: 'no_args' } when no args provided (caller should show info/guide)
 */
function parseRuttienArgs(text) {
  const body = (text || '').slice('/ruttien'.length).trim();
  if (!body) return { ok: 'no_args' };

  // Split into 3 parts: bank, account, holder (holder may contain spaces)
  const parts = body.split(/\s+/);
  if (parts.length < 3) {
    return { ok: false, error: 'syntax' };
  }

  const bankRaw = parts[0];
  const accountRaw = parts[1];
  const holderRaw = parts.slice(2).join(' ').trim();

  const bankCode = normaliseBankCode(bankRaw);
  if (!bankCode) return { ok: false, error: 'unknown_bank', value: bankRaw };

  // Account number: 6-20 digits (old accounts like ACB can be 7 digits)
  if (!/^\d{6,20}$/.test(accountRaw)) {
    return { ok: false, error: 'bad_account' };
  }

  if (holderRaw.length < 3) {
    return { ok: false, error: 'bad_holder' };
  }

  return { ok: true, bankCode, accountNumber: accountRaw, accountHolder: holderRaw };
}

/**
 * Compute the user's currently withdrawable amount by summing all unpaid
 * completed cashbacks across F0/F1/F2/F3/Custom roles. Re-uses payout-store's
 * canonical filter (excludes cancelled, excludes already-paid via paid_orders).
 */
async function computeUserPending(userId) {
  try {
    const detail = await payoutStore.getUserDetail(userId);
    if (!detail) return { total: 0, breakdown: { buyer: 0, f1: 0, f2: 0, f3: 0, custom: 0 } };

    const sum = (arr, field) => (arr || []).reduce((s, o) => s + (Number(o[field]) || 0), 0);
    const buyer = sum(detail.completed, 'buyerCashback');
    const f1 = sum(detail.completedReferrer, 'referrerCashback');
    const f2 = sum(detail.completedF2, 'fCashback');
    const f3 = sum(detail.completedF3, 'fCashback');
    const custom = sum(detail.completedCustom, 'customCashback');

    // Pending (processing) orders not yet withdrawable
    const pendingBuyerAmt = sum(detail.pending || [], 'buyerCashback');
    const pendingCustomAmt = sum(detail.pendingCustom || [], 'customCashback');
    const pendingF1Amt = sum(detail.pendingReferrer || [], 'referrerCashback');
    const pendingF2Amt = sum(detail.pendingF2 || [], 'fCashback');
    const pendingF3Amt = sum(detail.pendingF3 || [], 'fCashback');
    const pendingCount = (detail.pending || []).length + (detail.pendingCustom || []).length
      + (detail.pendingReferrer || []).length + (detail.pendingF2 || []).length + (detail.pendingF3 || []).length;
    const pendingAmount = pendingBuyerAmt + pendingCustomAmt + pendingF1Amt + pendingF2Amt + pendingF3Amt;

    return {
      total: buyer + f1 + f2 + f3 + custom,
      breakdown: { buyer, f1, f2, f3, custom },
      pendingCount,
      pendingAmount,
    };
  } catch (err) {
    logger.error('WithdrawalStore', `computeUserPending(${userId}) failed: ${err.message}`);
    return { total: 0, breakdown: { buyer: 0, f1: 0, f2: 0, f3: 0, custom: 0 } };
  }
}

/** Returns the most recent pending request for a user, or null. */
async function getActivePendingByUser(userId) {
  return db.get(
    `SELECT id, amount, bank_name, bank_account, account_holder, requested_at
     FROM withdrawal_requests
     WHERE user_id = $1 AND status = 'pending'
     ORDER BY requested_at DESC LIMIT 1`,
    [userId]
  );
}

/** Fetch current bank info on the user row. */
async function getUserBankInfo(userId) {
  return db.get(
    `SELECT bank_name, bank_account, bank_account_holder, display_name, zalo_name
     FROM users WHERE user_id = $1`,
    [userId]
  );
}

/** Persist bank info to the user row. */
async function updateUserBankInfo(userId, { bankCode, accountNumber, accountHolder }) {
  await db.run(
    `UPDATE users
     SET bank_name = $1, bank_account = $2, bank_account_holder = $3
     WHERE user_id = $4`,
    [bankCode, accountNumber, accountHolder, userId]
  );
}

/** Create a new withdrawal request. Returns the inserted row id (or null on failure). */
async function createRequest({ userId, userName, amount, breakdown, bankCode, accountNumber, accountHolder }) {
  try {
    const result = await db.getNamed(
      `INSERT INTO withdrawal_requests
         (user_id, user_name, amount, breakdown, bank_name, bank_account, account_holder)
       VALUES (@userId, @userName, @amount, @breakdown, @bankName, @bankAccount, @accountHolder)
       RETURNING id`,
      {
        userId,
        userName: userName || '',
        amount,
        breakdown: JSON.stringify(breakdown || {}),
        bankName: bankCode,
        bankAccount: accountNumber,
        accountHolder,
      }
    );
    return result?.id || null;
  } catch (err) {
    logger.error('WithdrawalStore', `createRequest(${userId}) failed: ${err.message}`);
    return null;
  }
}

/** List pending requests (admin). */
async function listRequests({ status = null, limit = 50, offset = 0 } = {}) {
  if (status) {
    return db.all(
      `SELECT * FROM withdrawal_requests WHERE status = $1
       ORDER BY requested_at DESC LIMIT $2 OFFSET $3`,
      [status, limit, offset]
    );
  }
  return db.all(
    `SELECT * FROM withdrawal_requests
     ORDER BY requested_at DESC LIMIT $1 OFFSET $2`,
    [limit, offset]
  );
}

/** Mark a request as processed (paid/rejected/cancelled). Admin-side. */
async function markProcessed(requestId, { status, adminNote, payoutId, processedBy }) {
  await db.run(
    `UPDATE withdrawal_requests
     SET status = $1, admin_note = $2, payout_id = $3,
         processed_at = NOW(), processed_by = $4
     WHERE id = $5`,
    [status, adminNote || '', payoutId || null, processedBy || 'system', requestId]
  );
}

module.exports = {
  // user-facing helpers
  parseRuttienArgs,
  normaliseBankCode,
  bankDisplayName,
  computeUserPending,
  getActivePendingByUser,
  getUserBankInfo,
  updateUserBankInfo,
  createRequest,
  // admin helpers
  listRequests,
  markProcessed,
  // for diagnostics / display
  BANK_ALIASES,
  BANK_DISPLAY,
};
