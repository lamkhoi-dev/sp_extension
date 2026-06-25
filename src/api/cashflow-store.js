/**
 * Cash Flow Store — internal fund ledger ("Sổ quỹ / Quản Lý Quỹ").
 *
 * Three transaction types:
 *   - income   : money Shopee actually disbursed → fund (MANUAL entry)
 *   - expense  : server / marketing / ads … out of fund (MANUAL entry)
 *   - cashback : refunds paid to users (NOT entered freely — each one is
 *                confirmed from an existing `payouts` record via confirmCashback,
 *                linked by reference_payout_id so it can never be double-counted).
 *
 * The "Công nợ Cashback" card does NOT recompute anything — it reuses
 * payout-store.getSummary() (the single source of truth, see [[payout-source-of-truth]]).
 *
 * Schema: see `cashflow_categories` + `cashflow_transactions` in src/db/migrations.js.
 */

const db = require('../db');
const logger = require('../logger');
const payoutStore = require('./payout-store');

const isDup = (err) => {
  const m = String(err?.message || '').toLowerCase();
  return m.includes('unique') || m.includes('duplicate');
};

// ─── Transactions ───────────────────────────────────────

/** List ledger transactions with filters + pagination. Returns { transactions, total }. */
async function listTransactions({ type, from, to, q, limit = 20, offset = 0 } = {}) {
  let where = '1=1';
  const params = [];
  if (type && type !== 'all') { where += ' AND t.type = ?'; params.push(type); }
  if (from) { where += ' AND t.occurred_at >= ?'; params.push(from); }
  if (to) { where += ' AND t.occurred_at <= ?'; params.push(to.length === 10 ? `${to}T23:59:59` : to); }
  if (q) {
    where += ' AND (t.description ILIKE ? OR t.counterparty ILIKE ? OR t.created_by ILIKE ?)';
    const like = `%${q}%`;
    params.push(like, like, like);
  }

  const rows = await db.all(
    `SELECT t.*, c.name AS category_name, c.color AS category_color
     FROM cashflow_transactions t
     LEFT JOIN cashflow_categories c ON c.id = t.category_id
     WHERE ${where}
     ORDER BY t.occurred_at DESC, t.id DESC
     LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );
  const countRow = await db.get(
    `SELECT COUNT(*) AS total FROM cashflow_transactions t WHERE ${where}`,
    params
  );
  return { transactions: rows, total: Number(countRow?.total || 0) };
}

async function getTransaction(id) {
  return db.get('SELECT * FROM cashflow_transactions WHERE id = ?', [id]);
}

/** Create a manual income/expense transaction. Cashback must go through confirmCashback. */
async function createTransaction({ type, amount, categoryId, description, counterparty, userId, receiptImage, occurredAt, createdBy }) {
  try {
    const result = await db.getNamed(
      `INSERT INTO cashflow_transactions
         (type, amount, category_id, description, counterparty, user_id, receipt_image, occurred_at, created_by)
       VALUES (@type, @amount, @categoryId, @description, @counterparty, @userId, @receiptImage, @occurredAt, @createdBy)
       RETURNING id`,
      {
        type,
        amount: Number(amount),
        categoryId: categoryId || null,
        description: description || '',
        counterparty: counterparty || '',
        userId: userId || '',
        receiptImage: receiptImage || '',
        occurredAt: occurredAt || new Date().toISOString(),
        createdBy: createdBy || '',
      }
    );
    return { id: result?.id || null };
  } catch (err) {
    logger.error('CashflowStore', `createTransaction failed: ${err.message}`);
    return { error: 'Lỗi tạo giao dịch' };
  }
}

async function deleteTransaction(id) {
  try {
    const result = await db.run('DELETE FROM cashflow_transactions WHERE id = ?', [id]);
    return (result?.changes || 0) > 0;
  } catch (err) {
    logger.error('CashflowStore', `deleteTransaction(${id}) failed: ${err.message}`);
    return false;
  }
}

// ─── Cashback (derived from payouts, requires confirm) ───

/** Payouts that have NOT yet been recorded into the fund ledger. */
async function getCashbackSuggestions() {
  return db.all(
    `SELECT p.id, p.user_id, p.user_name, p.role, p.amount, p.paid_at, p.admin_note
     FROM payouts p
     LEFT JOIN cashflow_transactions t ON t.reference_payout_id = p.id
     WHERE t.id IS NULL
     ORDER BY p.paid_at DESC
     LIMIT 100`
  );
}

/** Confirm a payout into the fund ledger as a cashback outflow (idempotent via UNIQUE payout id). */
async function confirmCashback({ payoutId, categoryId, description, receiptImage, createdBy }) {
  const p = await db.get('SELECT * FROM payouts WHERE id = ?', [payoutId]);
  if (!p) return { error: 'Không tìm thấy khoản hoàn tiền (payout)' };

  let catId = categoryId || null;
  if (!catId) {
    const c = await db.get(`SELECT id FROM cashflow_categories WHERE type = 'cashback' AND is_active = TRUE ORDER BY id LIMIT 1`);
    catId = c?.id || null;
  }

  try {
    const result = await db.getNamed(
      `INSERT INTO cashflow_transactions
         (type, amount, category_id, description, counterparty, user_id, reference_payout_id, receipt_image, occurred_at, created_by)
       VALUES ('cashback', @amount, @categoryId, @description, @counterparty, @userId, @refId, @receiptImage, @occurredAt, @createdBy)
       RETURNING id`,
      {
        amount: Number(p.amount || 0),
        categoryId: catId,
        description: description || `Hoàn tiền ${p.user_name || ''}`.trim(),
        counterparty: p.user_name || '',
        userId: p.user_id || '',
        refId: payoutId,
        receiptImage: receiptImage || '',
        occurredAt: p.paid_at || new Date().toISOString(),
        createdBy: createdBy || '',
      }
    );
    return { id: result?.id || null, amount: Number(p.amount || 0) };
  } catch (err) {
    if (isDup(err)) return { error: 'Khoản hoàn tiền này đã được ghi sổ rồi' };
    logger.error('CashflowStore', `confirmCashback(${payoutId}) failed: ${err.message}`);
    return { error: 'Lỗi ghi sổ hoàn tiền' };
  }
}

// ─── Categories ──────────────────────────────────────────

async function listCategories() {
  return db.all(
    `SELECT id, name, color, type FROM cashflow_categories
     WHERE is_active = TRUE ORDER BY type, name`
  );
}

async function createCategory({ name, color, type, createdBy }) {
  try {
    const result = await db.getNamed(
      `INSERT INTO cashflow_categories (name, color, type, created_by)
       VALUES (@name, @color, @type, @createdBy) RETURNING id`,
      { name, color: color || '#6b7280', type, createdBy: createdBy || '' }
    );
    return { id: result?.id || null };
  } catch (err) {
    if (isDup(err)) return { error: 'Danh mục đã tồn tại trong loại này' };
    logger.error('CashflowStore', `createCategory failed: ${err.message}`);
    return { error: 'Lỗi tạo danh mục' };
  }
}

async function updateCategory(id, { name, color }) {
  try {
    await db.run(
      `UPDATE cashflow_categories SET name = COALESCE(?, name), color = COALESCE(?, color) WHERE id = ?`,
      [name ?? null, color ?? null, id]
    );
    return true;
  } catch (err) {
    logger.error('CashflowStore', `updateCategory(${id}) failed: ${err.message}`);
    return false;
  }
}

/** Soft-delete a category. */
async function deleteCategory(id) {
  try {
    await db.run(`UPDATE cashflow_categories SET is_active = FALSE WHERE id = ?`, [id]);
    return true;
  } catch (err) {
    logger.error('CashflowStore', `deleteCategory(${id}) failed: ${err.message}`);
    return false;
  }
}

// ─── Summary / stats ─────────────────────────────────────

/**
 * Cashback debt — REUSES payout-store.getSummary() so the 3 figures match the
 * Payouts page exactly (Tổng phải hoàn / Đã hoàn / Còn chờ). Never recompute here.
 */
async function getCashbackDebt() {
  try {
    const summary = await payoutStore.getSummary();
    const users = summary?.users || [];
    let total = 0, paid = 0, pending = 0;
    for (const u of users) {
      total += (u.totalBuyerCashback || 0) + (u.totalReferrerCashback || 0) + (u.totalCustomCashback || 0);
      paid += (u.totalPaid || 0);
      pending += (u.pendingPayment || 0);
    }
    return { total: Math.round(total), paid: Math.round(paid), pending: Math.round(pending) };
  } catch (err) {
    logger.error('CashflowStore', `getCashbackDebt failed: ${err.message}`);
    return { total: 0, paid: 0, pending: 0 };
  }
}

/** Fund overview: balance, totals, quick stats, spending-by-category, cashback debt. */
async function getSummary() {
  const [allTotals, monthTotals, todayRow, spendingRows, debt] = await Promise.all([
    db.all(`SELECT type, COALESCE(SUM(amount),0) AS total FROM cashflow_transactions GROUP BY type`),
    db.all(`SELECT type, COALESCE(SUM(amount),0) AS total FROM cashflow_transactions
            WHERE occurred_at >= date_trunc('month', NOW()) GROUP BY type`),
    db.get(`SELECT COUNT(*) AS c FROM cashflow_transactions WHERE occurred_at >= CURRENT_DATE`),
    db.all(`SELECT c.name, c.color, COALESCE(SUM(t.amount),0) AS amount
            FROM cashflow_transactions t
            LEFT JOIN cashflow_categories c ON c.id = t.category_id
            WHERE t.type IN ('expense','cashback')
              AND t.occurred_at >= date_trunc('month', NOW())
            GROUP BY c.name, c.color
            ORDER BY amount DESC
            LIMIT 8`),
    getCashbackDebt(),
  ]);

  const pick = (rows, t) => Number(rows.find(r => r.type === t)?.total || 0);
  const income = pick(allTotals, 'income');
  const cashback = pick(allTotals, 'cashback');
  const expense = pick(allTotals, 'expense');

  const totalOut = spendingRows.reduce((s, r) => s + Number(r.amount || 0), 0) || 1;
  const spendingByCategory = spendingRows.map(r => ({
    name: r.name || 'Chưa phân loại',
    color: r.color || '#6b7280',
    amount: Number(r.amount || 0),
    percent: Math.round((Number(r.amount || 0) / totalOut) * 100),
  }));

  return {
    balance: Math.round(income - expense - cashback),
    received: Math.round(income),
    spent: Math.round(expense + cashback),
    totals: { income: Math.round(income), cashback: Math.round(cashback), expense: Math.round(expense) },
    quickStats: {
      todayCount: Number(todayRow?.c || 0),
      monthIncome: Math.round(pick(monthTotals, 'income')),
      monthExpense: Math.round(pick(monthTotals, 'expense')),
      monthCashback: Math.round(pick(monthTotals, 'cashback')),
    },
    spendingByCategory,
    cashbackDebt: debt,
  };
}

module.exports = {
  listTransactions,
  getTransaction,
  createTransaction,
  deleteTransaction,
  getCashbackSuggestions,
  confirmCashback,
  listCategories,
  createCategory,
  updateCategory,
  deleteCategory,
  getCashbackDebt,
  getSummary,
};
