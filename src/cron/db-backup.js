const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');
const logger = require('../logger');

const BACKUP_HOUR = 12;
const MAX_BACKUPS = 30;
const BACKUP_DIR = path.join(__dirname, '../../data/backups');

let backupTimeout = null;

function pad(n) { return String(n).padStart(2, '0'); }

function nowTag() {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}-${pad(d.getMinutes())}-${pad(d.getSeconds())}`;
}

async function runBackup() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    logger.warn('DbBackup', 'DATABASE_URL not set — skipping backup');
    return;
  }

  fs.mkdirSync(BACKUP_DIR, { recursive: true });

  const file = path.join(BACKUP_DIR, `pg-backup-${nowTag()}.dump`);
  logger.info('DbBackup', `Starting backup → ${file}`);

  await new Promise((resolve, reject) => {
    const cmd = `pg_dump -Fc "${url.replace(/"/g, '\\"')}" -f "${file}"`;
    exec(cmd, { env: { ...process.env, PGSSLMODE: 'require' } }, (err, _stdout, stderr) => {
      if (err) reject(new Error(stderr || err.message));
      else resolve();
    });
  });

  const stat = fs.statSync(file);
  logger.info('DbBackup', `Backup done — ${(stat.size / 1024).toFixed(1)} KB`);

  // Giữ MAX_BACKUPS file mới nhất, xóa cũ nhất
  const files = fs.readdirSync(BACKUP_DIR)
    .filter(f => f.startsWith('pg-backup-') && f.endsWith('.dump'))
    .sort(); // tên = timestamp → sort chữ = sort thời gian

  if (files.length > MAX_BACKUPS) {
    const toDelete = files.slice(0, files.length - MAX_BACKUPS);
    for (const f of toDelete) {
      fs.unlinkSync(path.join(BACKUP_DIR, f));
      logger.info('DbBackup', `Rotated old backup: ${f}`);
    }
  }
}

function scheduleNextBackup() {
  const now = new Date();
  const next = new Date();
  next.setHours(BACKUP_HOUR, 0, 0, 0);
  if (next <= now) next.setDate(next.getDate() + 1);

  const msUntil = next.getTime() - now.getTime();
  logger.info('DbBackup', `Next backup in ${Math.round(msUntil / 3600000 * 10) / 10}h (${next.toLocaleString('vi-VN')})`);

  backupTimeout = setTimeout(async () => {
    try { await runBackup(); } catch (err) { logger.error('DbBackup', `Backup failed: ${err.message}`); }
    scheduleNextBackup();
  }, msUntil);
}

function startBackupScheduler() {
  if (backupTimeout) return;
  scheduleNextBackup();
}

function stopBackupScheduler() {
  if (backupTimeout) { clearTimeout(backupTimeout); backupTimeout = null; }
}

module.exports = { startBackupScheduler, stopBackupScheduler, runBackup };
