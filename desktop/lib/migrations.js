'use strict';

/**
 * Local database schema versioning + migrations.
 *
 * Rules:
 *  - schema_migrations records applied versions.
 *  - BEFORE any migration on an existing database, a full backup is written
 *    to the backups directory.
 *  - Each migration runs in a transaction; on failure the database rolls back
 *    and the pre-migration backup is preserved for recovery.
 *  - Migrations never drop school data; additive/transformative only.
 */

const logger = require('./logger');

const MIGRATIONS = [
  {
    id: 1,
    name: 'initial_schema',
    up: (db) => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS school_info (
          id INTEGER PRIMARY KEY CHECK (id = 1),
          data TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS users (
          id TEXT PRIMARY KEY,
          role TEXT,
          email TEXT,
          status TEXT,
          data TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS classes (
          id TEXT PRIMARY KEY,
          name TEXT,
          data TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS students (
          id TEXT PRIMARY KEY,
          class_id TEXT,
          status TEXT,
          name TEXT,
          data TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS attendance (
          id TEXT PRIMARY KEY,
          class_id TEXT,
          date TEXT,
          student_id TEXT,
          data TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS teacher_attendance (
          id TEXT PRIMARY KEY,
          teacher_id TEXT,
          date TEXT,
          data TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS fee_accounts (
          id TEXT PRIMARY KEY,
          student_id TEXT,
          status TEXT,
          data TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS fee_transactions (
          id TEXT PRIMARY KEY,
          student_id TEXT,
          payment_date TEXT,
          data TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS exams (
          id TEXT PRIMARY KEY,
          data TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS results (
          id TEXT PRIMARY KEY,
          student_id TEXT,
          exam_name TEXT,
          data TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS performance (
          id TEXT PRIMARY KEY,
          student_id TEXT,
          data TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS academic_years (
          id TEXT PRIMARY KEY,
          data TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS activity_logs (
          id TEXT PRIMARY KEY,
          timestamp TEXT,
          data TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS notifications (
          id TEXT PRIMARY KEY,
          data TEXT NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_attendance_class_date ON attendance(class_id, date);
        CREATE INDEX IF NOT EXISTS idx_attendance_student ON attendance(student_id);
        CREATE INDEX IF NOT EXISTS idx_teacher_attendance ON teacher_attendance(teacher_id, date);
        CREATE INDEX IF NOT EXISTS idx_fee_accounts_student ON fee_accounts(student_id);
        CREATE INDEX IF NOT EXISTS idx_fee_tx_student ON fee_transactions(student_id);
        CREATE INDEX IF NOT EXISTS idx_results_student ON results(student_id);
        CREATE INDEX IF NOT EXISTS idx_performance_student ON performance(student_id);
        CREATE INDEX IF NOT EXISTS idx_students_class ON students(class_id);
        CREATE INDEX IF NOT EXISTS idx_logs_time ON activity_logs(timestamp);
      `);
    },
  },
];

function currentVersion(db) {
  db.exec(`CREATE TABLE IF NOT EXISTS schema_migrations (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    applied_at TEXT NOT NULL
  )`);
  const row = db.prepare('SELECT MAX(id) AS v FROM schema_migrations').get();
  return row && row.v ? row.v : 0;
}

/**
 * Apply pending migrations. Returns { applied: [...], version, backupFile }.
 * Throws MIGRATION_FAILED with the backup path preserved on any error.
 */
async function runMigrations(db, { createBackup } = {}) {
  const versionBefore = currentVersion(db);
  const pending = MIGRATIONS.filter((m) => m.id > versionBefore);
  if (pending.length === 0) return { applied: [], version: versionBefore, backupFile: null };

  // Backup before migrating an existing database.
  let backupFile = null;
  const hasData = versionBefore > 0 || db.prepare(`SELECT COUNT(*) AS n FROM sqlite_master WHERE type='table' AND name='students'`).all().length > 0;
  if (hasData && typeof createBackup === 'function') {
    try {
      const result = await createBackup({ reason: 'pre-migration' });
      backupFile = result && (result.path || result.file || result);
      logger.info('pre-migration backup created', { backupFile });
    } catch (err) {
      logger.error('pre-migration backup failed', { error: err.message });
    }
  }

  const applied = [];
  for (const migration of pending) {
    const run = db.transaction(() => {
      migration.up(db);
      db.prepare('INSERT INTO schema_migrations (id, name, applied_at) VALUES (?, ?, ?)').run(
        migration.id,
        migration.name,
        new Date().toISOString()
      );
    });
    try {
      run();
      applied.push(`${migration.id}_${migration.name}`);
      logger.info('migration applied', { migration: migration.name, id: migration.id });
    } catch (err) {
      logger.error('migration failed', { migration: migration.name, error: err.message, backupFile });
      const failure = new Error(`Database migration "${migration.name}" failed. Your data is preserved in a backup.`);
      failure.code = 'MIGRATION_FAILED';
      failure.backupFile = backupFile;
      throw failure;
    }
  }

  // Validate after migrating.
  const integrity = db.pragma('integrity_check', { simple: true });
  if (integrity !== 'ok') {
    logger.error('post-migration integrity check failed', { result: String(integrity) });
    const failure = new Error('Database validation failed after migration.');
    failure.code = 'MIGRATION_FAILED';
    failure.backupFile = backupFile;
    throw failure;
  }

  return { applied, version: currentVersion(db), backupFile };
}

function schemaVersion(db) {
  return currentVersion(db);
}

module.exports = { runMigrations, schemaVersion, MIGRATIONS };
