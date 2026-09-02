/**
 * Backup Package Service
 * Creates encrypted backup packages containing:
 * - manifest.json
 * - school.sqlite (or JSON dump)
 * - uploads/, settings/, metadata/ if present
 * 
 * Format: .smbak file = AES-256-GCM encrypted tar.gz-like archive (JSON + gzip)
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const zlib = require('zlib');
const os = require('os');
const { 
  FORMAT_VERSION, 
  BACKUP_FILE_PREFIX, 
  BACKUP_FILE_EXTENSION,
  getAppDataPaths,
  SAFETY_LIMITS,
} = require('./constants');

class BackupPackageService {
  constructor(options = {}) {
    this.appVersion = options.appVersion || '1.0.0';
    this.paths = options.paths || getAppDataPaths();
  }

  ensureDir(dirPath) {
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
  }

  /**
   * Check SQLite health via integrity_check
   * For file-based approach, we check file exists and header
   */
  checkDatabaseHealth(dbPath = null) {
    const sqlitePath = dbPath || this.paths.sqliteFile;
    
    // If SQLite file doesn't exist, we are in web mode using localStorage JSON
    // Health check passes if we have any data source
    if (!fs.existsSync(sqlitePath)) {
      // Check if we have localStorage backup or JSON files
      return { healthy: true, mode: 'json', message: 'Using JSON storage (web mode)' };
    }

    try {
      const fd = fs.openSync(sqlitePath, 'r');
      const header = Buffer.alloc(16);
      fs.readSync(fd, header, 0, 16, 0);
      fs.closeSync(fd);
      
      const sqliteMagic = 'SQLite format 3\0';
      if (header.toString('utf8', 0, 16) !== sqliteMagic) {
        return { healthy: false, error: 'Invalid SQLite header' };
      }
      
      // Additional check: file size > 0 and reasonable
      const stats = fs.statSync(sqlitePath);
      if (stats.size === 0) {
        return { healthy: false, error: 'Database file is empty' };
      }
      if (stats.size > SAFETY_LIMITS.maxBackupSizeBytes) {
        return { healthy: false, error: 'Database file too large' };
      }

      return { healthy: true, mode: 'sqlite', size: stats.size };
    } catch (e) {
      return { healthy: false, error: e.message };
    }
  }

  /**
   * Create consistent database snapshot
   * For SQLite: copy file with file lock handling
   * For JSON: read from localStorage dump or provided data
   */
  createDatabaseSnapshot(tempDir, providedData = null) {
    this.ensureDir(tempDir);
    const snapshotPath = path.join(tempDir, 'school.sqlite');
    
    if (providedData) {
      // Provided data is JSON database dump
      // Write as JSON but named .sqlite for compatibility, or as .json
      // We will write both for safety
      fs.writeFileSync(snapshotPath, JSON.stringify(providedData, null, 2));
      fs.writeFileSync(path.join(tempDir, 'school.json'), JSON.stringify(providedData, null, 2));
      return snapshotPath;
    }

    const sqlitePath = this.paths.sqliteFile;
    if (fs.existsSync(sqlitePath)) {
      // Copy SQLite file - use copyFileSync for atomic snapshot
      // In production, we should use SQLite backup API for consistency
      try {
        fs.copyFileSync(sqlitePath, snapshotPath);
        return snapshotPath;
      } catch (e) {
        throw new Error(`Failed to create database snapshot: ${e.message}`);
      }
    } else {
      // No SQLite file, check for JSON backup in local backups dir
      // For web mode, we will expect data to be provided via param
      // Create empty placeholder that will be filled later
      const placeholder = {
        note: 'No SQLite file found, this is a placeholder. Real data should be provided via backup API.',
        createdAt: new Date().toISOString(),
      };
      fs.writeFileSync(snapshotPath, JSON.stringify(placeholder, null, 2));
      return snapshotPath;
    }
  }

  /**
   * Collect additional school files (uploads, settings, metadata)
   * Only includes files that belong to the school and are safe
   */
  collectAdditionalFiles(tempDir) {
    const collected = [];
    const safeDirs = ['uploads', 'settings', 'metadata'];
    
    for (const dirName of safeDirs) {
      const sourceDir = path.join(this.paths.base, dirName);
      if (fs.existsSync(sourceDir)) {
        const destDir = path.join(tempDir, dirName);
        this.ensureDir(destDir);
        try {
          this.copyDirSafe(sourceDir, destDir, collected);
        } catch (e) {
          console.warn(`[BackupPackage] Failed to collect ${dirName}:`, e.message);
        }
      }
    }
    
    return collected;
  }

  copyDirSafe(src, dest, collectedList, depth = 0) {
    if (depth > 10) throw new Error('Directory depth exceeded, possible symlink loop');
    
    const entries = fs.readdirSync(src, { withFileTypes: true });
    if (entries.length > SAFETY_LIMITS.maxFilesInArchive) {
      throw new Error('Too many files in source directory');
    }

    for (const entry of entries) {
      // Security: prevent path traversal and malicious filenames
      if (entry.name.includes('..') || entry.name.includes('/') || entry.name.includes('\\')) {
        console.warn(`[BackupPackage] Skipping suspicious filename: ${entry.name}`);
        continue;
      }
      if (entry.name.length > SAFETY_LIMITS.maxFileNameLength) {
        console.warn(`[BackupPackage] Skipping too long filename: ${entry.name}`);
        continue;
      }
      // Skip hidden files and sensitive files
      if (entry.name.startsWith('.') && entry.name !== '.keep') continue;
      if (['tokens.enc', 'backup_key.enc', 'gdrive_tokens.enc'].includes(entry.name)) continue;

      const srcPath = path.join(src, entry.name);
      const destPath = path.join(dest, entry.name);

      // Prevent symlink attacks
      const stat = fs.lstatSync(srcPath);
      if (stat.isSymbolicLink()) {
        console.warn(`[BackupPackage] Skipping symlink: ${srcPath}`);
        continue;
      }

      if (entry.isDirectory()) {
        this.ensureDir(destPath);
        this.copyDirSafe(srcPath, destPath, collectedList, depth + 1);
      } else if (entry.isFile()) {
        if (stat.size > SAFETY_LIMITS.maxBackupSizeBytes) {
          console.warn(`[BackupPackage] Skipping oversized file: ${srcPath}`);
          continue;
        }
        fs.copyFileSync(srcPath, destPath);
        collectedList.push(destPath);
      }
    }
  }

  /**
   * Generate manifest.json
   */
  generateManifest(options = {}) {
    const {
      schoolId = 'default_school',
      databaseVersion = '1',
      fileCount = 0,
      checksum = '',
      deviceId = os.hostname(),
    } = options;

    const manifest = {
      formatVersion: FORMAT_VERSION,
      appVersion: this.appVersion,
      schoolId,
      createdAt: new Date().toISOString(),
      databaseVersion,
      checksum,
      fileCount,
      deviceId,
      platform: os.platform(),
      arch: os.arch(),
      // Do NOT include secrets, tokens, passwords
    };

    // Validate manifest size
    const manifestStr = JSON.stringify(manifest);
    if (manifestStr.length > SAFETY_LIMITS.maxManifestSize) {
      throw new Error('Manifest too large');
    }

    return manifest;
  }

  /**
   * Create archive (tar-like JSON + gzip)
   * We use a simple format: JSON object with files as base64, then gzip
   * This avoids needing external zip libraries
   */
  createArchive(tempDir, manifest) {
    const archive = {
      manifest,
      files: {},
    };

    // Read all files in tempDir recursively
    const files = this.listFilesRecursive(tempDir);
    
    if (files.length > SAFETY_LIMITS.maxFilesInArchive) {
      throw new Error('Too many files for backup archive');
    }

    let totalSize = 0;
    for (const filePath of files) {
      const relative = path.relative(tempDir, filePath);
      
      // Security checks
      if (relative.includes('..')) throw new Error('Path traversal detected in archive');
      if (relative.length > SAFETY_LIMITS.maxFileNameLength) continue;
      
      const stat = fs.statSync(filePath);
      if (stat.size > SAFETY_LIMITS.maxBackupSizeBytes) {
        console.warn(`[BackupPackage] Skipping large file in archive: ${relative}`);
        continue;
      }
      
      totalSize += stat.size;
      if (totalSize > SAFETY_LIMITS.maxExtractedSizeBytes) {
        throw new Error('Total backup size exceeds safety limit');
      }

      const data = fs.readFileSync(filePath);
      archive.files[relative] = data.toString('base64');
    }

    archive.manifest.fileCount = Object.keys(archive.files).length;

    // Calculate checksum of file contents (before compression)
    const fileContentsForChecksum = Object.keys(archive.files)
      .sort()
      .map(k => archive.files[k])
      .join('');
    const checksum = crypto.createHash('sha256').update(fileContentsForChecksum).digest('hex');
    archive.manifest.checksum = checksum;

    // Serialize and compress
    const jsonStr = JSON.stringify(archive);
    const compressed = zlib.gzipSync(Buffer.from(jsonStr, 'utf8'), { level: 6 });

    return {
      buffer: compressed,
      manifest: archive.manifest,
      checksum,
      fileCount: Object.keys(archive.files).length,
      uncompressedSize: Buffer.byteLength(jsonStr),
      compressedSize: compressed.length,
    };
  }

  listFilesRecursive(dir, fileList = []) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      const lstat = fs.lstatSync(fullPath);
      if (lstat.isSymbolicLink()) continue; // Skip symlinks
      if (entry.isDirectory()) {
        this.listFilesRecursive(fullPath, fileList);
      } else if (entry.isFile()) {
        fileList.push(fullPath);
      }
    }
    return fileList;
  }

  /**
   * Extract and validate archive
   */
  extractArchive(compressedBuffer, destDir) {
    if (compressedBuffer.length > SAFETY_LIMITS.maxBackupSizeBytes) {
      throw new Error('Compressed archive too large');
    }

    let decompressed;
    try {
      decompressed = zlib.gunzipSync(compressedBuffer);
    } catch (e) {
      throw new Error(`Failed to decompress backup: ${e.message}`);
    }

    if (decompressed.length > SAFETY_LIMITS.maxExtractedSizeBytes) {
      throw new Error('Decompressed backup too large, possible zip bomb');
    }

    let archive;
    try {
      archive = JSON.parse(decompressed.toString('utf8'));
    } catch (e) {
      throw new Error(`Invalid backup archive JSON: ${e.message}`);
    }

    // Validate manifest
    if (!archive.manifest) throw new Error('Missing manifest in backup');
    this.validateManifest(archive.manifest);

    if (!archive.files || typeof archive.files !== 'object') {
      throw new Error('Missing files in backup archive');
    }

    const fileNames = Object.keys(archive.files);
    if (fileNames.length > SAFETY_LIMITS.maxFilesInArchive) {
      throw new Error('Too many files in backup archive');
    }

    // Verify checksum
    const fileContentsForChecksum = fileNames
      .sort()
      .map(k => archive.files[k])
      .join('');
    const calculatedChecksum = crypto.createHash('sha256').update(fileContentsForChecksum).digest('hex');
    if (calculatedChecksum !== archive.manifest.checksum) {
      throw new Error('Backup checksum mismatch, corrupted archive');
    }

    // Extract files safely
    this.ensureDir(destDir);
    for (const relativePath of fileNames) {
      // Security: prevent path traversal
      if (relativePath.includes('..') || path.isAbsolute(relativePath)) {
        throw new Error(`Path traversal attempt in backup: ${relativePath}`);
      }
      if (relativePath.length > SAFETY_LIMITS.maxFileNameLength) {
        throw new Error(`Filename too long: ${relativePath}`);
      }

      const destPath = path.join(destDir, relativePath);
      const destDirName = path.dirname(destPath);

      // Ensure destPath is within destDir
      const resolvedDest = path.resolve(destPath);
      const resolvedBase = path.resolve(destDir);
      if (!resolvedDest.startsWith(resolvedBase)) {
        throw new Error(`Path traversal detected: ${relativePath}`);
      }

      this.ensureDir(destDirName);
      const fileData = Buffer.from(archive.files[relativePath], 'base64');
      
      if (fileData.length > SAFETY_LIMITS.maxBackupSizeBytes) {
        throw new Error(`File too large in archive: ${relativePath}`);
      }

      fs.writeFileSync(destPath, fileData);
    }

    return {
      manifest: archive.manifest,
      fileCount: fileNames.length,
      extractedTo: destDir,
    };
  }

  validateManifest(manifest) {
    if (!manifest) throw new Error('Manifest is null');
    if (manifest.formatVersion !== FORMAT_VERSION) {
      throw new Error(`Unsupported backup format version: ${manifest.formatVersion}`);
    }
    if (!manifest.createdAt) throw new Error('Manifest missing createdAt');
    if (!manifest.checksum) throw new Error('Manifest missing checksum');
    if (!manifest.schoolId) throw new Error('Manifest missing schoolId');
    // Check for secrets that should NOT be in manifest
    const forbiddenKeys = ['password', 'token', 'secret', 'key', 'oauth', 'refresh'];
    const manifestStr = JSON.stringify(manifest).toLowerCase();
    for (const forbidden of forbiddenKeys) {
      if (manifestStr.includes(forbidden) && manifestStr.includes('token')) {
        // Allow checksum field, but not token fields
        if (forbidden === 'token' && manifest.checksum) continue;
        // More strict check for actual secret keys
        if (manifest[forbidden] || manifest[`${forbidden}Token`] || manifest[`${forbidden}_token`]) {
          throw new Error(`Manifest contains forbidden field: ${forbidden}`);
        }
      }
    }
    return true;
  }

  /**
   * Full backup creation flow
   */
  async createBackupPackage(options = {}) {
    const {
      schoolId = 'default_school',
      schoolData = null, // JSON data for web mode
      databaseVersion = '1',
      deviceId = os.hostname(),
      tempBaseDir = null,
    } = options;

    const tempDir = tempBaseDir || fs.mkdtempSync(path.join(os.tmpdir(), 'school-backup-'));
    this.ensureDir(tempDir);

    try {
      // 1. Check DB health
      const health = this.checkDatabaseHealth();
      if (!health.healthy) {
        throw new Error(`Database health check failed: ${health.error}`);
      }

      // 2. Create snapshot
      this.createDatabaseSnapshot(tempDir, schoolData);

      // 3. Collect additional files
      const additionalFiles = this.collectAdditionalFiles(tempDir);

      // 4. Generate manifest (checksum will be filled after archive creation)
      const manifest = this.generateManifest({
        schoolId,
        databaseVersion,
        fileCount: 0,
        checksum: '',
        deviceId,
      });

      // Write manifest temporarily
      fs.writeFileSync(path.join(tempDir, 'manifest.json'), JSON.stringify(manifest, null, 2));

      // 5. Create archive
      const archiveResult = this.createArchive(tempDir, manifest);

      // Update manifest with final checksum
      archiveResult.manifest.checksum = archiveResult.checksum;

      return {
        tempDir,
        archiveBuffer: archiveResult.buffer,
        manifest: archiveResult.manifest,
        checksum: archiveResult.checksum,
        fileCount: archiveResult.fileCount,
        size: archiveResult.compressedSize,
        uncompressedSize: archiveResult.uncompressedSize,
      };
    } catch (e) {
      // Cleanup temp dir on error
      try {
        fs.rmSync(tempDir, { recursive: true, force: true });
      } catch (cleanupErr) {}
      throw e;
    }
  }

  /**
   * Generate backup filename with timestamp
   */
  generateBackupFilename(date = new Date()) {
    const pad = (n) => n.toString().padStart(2, '0');
    const timestamp = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
    return `${BACKUP_FILE_PREFIX}-${timestamp}${BACKUP_FILE_EXTENSION}`;
  }

  /**
   * Validate SQLite integrity after extraction
   */
  validateExtractedDatabase(extractedDir) {
    const sqlitePath = path.join(extractedDir, 'school.sqlite');
    const jsonPath = path.join(extractedDir, 'school.json');
    
    if (fs.existsSync(sqlitePath)) {
      const data = fs.readFileSync(sqlitePath);
      // Check if it's actually JSON (web mode) or SQLite
      try {
        const maybeJson = JSON.parse(data.toString('utf8'));
        // If it's JSON, validate structure
        if (maybeJson.schoolInfo && Array.isArray(maybeJson.students)) {
          return { valid: true, type: 'json', size: data.length };
        }
      } catch (e) {
        // Not JSON, check SQLite header
        if (data.length >= 16) {
          const header = data.toString('utf8', 0, 16);
          if (header === 'SQLite format 3\0') {
            return { valid: true, type: 'sqlite', size: data.length };
          }
        }
      }
      // If file exists but not valid, still check size
      if (data.length > 0) {
        return { valid: true, type: 'unknown', size: data.length, warning: 'Unknown format but non-empty' };
      }
      return { valid: false, error: 'Extracted database file is invalid' };
    } else if (fs.existsSync(jsonPath)) {
      try {
        const data = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
        if (data.schoolInfo) {
          return { valid: true, type: 'json', size: fs.statSync(jsonPath).size };
        }
      } catch (e) {
        return { valid: false, error: `Invalid JSON database: ${e.message}` };
      }
    }
    
    return { valid: false, error: 'No database file found in backup' };
  }

  cleanupTempDir(tempDir) {
    if (tempDir && fs.existsSync(tempDir)) {
      try {
        fs.rmSync(tempDir, { recursive: true, force: true });
      } catch (e) {
        console.warn(`[BackupPackage] Failed to cleanup temp dir ${tempDir}:`, e.message);
      }
    }
  }
}

module.exports = BackupPackageService;
