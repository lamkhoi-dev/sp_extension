/**
 * SQLite Adapter — Wraps better-sqlite3 in the unified async interface.
 *
 * All methods return Promises for compatibility with the PG adapter,
 * but internally they're synchronous (better-sqlite3 is sync).
 *
 * Key interface:
 *   all(sql, params)       → Promise<Row[]>
 *   get(sql, params)       → Promise<Row|undefined>
 *   run(sql, params)       → Promise<{ changes, lastInsertRowid }>
 *   exec(sql)              → Promise<void>
 *   transaction(fn)        → Promise<T>
 */

const Database = require('better-sqlite3');
const logger = require('../logger');

class SqliteAdapter {
  constructor(dbPath) {
    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('foreign_keys = ON');
    this.type = 'sqlite';
    logger.info('SQLiteAdapter', `Connected: ${dbPath}`);
  }

  /**
   * Normalize params: converts [val1, val2] → {1: val1, 2: val2} style,
   * but better-sqlite3 natively supports both positional (?) and named (@) params.
   * We just pass through.
   */
  _normalizeSQL(sql) {
    // Replace $1, $2 (PG style) → ? (SQLite style) if present
    // This allows writing PG-style queries that also work in SQLite
    let idx = 0;
    return sql.replace(/\$(\d+)/g, () => '?');
  }

  async all(sql, params = []) {
    const normalized = this._normalizeSQL(sql);
    return this.db.prepare(normalized).all(...(Array.isArray(params) ? params : [params]));
  }

  async get(sql, params = []) {
    const normalized = this._normalizeSQL(sql);
    return this.db.prepare(normalized).get(...(Array.isArray(params) ? params : [params]));
  }

  async run(sql, params = []) {
    const normalized = this._normalizeSQL(sql);
    const result = this.db.prepare(normalized).run(...(Array.isArray(params) ? params : [params]));
    return { changes: result.changes, lastInsertRowid: result.lastInsertRowid };
  }

  /**
   * Run with named parameters (object-style).
   * better-sqlite3 natively supports @name params.
   */
  async runNamed(sql, params = {}) {
    return this.db.prepare(sql).run(params);
  }

  async allNamed(sql, params = {}) {
    return this.db.prepare(sql).all(params);
  }

  async getNamed(sql, params = {}) {
    return this.db.prepare(sql).get(params);
  }

  async exec(sql) {
    this.db.exec(sql);
  }

  /**
   * Transaction wrapper.
   * fn receives a transaction context object with the same interface.
   * For SQLite, better-sqlite3 transactions are synchronous but we wrap in async.
   */
  /**
   * Transaction wrapper.
   * For SQLite: We use manual BEGIN/COMMIT/ROLLBACK so we can properly
   * await the async callback fn. The txCtx methods return plain values
   * (awaiting a non-Promise is fine and returns the value immediately).
   */
  async transaction(fn) {
    const self = this;
    const txCtx = {
      run(sql, params = []) {
        const normalized = self._normalizeSQL(sql);
        const result = self.db.prepare(normalized).run(...(Array.isArray(params) ? params : [params]));
        return { changes: result.changes, lastInsertRowid: result.lastInsertRowid };
      },
      runNamed(sql, params = {}) {
        return self.db.prepare(sql).run(params);
      },
      all(sql, params = []) {
        const normalized = self._normalizeSQL(sql);
        return self.db.prepare(normalized).all(...(Array.isArray(params) ? params : [params]));
      },
      get(sql, params = []) {
        const normalized = self._normalizeSQL(sql);
        return self.db.prepare(normalized).get(...(Array.isArray(params) ? params : [params]));
      },
    };

    this.db.exec('BEGIN');
    try {
      const result = await fn(txCtx);
      this.db.exec('COMMIT');
      return result;
    } catch (err) {
      this.db.exec('ROLLBACK');
      throw err;
    }
  }

  /**
   * Close the database connection.
   */
  close() {
    this.db.close();
  }
}

module.exports = SqliteAdapter;
