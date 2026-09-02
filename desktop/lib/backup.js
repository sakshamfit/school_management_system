'use strict';

/**
 * Backup & restore for the local school database.
 *
 * - Backups live in <AppData>/SchoolManagementSystem/backups as
 *   school-YYYY-MM-DD-HHMMSS.sqlite
 * - Automatic daily backup on startup (and every 6h while running if stale).
 * - Manual "Backup Now" + restore with validation.
 * - Restore ALWAYS creates a pre-restore backup first.
 * - Optional external backup directory (USB/network drive) is mirrored.
 * - 14-day retention (minimum 5 backups kept).
 */

const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');
const paths = require('./paths');
const logger = require('./logger');
const dbModule = require('./db');

const RETENTION_DAYS = 14;
const MIN_KEEP = 5;
const AUTO_BACKUP_INTERVAL_MS = 24 * 3600 * 1000;

function externalTargetFile() {
  return path.join(paths.configDir(), 'backup-target.json');
}

function getExternalBackupDir() {
  try {
    const parsed = JSON.parse(fs.readFileSync(externalTargetFile(), 'utf8'));
    return parsed && typeof parsed.dir === 'string' && parsed.dir ? parsed.dir : null;
  } catch {
    return null;
  }
}

function setExternalBackupDir(dir) {
  fs.mkdirSync(paths.configDir(), { recursive: true });
  if (!dir) {
    if (fs.existsSync(externalTargetFile())) fs.unlinkSync(externalTargetFile());
    return { ok: true, dir: null };
  }
  // Validate the directory exists (or can be created) before accepting it.
  fs.mkdirSync(dir, { recursive: true });
  const probe = path.join(dir, `.sms-write-test-${Date.now()}`);
  fs.writeFileSync(probe, 'ok');
  fs.unlinkSync(probe);
  fs.writeFileSync(externalTargetFile(), JSON.stringify({ dir }, null, 2));
  logger.info('external backup directory configured', { dir });
  return { ok: true, dir };
}

function stamp() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  const rand = require('crypto').randomBytes(2).toString('hex');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}-${d.getMilliseconds()}${rand}`;
}

function listBackups() {
  const dir = paths.backupDir();
  let files = [];
  try {
    files = fs
      .readdirSync(dir)
      .filter((f) => /^school-[\w.-]+\.sqlite$/.test(f) && !f.includes('..'))
      .map((f) => {
        const stat = fs.statSync(path.join(dir, f));
        return { file: f, size: stat.size, createdAt: stat.mtime.toISOString() };
      })
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  } catch {
    files = [];
  }
  return files;
}

function applyRetention() {
  const backups = listBackups();
  if (backups.length <= MIN_KEEP) return;
  const cutoff = Date.now() - RETENTION_DAYS * 86400000;
  let kept = 0;
  for (const b of backups) {
    kept += 1;
    if (kept <= MIN_KEEP) continue;
    if (new Date(b.createdAt).getTime() < cutoff) {
      try {
        fs.unlinkSync(path.join(paths.backupDir(), b.file));
        logger.info('old backup removed by retention policy', { file: b.file });
      } catch {
        /* ignore */
      }
    }
  }
}

/**
 * Create a consistent backup of the current database using the SQLite online
 * backup API. Returns { file, path, mirrored, createdAt }.
 */
async function createBackup({ reason = 'manual' } = {}) {
  const db = dbModule.getDb();
  const dir = paths.backupDir();
  fs.mkdirSync(dir, { recursive: true });
  const file = `school-${stamp()}.sqlite`;
  const target = path.join(dir, file);

  try {
    await db.backup(target);
  } catch (err) {
    logger.error('backup failed', { error: err.message, reason });
    try {
      if (fs.existsSync(target)) fs.unlinkSync(target);
    } catch {
      /* ignore */
    }
    throw new Error(`Backup failed: ${err.message}`);
  }

  logger.info('backup created', { file, reason });
  applyRetention();

  // Mirror to the external directory when configured.
  let mirrored = false;
  const externalDir = getExternalBackupDir();
  if (externalDir) {
    try {
      fs.mkdirSync(externalDir, { recursive: true });
      fs.copyFileSync(target, path.join(externalDir, file));
      mirrored = true;
    } catch (e) {
      logger.warn('external backup mirror failed', { error: e.message });
    }
  }

  return { file, path: target, mirrored, createdAt: new Date().toISOString() };
}

/** Validate that a file is a readable school database (integrity check). */
function validateBackupFile(file) {
  const probe = new Database(file, { readonly: true });
  try {
    const result = probe.pragma('integrity_check', { simple: true });
    let hasSchoolInfo = false;
    try {
      hasSchoolInfo = !!probe.prepare('SELECT data FROM school_info WHERE id = 1').get();
    } catch {
      hasSchoolInfo = false;
    }
    return { ok: result === 'ok' && hasSchoolInfo, integrity: String(result) };
  } finally {
    probe.close();
  }
}

/**
 * Restore a backup file (must live inside the backups directory).
 * Flow: validate → pre-restore backup → close db → replace files → reopen.
 */
async function restoreBackup(fileName, { runMigrations } = {}) {
  // Path security: only plain filenames inside the backup directory.
  if (
    typeof fileName !== 'string' ||
    !/^school-[\w.-]+\.sqlite$/.test(fileName) ||
    fileName.includes('..') ||
    fileName.includes('/') ||
    fileName.includes('\\')
  ) {
    throw new Error('Invalid backup file name');
  }
  const file = path.join(paths.backupDir(), fileName);
  if (!fs.existsSync(file)) throw new Error('Backup file not found');

  const validation = validateBackupFile(file);
  if (!validation.ok) throw new Error(`Backup failed validation (${validation.integrity})`);

  // Safety net: back up the current state before replacing it.
  let preRestore = null;
  try {
    preRestore = await createBackup({ reason: 'pre-restore' });
  } catch (err) {
    logger.error('pre-restore backup failed', { error: err.message });
    throw new Error('Could not create a safety backup before restore. Restore aborted.');
  }

  dbModule.closeDatabase();
  const dbFile = paths.databaseFile();
  for (const suffix of ['', '-wal', '-shm']) {
    const f = dbFile + suffix;
    if (fs.existsSync(f)) fs.unlinkSync(f);
  }
  fs.copyFileSync(file, dbFile);

  const db = dbModule.openDatabase();
  if (typeof runMigrations === 'function') {
    await runMigrations(db);
  }
  logger.info('database restored from backup', {
    file: fileName,
    preRestore: preRestore && preRestore.file,
  });
  return { ok: true, restoredFrom: fileName, safetyBackup: preRestore ? preRestore.file : null };
}

/** Auto-backup: create one if the latest backup is older than 24h. */
async function ensureFreshBackup(reason = 'automatic') {
  const backups = listBackups();
  if (backups.length > 0) {
    const ageMs = Date.now() - new Date(backups[0].createdAt).getTime();
    if (ageMs < AUTO_BACKUP_INTERVAL_MS) return { skipped: true };
  }
  try {
    return await createBackup({ reason });
  } catch (err) {
    logger.error('automatic backup failed', { error: err.message });
    return { skipped: true, error: err.message };
  }
}

module.exports = {
  createBackup,
  listBackups,
  restoreBackup,
  validateBackupFile,
  ensureFreshBackup,
  getExternalBackupDir,
  setExternalBackupDir,
};
