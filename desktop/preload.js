/**
 * Electron Preload Script
 * Secure bridge between renderer and main process
 * 
 * Security:
 * - contextIsolation: true
 * - sandbox: true
 * - Never expose tokens, keys, or secrets to renderer
 * - Only expose safe, whitelisted IPC channels
 */

const { contextBridge, ipcRenderer } = require('electron');

// Whitelisted channels for backup system
const BACKUP_CHANNELS = [
  'backup:get-status',
  'backup:connect-drive',
  'backup:disconnect-drive',
  'backup:create-now',
  'backup:list',
  'backup:restore',
  'backup:get-settings',
  'backup:update-settings',
  'backup:get-history',
  'backup:check-connectivity',
  'backup:get-admin-metadata',
  'backup:create-local',
  'backup:export-local',
];

const SECURE_CHANNELS = [
  'secure:has-backup-key',
  'secure:get-backup-info',
];

// General app channels (existing)
const APP_CHANNELS = [
  'app:get-version',
  'app:get-paths',
  'app:check-for-updates',
];

const ALLOWED_CHANNELS = [...BACKUP_CHANNELS, ...SECURE_CHANNELS, ...APP_CHANNELS];

// Expose safe API to renderer
contextBridge.exposeInMainWorld('electronAPI', {
  // Backup operations
  backup: {
    getStatus: () => ipcRenderer.invoke('backup:get-status'),
    connectDrive: () => ipcRenderer.invoke('backup:connect-drive'),
    disconnectDrive: () => ipcRenderer.invoke('backup:disconnect-drive'),
    createNow: (schoolData) => ipcRenderer.invoke('backup:create-now', schoolData),
    listBackups: () => ipcRenderer.invoke('backup:list'),
    restoreBackup: (fileId) => ipcRenderer.invoke('backup:restore', fileId),
    getSettings: () => ipcRenderer.invoke('backup:get-settings'),
    updateSettings: (settings) => ipcRenderer.invoke('backup:update-settings', settings),
    getHistory: () => ipcRenderer.invoke('backup:get-history'),
    checkConnectivity: () => ipcRenderer.invoke('backup:check-connectivity'),
    getAdminMetadata: () => ipcRenderer.invoke('backup:get-admin-metadata'),
    createLocalBackup: (schoolData) => ipcRenderer.invoke('backup:create-local', schoolData),
    exportLocalBackup: (schoolData, fileName) => ipcRenderer.invoke('backup:export-local', schoolData, fileName),
  },

  // App info
  app: {
    getVersion: () => ipcRenderer.invoke('app:get-version'),
    getPaths: () => ipcRenderer.invoke('app:get-paths'),
  },

  // Secure info (no secrets exposed)
  secure: {
    hasBackupKey: () => ipcRenderer.invoke('secure:has-backup-key'),
    getBackupInfo: () => ipcRenderer.invoke('secure:get-backup-info'),
  },

  // Event listeners for backup progress
  onBackupProgress: (callback) => {
    const channel = 'backup:progress';
    const listener = (event, data) => callback(data);
    ipcRenderer.on(channel, listener);
    return () => ipcRenderer.removeListener(channel, listener);
  },

  onBackupStatusChanged: (callback) => {
    const channel = 'backup:status-changed';
    const listener = (event, data) => callback(data);
    ipcRenderer.on(channel, listener);
    return () => ipcRenderer.removeListener(channel, listener);
  },

  // Utility to check if running in Electron
  isElectron: true,
  platform: process.platform,
});

// Also expose a minimal legacy API for compatibility
contextBridge.exposeInMainWorld('desktopAPI', {
  isDesktop: true,
  backup: {
    getStatus: () => ipcRenderer.invoke('backup:get-status'),
    connect: () => ipcRenderer.invoke('backup:connect-drive'),
    disconnect: () => ipcRenderer.invoke('backup:disconnect-drive'),
    backupNow: (data) => ipcRenderer.invoke('backup:create-now', data),
    list: () => ipcRenderer.invoke('backup:list'),
    restore: (id) => ipcRenderer.invoke('backup:restore', id),
  }
});

console.log('[Preload] Electron backup API exposed securely');
