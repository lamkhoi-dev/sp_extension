require('dotenv').config();
const db = require('./src/db');
const messageStore = require('./src/api/message-store');
async function main() {
  const stats = await messageStore.getStats();
  console.log(stats);
  process.exit(0);
}
main();
