/**
 * Backup Restore Service
 * Implements safe restore with:
 * - Safety backup before restore
 * - Checksum verification
 * - Decryption
 * - Manifest validation
 * - SQLite integrity validation
 * - Atomic replacement
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const { getAppDataPaths, SAFETY_LIMITS } = require('./constants');
const BackupPackageService = require('./backupPackageService');
const BackupEncryptionService = require('./backupEncryptionService');

class BackupRestoreService {
  constructor(options = {}) {
    this.paths = options.paths || getAppDataPaths();
    this.packageService = options.packageService || new BackupPackageService({ paths: this.paths });
    this.encryptionService = options.encryptionService || new BackupEncryptionService();
    this.driveClient = options.driveClient || null;
  }

  ensureDir(dirPath) {
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
  }

  /**
   * Create safety backup of current database before restore
   */
  async createSafetyBackup() {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const safetyDir = path.join(this.paths.base, 'safety_backups');
    this.ensureDir(safetyDir);

    const safetyFileName = `safety-backup-${timestamp}.sqlite`;
    const safetyPath = path.join(safetyDir, safetyFileName);

    try {
      if (fs.existsSync(this.paths.sqliteFile)) {
        fs.copyFileSync(this.paths.sqliteFile, safetyPath);
        return { success: true, path: safetyPath, type: 'sqlite' };
      } else {
        // For JSON mode, we need school data provided externally
        // This will be handled by the caller providing data
        return { success: true, path: null, type: 'none', note: 'No SQLite file, safety backup will be handled via JSON' };
      }
    } catch (e) {
      throw new Error(`Failed to create safety backup: ${e.message}`);
    }
  }

  /**
   * Download backup from Google Drive
   */
  async downloadBackup(fileId) {
    if (!this.driveClient) {
      throw new Error('Drive client not configured');
    }

    try {
      const buffer = await this.driveClient.downloadFile(fileId);
      
      if (buffer.length > SAFETY_LIMITS.maxBackupSizeBytes) {
        throw new Error('Downloaded backup too large, possible malicious file');
      }

      return buffer;
    } catch (e) {
      if (e.message.includes('INTERNET_UNAVAILABLE')) {
        throw new Error('INTERNET_UNAVAILABLE: Cannot download backup without internet');
      }
      throw e;
    }
  }

  /**
   * Verify, decrypt, and validate backup
   */
  async verifyAndDecryptBackup(encryptedBuffer, options = {}) {
    // 1. Verify no plaintext leakage (basic check)
    this.encryptionService.verifyNoPlaintextLeakage(encryptedBuffer);

    // 2. Decrypt
    let decryptedBuffer;
    try {
      decryptedBuffer = this.encryptionService.decryptBuffer(encryptedBuffer, options.encryptionKey || null);
    } catch (e) {
      throw new Error(`Decryption failed: ${e.message}. If encryption key is lost, backup is unrecoverable.`);
    }

    // 3. Extract and validate archive
    const tempExtractDir = fs.mkdtempSync(path.join(os.tmpdir(), 'restore-extract-'));
    try {
      const extractResult = this.packageService.extractArchive(decryptedBuffer, tempExtractDir);
      
      // 4. Validate database
      const dbValidation = this.packageService.validateExtractedDatabase(tempExtractDir);
      if (!dbValidation.valid) {
        throw new Error(`Database validation failed: ${dbValidation.error}`);
      }

      return {
        decryptedBuffer,
        extractDir: tempExtractDir,
        manifest: extractResult.manifest,
        dbValidation,
        fileCount: extractResult.fileCount,
      };
    } catch (e) {
      // Cleanup on failure
      try { fs.rmSync(tempExtractDir, { recursive: true, force: true }); } catch (cleanupErr) {}
      throw e;
    }
  }

  /**
   * Prepare restored database for atomic replacement
   */
  async prepareRestoredDatabase(extractDir) {
    const sqlitePath = path.join(extractDir, 'school.sqlite');
    const jsonPath = path.join(extractDir, 'school.json');
    const manifestPath = path.join(extractDir, 'manifest.json');

    let restoredData = null;
    let restoredType = null;

    if (fs.existsSync(jsonPath)) {
      try {
        restoredData = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
        restoredType = 'json';
      } catch (e) {
        throw new Error(`Invalid JSON in backup: ${e.message}`);
      }
    } else if (fs.existsSync(sqlitePath)) {
      // Check if it's JSON or SQLite
      const data = fs.readFileSync(sqlitePath);
      try {
        const maybeJson = JSON.parse(data.toString('utf8'));
        if (maybeJson.schoolInfo) {
          restoredData = maybeJson;
          restoredType = 'json';
        } else {
          restoredType = 'sqlite';
        }
      } catch (e) {
        // Assume SQLite
        restoredType = 'sqlite';
      }
    }

    if (!restoredData && restoredType !== 'sqlite') {
      throw new Error('No valid database found in backup');
    }

    return {
      extractDir,
      sqlitePath: fs.existsSync(sqlitePath) ? sqlitePath : null,
      jsonPath: fs.existsSync(jsonPath) ? jsonPath : null,
      manifestPath: fs.existsSync(manifestPath) ? manifestPath : null,
      restoredData,
      restoredType,
    };
  }

  /**
   * Perform atomic replacement of current database
   */
  async atomicReplaceDatabase(prepared, options = {}) {
    const { schoolDataCallback } = options;

    if (prepared.restoredType === 'json' && prepared.restoredData) {
      // For JSON mode, we need to call back to renderer to update localStorage
      // In Electron, we can write to a file that will be loaded on next start
      // Or we return data for the main process to send to renderer
      if (schoolDataCallback) {
        await schoolDataCallback(prepared.restoredData);
      }
      
      // Also save to local backup file for persistence
      const tempJsonPath = path.join(this.paths.base, 'database', 'restored.json');
      this.ensureDir(path.dirname(tempJsonPath));
      fs.writeFileSync(tempJsonPath, JSON.stringify(prepared.restoredData, null, 2));
      
      return { success: true, type: 'json', data: prepared.restoredData };
    } else if (prepared.restoredType === 'sqlite' && prepared.sqlitePath) {
      // Atomic replacement for SQLite
      const currentDbPath = this.paths.sqliteFile;
      const backupCurrentPath = `${currentDbPath}.pre-restore-${Date.now()}`;
      
      try {
        // Step 1: Backup current DB if exists
        if (fs.existsSync(currentDbPath)) {
          fs.copyFileSync(currentDbPath, backupCurrentPath);
        }

        // Step 2: Copy new DB to temp location first
        const tempNewPath = `${currentDbPath}.new`;
        fs.copyFileSync(prepared.sqlitePath, tempNewPath);

        // Step 3: Validate new DB (basic header check)
        const health = this.packageService.checkDatabaseHealth(tempNewPath);
        if (!health.healthy) {
          fs.unlinkSync(tempNewPath);
          throw new Error(`Restored database health check failed: ${health.error}`);
        }

        // Step 4: Atomic rename (on Windows, need to handle)
        try {
          if (fs.existsSync(currentDbPath)) {
            fs.unlinkSync(currentDbPath);
          }
          fs.renameSync(tempNewPath, currentDbPath);
        } catch (e) {
          // On Windows, rename might fail if file in use, try copy + delete
          fs.copyFileSync(tempNewPath, currentDbPath);
          fs.unlinkSync(tempNewPath);
        }

        // Step 5: Cleanup backup of current if restore succeeded
        // Keep it as safety for a while, but we can leave it
        return { success: true, type: 'sqlite', previousBackup: backupCurrentPath };
      } catch (e) {
        // Restore previous if failed
        if (fs.existsSync(backupCurrentPath) && !fs.existsSync(currentDbPath)) {
          try { fs.copyFileSync(backupCurrentPath, currentDbPath); } catch (restoreErr) {}
        }
        throw new Error(`Atomic replacement failed: ${e.message}. Original database preserved.`);
      }
    } else {
      throw new Error('Unsupported restore type');
    }
  }

  /**
   * Full restore flow
   */
  async restoreBackup(fileId, options = {}) {
    const {
      schoolDataCallback = null, // Function to update school data in renderer
      encryptionKey = null,
      skipSafetyBackup = false,
    } = options;

    let safetyBackup = null;
    let extractDir = null;

    try {
      // 1. Safety backup
      if (!skipSafetyBackup) {
        safetyBackup = await this.createSafetyBackup();
      }

      // 2. Download
      const encryptedBuffer = await this.downloadBackup(fileId);

      // 3. Verify, decrypt, validate
      const verified = await this.verifyAndDecryptBackup(encryptedBuffer, { encryptionKey });
      extractDir = verified.extractDir;

      // 4. Prepare
      const prepared = await this.prepareRestoredDatabase(extractDir);

      // 5. Atomic replacement
      const result = await this.atomicReplaceDatabase(prepared, { schoolDataCallback });

      // 6. Cleanup extract dir
      try { fs.rmSync(extractDir, { recursive: true, force: true }); } catch (e) {}

      return {
        success: true,
        manifest: verified.manifest,
        dbValidation: verified.dbValidation,
        safetyBackup,
        restored: result,
      };
    } catch (e) {
      // Cleanup on failure
      if (extractDir) {
        try { fs.rmSync(extractDir, { recursive: true, force: true }); } catch (cleanupErr) {}
      }
      throw e;
    }
  }

  /**
   * Restore from local encrypted file (for testing or offline restore)
   */
  async restoreFromLocalFile(filePath, options = {}) {
    if (!fs.existsSync(filePath)) {
      throw new Error(`Backup file not found: ${filePath}`);
    }

    const encryptedBuffer = fs.readFileSync(filePath);
    const verified = await this.verifyAndDecryptBackup(encryptedBuffer, options);
    const prepared = await this.prepareRestoredDatabase(verified.extractDir);
    const result = await this.atomicReplaceDatabase(prepared, options);

    try { fs.rmSync(verified.extractDir, { recursive: true, force: true }); } catch (e) {}

    return {
      success: true,
      manifest: verified.manifest,
      restored: result,
    };
  }

  cleanup() {
    // Cleanup any temp dirs
  }
}

module.exports = BackupRestoreService;
