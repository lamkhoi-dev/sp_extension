/**
 * PostgreSQL Adapter — Uses `pg` Pool with the same async interface as SqliteAdapter.
 *
 * Key interface:
 *   all(sql, params)       → Promise<Row[]>
 *   get(sql, params)       → Promise<Row|undefined>
 *   run(sql, params)       → Promise<{ changes, lastInsertRowid }>
 *   exec(sql)              → Promise<void>
 *   transaction(fn)        → Promise<T>
 */

const { Pool } = require('pg');
const logger = require('../logger');

class PgAdapter {
  constructor(connectionString) {
    const poolConfig = {
      connectionString,
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
      keepAlive: true,
      keepAliveInitialDelayMillis: 10000,
    };
    let finalConnectionString = connectionString;
    const isLocalhost = connectionString.includes('@localhost') || connectionString.includes('@127.0.0.1');

    // Force SSL with rejectUnauthorized: false for all remote connections
    // Many cloud providers (like Aiven) use self-signed certs that cause pg to fail.
    if (!isLocalhost) {
      poolConfig.ssl = { rejectUnauthorized: false };
      // Strip common ssl flags from connection string to prevent conflicts with the poolConfig.ssl object
      finalConnectionString = finalConnectionString
        .replace(/[?&]sslmode=require/i, '')
        .replace(/[?&]sslmode=no-verify/i, '')
        .replace(/[?&]ssl=true/i, '');

      // Clean up trailing '?' if any query params were removed
      if (finalConnectionString.endsWith('?')) {
        finalConnectionString = finalConnectionString.slice(0, -1);
      }
    }

    poolConfig.connectionString = finalConnectionString;
    this.pool = new Pool(poolConfig);
    this.type = 'postgres';

    this.pool.on('error', (err) => {
      logger.error('PgAdapter', `Pool error: ${err.message}`);
    });

    logger.info('PgAdapter', 'Pool initialized');
  }

  /**
   * Convert SQLite-style ? placeholders to PG-style $1, $2, ...
   * Also handles common SQLite → PG syntax differences.
   */
  _normalizeSQLForPG(sql) {
    let normalized = sql;

    // 1. Strip 'localtime' from date/datetime functions
    normalized = normalized.replace(/(date|datetime)\(([^)]+?)\s*,\s*'localtime'\)/gi, '$1($2)');

    // 2. datetime('now', '-X days')
    normalized = normalized.replace(/datetime\('now'\s*,\s*'([^']+)'\)/gi, "NOW() + INTERVAL '$1'");
    normalized = normalized.replace(/datetime\('now'\)/gi, 'NOW()');

    // 3. date('now', '-X days')
    normalized = normalized.replace(/date\('now'\s*,\s*'([^']+)'\)/gi, "(CURRENT_DATE + INTERVAL '$1')::DATE");
    normalized = normalized.replace(/date\('now'\)/gi, 'CURRENT_DATE');

    // Replace INTEGER PRIMARY KEY AUTOINCREMENT → SERIAL PRIMARY KEY
    normalized = normalized.replace(/INTEGER\s+PRIMARY\s+KEY\s+AUTOINCREMENT/gi, 'SERIAL PRIMARY KEY');

    // Replace INSERT OR REPLACE → INSERT ... ON CONFLICT DO UPDATE
    // (This is handled per-query in stores, not generically)

    // Replace LIKE (SQLite case-insensitive by default) → ILIKE (PG)
    normalized = normalized.replace(/\bLIKE\b/g, 'ILIKE');

    // Convert ? placeholders to $1, $2, etc.
    let idx = 0;
    normalized = normalized.replace(/\?/g, () => `$${++idx}`);

    return normalized;
  }

  /**
   * Convert named params (@name) to positional ($1, $2, ...).
   * Returns { sql, values }.
   */
  _convertNamedParams(sql, params = {}) {
    const values = [];
    let idx = 0;

    // Replace SQLite date/datetime to PG
    let normalized = sql;
    normalized = normalized.replace(/(date|datetime)\(([^)]+?)\s*,\s*'localtime'\)/gi, '$1($2)');
    normalized = normalized.replace(/datetime\('now'\s*,\s*'([^']+)'\)/gi, "NOW() + INTERVAL '$1'");
    normalized = normalized.replace(/datetime\('now'\)/gi, 'NOW()');
    normalized = normalized.replace(/date\('now'\s*,\s*'([^']+)'\)/gi, "(CURRENT_DATE + INTERVAL '$1')::DATE");
    normalized = normalized.replace(/date\('now'\)/gi, 'CURRENT_DATE');
    normalized = normalized.replace(/\bLIKE\b/g, 'ILIKE');

    // Replace @paramName with $N
    const converted = normalized.replace(/@(\w+)/g, (match, name) => {
      idx++;
      values.push(params[name] !== undefined ? params[name] : null);
      return `$${idx}`;
    });

    return { sql: converted, values };
  }

  async all(sql, params = []) {
    const normalized = this._normalizeSQLForPG(sql);
    const result = await this.pool.query(normalized, params);
    return result.rows;
  }

  async get(sql, params = []) {
    const normalized = this._normalizeSQLForPG(sql);
    const result = await this.pool.query(normalized, params);
    return result.rows[0] || undefined;
  }

  async run(sql, params = []) {
    const normalized = this._normalizeSQLForPG(sql);
    const result = await this.pool.query(normalized, params);
    return {
      changes: result.rowCount || 0,
      lastInsertRowid: result.rows?.[0]?.id || 0,
    };
  }

  /**
   * Run with named params — converts @name to $N for PG.
   */
  async runNamed(sql, params = {}) {
    const { sql: converted, values } = this._convertNamedParams(sql, params);
    const result = await this.pool.query(converted, values);
    return { changes: result.rowCount || 0, lastInsertRowid: result.rows?.[0]?.id || 0 };
  }

  async allNamed(sql, params = {}) {
    const { sql: converted, values } = this._convertNamedParams(sql, params);
    const result = await this.pool.query(converted, values);
    return result.rows;
  }

  async getNamed(sql, params = {}) {
    const { sql: converted, values } = this._convertNamedParams(sql, params);
    const result = await this.pool.query(converted, values);
    return result.rows[0] || undefined;
  }

  async exec(sql) {
    await this.pool.query(sql);
  }

  /**
   * Transaction wrapper.
   * fn receives a client with the same interface.
   */
  async transaction(fn) {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      const txCtx = {
        run: async (sql, params = []) => {
          const normalized = this._normalizeSQLForPG(sql);
          const result = await client.query(normalized, params);
          return { changes: result.rowCount || 0, lastInsertRowid: result.rows?.[0]?.id || 0 };
        },
        runNamed: async (sql, params = {}) => {
          const { sql: converted, values } = this._convertNamedParams(sql, params);
          const result = await client.query(converted, values);
          return { changes: result.rowCount || 0, lastInsertRowid: result.rows?.[0]?.id || 0 };
        },
        all: async (sql, params = []) => {
          const normalized = this._normalizeSQLForPG(sql);
          const result = await client.query(normalized, params);
          return result.rows;
        },
        get: async (sql, params = []) => {
          const normalized = this._normalizeSQLForPG(sql);
          const result = await client.query(normalized, params);
          return result.rows[0] || undefined;
        },
      };

      const result = await fn(txCtx);
      await client.query('COMMIT');
      return result;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  async close() {
    await this.pool.end();
  }
}

module.exports = PgAdapter;
