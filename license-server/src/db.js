'use strict';

/**
 * SQLite database bootstrap + ordered migrations for the license server.
 *
 * Design rules:
 *  - WAL mode + busy timeout for safe concurrent reads.
 *  - schema_migrations table; every migration runs inside a transaction.
 *  - A timestamped backup of the database file is created automatically
 *    before migrations run (kept in data/backups).
 */

const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');
const config = require('./config');

let db = null;

const MIGRATIONS = [
  {
    id: 1,
    name: 'initial_schema',
    up: (d) => {
      d.exec(`
        CREATE TABLE schools (
          id TEXT PRIMARY KEY,
          school_code TEXT NOT NULL UNIQUE,
          name TEXT NOT NULL,
          address TEXT NOT NULL DEFAULT '',
          phone TEXT NOT NULL DEFAULT '',
          email TEXT NOT NULL DEFAULT '',
          status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','suspended','archived')),
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );

        CREATE TABLE school_users (
          id TEXT PRIMARY KEY,
          school_id TEXT NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
          name TEXT NOT NULL,
          email TEXT NOT NULL UNIQUE,
          password_hash TEXT NOT NULL,
          role TEXT NOT NULL DEFAULT 'admin',
          status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','locked')),
          must_change_password INTEGER NOT NULL DEFAULT 1,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );

        CREATE TABLE licenses (
          id TEXT PRIMARY KEY,
          school_id TEXT NOT NULL UNIQUE REFERENCES schools(id) ON DELETE CASCADE,
          license_key TEXT NOT NULL UNIQUE,
          status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','suspended','revoked')),
          issued_at TEXT NOT NULL,
          expires_at TEXT NOT NULL,
          max_devices INTEGER NOT NULL DEFAULT 3,
          offline_grace_days INTEGER NOT NULL DEFAULT 30,
          revalidate_hours INTEGER NOT NULL DEFAULT 24,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );

        CREATE TABLE devices (
          id TEXT PRIMARY KEY,
          school_id TEXT NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
          device_identifier TEXT NOT NULL,
          device_name TEXT NOT NULL DEFAULT '',
          os_info TEXT NOT NULL DEFAULT '',
          app_version TEXT NOT NULL DEFAULT '',
          status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','deactivated')),
          activated_at TEXT NOT NULL,
          last_seen_at TEXT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          UNIQUE (school_id, device_identifier)
        );

        CREATE TABLE sessions (
          id TEXT PRIMARY KEY,
          school_id TEXT NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
          user_id TEXT NOT NULL REFERENCES school_users(id) ON DELETE CASCADE,
          device_id TEXT REFERENCES devices(id) ON DELETE SET NULL,
          access_token_hash TEXT NOT NULL UNIQUE,
          refresh_token_hash TEXT NOT NULL UNIQUE,
          access_expires_at TEXT NOT NULL,
          refresh_expires_at TEXT NOT NULL,
          created_at TEXT NOT NULL,
          last_used_at TEXT
        );

        CREATE TABLE admins (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          email TEXT NOT NULL UNIQUE,
          password_hash TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','locked')),
          created_at TEXT NOT NULL,
          last_login_at TEXT
        );

        CREATE TABLE admin_sessions (
          id TEXT PRIMARY KEY,
          admin_id TEXT NOT NULL REFERENCES admins(id) ON DELETE CASCADE,
          token_hash TEXT NOT NULL UNIQUE,
          expires_at TEXT NOT NULL,
          created_at TEXT NOT NULL
        );

        CREATE TABLE audit_logs (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          actor_type TEXT NOT NULL,
          actor_id TEXT,
          actor_name TEXT,
          action TEXT NOT NULL,
          target TEXT,
          metadata TEXT NOT NULL DEFAULT '{}',
          ip TEXT,
          created_at TEXT NOT NULL
        );

        CREATE TABLE releases (
          id TEXT PRIMARY KEY,
          version TEXT NOT NULL UNIQUE,
          channel TEXT NOT NULL DEFAULT 'stable' CHECK (channel IN ('stable','beta')),
          notes TEXT NOT NULL DEFAULT '',
          installer_url TEXT NOT NULL DEFAULT '',
          released_at TEXT NOT NULL,
          is_latest_stable INTEGER NOT NULL DEFAULT 0
        );

        CREATE TABLE client_settings (
          key TEXT PRIMARY KEY,
          value TEXT NOT NULL
        );

        CREATE INDEX idx_devices_school ON devices(school_id, status);
        CREATE INDEX idx_sessions_school ON sessions(school_id);
        CREATE INDEX idx_sessions_refresh ON sessions(refresh_token_hash);
        CREATE INDEX idx_audit_created ON audit_logs(created_at);
      `);
    },
  },
];

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function backupBeforeMigration(dbFile) {
  try {
    if (!fs.existsSync(dbFile)) return null;
    const backupDir = path.join(config.dataDir, 'backups');
    ensureDir(backupDir);
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const target = path.join(backupDir, `license-pre-migration-${stamp}.sqlite`);
    fs.copyFileSync(dbFile, target);
    return target;
  } catch (err) {
    console.error('[db] pre-migration backup failed (continuing):', err.message);
    return null;
  }
}

function getDb() {
  if (db) return db;

  ensureDir(config.dataDir);
  const dbFile = path.join(config.dataDir, 'license.sqlite');
  const isNew = !fs.existsSync(dbFile);

  db = new Database(dbFile);
  db.pragma('journal_mode = WAL');
  db.pragma('busy_timeout = 5000');
  db.pragma('foreign_keys = ON');
  db.pragma('synchronous = NORMAL');

  db.exec(`CREATE TABLE IF NOT EXISTS schema_migrations (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    applied_at TEXT NOT NULL
  )`);

  const applied = new Set(
    db.prepare('SELECT name FROM schema_migrations').all().map((r) => r.name)
  );
  const pending = MIGRATIONS.filter((m) => !applied.has(m.name));

  if (pending.length > 0 && !isNew) {
    const backupPath = backupBeforeMigration(dbFile);
    if (backupPath) console.log(`[db] pre-migration backup: ${backupPath}`);
  }

  for (const migration of pending) {
    const run = db.transaction(() => {
      migration.up(db);
      db.prepare('INSERT INTO schema_migrations (id, name, applied_at) VALUES (?, ?, ?)').run(
        migration.id,
        migration.name,
        new Date().toISOString()
      );
    });
    run();
    console.log(`[db] applied migration ${migration.id}_${migration.name}`);
  }

  // Integrity check on first open of this process.
  const integrity = db.pragma('integrity_check', { simple: true });
  if (integrity !== 'ok') {
    console.error('[db] WARNING: integrity_check reported:', integrity);
  }

  return db;
}

function closeDb() {
  if (db) {
    db.close();
    db = null;
  }
}

module.exports = { getDb, closeDb, MIGRATIONS };
