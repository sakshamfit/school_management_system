/**
 * Electron main process entrypoint.
 *
 * Single-instance desktop app with:
 *   - deterministic user-data location
 *   - hardened BrowserWindow (see windows.cjs)
 *   - control-plane licensing session (see licenseClient.cjs)
 *   - update checks against the trusted release feed
 */

const path = require('path');
const { app, BrowserWindow, ipcMain } = require('electron');
const { createMainWindow, installApplicationMenu } = require('./windows.cjs');
const { LicenseClient } = require('./licenseClient.cjs');
const { checkForUpdates } = require('./releaseClient.cjs');

// Deterministic customer data location:
//   Windows: %LOCALAPPDATA%\SchoolManagementSystem
//   macOS:   ~/Library/Application Support/SchoolManagementSystem
// Updates MUST never delete this directory (see update-safety docs).
if (process.platform === 'win32' && process.env.LOCALAPPDATA) {
  app.setPath('userData', path.join(process.env.LOCALAPPDATA, 'SchoolManagementSystem'));
} else {
  app.setPath('userData', path.join(app.getPath('appData'), 'SchoolManagementSystem'));
}

// In production the app must not allow insecure content anywhere.
if (app.isPackaged) {
  app.commandLine.appendSwitch('--disable-features', 'InsecurePrivateNetworkRequests');
}

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  let licenseClient = null;

  app.on('second-instance', () => {
    const [existing] = BrowserWindow.getAllWindows();
    if (existing) {
      if (existing.isMinimized()) existing.restore();
      existing.focus();
    }
  });

  app.whenReady().then(() => {
    installApplicationMenu();

    licenseClient = new LicenseClient();
    licenseClient.registerIpc();

    ipcMain.handle('control-plane:check-updates', () => checkForUpdates());

    const isDev = !app.isPackaged;
    createMainWindow({ isDev });

    licenseClient.start();

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createMainWindow({ isDev });
    });
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      app.quit();
    }
  });
}
