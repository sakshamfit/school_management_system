'use strict';

/**
 * SQLite lifecycle for the desktop edition.
 *
 * - WAL journal mode + busy timeout → no locking issues for a desktop app.
 * - Single write connection owned by the main process (renderer talks via IPC).
 * - Foreign keys on, NORMAL synchronous (safe with WAL).
 * - Integrity check on open; corruption surfaces as a friendly error upstream.
 */

const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');
const paths = require('./paths');
const logger = require('./logger');

let db = null;

function openDatabase() {
  if (db) return db;

  const file = paths.databaseFile();
  fs.mkdirSync(path.dirname(file), { recursive: true });

  db = new Database(file);
  db.pragma('journal_mode = WAL');
  db.pragma('busy_timeout = 8000');
  db.pragma('foreign_keys = ON');
  db.pragma('synchronous = NORMAL');

  const integrity = db.pragma('integrity_check', { simple: true });
  if (integrity !== 'ok') {
    logger.error('database integrity check failed', { result: String(integrity) });
    const err = new Error('DATABASE_INTEGRITY');
    err.code = 'DATABASE_INTEGRITY';
    throw err;
  }

  logger.info('database opened', { file });
  return db;
}

function getDb() {
  if (!db) return openDatabase();
  return db;
}

function closeDatabase() {
  if (db) {
    try {
      db.pragma('wal_checkpoint(TRUNCATE)');
    } catch {
      /* ignore */
    }
    db.close();
    db = null;
    logger.info('database closed');
  }
}

function databaseStats() {
  const d = getDb();
  const stats = {};
  const tables = d
    .prepare(`SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'`)
    .all();
  for (const t of tables) {
    try {
      stats[t.name] = d.prepare(`SELECT COUNT(*) AS n FROM "${t.name}"`).get().n;
    } catch {
      stats[t.name] = -1;
    }
  }
  return stats;
}

module.exports = { openDatabase, getDb, closeDatabase, databaseStats };
