/**
 * Backup Repository
 * Manages local metadata for Google Drive backups
 * 
 * Stores only safe metadata, tokens remain in secure storage
 */

const fs = require('fs');
const path = require('path');
const { getAppDataPaths, BACKUP_STATUS, BACKUP_FREQUENCY, DEFAULT_RETENTION } = require('./constants');
const secureStorage = require('./secureStorage');

class BackupRepository {
  constructor(options = {}) {
    this.paths = options.paths || getAppDataPaths();
    this.ensureDirs();
  }

  ensureDirs() {
    const dirs = [
      path.dirname(this.paths.metadataFile),
      path.dirname(this.paths.historyFile),
      this.paths.localBackupDir,
      path.dirname(this.paths.sqliteFile),
    ];
    for (const dir of dirs) {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    }
  }

  /**
   * Load backup metadata
   */
  loadMetadata() {
    try {
      if (!fs.existsSync(this.paths.metadataFile)) {
        return this.getDefaultMetadata();
      }
      const raw = fs.readFileSync(this.paths.metadataFile, 'utf8');
      const data = JSON.parse(raw);
      return { ...this.getDefaultMetadata(), ...data };
    } catch (e) {
      console.warn('[BackupRepository] Failed to load metadata:', e.message);
      return this.getDefaultMetadata();
    }
  }

  getDefaultMetadata() {
    return {
      provider: 'google_drive',
      account_email: null,
      account_name: null,
      folder_id: null,
      root_folder_id: null,
      last_backup_at: null,
      last_backup_status: BACKUP_STATUS.NOT_CONNECTED,
      last_backup_checksum: null,
      last_backup_size: null,
      last_backup_file_id: null,
      last_backup_file_name: null,
      automatic_backup_enabled: true,
      backup_frequency: BACKUP_FREQUENCY.DAILY,
      retention: { ...DEFAULT_RETENTION },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      device_id: require('os').hostname(),
      app_version: '1.0.0',
      last_error: null,
      pending_backup: false,
      data_hash: null, // To detect if data changed
    };
  }

  /**
   * Save metadata
   */
  saveMetadata(metadata) {
    const toSave = {
      ...metadata,
      updated_at: new Date().toISOString(),
    };
    // Ensure we never save secrets
    delete toSave.access_token;
    delete toSave.refresh_token;
    delete toSave.encryption_key;
    delete toSave.password;
    
    fs.writeFileSync(this.paths.metadataFile, JSON.stringify(toSave, null, 2));
    return toSave;
  }

  /**
   * Update specific metadata fields
   */
  updateMetadata(updates) {
    const current = this.loadMetadata();
    // Sanitize updates
    const sanitized = { ...updates };
    delete sanitized.access_token;
    delete sanitized.refresh_token;
    delete sanitized.encryption_key;
    
    const updated = { ...current, ...sanitized, updated_at: new Date().toISOString() };
    return this.saveMetadata(updated);
  }

  /**
   * Load backup history
   */
  loadHistory() {
    try {
      if (!fs.existsSync(this.paths.historyFile)) {
        return [];
      }
      const raw = fs.readFileSync(this.paths.historyFile, 'utf8');
      const data = JSON.parse(raw);
      return Array.isArray(data) ? data : [];
    } catch (e) {
      console.warn('[BackupRepository] Failed to load history:', e.message);
      return [];
    }
  }

  saveHistory(history) {
    // Keep only last 100 entries locally
    const trimmed = history.slice(0, 100);
    fs.writeFileSync(this.paths.historyFile, JSON.stringify(trimmed, null, 2));
    return trimmed;
  }

  addHistoryEntry(entry) {
    const history = this.loadHistory();
    const newEntry = {
      id: entry.id || `backup_${Date.now()}`,
      fileName: entry.fileName,
      fileId: entry.fileId || null,
      size: entry.size || 0,
      checksum: entry.checksum || null,
      createdAt: entry.createdAt || new Date().toISOString(),
      status: entry.status || BACKUP_STATUS.SUCCESS,
      verified: entry.verified || false,
      provider: 'google_drive',
      appVersion: entry.appVersion || '1.0.0',
    };
    history.unshift(newEntry);
    return this.saveHistory(history);
  }

  updateHistoryEntry(id, updates) {
    const history = this.loadHistory();
    const index = history.findIndex(h => h.id === id);
    if (index >= 0) {
      history[index] = { ...history[index], ...updates };
      return this.saveHistory(history);
    }
    return history;
  }

  /**
   * Set connection info
   */
  setConnectionInfo({ email, name, folderId, rootFolderId }) {
    return this.updateMetadata({
      account_email: email,
      account_name: name,
      folder_id: folderId,
      root_folder_id: rootFolderId,
      last_backup_status: this.loadMetadata().last_backup_at ? BACKUP_STATUS.SUCCESS : BACKUP_STATUS.NOT_CONNECTED,
    });
  }

  clearConnectionInfo() {
    return this.updateMetadata({
      account_email: null,
      account_name: null,
      folder_id: null,
      root_folder_id: null,
      last_backup_status: BACKUP_STATUS.NOT_CONNECTED,
    });
  }

  /**
   * Record successful backup
   */
  recordSuccessfulBackup({ fileName, fileId, size, checksum, dataHash }) {
    const now = new Date().toISOString();
    this.updateMetadata({
      last_backup_at: now,
      last_backup_status: BACKUP_STATUS.SUCCESS,
      last_backup_checksum: checksum,
      last_backup_size: size,
      last_backup_file_id: fileId,
      last_backup_file_name: fileName,
      last_error: null,
      pending_backup: false,
      data_hash: dataHash || null,
    });

    this.addHistoryEntry({
      fileName,
      fileId,
      size,
      checksum,
      createdAt: now,
      status: BACKUP_STATUS.SUCCESS,
      verified: true,
    });
  }

  recordFailedBackup(error) {
    this.updateMetadata({
      last_backup_status: BACKUP_STATUS.FAILED,
      last_error: error ? error.message || String(error) : 'Unknown error',
      pending_backup: false,
    });
  }

  setPendingBackup(pending = true) {
    this.updateMetadata({
      pending_backup: pending,
      last_backup_status: pending ? BACKUP_STATUS.PENDING : this.loadMetadata().last_backup_status,
    });
  }

  /**
   * Calculate data hash to detect changes
   */
  calculateDataHash(data) {
    const crypto = require('crypto');
    const str = JSON.stringify(data);
    return crypto.createHash('sha256').update(str).digest('hex');
  }

  hasDataChanged(newDataHash) {
    const metadata = this.loadMetadata();
    if (!metadata.data_hash) return true; // No previous hash, consider changed
    return metadata.data_hash !== newDataHash;
  }

  /**
   * Get backup settings for UI (safe, no secrets)
   */
  getSafeSettings() {
    const metadata = this.loadMetadata();
    const tokens = secureStorage.getSecureValue(secureStorage.getAppDataPaths().tokensFile);
    const hasTokens = !!tokens;
    
    return {
      provider: metadata.provider,
      account_email: metadata.account_email,
      account_name: metadata.account_name,
      folder_id: metadata.folder_id,
      last_backup_at: metadata.last_backup_at,
      last_backup_status: hasTokens ? metadata.last_backup_status : BACKUP_STATUS.NOT_CONNECTED,
      last_backup_size: metadata.last_backup_size,
      last_backup_file_name: metadata.last_backup_file_name,
      automatic_backup_enabled: metadata.automatic_backup_enabled,
      backup_frequency: metadata.backup_frequency,
      retention: metadata.retention,
      is_connected: hasTokens && !!metadata.account_email,
      has_encryption_key: secureStorage.hasBackupKey(),
      device_id: metadata.device_id,
      last_error: metadata.last_error,
      pending_backup: metadata.pending_backup,
    };
  }

  /**
   * Local backup (rolling backups in AppData/backups/)
   */
  createLocalBackup(schoolData) {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const fileName = `local-backup-${timestamp}.json`;
      const filePath = path.join(this.paths.localBackupDir, fileName);
      
      fs.writeFileSync(filePath, JSON.stringify(schoolData, null, 2));
      
      // Keep only last 10 local backups
      this.rotateLocalBackups(10);
      
      return { success: true, filePath, fileName };
    } catch (e) {
      return { success: false, error: e.message };
    }
  }

  rotateLocalBackups(keepCount = 10) {
    try {
      const files = fs.readdirSync(this.paths.localBackupDir)
        .filter(f => f.startsWith('local-backup-') && f.endsWith('.json'))
        .map(f => ({
          name: f,
          path: path.join(this.paths.localBackupDir, f),
          mtime: fs.statSync(path.join(this.paths.localBackupDir, f)).mtime,
        }))
        .sort((a, b) => b.mtime - a.mtime);

      if (files.length > keepCount) {
        const toDelete = files.slice(keepCount);
        for (const file of toDelete) {
          try { fs.unlinkSync(file.path); } catch (e) {}
        }
      }
    } catch (e) {
      console.warn('[BackupRepository] Failed to rotate local backups:', e.message);
    }
  }

  /**
   * Get backup status for admin panel (operational metadata only, no school data)
   */
  getAdminMetadata() {
    const metadata = this.loadMetadata();
    const history = this.loadHistory();
    
    return {
      backup_enabled: !!metadata.account_email,
      last_backup_time: metadata.last_backup_at,
      last_backup_status: metadata.last_backup_status,
      google_account_connected: !!metadata.account_email,
      app_version: metadata.app_version,
      device_id: metadata.device_id,
      backup_frequency: metadata.backup_frequency,
      automatic_backup_enabled: metadata.automatic_backup_enabled,
      total_backups: history.length,
      // Never include school data, tokens, or encryption keys
    };
  }
}

module.exports = BackupRepository;
