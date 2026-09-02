/**
 * Auto Updater Service
 * Handles application updates without deleting user data
 * 
 * Flow:
 * Version 1.0.0
 *   ↓
 * New release → latest.yml
 *   ↓
 * App detects update
 *   ↓
 * User chooses update
 *   ↓
 * Update installs
 *   ↓
 * SQLite remains intact
 *   ↓
 * App restarts
 */

const { app, dialog } = require('electron');
const path = require('path');
const fs = require('fs');

let autoUpdater = null;
let mainWindowRef = null;

try {
  // Try to load electron-updater if available
  const updaterModule = require('electron-updater');
  autoUpdater = updaterModule.autoUpdater;
} catch (e) {
  console.log('[AutoUpdater] electron-updater not available, using mock');
  autoUpdater = null;
}

function setMainWindow(window) {
  mainWindowRef = window;
}

function initializeAutoUpdater() {
  if (!autoUpdater) {
    console.log('[AutoUpdater] Mock mode - no real updater');
    return {
      checkForUpdates: async () => ({ updateAvailable: false }),
      downloadUpdate: async () => {},
      quitAndInstall: () => {},
    };
  }

  // Configure auto-updater
  autoUpdater.logger = {
    info: (msg) => console.log(`[AutoUpdater] ${msg}`),
    warn: (msg) => console.warn(`[AutoUpdater] ${msg}`),
    error: (msg) => console.error(`[AutoUpdater] ${msg}`),
  };

  autoUpdater.autoDownload = false; // User chooses
  autoUpdater.autoInstallOnAppQuit = true;

  // Security: verify update signature if possible
  // autoUpdater.requestHeaders = { 'Cache-Control': 'no-cache' };

  autoUpdater.on('checking-for-update', () => {
    console.log('[AutoUpdater] Checking for update...');
    sendToRenderer('updater:checking');
  });

  autoUpdater.on('update-available', (info) => {
    console.log('[AutoUpdater] Update available:', info.version);
    sendToRenderer('updater:available', {
      version: info.version,
      releaseNotes: info.releaseNotes,
      releaseDate: info.releaseDate,
    });

    // Show dialog to user
    if (mainWindowRef) {
      dialog.showMessageBox(mainWindowRef, {
        type: 'info',
        title: 'Update Available',
        message: `Version ${info.version} is available. Current version is ${app.getVersion()}.`,
        detail: 'Your school data will remain intact. The application will restart after update.',
        buttons: ['Download Update', 'Later'],
        defaultId: 0,
      }).then(result => {
        if (result.response === 0) {
          autoUpdater.downloadUpdate();
          sendToRenderer('updater:downloading');
        }
      });
    }
  });

  autoUpdater.on('update-not-available', (info) => {
    console.log('[AutoUpdater] Update not available');
    sendToRenderer('updater:not-available', { version: info.version });
  });

  autoUpdater.on('error', (err) => {
    console.error('[AutoUpdater] Error:', err.message);
    sendToRenderer('updater:error', { error: err.message });
  });

  autoUpdater.on('download-progress', (progress) => {
    console.log(`[AutoUpdater] Download progress: ${progress.percent.toFixed(1)}%`);
    sendToRenderer('updater:progress', {
      percent: progress.percent,
      bytesPerSecond: progress.bytesPerSecond,
      transferred: progress.transferred,
      total: progress.total,
    });
  });

  autoUpdater.on('update-downloaded', (info) => {
    console.log('[AutoUpdater] Update downloaded:', info.version);
    sendToRenderer('updater:downloaded', { version: info.version });

    if (mainWindowRef) {
      dialog.showMessageBox(mainWindowRef, {
        type: 'info',
        title: 'Update Ready',
        message: `Version ${info.version} has been downloaded.`,
        detail: 'The application will restart to install the update. Your school data will remain intact.',
        buttons: ['Restart and Install', 'Later'],
        defaultId: 0,
      }).then(result => {
        if (result.response === 0) {
          // Create safety backup before update
          try {
            const DatabaseService = require('./database');
            const dbService = new DatabaseService();
            dbService.createSafetyBackup();
            console.log('[AutoUpdater] Safety backup created before update');
          } catch (e) {
            console.warn('[AutoUpdater] Failed to create safety backup:', e.message);
          }

          setTimeout(() => {
            autoUpdater.quitAndInstall();
          }, 500);
        }
      });
    }
  });

  return autoUpdater;
}

function sendToRenderer(channel, data) {
  if (mainWindowRef && !mainWindowRef.isDestroyed()) {
    mainWindowRef.webContents.send(channel, data);
  }
}

async function checkForUpdates() {
  if (!autoUpdater) {
    return { updateAvailable: false, message: 'Auto-updater not available in dev mode' };
  }

  try {
    const result = await autoUpdater.checkForUpdates();
    return {
      updateAvailable: !!result?.updateInfo,
      version: result?.updateInfo?.version,
      currentVersion: app.getVersion(),
    };
  } catch (e) {
    console.error('[AutoUpdater] Check failed:', e.message);
    return { updateAvailable: false, error: e.message };
  }
}

async function downloadUpdate() {
  if (!autoUpdater) throw new Error('Auto-updater not available');
  return await autoUpdater.downloadUpdate();
}

function quitAndInstall() {
  if (!autoUpdater) throw new Error('Auto-updater not available');
  
  // Safety backup before install
  try {
    const DatabaseService = require('./database');
    const dbService = new DatabaseService();
    dbService.createSafetyBackup();
  } catch (e) {}

  autoUpdater.quitAndInstall();
}

module.exports = {
  initializeAutoUpdater,
  checkForUpdates,
  downloadUpdate,
  quitAndInstall,
  setMainWindow,
};
