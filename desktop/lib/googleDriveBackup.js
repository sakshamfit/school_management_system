/**
 * Google Drive Backup Facade
 * Main service combining all backup components
 * 
 * Responsibilities:
 * - Orchestrate backup creation flow
 * - Handle upload with verification
 * - Retention management
 * - Expose simple API for IPC
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const { 
  BACKUP_FILE_PREFIX, 
  BACKUP_FILE_EXTENSION, 
  LATEST_BACKUP_NAME,
  BACKUP_STATUS,
  getAppDataPaths,
  SAFETY_LIMITS,
} = require('./constants');
const BackupPackageService = require('./backupPackageService');
const BackupEncryptionService = require('./backupEncryptionService');
const BackupRepository = require('./backupRepository');
const BackupRestoreService = require('./backupRestoreService');
const GoogleAuthManager = require('./googleAuthManager');
const GoogleDriveClient = require('./googleDriveClient');
const BackupScheduler = require('./backupScheduler');

class GoogleDriveBackupService {
  constructor(options = {}) {
    this.paths = options.paths || getAppDataPaths();
    this.appVersion = options.appVersion || '1.0.0';
    
    this.packageService = options.packageService || new BackupPackageService({ 
      appVersion: this.appVersion,
      paths: this.paths,
    });
    this.encryptionService = options.encryptionService || new BackupEncryptionService();
    this.repository = options.repository || new BackupRepository({ paths: this.paths });
    this.authManager = options.authManager || new GoogleAuthManager();
    this.driveClient = options.driveClient || new GoogleDriveClient(this.authManager);
    this.restoreService = options.restoreService || new BackupRestoreService({
      paths: this.paths,
      packageService: this.packageService,
      encryptionService: this.encryptionService,
      driveClient: this.driveClient,
    });
    this.scheduler = options.scheduler || new BackupScheduler(this, this.repository);
    
    this.isBackupInProgress = false;
  }

  /**
   * Connect Google Drive (OAuth flow)
   */
  async connectGoogleDrive(shellOpenExternal) {
    try {
      const tokens = await this.authManager.authenticate(shellOpenExternal);
      
      // Ensure backup folder exists
      const folders = await this.driveClient.ensureBackupFolder();
      
      // Save connection info
      this.repository.setConnectionInfo({
        email: tokens.userInfo.email,
        name: tokens.userInfo.name,
        folderId: folders.backupFolderId,
        rootFolderId: folders.rootFolderId,
      });

      return {
        success: true,
        email: tokens.userInfo.email,
        name: tokens.userInfo.name,
        folders,
      };
    } catch (e) {
      throw new Error(`Failed to connect Google Drive: ${e.message}`);
    }
  }

  /**
   * Disconnect Google Drive
   * Does NOT delete backups from Drive, only removes local connection
   */
  async disconnectGoogleDrive() {
    this.authManager.clearTokens();
    this.driveClient.clearCache();
    this.repository.clearConnectionInfo();
    
    return { success: true, message: 'Disconnected. Existing backups remain in Google Drive.' };
  }

  /**
   * Get connection status (safe, no tokens)
   */
  getConnectionStatus() {
    return this.repository.getSafeSettings();
  }

  /**
   * Create and upload backup - full flow per spec:
   * 1. Check SQLite health
   * 2. Create consistent snapshot
   * 3. Include required files
   * 4. Generate manifest
   * 5. Calculate checksum
   * 6. Compress
   * 7. Encrypt
   * 8. Upload
   * 9. Verify upload
   * 10. Update metadata
   * 11. Return success
   */
  async createAndUploadBackup(schoolData = null) {
    if (this.isBackupInProgress) {
      throw new Error('Backup already in progress');
    }

    this.isBackupInProgress = true;
    let tempDir = null;

    try {
      // Check if connected
      if (!this.authManager.isConnected()) {
        throw new Error('Not connected to Google Drive');
      }

      // Check connectivity
      const isOnline = await this.driveClient.checkConnectivity().catch(() => false);
      if (!isOnline) {
        // Try a simple check via Drive API, if fails then offline
        try {
          await this.driveClient.ensureBackupFolder();
        } catch (e) {
          if (e.message.includes('INTERNET_UNAVAILABLE')) {
            this.repository.setPendingBackup(true);
            throw new Error('INTERNET_UNAVAILABLE: No internet connection');
          }
        }
      }

      this.repository.setPendingBackup(true);

      // 1. Check DB health
      const health = this.packageService.checkDatabaseHealth();
      if (!health.healthy) {
        throw new Error(`Database health check failed: ${health.error}`);
      }

      // 2-6. Create package
      const schoolId = schoolData?.schoolInfo?.id || 'default_school';
      const packageResult = await this.packageService.createBackupPackage({
        schoolId,
        schoolData,
        databaseVersion: '1',
        deviceId: os.hostname(),
      });
      tempDir = packageResult.tempDir;

      // 7. Encrypt
      const encryptedBuffer = this.encryptionService.encryptBuffer(packageResult.archiveBuffer);
      
      // Security check: ensure no plaintext leakage
      this.encryptionService.verifyNoPlaintextLeakage(encryptedBuffer);

      // Calculate checksums
      const encryptedChecksum = this.encryptionService.calculateChecksum(encryptedBuffer);
      const dataHash = schoolData ? this.repository.calculateDataHash(schoolData) : null;

      // 8. Upload
      const timestampedFileName = this.packageService.generateBackupFilename(new Date());
      
      // Upload timestamped backup
      const timestampedUpload = await this.driveClient.safeUploadBackup(timestampedFileName, encryptedBuffer);
      
      // Upload latest backup (overwrite)
      let latestUpload;
      try {
        latestUpload = await this.driveClient.safeUploadBackup(LATEST_BACKUP_NAME, encryptedBuffer);
      } catch (e) {
        console.warn('[GoogleDriveBackup] Failed to upload latest backup, but timestamped succeeded:', e.message);
        // Don't fail overall if latest fails but timestamped succeeded
      }

      // 9. Verify upload
      const verifiedMeta = await this.driveClient.getFileMetadata(timestampedUpload.id);
      if (parseInt(verifiedMeta.size) !== encryptedBuffer.length) {
        throw new Error('Upload verification failed: size mismatch');
      }

      // 10. Update metadata
      this.repository.recordSuccessfulBackup({
        fileName: timestampedFileName,
        fileId: timestampedUpload.id,
        size: encryptedBuffer.length,
        checksum: packageResult.checksum,
        dataHash,
      });

      // 11. Handle retention
      await this.handleRetention().catch(e => {
        console.warn('[GoogleDriveBackup] Retention handling failed:', e.message);
      });

      // Also create local backup
      if (schoolData) {
        this.repository.createLocalBackup(schoolData);
      }

      return {
        success: true,
        fileName: timestampedFileName,
        fileId: timestampedUpload.id,
        size: encryptedBuffer.length,
        checksum: packageResult.checksum,
        encryptedChecksum,
        manifest: packageResult.manifest,
        verified: true,
        createdAt: new Date().toISOString(),
      };
    } catch (e) {
      this.repository.recordFailedBackup(e);
      throw e;
    } finally {
      this.isBackupInProgress = false;
      if (tempDir) {
        this.packageService.cleanupTempDir(tempDir);
      }
      this.repository.setPendingBackup(false);
    }
  }

  /**
   * List available backups from Google Drive
   */
  async listBackups() {
    if (!this.authManager.isConnected()) {
      throw new Error('Not connected to Google Drive');
    }

    const files = await this.driveClient.listBackupFiles();
    
    // Enrich with local history verification status
    const localHistory = this.repository.loadHistory();
    
    const enriched = files.map(file => {
      const localEntry = localHistory.find(h => h.fileId === file.id || h.fileName === file.name);
      return {
        id: file.id,
        name: file.name,
        size: parseInt(file.size) || 0,
        sizeFormatted: this.formatBytes(parseInt(file.size) || 0),
        createdTime: file.createdTime,
        modifiedTime: file.modifiedTime,
        verified: localEntry ? localEntry.verified : false,
        checksum: localEntry ? localEntry.checksum : null,
        isLatest: file.name === LATEST_BACKUP_NAME,
      };
    });

    return enriched;
  }

  /**
   * Download and restore backup
   */
  async restoreBackup(fileId, schoolDataCallback = null) {
    if (this.isBackupInProgress) {
      throw new Error('Cannot restore while backup in progress');
    }

    return await this.restoreService.restoreBackup(fileId, {
      schoolDataCallback,
    });
  }

  /**
   * Retention: keep latest + last 7 daily
   * Safe rotation: never delete only known-good backup before verifying new one
   */
  async handleRetention() {
    const files = await this.driveClient.listBackupFiles();
    
    // Filter out latest file
    const timestampedBackups = files.filter(f => f.name !== LATEST_BACKUP_NAME);
    
    if (timestampedBackups.length <= 7) {
      return; // Nothing to delete
    }

    // Sort by modifiedTime desc (newest first)
    const sorted = timestampedBackups.sort((a, b) => new Date(b.modifiedTime) - new Date(a.modifiedTime));
    
    // Keep 7 most recent
    const toKeep = sorted.slice(0, 7);
    const toDelete = sorted.slice(7);

    // Safety: never delete if we have less than 2 backups total (including latest)
    if (files.length - toDelete.length < 2) {
      console.log('[Retention] Skipping deletion to preserve minimum backups');
      return;
    }

    for (const file of toDelete) {
      try {
        await this.driveClient.deleteFile(file.id);
        console.log(`[Retention] Deleted old backup: ${file.name}`);
      } catch (e) {
        console.warn(`[Retention] Failed to delete ${file.name}:`, e.message);
      }
    }
  }

  /**
   * Check if backup needed (for scheduler)
   */
  async checkAndPerformAutomaticBackup(schoolData = null) {
    return await this.scheduler.checkAndBackup(schoolData);
  }

  startScheduler() {
    this.scheduler.start();
  }

  stopScheduler() {
    this.scheduler.stop();
  }

  getSchedulerStatus() {
    return this.scheduler.getStatus();
  }

  /**
   * Get admin metadata (no school data)
   */
  getAdminMetadata() {
    return this.repository.getAdminMetadata();
  }

  formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  /**
   * For testing: create backup without upload
   */
  async createBackupPackageOnly(schoolData = null) {
    const schoolId = schoolData?.schoolInfo?.id || 'test_school';
    const result = await this.packageService.createBackupPackage({
      schoolId,
      schoolData,
    });
    
    const encrypted = this.encryptionService.encryptBuffer(result.archiveBuffer);
    
    return {
      ...result,
      encryptedBuffer: encrypted,
      encryptedSize: encrypted.length,
    };
  }
}

module.exports = GoogleDriveBackupService;
