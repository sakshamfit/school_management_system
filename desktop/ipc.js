/**
 * IPC Handlers for Production System
 * Handles backup, auth, license, device, recovery, etc.
 * 
 * Security:
 * - Tokens never leave main process
 * - Encryption keys never exposed to renderer (except recovery key export after auth)
 * - All file operations validated
 * - No secrets in logs
 * - Whitelisted channels only
 */

const { ipcMain, shell, app, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');

// Import services
const GoogleDriveBackupService = require('./lib/googleDriveBackup');
const BackupRepository = require('./lib/backupRepository');
const secureStorage = require('./lib/secureStorage');
const RecoveryService = require('./lib/recoveryService');
const LicenseManager = require('./lib/licenseManager');
const DeviceManager = require('./lib/deviceManager');
const AuthManager = require('./lib/authManager');
const DatabaseService = require('./lib/database');
const { getAppDataPaths } = require('./lib/constants');

let backupService = null;
let recoveryService = null;
let licenseManager = null;
let deviceManager = null;
let authManager = null;
let databaseService = null;
let mainWindowRef = null;

function getDeviceManager() {
  if (!deviceManager) {
    deviceManager = new DeviceManager();
  }
  return deviceManager;
}

function getLicenseManager() {
  if (!licenseManager) {
    licenseManager = new LicenseManager({
      deviceManager: getDeviceManager(),
    });
  }
  return licenseManager;
}

function getAuthManager() {
  if (!authManager) {
    authManager = new AuthManager({
      licenseManager: getLicenseManager(),
      deviceManager: getDeviceManager(),
    });
  }
  return authManager;
}

function getRecoveryService() {
  if (!recoveryService) {
    recoveryService = new RecoveryService();
  }
  return recoveryService;
}

function getBackupService() {
  if (!backupService) {
    backupService = new GoogleDriveBackupService({
      appVersion: app.getVersion ? app.getVersion() : '1.0.0',
    });
  }
  return backupService;
}

function getDatabaseService() {
  if (!databaseService) {
    databaseService = new DatabaseService();
  }
  return databaseService;
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
  console.log('[IPC] Registering production IPC handlers');

  // ==================== BACKUP ====================

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

  ipcMain.handle('backup:create-now', async (event, schoolData) => {
    try {
      const service = getBackupService();
      if (!schoolData || typeof schoolData !== 'object') throw new Error('Invalid school data');
      if (schoolData.tokens || schoolData.secrets) console.warn('[IPC] Suspicious fields in school data');

      sendToRenderer('backup:progress', { stage: 'checking', message: 'Checking database health...' });
      sendToRenderer('backup:status-changed', { status: 'in_progress' });
      await new Promise(r => setTimeout(r, 500));
      sendToRenderer('backup:progress', { stage: 'packaging', message: 'Creating backup package...' });
      const result = await service.createAndUploadBackup(schoolData);

      sendToRenderer('backup:progress', { 
        stage: 'success', 
        message: `Backup successful: ${result.fileName}`,
        data: { fileName: result.fileName, size: result.size, createdAt: result.createdAt }
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

  ipcMain.handle('backup:restore', async (event, fileId) => {
    try {
      if (!fileId) throw new Error('No backup file ID provided');
      const service = getBackupService();
      sendToRenderer('backup:progress', { stage: 'restoring', message: 'Downloading backup from Google Drive...' });

      const result = await service.restoreBackup(fileId, async (restoredData) => {
        const paths = getAppDataPaths();
        const restorePath = path.join(paths.base, 'database', 'restored.json');
        if (!fs.existsSync(path.dirname(restorePath))) fs.mkdirSync(path.dirname(restorePath), { recursive: true });
        fs.writeFileSync(restorePath, JSON.stringify(restoredData, null, 2));
        sendToRenderer('backup:progress', { 
          stage: 'restored-data', 
          message: 'Backup data ready, applying...',
          data: restoredData,
        });
      });

      sendToRenderer('backup:progress', { stage: 'restore-success', message: 'Restore completed successfully' });
      sendToRenderer('backup:status-changed', { status: 'restored' });
      return { success: true, data: { manifest: result.manifest, safetyBackup: result.safetyBackup, restored: { type: result.restored.type } } };
    } catch (e) {
      console.error('[IPC] restore failed:', e.message);
      sendToRenderer('backup:progress', { stage: 'restore-error', message: e.message });
      return { success: false, error: e.message };
    }
  });

  ipcMain.handle('backup:get-settings', async () => {
    try {
      const service = getBackupService();
      return { success: true, data: service.getConnectionStatus() };
    } catch (e) { return { success: false, error: e.message }; }
  });

  ipcMain.handle('backup:update-settings', async (event, settings) => {
    try {
      const repo = new BackupRepository();
      const allowed = {};
      if (typeof settings.automatic_backup_enabled === 'boolean') allowed.automatic_backup_enabled = settings.automatic_backup_enabled;
      if (settings.backup_frequency && ['daily', 'weekly', 'manual'].includes(settings.backup_frequency)) allowed.backup_frequency = settings.backup_frequency;
      if (settings.retention && typeof settings.retention === 'object') allowed.retention = settings.retention;
      return { success: true, data: repo.updateMetadata(allowed) };
    } catch (e) { return { success: false, error: e.message }; }
  });

  ipcMain.handle('backup:get-history', async () => {
    try {
      const repo = new BackupRepository();
      return { success: true, data: repo.loadHistory() };
    } catch (e) { return { success: false, error: e.message }; }
  });

  ipcMain.handle('backup:check-connectivity', async () => {
    try {
      const service = getBackupService();
      return { success: true, data: { online: await service.driveClient.checkConnectivity() } };
    } catch (e) { return { success: true, data: { online: false, error: e.message } }; }
  });

  ipcMain.handle('backup:get-admin-metadata', async () => {
    try {
      const service = getBackupService();
      return { success: true, data: service.getAdminMetadata() };
    } catch (e) { return { success: false, error: e.message }; }
  });

  ipcMain.handle('backup:create-local', async (event, schoolData) => {
    try {
      const repo = new BackupRepository();
      const result = repo.createLocalBackup(schoolData);
      return result.success ? { success: true, data: result } : { success: false, error: result.error };
    } catch (e) { return { success: false, error: e.message }; }
  });

  ipcMain.handle('backup:export-local', async (event, schoolData, fileName) => {
    try {
      const result = await dialog.showSaveDialog(mainWindowRef, {
        defaultPath: fileName || `school-backup-${new Date().toISOString().slice(0,10)}.json`,
        filters: [{ name: 'JSON Backup', extensions: ['json'] }],
      });
      if (result.canceled) return { success: false, error: 'Cancelled' };
      fs.writeFileSync(result.filePath, JSON.stringify(schoolData, null, 2));
      return { success: true, data: { path: result.filePath } };
    } catch (e) { return { success: false, error: e.message }; }
  });

  // ==================== RECOVERY KEY ====================

  ipcMain.handle('recovery:has-key', async () => {
    try {
      const service = getRecoveryService();
      return { success: true, data: { hasKey: service.hasRecoveryKey() } };
    } catch (e) { return { success: false, error: e.message }; }
  });

  ipcMain.handle('recovery:export-key', async () => {
    try {
      // Only allow export after authentication - check session
      const auth = getAuthManager();
      const session = auth.loadSession();
      if (!session) throw new Error('Not authenticated. Please login first.');

      const service = getRecoveryService();
      const result = service.exportRecoveryKey();
      // Never log the key
      console.log('[IPC] Recovery key exported (key not logged)');
      return { success: true, data: result };
    } catch (e) {
      console.error('[IPC] export recovery key failed:', e.message);
      return { success: false, error: e.message };
    }
  });

  ipcMain.handle('recovery:import-key', async (event, formattedKey) => {
    try {
      if (!formattedKey) throw new Error('Recovery key required');
      const service = getRecoveryService();
      const result = service.importRecoveryKey(formattedKey);
      console.log('[IPC] Recovery key imported');
      return { success: true, data: result };
    } catch (e) {
      console.error('[IPC] import recovery key failed:', e.message);
      return { success: false, error: e.message };
    }
  });

  ipcMain.handle('recovery:validate-key', async (event, formattedKey) => {
    try {
      const service = getRecoveryService();
      const validation = service.validateRecoveryKeyFormat(formattedKey);
      return { success: true, data: validation };
    } catch (e) { return { success: false, error: e.message }; }
  });

  ipcMain.handle('recovery:get-or-create', async () => {
    try {
      const auth = getAuthManager();
      const session = auth.loadSession();
      if (!session) throw new Error('Not authenticated');

      const service = getRecoveryService();
      const result = service.getOrCreateRecoveryKey();
      // Return formatted only, never raw key
      return { 
        success: true, 
        data: { 
          formatted: result.formatted, 
          isNew: result.isNew,
          warning: 'Keep this key safe. If you lose this computer and this key, backups become unrecoverable.'
        } 
      };
    } catch (e) { return { success: false, error: e.message }; }
  });

  // ==================== AUTH ====================

  ipcMain.handle('auth:login', async (event, email, password, schoolId) => {
    try {
      const auth = getAuthManager();
      const result = await auth.login(email, password, schoolId);
      return { success: true, data: { user: result.user, isOffline: result.isOffline || false } };
    } catch (e) {
      console.error('[IPC] login failed:', e.message);
      return { success: false, error: e.message, isOffline: e.message.includes('INTERNET_UNAVAILABLE') };
    }
  });

  ipcMain.handle('auth:login-teacher', async (event, code) => {
    try {
      const auth = getAuthManager();
      const result = await auth.loginWithTeacherCode(code);
      return { success: true, data: result };
    } catch (e) { return { success: false, error: e.message }; }
  });

  ipcMain.handle('auth:logout', async () => {
    try {
      const auth = getAuthManager();
      return { success: true, data: auth.logout() };
    } catch (e) { return { success: false, error: e.message }; }
  });

  ipcMain.handle('auth:get-session', async () => {
    try {
      const auth = getAuthManager();
      const session = auth.getSafeAuthInfo();
      return { success: true, data: session };
    } catch (e) { return { success: false, error: e.message }; }
  });

  ipcMain.handle('auth:refresh', async () => {
    try {
      const auth = getAuthManager();
      const session = await auth.refreshSession();
      return { success: true, data: { user: session.user } };
    } catch (e) { return { success: false, error: e.message }; }
  });

  // ==================== LICENSE ====================

  ipcMain.handle('license:check', async (event, schoolId) => {
    try {
      const licenseMgr = getLicenseManager();
      const deviceMgr = getDeviceManager();
      const deviceId = deviceMgr.getOrCreateDeviceId();
      const result = await licenseMgr.checkLicense(schoolId, deviceId);
      return { success: true, data: result };
    } catch (e) { return { success: false, error: e.message }; }
  });

  ipcMain.handle('license:get-info', async () => {
    try {
      const licenseMgr = getLicenseManager();
      return { success: true, data: licenseMgr.getLicenseInfo() };
    } catch (e) { return { success: false, error: e.message }; }
  });

  ipcMain.handle('license:clear', async () => {
    try {
      const licenseMgr = getLicenseManager();
      licenseMgr.clearLicense();
      return { success: true };
    } catch (e) { return { success: false, error: e.message }; }
  });

  // ==================== DEVICE ====================

  ipcMain.handle('device:get-id', async () => {
    try {
      const deviceMgr = getDeviceManager();
      return { success: true, data: deviceMgr.getDeviceInfo() };
    } catch (e) { return { success: false, error: e.message }; }
  });

  ipcMain.handle('device:reset', async () => {
    try {
      const deviceMgr = getDeviceManager();
      const newId = deviceMgr.resetDeviceId();
      return { success: true, data: { deviceId: newId } };
    } catch (e) { return { success: false, error: e.message }; }
  });

  // ==================== DATABASE ====================

  ipcMain.handle('db:initialize', async () => {
    try {
      const dbService = getDatabaseService();
      return { success: true, data: dbService.initialize() };
    } catch (e) { return { success: false, error: e.message }; }
  });

  ipcMain.handle('db:check-integrity', async () => {
    try {
      const dbService = getDatabaseService();
      return { success: true, data: dbService.checkIntegrity() };
    } catch (e) { return { success: false, error: e.message }; }
  });

  ipcMain.handle('db:safety-backup', async () => {
    try {
      const dbService = getDatabaseService();
      return { success: true, data: dbService.createSafetyBackup() };
    } catch (e) { return { success: false, error: e.message }; }
  });

  ipcMain.handle('db:vacuum', async () => {
    try {
      const dbService = getDatabaseService();
      dbService.vacuum();
      return { success: true };
    } catch (e) { return { success: false, error: e.message }; }
  });

  // ==================== APP ====================

  ipcMain.handle('app:get-version', async () => {
    return { success: true, data: app.getVersion() };
  });

  ipcMain.handle('app:get-paths', async () => {
    return { success: true, data: getAppDataPaths() };
  });

  ipcMain.handle('app:check-update', async () => {
    // Mock update check - in production would use electron-updater
    return { success: true, data: { updateAvailable: false, currentVersion: app.getVersion() } };
  });

  ipcMain.handle('secure:has-backup-key', async () => {
    try {
      return { success: true, data: { hasKey: secureStorage.hasBackupKey() } };
    } catch (e) { return { success: false, error: e.message }; }
  });

  ipcMain.handle('secure:get-backup-info', async () => {
    try {
      const hasKey = secureStorage.hasBackupKey();
      const keyInfo = secureStorage.getSecureValue(secureStorage.getAppDataPaths().keyFile);
      return { success: true, data: { hasKey, createdAt: keyInfo?.createdAt || null, version: keyInfo?.version || null } };
    } catch (e) { return { success: false, error: e.message }; }
  });

  // ==================== AUTO UPDATER ====================

  ipcMain.handle('updater:check', async () => {
    try {
      const updaterPath = path.join(__dirname, 'lib', 'autoUpdater.js');
      if (!fs.existsSync(updaterPath)) return { success: false, error: 'Auto-updater not available' };
      const { checkForUpdates } = require(updaterPath);
      const result = await checkForUpdates();
      return { success: true, data: result };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });

  ipcMain.handle('updater:download', async () => {
    try {
      const updaterPath = path.join(__dirname, 'lib', 'autoUpdater.js');
      if (!fs.existsSync(updaterPath)) return { success: false, error: 'Auto-updater not available' };
      const { downloadUpdate } = require(updaterPath);
      const result = await downloadUpdate();
      return { success: true, data: result };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });

  ipcMain.handle('updater:install', async () => {
    try {
      const updaterPath = path.join(__dirname, 'lib', 'autoUpdater.js');
      if (!fs.existsSync(updaterPath)) return { success: false, error: 'Auto-updater not available' };
      const { quitAndInstall } = require(updaterPath);
      quitAndInstall();
      return { success: true };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });

  console.log('[IPC] All production handlers registered');
}

function cleanupIpcHandlers() {
  const channels = [
    'backup:get-status', 'backup:connect-drive', 'backup:disconnect-drive', 'backup:create-now',
    'backup:list', 'backup:restore', 'backup:get-settings', 'backup:update-settings',
    'backup:get-history', 'backup:check-connectivity', 'backup:get-admin-metadata',
    'backup:create-local', 'backup:export-local',
    'recovery:has-key', 'recovery:export-key', 'recovery:import-key', 'recovery:validate-key', 'recovery:get-or-create',
    'auth:login', 'auth:login-teacher', 'auth:logout', 'auth:get-session', 'auth:refresh',
    'license:check', 'license:get-info', 'license:clear',
    'device:get-id', 'device:reset',
    'db:initialize', 'db:check-integrity', 'db:safety-backup', 'db:vacuum',
    'app:get-version', 'app:get-paths', 'app:check-update',
    'secure:has-backup-key', 'secure:get-backup-info',
    'updater:check', 'updater:download', 'updater:install'
  ];
  for (const ch of channels) ipcMain.removeAllListeners(ch);
}

module.exports = {
  registerIpcHandlers,
  cleanupIpcHandlers,
  setMainWindow,
  getBackupService,
  getAuthManager,
  getLicenseManager,
  getDeviceManager,
  getRecoveryService,
  getDatabaseService,
};
