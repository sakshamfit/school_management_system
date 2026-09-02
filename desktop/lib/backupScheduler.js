/**
 * Backup Scheduler
 * Runs in Electron main process, schedules automatic backups
 * 
 * Features:
 * - Daily / Weekly / Manual modes
 * - Checks if data changed since last backup
 * - Handles offline, retries
 * - Does not rely on React renderer being open
 */

const { BACKUP_FREQUENCY, BACKUP_STATUS } = require('./constants');

class BackupScheduler {
  constructor(backupService, repository, options = {}) {
    this.backupService = backupService;
    this.repository = repository;
    this.intervalId = null;
    this.isRunning = false;
    this.checkIntervalMs = options.checkIntervalMs || 60 * 60 * 1000; // 1 hour
    this.retryDelayMs = options.retryDelayMs || 5 * 60 * 1000; // 5 minutes for retry
    this.lastCheck = null;
    this.retryCount = 0;
    this.maxRetries = 3;
  }

  start() {
    if (this.intervalId) return;

    console.log('[BackupScheduler] Starting scheduler');
    
    // Check immediately after 30 seconds of app start
    setTimeout(() => this.checkAndBackup(), 30 * 1000);

    // Then check every hour
    this.intervalId = setInterval(() => this.checkAndBackup(), this.checkIntervalMs);
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      console.log('[BackupScheduler] Stopped');
    }
  }

  /**
   * Check if backup should run and execute
   */
  async checkAndBackup(schoolData = null) {
    if (this.isRunning) {
      console.log('[BackupScheduler] Backup already in progress, skipping');
      return;
    }

    const metadata = this.repository.loadMetadata();
    
    if (!metadata.automatic_backup_enabled) {
      console.log('[BackupScheduler] Automatic backup disabled');
      return;
    }

    if (metadata.backup_frequency === BACKUP_FREQUENCY.MANUAL) {
      console.log('[BackupScheduler] Manual only mode, skipping automatic backup');
      return;
    }

    // Check if connected
    if (!metadata.account_email) {
      console.log('[BackupScheduler] Not connected to Google Drive');
      return;
    }

    // Check frequency
    if (!this.shouldBackupByFrequency(metadata)) {
      console.log('[BackupScheduler] Not time for backup yet');
      return;
    }

    // Check if data changed
    if (schoolData) {
      const dataHash = this.repository.calculateDataHash(schoolData);
      if (!this.repository.hasDataChanged(dataHash)) {
        console.log('[BackupScheduler] No meaningful data change, skipping backup');
        return;
      }
    }

    // Attempt backup
    this.isRunning = true;
    try {
      console.log('[BackupScheduler] Starting automatic backup');
      this.repository.setPendingBackup(true);
      
      const result = await this.backupService.createAndUploadBackup(schoolData);
      
      console.log('[BackupScheduler] Automatic backup successful:', result.fileName);
      this.retryCount = 0;
      this.lastCheck = new Date();
      
      return result;
    } catch (e) {
      console.error('[BackupScheduler] Automatic backup failed:', e.message);
      
      if (e.message.includes('INTERNET_UNAVAILABLE')) {
        console.log('[BackupScheduler] Internet unavailable, will retry later');
        this.repository.updateMetadata({
          last_backup_status: BACKUP_STATUS.PENDING,
          last_error: 'Internet connection unavailable',
          pending_backup: true,
        });
        // Don't increment retry count for internet issues, just wait
        return;
      }

      this.retryCount++;
      this.repository.recordFailedBackup(e);

      if (this.retryCount < this.maxRetries) {
        console.log(`[BackupScheduler] Scheduling retry ${this.retryCount}/${this.maxRetries} in ${this.retryDelayMs}ms`);
        setTimeout(() => {
          this.isRunning = false;
          this.checkAndBackup(schoolData);
        }, this.retryDelayMs);
      } else {
        console.log('[BackupScheduler] Max retries reached, giving up until next scheduled check');
        this.retryCount = 0;
      }
    } finally {
      this.isRunning = false;
    }
  }

  shouldBackupByFrequency(metadata) {
    if (!metadata.last_backup_at) return true; // Never backed up

    const lastBackup = new Date(metadata.last_backup_at);
    const now = new Date();
    const diffMs = now - lastBackup;
    const diffHours = diffMs / (1000 * 60 * 60);
    const diffDays = diffHours / 24;

    switch (metadata.backup_frequency) {
      case BACKUP_FREQUENCY.DAILY:
        return diffHours >= 20; // Allow some flexibility, backup after 20 hours
      case BACKUP_FREQUENCY.WEEKLY:
        return diffDays >= 6; // Weekly, allow after 6 days
      default:
        return false;
    }
  }

  /**
   * Trigger manual backup check (called from UI or app events)
   */
  triggerBackup(schoolData = null) {
    return this.checkAndBackup(schoolData);
  }

  /**
   * Handle internet came back online
   */
  async handleOnline(schoolData = null) {
    const metadata = this.repository.loadMetadata();
    if (metadata.pending_backup) {
      console.log('[BackupScheduler] Internet restored and backup pending, triggering backup');
      return await this.checkAndBackup(schoolData);
    }
  }

  getStatus() {
    const metadata = this.repository.loadMetadata();
    return {
      isRunning: this.isRunning,
      lastCheck: this.lastCheck,
      retryCount: this.retryCount,
      nextCheckInMs: this.intervalId ? this.checkIntervalMs : null,
      settings: {
        enabled: metadata.automatic_backup_enabled,
        frequency: metadata.backup_frequency,
        lastBackupAt: metadata.last_backup_at,
        status: metadata.last_backup_status,
      },
    };
  }
}

module.exports = BackupScheduler;
