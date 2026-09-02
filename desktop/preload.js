/**
 * Electron Preload Script - Production Hardened
 * Secure bridge between renderer and main process
 */

const { contextBridge, ipcRenderer } = require('electron');

// Whitelisted channels
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

const RECOVERY_CHANNELS = [
  'recovery:has-key',
  'recovery:export-key',
  'recovery:import-key',
  'recovery:validate-key',
  'recovery:get-or-create',
];

const AUTH_CHANNELS = [
  'auth:login',
  'auth:login-teacher',
  'auth:logout',
  'auth:get-session',
  'auth:refresh',
];

const LICENSE_CHANNELS = [
  'license:check',
  'license:get-info',
  'license:clear',
];

const DEVICE_CHANNELS = [
  'device:get-id',
  'device:reset',
];

const DB_CHANNELS = [
  'db:initialize',
  'db:check-integrity',
  'db:safety-backup',
  'db:vacuum',
];

const APP_CHANNELS = [
  'app:get-version',
  'app:get-paths',
  'app:check-update',
];

const SECURE_CHANNELS = [
  'secure:has-backup-key',
  'secure:get-backup-info',
];

const UPDATER_CHANNELS = [
  'updater:check',
  'updater:download',
  'updater:install',
];

const ALLOWED_CHANNELS = [
  ...BACKUP_CHANNELS,
  ...RECOVERY_CHANNELS,
  ...AUTH_CHANNELS,
  ...LICENSE_CHANNELS,
  ...DEVICE_CHANNELS,
  ...DB_CHANNELS,
  ...APP_CHANNELS,
  ...SECURE_CHANNELS,
  ...UPDATER_CHANNELS,
];

// Expose safe API
contextBridge.exposeInMainWorld('electronAPI', {
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

  recovery: {
    hasKey: () => ipcRenderer.invoke('recovery:has-key'),
    exportKey: () => ipcRenderer.invoke('recovery:export-key'),
    importKey: (formattedKey) => ipcRenderer.invoke('recovery:import-key', formattedKey),
    validateKey: (formattedKey) => ipcRenderer.invoke('recovery:validate-key', formattedKey),
    getOrCreate: () => ipcRenderer.invoke('recovery:get-or-create'),
  },

  auth: {
    login: (email, password, schoolId) => ipcRenderer.invoke('auth:login', email, password, schoolId),
    loginTeacher: (code) => ipcRenderer.invoke('auth:login-teacher', code),
    logout: () => ipcRenderer.invoke('auth:logout'),
    getSession: () => ipcRenderer.invoke('auth:get-session'),
    refresh: () => ipcRenderer.invoke('auth:refresh'),
  },

  license: {
    check: (schoolId) => ipcRenderer.invoke('license:check', schoolId),
    getInfo: () => ipcRenderer.invoke('license:get-info'),
    clear: () => ipcRenderer.invoke('license:clear'),
  },

  device: {
    getId: () => ipcRenderer.invoke('device:get-id'),
    reset: () => ipcRenderer.invoke('device:reset'),
  },

  db: {
    initialize: () => ipcRenderer.invoke('db:initialize'),
    checkIntegrity: () => ipcRenderer.invoke('db:check-integrity'),
    safetyBackup: () => ipcRenderer.invoke('db:safety-backup'),
    vacuum: () => ipcRenderer.invoke('db:vacuum'),
  },

  app: {
    getVersion: () => ipcRenderer.invoke('app:get-version'),
    getPaths: () => ipcRenderer.invoke('app:get-paths'),
    checkUpdate: () => ipcRenderer.invoke('app:check-update'),
  },

  secure: {
    hasBackupKey: () => ipcRenderer.invoke('secure:has-backup-key'),
    getBackupInfo: () => ipcRenderer.invoke('secure:get-backup-info'),
  },

  updater: {
    check: () => ipcRenderer.invoke('updater:check'),
    download: () => ipcRenderer.invoke('updater:download'),
    install: () => ipcRenderer.invoke('updater:install'),
  },

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

  onNavigateTo: (callback) => {
    const channel = 'navigate-to';
    const listener = (event, data) => callback(data);
    ipcRenderer.on(channel, listener);
    return () => ipcRenderer.removeListener(channel, listener);
  },

  onUpdaterChecking: (cb) => { const l = (e,d)=>cb(d); ipcRenderer.on('updater:checking-for-update', l); return ()=>ipcRenderer.removeListener('updater:checking-for-update', l); },
  onUpdaterAvailable: (cb) => { const l = (e,d)=>cb(d); ipcRenderer.on('updater:update-available', l); return ()=>ipcRenderer.removeListener('updater:update-available', l); },
  onUpdaterNotAvailable: (cb) => { const l = (e,d)=>cb(d); ipcRenderer.on('updater:update-not-available', l); return ()=>ipcRenderer.removeListener('updater:update-not-available', l); },
  onUpdaterError: (cb) => { const l = (e,d)=>cb(d); ipcRenderer.on('updater:error', l); return ()=>ipcRenderer.removeListener('updater:error', l); },
  onUpdaterProgress: (cb) => { const l = (e,d)=>cb(d); ipcRenderer.on('updater:download-progress', l); return ()=>ipcRenderer.removeListener('updater:download-progress', l); },
  onUpdaterDownloaded: (cb) => { const l = (e,d)=>cb(d); ipcRenderer.on('updater:update-downloaded', l); return ()=>ipcRenderer.removeListener('updater:update-downloaded', l); },

  isElectron: true,
  platform: process.platform,
});

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

console.log('[Preload] Production Electron API exposed securely');
