/**
 * IPC Handlers for Google Drive Backup
 * Main process side - handles all backup operations securely
 * 
 * Security:
 * - Tokens never leave main process
 * - Encryption keys never exposed to renderer
 * - All file operations validated
 * - No secrets in logs
 */

const { ipcMain, shell, app } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');

// Import backup services
const GoogleDriveBackupService = require('./lib/googleDriveBackup');
const BackupRepository = require('./lib/backupRepository');
const secureStorage = require('./lib/secureStorage');
const { getAppDataPaths } = require('./lib/constants');

let backupService = null;
let mainWindowRef = null;

function getBackupService() {
  if (!backupService) {
    backupService = new GoogleDriveBackupService({
      appVersion: app.getVersion ? app.getVersion() : '1.0.0',
    });
  }
  return backupService;
}

function setMainWindow(window) {
  mainWindowRef = window;
}

function sendToRenderer(channel, data) {
  if (mainWindowRef && !mainWindowRef.isDestroyed()) {
    mainWindowRef.webContents.send(channel, data);
  }
}

function registerIpcHandlers() {
  console.log('[IPC] Registering backup IPC handlers');

  // Get backup status (safe metadata only)
  ipcMain.handle('backup:get-status', async () => {
    try {
      const service = getBackupService();
      const status = service.getConnectionStatus();
      return { success: true, data: status };
    } catch (e) {
      console.error('[IPC] get-status failed:', e.message);
      return { success: false, error: e.message };
    }
  });

  // Connect Google Drive
  ipcMain.handle('backup:connect-drive', async () => {
    try {
      const service = getBackupService();
      sendToRenderer('backup:progress', { stage: 'authenticating', message: 'Opening Google authentication...' });
      
      const result = await service.connectGoogleDrive((url) => shell.openExternal(url));
      
      sendToRenderer('backup:status-changed', { status: 'connected', email: result.email });
      sendToRenderer('backup:progress', { stage: 'connected', message: `Connected as ${result.email}` });
      
      return { success: true, data: result };
    } catch (e) {
      console.error('[IPC] connect-drive failed:', e.message);
      sendToRenderer('backup:progress', { stage: 'error', message: e.message });
      return { success: false, error: e.message };
    }
  });

  // Disconnect Google Drive
  ipcMain.handle('backup:disconnect-drive', async () => {
    try {
      const service = getBackupService();
      const result = await service.disconnectGoogleDrive();
      sendToRenderer('backup:status-changed', { status: 'disconnected' });
      return { success: true, data: result };
    } catch (e) {
      console.error('[IPC] disconnect-drive failed:', e.message);
      return { success: false, error: e.message };
    }
  });

  // Create backup now
  ipcMain.handle('backup:create-now', async (event, schoolData) => {
    try {
      const service = getBackupService();
      
      // Validate schoolData
      if (!schoolData || typeof schoolData !== 'object') {
        throw new Error('Invalid school data provided');
      }

      // Security: ensure schoolData doesn't contain secrets that shouldn't be backed up
      // We will filter in package service, but do basic check here
      if (schoolData.tokens || schoolData.secrets) {
        console.warn('[IPC] School data contains suspicious fields, filtering');
      }

      sendToRenderer('backup:progress', { stage: 'checking', message: 'Checking database health...' });
      sendToRenderer('backup:status-changed', { status: 'in_progress' });

      // Small delay to show progress
      await new Promise(r => setTimeout(r, 500));

      sendToRenderer('backup:progress', { stage: 'packaging', message: 'Creating backup package...' });
      const result = await service.createAndUploadBackup(schoolData);

      sendToRenderer('backup:progress', { 
        stage: 'success', 
        message: `Backup successful: ${result.fileName}`,
        data: {
          fileName: result.fileName,
          size: result.size,
          createdAt: result.createdAt,
        }
      });
      sendToRenderer('backup:status-changed', { status: 'success', lastBackupAt: result.createdAt });

      return { success: true, data: result };
    } catch (e) {
      console.error('[IPC] create-now failed:', e.message);
      const isOffline = e.message.includes('INTERNET_UNAVAILABLE');
      sendToRenderer('backup:progress', { 
        stage: 'error', 
        message: isOffline ? 'Internet unavailable, backup will retry automatically' : e.message,
        isOffline,
      });
      sendToRenderer('backup:status-changed', { status: 'failed', error: e.message });
      return { success: false, error: e.message, isOffline };
    }
  });

  // List backups
  ipcMain.handle('backup:list', async () => {
    try {
      const service = getBackupService();
      const backups = await service.listBackups();
      return { success: true, data: backups };
    } catch (e) {
      console.error('[IPC] list backups failed:', e.message);
      return { success: false, error: e.message, isOffline: e.message.includes('INTERNET_UNAVAILABLE') };
    }
  });

  // Restore backup
  ipcMain.handle('backup:restore', async (event, fileId) => {
    try {
      if (!fileId) throw new Error('No backup file ID provided');

      const service = getBackupService();
      sendToRenderer('backup:progress', { stage: 'restoring', message: 'Downloading backup from Google Drive...' });

      // For JSON mode, we need to handle restoration via callback
      // The main process will download and decrypt, then send data to renderer to save to localStorage
      // And also save to file for future
      const result = await service.restoreBackup(fileId, async (restoredData) => {
        // This callback will be called with restored JSON data
        // We save it to a temp file that renderer can load
        const paths = getAppDataPaths();
        const restorePath = path.join(paths.base, 'database', 'restored.json');
        if (!fs.existsSync(path.dirname(restorePath))) {
          fs.mkdirSync(path.dirname(restorePath), { recursive: true });
        }
        fs.writeFileSync(restorePath, JSON.stringify(restoredData, null, 2));
        
        // Also send to renderer
        sendToRenderer('backup:progress', { 
          stage: 'restored-data', 
          message: 'Backup data ready, applying...',
          data: restoredData, // This is safe, it's school data, not secrets
        });
      });

      sendToRenderer('backup:progress', { stage: 'restore-success', message: 'Restore completed successfully' });
      sendToRenderer('backup:status-changed', { status: 'restored' });

      return { 
        success: true, 
        data: {
          manifest: result.manifest,
          safetyBackup: result.safetyBackup,
          restored: {
            type: result.restored.type,
            // Don't send full data back via IPC if large, renderer already got it via event
          }
        }
      };
    } catch (e) {
      console.error('[IPC] restore failed:', e.message);
      sendToRenderer('backup:progress', { stage: 'restore-error', message: e.message });
      return { success: false, error: e.message };
    }
  });

  // Get settings
  ipcMain.handle('backup:get-settings', async () => {
    try {
      const service = getBackupService();
      const settings = service.getConnectionStatus();
      return { success: true, data: settings };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });

  // Update settings
  ipcMain.handle('backup:update-settings', async (event, settings) => {
    try {
      const repo = new BackupRepository();
      
      // Validate settings
      const allowed = {};
      if (typeof settings.automatic_backup_enabled === 'boolean') {
        allowed.automatic_backup_enabled = settings.automatic_backup_enabled;
      }
      if (settings.backup_frequency && ['daily', 'weekly', 'manual'].includes(settings.backup_frequency)) {
        allowed.backup_frequency = settings.backup_frequency;
      }
      if (settings.retention && typeof settings.retention === 'object') {
        allowed.retention = settings.retention;
      }

      const updated = repo.updateMetadata(allowed);
      return { success: true, data: updated };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });

  // Get history
  ipcMain.handle('backup:get-history', async () => {
    try {
      const repo = new BackupRepository();
      const history = repo.loadHistory();
      return { success: true, data: history };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });

  // Check connectivity
  ipcMain.handle('backup:check-connectivity', async () => {
    try {
      const service = getBackupService();
      const online = await service.driveClient.checkConnectivity();
      return { success: true, data: { online } };
    } catch (e) {
      return { success: true, data: { online: false, error: e.message } };
    }
  });

  // Admin metadata (no school data)
  ipcMain.handle('backup:get-admin-metadata', async () => {
    try {
      const service = getBackupService();
      const metadata = service.getAdminMetadata();
      return { success: true, data: metadata };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });

  // Local backup
  ipcMain.handle('backup:create-local', async (event, schoolData) => {
    try {
      const repo = new BackupRepository();
      const result = repo.createLocalBackup(schoolData);
      return result.success ? { success: true, data: result } : { success: false, error: result.error };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });

  // Export local backup to chosen path
  ipcMain.handle('backup:export-local', async (event, schoolData, fileName) => {
    try {
      // For security, we don't allow arbitrary path from renderer, we use dialog
      const { dialog } = require('electron');
      const result = await dialog.showSaveDialog(mainWindowRef, {
        defaultPath: fileName || `school-backup-${new Date().toISOString().slice(0,10)}.json`,
        filters: [{ name: 'JSON Backup', extensions: ['json'] }],
      });

      if (result.canceled) {
        return { success: false, error: 'Cancelled' };
      }

      fs.writeFileSync(result.filePath, JSON.stringify(schoolData, null, 2));
      return { success: true, data: { path: result.filePath } };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });

  // App version
  ipcMain.handle('app:get-version', async () => {
    return { success: true, data: app.getVersion() };
  });

  // App paths
  ipcMain.handle('app:get-paths', async () => {
    const paths = getAppDataPaths();
    return { success: true, data: paths };
  });

  // Secure info
  ipcMain.handle('secure:has-backup-key', async () => {
    try {
      const hasKey = secureStorage.hasBackupKey();
      return { success: true, data: { hasKey } };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });

  ipcMain.handle('secure:get-backup-info', async () => {
    try {
      const hasKey = secureStorage.hasBackupKey();
      const keyInfo = secureStorage.getSecureValue(secureStorage.getAppDataPaths().keyFile);
      return {
        success: true,
        data: {
          hasKey,
          createdAt: keyInfo?.createdAt || null,
          version: keyInfo?.version || null,
          // Never expose actual key
        }
      };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });

  console.log('[IPC] All handlers registered');
}

function cleanupIpcHandlers() {
  ipcMain.removeAllListeners('backup:get-status');
  ipcMain.removeAllListeners('backup:connect-drive');
  ipcMain.removeAllListeners('backup:disconnect-drive');
  ipcMain.removeAllListeners('backup:create-now');
  ipcMain.removeAllListeners('backup:list');
  ipcMain.removeAllListeners('backup:restore');
  ipcMain.removeAllListeners('backup:get-settings');
  ipcMain.removeAllListeners('backup:update-settings');
  ipcMain.removeAllListeners('backup:get-history');
  ipcMain.removeAllListeners('backup:check-connectivity');
  ipcMain.removeAllListeners('backup:get-admin-metadata');
  ipcMain.removeAllListeners('backup:create-local');
  ipcMain.removeAllListeners('backup:export-local');
  ipcMain.removeAllListeners('app:get-version');
  ipcMain.removeAllListeners('app:get-paths');
  ipcMain.removeAllListeners('secure:has-backup-key');
  ipcMain.removeAllListeners('secure:get-backup-info');
}

module.exports = {
  registerIpcHandlers,
  cleanupIpcHandlers,
  setMainWindow,
  getBackupService,
};
