require('dotenv').config();
const { Pool } = require('pg');

const connectionString = process.env.DATABASE_URL;

console.log("Connection string:", connectionString);
console.log("Includes sslmode=require?", connectionString.includes('sslmode=require'));

const poolConfig = {
  connectionString,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
};

let finalConnectionString = connectionString;
if (connectionString.includes('sslmode=require')) {
  console.log("Adding ssl: { rejectUnauthorized: false }");
  poolConfig.ssl = { rejectUnauthorized: false };
  finalConnectionString = connectionString.replace('?sslmode=require', '').replace('&sslmode=require', '');
}
poolConfig.connectionString = finalConnectionString;

console.log("Pool config:", poolConfig);

const pool = new Pool(poolConfig);

pool.query('SELECT NOW()', (err, res) => {
  if (err) {
    console.error("Error:", err.message);
  } else {
    console.log("Success:", res.rows);
  }
  pool.end();
});
