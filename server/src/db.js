/**
 * Control-plane database (SQLite via better-sqlite3).
 *
 * This database stores ONLY commercial control-plane data:
 *   admins, schools, school_users, licenses, devices, sessions,
 *   audit_logs, releases.
 *
 * It NEVER stores school operational data (students, teachers,
 * attendance, fees, exams, results, school files, or the school's
 * operational database). That data lives in the school's own system
 * and its own backup destination — never here.
 *
 * All queries use parameterized statements. Raw string interpolation
 * into SQL is not used anywhere in this codebase.
 */

import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import config from './config.js';

const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS admins (
  id            TEXT PRIMARY KEY,
  email         TEXT NOT NULL UNIQUE COLLATE NOCASE,
  name          TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  role          TEXT NOT NULL DEFAULT 'admin' CHECK (role IN ('owner','admin')),
  status        TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','DISABLED')),
  failed_logins INTEGER NOT NULL DEFAULT 0,
  locked_until  TEXT,
  created_at    TEXT NOT NULL,
  last_login_at TEXT
);

CREATE TABLE IF NOT EXISTS schools (
  id           TEXT PRIMARY KEY,
  school_code  TEXT NOT NULL UNIQUE COLLATE NOCASE,
  name         TEXT NOT NULL,
  contact_name TEXT,
  email        TEXT,
  phone        TEXT,
  address      TEXT,
  status       TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','SUSPENDED','ARCHIVED')),
  created_at   TEXT NOT NULL,
  updated_at   TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS school_users (
  id                   TEXT PRIMARY KEY,
  school_id            TEXT NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  name                 TEXT NOT NULL,
  email                TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password_hash        TEXT NOT NULL,
  role                 TEXT NOT NULL DEFAULT 'school_admin' CHECK (role IN ('school_admin','staff')),
  status               TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','DISABLED')),
  must_change_password INTEGER NOT NULL DEFAULT 1,
  failed_logins        INTEGER NOT NULL DEFAULT 0,
  locked_until         TEXT,
  created_at           TEXT NOT NULL,
  updated_at           TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_school_users_school ON school_users(school_id);

CREATE TABLE IF NOT EXISTS licenses (
  id          TEXT PRIMARY KEY,
  school_id   TEXT NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  license_key TEXT NOT NULL UNIQUE,
  status      TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','EXPIRED','SUSPENDED','REVOKED')),
  issued_at   TEXT NOT NULL,
  expires_at  TEXT NOT NULL,
  max_devices INTEGER NOT NULL DEFAULT 1 CHECK (max_devices BETWEEN 1 AND 500),
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_licenses_school ON licenses(school_id);

CREATE TABLE IF NOT EXISTS devices (
  id                 TEXT PRIMARY KEY,
  school_id          TEXT NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  device_uid         TEXT NOT NULL,
  name               TEXT,
  platform           TEXT,
  app_version        TEXT,
  status             TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','DEACTIVATED')),
  activated_at       TEXT NOT NULL,
  last_seen_at       TEXT,
  deactivated_at     TEXT,
  drive_connected    INTEGER NOT NULL DEFAULT 0,
  last_backup_at     TEXT,
  last_backup_status TEXT,
  created_at         TEXT NOT NULL,
  updated_at         TEXT NOT NULL,
  UNIQUE (school_id, device_uid)
);
CREATE INDEX IF NOT EXISTS idx_devices_school ON devices(school_id);

CREATE TABLE IF NOT EXISTS sessions (
  id                TEXT PRIMARY KEY,
  subject_type      TEXT NOT NULL CHECK (subject_type IN ('school_user','admin')),
  subject_id        TEXT NOT NULL,
  school_id         TEXT REFERENCES schools(id) ON DELETE CASCADE,
  refresh_hash      TEXT NOT NULL UNIQUE,
  prev_refresh_hash TEXT,
  family_id         TEXT NOT NULL,
  status            TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','REVOKED','REUSED')),
  device_id         TEXT REFERENCES devices(id) ON DELETE SET NULL,
  user_agent        TEXT,
  ip                TEXT,
  created_at        TEXT NOT NULL,
  expires_at        TEXT NOT NULL,
  rotated_at        TEXT,
  revoked_at        TEXT
);
CREATE INDEX IF NOT EXISTS idx_sessions_subject ON sessions(subject_type, subject_id);
CREATE INDEX IF NOT EXISTS idx_sessions_family ON sessions(family_id);

CREATE TABLE IF NOT EXISTS audit_logs (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  actor_type  TEXT,
  actor_id    TEXT,
  actor_label TEXT,
  action      TEXT NOT NULL,
  target_type TEXT,
  target_id   TEXT,
  metadata    TEXT,
  ip          TEXT,
  created_at  TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_target ON audit_logs(target_type, target_id);

CREATE TABLE IF NOT EXISTS releases (
  id           TEXT PRIMARY KEY,
  version      TEXT NOT NULL,
  channel      TEXT NOT NULL DEFAULT 'stable' CHECK (channel IN ('stable','beta')),
  download_url TEXT NOT NULL,
  notes        TEXT,
  mandatory    INTEGER NOT NULL DEFAULT 0,
  sha256       TEXT,
  status       TEXT NOT NULL DEFAULT 'PUBLISHED' CHECK (status IN ('PUBLISHED','UNPUBLISHED')),
  published_at TEXT NOT NULL,
  created_at   TEXT NOT NULL,
  UNIQUE (version, channel)
);
`;

let db = null;

export function getDb() {
  if (!db) {
    throw new Error('Database not initialized. Call initDb() first.');
  }
  return db;
}

export function initDb(dbPath = config.db.path) {
  if (db) return db;
  if (dbPath !== ':memory:') {
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  }
  db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.pragma('busy_timeout = 5000');
  db.exec(SCHEMA_SQL);
  return db;
}

export function closeDb() {
  if (db) {
    db.close();
    db = null;
  }
}

/** Integrity check used by the backup script and /health. */
export function checkIntegrity() {
  try {
    const row = getDb().pragma('integrity_check', { simple: true });
    return row === 'ok' || row?.integrity_check === 'ok';
  } catch {
    return false;
  }
}
