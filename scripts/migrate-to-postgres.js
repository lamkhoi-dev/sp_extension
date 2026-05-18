const { Pool } = require('pg');
const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

const sqliteDbPath = process.env.SQLITE_DB_PATH || path.join(__dirname, '../data/zalo-bot.db');
const pgConnectionString = process.env.DATABASE_URL || 'postgres://localhost:5432/shopee_affiliate';

console.log(`Using SQLite: ${sqliteDbPath}`);
console.log(`Using PG: ${pgConnectionString}`);

const sqliteDb = new Database(sqliteDbPath, { fileMustExist: true });
const pgPool = new Pool({ connectionString: pgConnectionString });

const BATCH_SIZE = 500;

async function migrateTable(tableName, pgTableName = tableName) {
  console.log(`\nMigrating table: ${tableName} -> ${pgTableName}...`);
  
  // Get columns from SQLite
  const tableInfo = sqliteDb.pragma(`table_info(${tableName})`);
  const columns = tableInfo.map(col => col.name);
  
  if (columns.length === 0) {
    console.log(`  Table ${tableName} not found in SQLite or has no columns.`);
    return;
  }
  
  const sqliteCountQuery = sqliteDb.prepare(`SELECT count(*) as count FROM ${tableName}`);
  const totalRows = sqliteCountQuery.get().count;
  console.log(`  Found ${totalRows} rows in SQLite.`);
  
  if (totalRows === 0) {
    console.log(`  Skipping empty table.`);
    return;
  }
  
  const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');
  const columnNames = columns.join(', ');
  const insertQuery = `INSERT INTO ${pgTableName} (${columnNames}) VALUES (${placeholders}) ON CONFLICT DO NOTHING`;
  
  const selectQuery = sqliteDb.prepare(`SELECT * FROM ${tableName}`);
  const iterator = selectQuery.iterate();
  
  let migratedCount = 0;
  let batch = [];
  
  const client = await pgPool.connect();
  try {
    await client.query('BEGIN');
    
    for (const row of iterator) {
      const values = columns.map(col => {
        let val = row[col];
        // Clean up numeric types from text (like '1.050.000₫' -> 1050000)
        if (typeof val === 'string' && (col === 'price' || col === 'commission_amount' || col.includes('rate') || col.includes('commission') || col.includes('amount') || col.includes('bonus'))) {
           let clean = val.replace(/[^0-9.-]+/g, '');
           return clean === '' ? 0 : parseFloat(clean);
        }
        return val;
      });
      
      // PostgreSQL handles boolean differently if the column is BOOLEAN, but SQLite has 0/1. 
      // The pg driver will cast 0/1 to false/true automatically for bool fields, but let's be safe if we need to.
      // Assuming straightforward insert works based on schema definition.
      batch.push(client.query(insertQuery, values));
      
      if (batch.length >= BATCH_SIZE) {
        await Promise.all(batch);
        migratedCount += batch.length;
        process.stdout.write(`\r  Progress: ${migratedCount} / ${totalRows}`);
        batch = [];
      }
    }
    
    if (batch.length > 0) {
      await Promise.all(batch);
      migratedCount += batch.length;
      process.stdout.write(`\r  Progress: ${migratedCount} / ${totalRows}`);
    }
    
    await client.query('COMMIT');
    console.log(`\n  ✅ Successfully migrated ${migratedCount} rows.`);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(`\n  ❌ Error migrating table ${tableName}:`, err);
    throw err;
  } finally {
    client.release();
  }
}

async function main() {
  console.log("=========================================");
  console.log("   SQLite to PostgreSQL Migration Tool");
  console.log("=========================================\n");

  try {
    console.log("1. Running Schema Setup in PostgreSQL...");
    const { runMigrations } = require('../src/db/migrations');
    const db = require('../src/db'); // Will be the pg adapter
    await runMigrations(db);
    console.log("  ✅ Schema created successfully.\n");
    
    console.log("2. Migrating Data...");
    // Sequence matters due to foreign keys (if any)
    const tables = [
      'users',
      'messages',
      'convert_logs',
      'orders',
      'payouts',
      'product_images',
      'admin_users',
      'audit_logs',
      'stat_reports'
    ];
    
    for (const table of tables) {
      await migrateTable(table);
    }
    
    console.log("\n=========================================");
    console.log("  🎉 MIGRATION COMPLETED SUCCESSFULLY!");
    console.log("=========================================\n");
  } catch (err) {
    console.error("\nMigration failed:", err);
  } finally {
    await pgPool.end();
    sqliteDb.close();
  }
}

main();
