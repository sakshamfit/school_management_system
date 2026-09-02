/**
 * Database Service - SQLite handling with safety
 * 
 * Features:
 * - WAL mode for better concurrency and crash safety
 * - Migration system with backup-before-migration
 * - Transactional migrations
 * - Integrity checks
 * - Handles restart during write, unexpected termination
 * - Corrupted DB handling
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { getAppDataPaths, SAFETY_LIMITS } = require('./constants');

class DatabaseService {
  constructor(options = {}) {
    this.paths = options.paths || getAppDataPaths();
    this.db = null;
    this.isBetterSqlite3Available = false;
    
    // Try to load better-sqlite3 if available (native module)
    try {
      require('better-sqlite3');
      this.isBetterSqlite3Available = true;
    } catch (e) {
      this.isBetterSqlite3Available = false;
      console.log('[Database] better-sqlite3 not available, using JSON fallback for web mode');
    }

    this.ensureDirs();
  }

  ensureDirs() {
    const dirs = [
      this.paths.database,
      this.paths.backups,
      path.dirname(this.paths.sqliteFile),
      path.join(this.paths.base, 'safety_backups'),
    ];
    for (const dir of dirs) {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    }
  }

  /**
   * Initialize database
   */
  initialize() {
    if (this.isBetterSqlite3Available) {
      return this.initializeSqlite();
    } else {
      return this.initializeJsonFallback();
    }
  }

  initializeSqlite() {
    try {
      const Database = require('better-sqlite3');
      this.db = new Database(this.paths.sqliteFile, {
        // Enable WAL for better crash safety
        // timeout for busy handling
        timeout: 5000,
      });

      // Enable WAL mode
      this.db.pragma('journal_mode = WAL');
      this.db.pragma('synchronous = NORMAL'); // NORMAL is safe with WAL, faster than FULL
      this.db.pragma('foreign_keys = ON');
      this.db.pragma('temp_store = MEMORY');
      this.db.pragma('cache_size = -64000'); // 64MB cache

      console.log('[Database] SQLite initialized with WAL mode');

      // Run migrations
      this.runMigrations();

      // Integrity check
      const integrity = this.checkIntegrity();
      if (!integrity.ok) {
        console.error('[Database] Integrity check failed:', integrity.error);
        throw new Error(`Database integrity check failed: ${integrity.error}`);
      }

      return { success: true, mode: 'sqlite' };
    } catch (e) {
      console.error('[Database] Failed to initialize SQLite:', e.message);
      // Fallback to JSON
      return this.initializeJsonFallback();
    }
  }

  initializeJsonFallback() {
    console.log('[Database] Using JSON fallback (web mode or SQLite unavailable)');
    // Ensure JSON file exists
    const jsonPath = path.join(this.paths.database, 'school.json');
    if (!fs.existsSync(jsonPath)) {
      const initialData = this.getInitialData();
      fs.writeFileSync(jsonPath, JSON.stringify(initialData, null, 2));
    }
    return { success: true, mode: 'json', path: jsonPath };
  }

  getInitialData() {
    return {
      schoolInfo: {
        id: 'school_msps_01',
        name: 'M.S. PUBLIC SCHOOL',
        tagline: 'Excellence in Education',
        address: '',
        phone: '',
        email: '',
        currentAcademicYear: '2026-2027',
        setupCompleted: false,
      },
      users: [],
      classes: [],
      students: [],
      attendance: [],
      teacherAttendance: [],
      feeAccounts: [],
      feeTransactions: [],
      exams: [],
      results: [],
      performance: [],
      academicYears: [],
      activityLogs: [],
      notifications: [],
      meta: {
        version: 1,
        createdAt: new Date().toISOString(),
      }
    };
  }

  /**
   * Run migrations with backup-before-migration
   */
  runMigrations() {
    if (!this.db) return;

    try {
      // Ensure migrations table exists
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS migrations (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          version INTEGER UNIQUE NOT NULL,
          name TEXT NOT NULL,
          applied_at TEXT NOT NULL
        );
      `);

      const currentVersion = this.getCurrentMigrationVersion();
      const migrations = this.getMigrations();

      for (const migration of migrations) {
        if (migration.version > currentVersion) {
          console.log(`[Database] Applying migration ${migration.version}: ${migration.name}`);
          
          // Backup before migration
          this.backupBeforeMigration(migration.version);

          // Run migration in transaction
          const tx = this.db.transaction(() => {
            this.db.exec(migration.sql);
            this.db.prepare('INSERT INTO migrations (version, name, applied_at) VALUES (?, ?, ?)').run(
              migration.version,
              migration.name,
              new Date().toISOString()
            );
          });

          try {
            tx();
            console.log(`[Database] Migration ${migration.version} applied successfully`);
          } catch (e) {
            console.error(`[Database] Migration ${migration.version} failed:`, e.message);
            // Restore from backup
            this.restoreFromMigrationBackup(migration.version);
            throw e;
          }
        }
      }
    } catch (e) {
      console.error('[Database] Migration failed:', e.message);
      throw e;
    }
  }

  getCurrentMigrationVersion() {
    if (!this.db) return 0;
    try {
      const row = this.db.prepare('SELECT MAX(version) as maxVersion FROM migrations').get();
      return row?.maxVersion || 0;
    } catch (e) {
      return 0;
    }
  }

  getMigrations() {
    // Define migrations in order
    return [
      {
        version: 1,
        name: 'Initial schema',
        sql: `
          CREATE TABLE IF NOT EXISTS school_info (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            tagline TEXT,
            address TEXT,
            phone TEXT,
            email TEXT,
            affiliation_number TEXT,
            principal_name TEXT,
            current_academic_year TEXT,
            currency_symbol TEXT,
            setup_completed INTEGER DEFAULT 0,
            created_at TEXT,
            updated_at TEXT
          );

          CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            email TEXT,
            role TEXT NOT NULL,
            password_hash TEXT,
            teacher_code TEXT,
            assigned_class_id TEXT,
            assigned_class_name TEXT,
            subject TEXT,
            phone TEXT,
            photo_url TEXT,
            status TEXT DEFAULT 'active',
            joining_date TEXT,
            created_at TEXT
          );

          CREATE TABLE IF NOT EXISTS classes (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            section TEXT,
            class_teacher_id TEXT,
            class_teacher_name TEXT,
            room_number TEXT,
            capacity INTEGER,
            total_students INTEGER DEFAULT 0
          );

          CREATE TABLE IF NOT EXISTS students (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            roll_number TEXT,
            class_id TEXT,
            class_name TEXT,
            age INTEGER,
            dob TEXT,
            gender TEXT,
            parent_name TEXT,
            parent_phone TEXT,
            parent_relation TEXT,
            address TEXT,
            admission_number TEXT,
            admission_date TEXT,
            photo_url TEXT,
            status TEXT DEFAULT 'active',
            notes TEXT,
            blood_group TEXT,
            academic_year TEXT,
            created_at TEXT,
            updated_at TEXT
          );

          CREATE TABLE IF NOT EXISTS attendance (
            id TEXT PRIMARY KEY,
            date TEXT NOT NULL,
            class_id TEXT,
            class_name TEXT,
            student_id TEXT,
            student_name TEXT,
            roll_number TEXT,
            status TEXT,
            marked_by_user_id TEXT,
            marked_by_user_name TEXT,
            marked_by_role TEXT,
            timestamp TEXT,
            remarks TEXT
          );

          CREATE TABLE IF NOT EXISTS fee_accounts (
            id TEXT PRIMARY KEY,
            student_id TEXT,
            student_name TEXT,
            roll_number TEXT,
            class_id TEXT,
            class_name TEXT,
            total_fee REAL,
            paid_amount REAL,
            due_amount REAL,
            status TEXT,
            last_payment_date TEXT
          );

          CREATE TABLE IF NOT EXISTS fee_transactions (
            id TEXT PRIMARY KEY,
            fee_account_id TEXT,
            student_id TEXT,
            student_name TEXT,
            class_id TEXT,
            class_name TEXT,
            amount REAL,
            payment_date TEXT,
            payment_method TEXT,
            receipt_number TEXT,
            notes TEXT,
            recorded_by_name TEXT,
            recorded_by_user_id TEXT,
            timestamp TEXT
          );

          CREATE INDEX IF NOT EXISTS idx_students_class ON students(class_id);
          CREATE INDEX IF NOT EXISTS idx_attendance_date ON attendance(date);
          CREATE INDEX IF NOT EXISTS idx_attendance_class ON attendance(class_id);
          CREATE INDEX IF NOT EXISTS idx_fee_student ON fee_accounts(student_id);
        `
      },
      {
        version: 2,
        name: 'Add backup metadata table',
        sql: `
          CREATE TABLE IF NOT EXISTS backup_metadata (
            id TEXT PRIMARY KEY,
            provider TEXT,
            account_email TEXT,
            folder_id TEXT,
            last_backup_at TEXT,
            last_backup_status TEXT,
            last_backup_checksum TEXT,
            automatic_backup_enabled INTEGER DEFAULT 1,
            backup_frequency TEXT DEFAULT 'daily',
            created_at TEXT,
            updated_at TEXT
          );
        `
      },
      {
        version: 3,
        name: 'Add license and device tables',
        sql: `
          CREATE TABLE IF NOT EXISTS licenses (
            id TEXT PRIMARY KEY,
            school_id TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'active',
            expires_at TEXT,
            max_devices INTEGER DEFAULT 3,
            created_at TEXT,
            updated_at TEXT
          );

          CREATE TABLE IF NOT EXISTS devices (
            id TEXT PRIMARY KEY,
            school_id TEXT NOT NULL,
            device_id TEXT NOT NULL,
            device_name TEXT,
            platform TEXT,
            last_seen_at TEXT,
            is_active INTEGER DEFAULT 1,
            created_at TEXT
          );

          CREATE UNIQUE INDEX IF NOT EXISTS idx_devices_school_device ON devices(school_id, device_id);
        `
      }
    ];
  }

  backupBeforeMigration(version) {
    if (!this.db) return;
    try {
      const backupPath = path.join(this.paths.database, `pre-migration-v${version}-${Date.now()}.sqlite`);
      this.db.backup(backupPath).then(() => {
        console.log(`[Database] Backup before migration v${version} created: ${backupPath}`);
      }).catch(e => {
        console.warn(`[Database] Failed to backup before migration:`, e.message);
        // Fallback: copy file
        try {
          fs.copyFileSync(this.paths.sqliteFile, backupPath);
        } catch (copyErr) {
          console.warn(`[Database] Fallback copy also failed:`, copyErr.message);
        }
      });
    } catch (e) {
      console.warn(`[Database] Backup before migration failed:`, e.message);
    }
  }

  restoreFromMigrationBackup(version) {
    const pattern = `pre-migration-v${version}-`;
    try {
      const files = fs.readdirSync(this.paths.database)
        .filter(f => f.includes(pattern))
        .map(f => ({
          name: f,
          path: path.join(this.paths.database, f),
          mtime: fs.statSync(path.join(this.paths.database, f)).mtime,
        }))
        .sort((a, b) => b.mtime - a.mtime);

      if (files.length > 0) {
        const latest = files[0];
        fs.copyFileSync(latest.path, this.paths.sqliteFile);
        console.log(`[Database] Restored from migration backup: ${latest.name}`);
        return true;
      }
    } catch (e) {
      console.error(`[Database] Failed to restore from migration backup:`, e.message);
    }
    return false;
  }

  /**
   * Check database integrity
   */
  checkIntegrity() {
    if (!this.db) {
      return { ok: true, mode: 'json', message: 'JSON mode, no integrity check needed' };
    }

    try {
      const result = this.db.pragma('integrity_check');
      if (result && result[0] && result[0].integrity_check === 'ok') {
        return { ok: true, message: 'Integrity check passed' };
      }
      // better-sqlite3 returns array of objects or string
      const check = this.db.prepare('PRAGMA integrity_check').get();
      if (typeof check === 'string' && check === 'ok') {
        return { ok: true };
      }
      if (Array.isArray(result) && result.length === 1 && result[0].integrity_check === 'ok') {
        return { ok: true };
      }
      // If result is array of strings
      if (Array.isArray(result) && result[0] === 'ok') {
        return { ok: true };
      }
      return { ok: false, error: JSON.stringify(result) };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  }

  /**
   * Create safety backup before dangerous operations
   */
  createSafetyBackup() {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupDir = path.join(this.paths.base, 'safety_backups');
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }

    const backupPath = path.join(backupDir, `safety-${timestamp}.sqlite`);

    try {
      if (this.db) {
        // Use SQLite backup API if available
        if (this.db.backup) {
          // better-sqlite3 backup is async in newer versions, but we can copy file as fallback
          fs.copyFileSync(this.paths.sqliteFile, backupPath);
        } else {
          fs.copyFileSync(this.paths.sqliteFile, backupPath);
        }
      } else {
        // JSON mode
        const jsonPath = path.join(this.paths.database, 'school.json');
        if (fs.existsSync(jsonPath)) {
          fs.copyFileSync(jsonPath, backupPath.replace('.sqlite', '.json'));
        }
      }
      console.log(`[Database] Safety backup created: ${backupPath}`);
      return { success: true, path: backupPath };
    } catch (e) {
      console.error(`[Database] Safety backup failed:`, e.message);
      return { success: false, error: e.message };
    }
  }

  /**
   * Handle corrupted database
   */
  handleCorruptedDatabase() {
    console.error('[Database] Handling corrupted database');
    
    const corruptedPath = `${this.paths.sqliteFile}.corrupted-${Date.now()}`;
    try {
      if (fs.existsSync(this.paths.sqliteFile)) {
        fs.renameSync(this.paths.sqliteFile, corruptedPath);
        console.log(`[Database] Corrupted DB moved to: ${corruptedPath}`);
      }
    } catch (e) {
      console.warn(`[Database] Failed to move corrupted DB:`, e.message);
    }

    // Try to restore from latest safety backup
    const restored = this.restoreFromLatestSafetyBackup();
    if (restored) {
      console.log('[Database] Restored from safety backup');
      return { restored: true, from: restored };
    }

    // Try to restore from local backups
    const localRestored = this.restoreFromLocalBackup();
    if (localRestored) {
      console.log('[Database] Restored from local backup');
      return { restored: true, from: localRestored };
    }

    // Last resort: create fresh DB
    console.log('[Database] Creating fresh database');
    this.initializeJsonFallback();
    return { restored: false, fresh: true, corruptedPath };
  }

  restoreFromLatestSafetyBackup() {
    try {
      const safetyDir = path.join(this.paths.base, 'safety_backups');
      if (!fs.existsSync(safetyDir)) return null;

      const files = fs.readdirSync(safetyDir)
        .filter(f => f.endsWith('.sqlite'))
        .map(f => ({
          name: f,
          path: path.join(safetyDir, f),
          mtime: fs.statSync(path.join(safetyDir, f)).mtime,
        }))
        .sort((a, b) => b.mtime - a.mtime);

      if (files.length > 0) {
        fs.copyFileSync(files[0].path, this.paths.sqliteFile);
        return files[0].path;
      }
    } catch (e) {
      console.error('[Database] Failed to restore from safety backup:', e.message);
    }
    return null;
  }

  restoreFromLocalBackup() {
    try {
      if (!fs.existsSync(this.paths.localBackupDir)) return null;

      const files = fs.readdirSync(this.paths.localBackupDir)
        .filter(f => f.startsWith('local-backup-') && f.endsWith('.json'))
        .map(f => ({
          name: f,
          path: path.join(this.paths.localBackupDir, f),
          mtime: fs.statSync(path.join(this.paths.localBackupDir, f)).mtime,
        }))
        .sort((a, b) => b.mtime - a.mtime);

      if (files.length > 0) {
        const data = JSON.parse(fs.readFileSync(files[0].path, 'utf8'));
        const jsonPath = path.join(this.paths.database, 'school.json');
        fs.writeFileSync(jsonPath, JSON.stringify(data, null, 2));
        return files[0].path;
      }
    } catch (e) {
      console.error('[Database] Failed to restore from local backup:', e.message);
    }
    return null;
  }

  /**
   * Close database
   */
  close() {
    if (this.db) {
      try {
        this.db.close();
        console.log('[Database] Closed');
      } catch (e) {
        console.warn('[Database] Failed to close:', e.message);
      }
      this.db = null;
    }
  }

  /**
   * Get database file path
   */
  getDatabasePath() {
    return this.paths.sqliteFile;
  }

  /**
   * Vacuum (optimize)
   */
  vacuum() {
    if (!this.db) return;
    try {
      this.db.exec('VACUUM');
      console.log('[Database] Vacuum completed');
    } catch (e) {
      console.warn('[Database] Vacuum failed:', e.message);
    }
  }
}

module.exports = DatabaseService;
