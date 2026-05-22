const { Pool } = require('pg');
require('dotenv').config();

(async () => {
  const connectionString = process.env.DATABASE_URL || 'postgres://localhost:5432/shopee_affiliate';
  let finalConnectionString = connectionString;
  const isLocalhost = connectionString.includes('@localhost') || connectionString.includes('@127.0.0.1');

  const poolConfig = {
    connectionString,
    max: 1,
    connectionTimeoutMillis: 5000,
  };

  if (!isLocalhost) {
    poolConfig.ssl = { rejectUnauthorized: false };
    finalConnectionString = finalConnectionString
      .replace(/[?&]sslmode=require/i, '')
      .replace(/[?&]sslmode=no-verify/i, '')
      .replace(/[?&]ssl=true/i, '');
    
    if (finalConnectionString.endsWith('?')) {
      finalConnectionString = finalConnectionString.slice(0, -1);
    }
  }
  poolConfig.connectionString = finalConnectionString;

  const pool = new Pool(poolConfig);
  try {
    const res = await pool.query('SELECT * FROM convert_logs ORDER BY created_at DESC LIMIT 1');
    console.log('Row properties:', res.rows[0] ? Object.keys(res.rows[0]) : 'No rows');
    console.log('Sample Row:', res.rows[0]);
  } catch (err) {
    console.error('Error during query:', err);
  } finally {
    await pool.end();
  }
})();
