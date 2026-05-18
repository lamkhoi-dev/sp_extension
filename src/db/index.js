/**
 * Database Factory — Unified async interface for PostgreSQL
 *
 * Usage:
 *   const db = require('./db');
 *   const rows = await db.all('SELECT * FROM users WHERE user_id = $1', [id]);
 *   const row  = await db.get('SELECT * FROM users WHERE user_id = $1', [id]);
 *   await db.run('INSERT INTO users (user_id) VALUES ($1)', [id]);
 *   await db.exec(ddlString);
 *   await db.transaction(async (tx) => { ... });
 *
 * Env:
 *   DATABASE_URL=postgres://user:pass@host:5432/db  → Remote PostgreSQL
 *   (unset or empty)                                → Local PostgreSQL (default)
 */

const DATABASE_URL = process.env.DATABASE_URL || 'postgres://localhost:5432/shopee_affiliate';

const PgAdapter = require('./pg-adapter');
const adapter = new PgAdapter(DATABASE_URL);
console.log(`[DB] Using PostgreSQL (${process.env.DATABASE_URL ? 'Remote' : 'Local'})`);

module.exports = adapter;
