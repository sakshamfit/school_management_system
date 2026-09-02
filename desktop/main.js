'use strict';

/**
 * School Management System — Windows Desktop Edition
 * Electron main process.
 *
 * Security posture:
 *   - contextIsolation ON, nodeIntegration OFF, sandbox ON
 *   - renderer talks to the outside world only via the preload bridge
 *   - single-instance lock (no competing DB writers)
 *   - devtools disabled in packaged production builds
 *   - window.open / navigation locked down to the app itself
 */

const path = require('path');
const { app, BrowserWindow, Menu, shell, session, dialog } = require('electron');

const paths = require('./lib/paths');
const logger = require('./lib/logger');
const dbModule = require('./lib/db');
const migrations = require('./lib/migrations');
const backupLib = require('./lib/backup');
const { getDeviceIdentity } = require('./lib/device');
const { resolveConfig } = require('./config');
const { registerIpc, restoreSessionOnStartup } = require('./ipc');

const isDev = !app.isPackaged;

let mainWindow = null;
let startupError = null;

// ---------------------------------------------------------------------------
// Single instance: a second launch focuses the existing window instead of
// starting a competing process (protects the SQLite database).
// ---------------------------------------------------------------------------
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
  process.exit(0);
}

app.on('second-instance', () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  }
});

// ---------------------------------------------------------------------------
// Window
// ---------------------------------------------------------------------------
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1360,
    height: 860,
    minWidth: 1024,
    minHeight: 640,
    title: 'School Management System',
    backgroundColor: '#f5f5f7',
    icon: path.join(__dirname, '..', 'resources', 'icon.png'),
    autoHideMenuBar: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      spellcheck: false,
    },
  });

  // Never open new Electron windows from content; http(s)/mailto go to the
  // default browser, everything else is denied.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//i.test(url) || /^mailto:/i.test(url)) {
      shell.openExternal(url).catch(() => {});
    }
    return { action: 'deny' };
  });

  // Block in-app navigation away from the application itself.
  mainWindow.webContents.on('will-navigate', (event, url) => {
    const devServer = process.env.VITE_DEV_SERVER_URL;
    if (devServer && url.startsWith(devServer)) return;
    if (url.startsWith('file://')) return;
    event.preventDefault();
  });

  if (isDev && process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  setupMenu();
  return mainWindow;
}

function setupMenu() {
  const template = [
    {
      label: 'File',
      submenu: [
        { label: 'Print Active Page / Receipt', accelerator: 'CmdOrCtrl+P', click: () => mainWindow && mainWindow.webContents.print() },
        { type: 'separator' },
        { label: 'Exit School Management System', accelerator: 'CmdOrCtrl+Q', click: () => app.quit() },
      ],
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' },
      ],
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload', accelerator: 'CmdOrCtrl+R', visible: isDev },
        { role: 'forceReload', visible: isDev },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
      ],
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'Contact Support',
          click: () => {
            if (mainWindow) mainWindow.webContents.send('nav:open-support');
          },
        },
        { type: 'separator' },
        {
          label: `Version ${app.getVersion()}`,
          enabled: false,
        },
      ],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

// ---------------------------------------------------------------------------
// Startup sequence
// ---------------------------------------------------------------------------
async function startup() {
  logger.init({ dir: paths.logsDir(), isDev });
  logger.info('application starting', {
    version: app.getVersion(),
    platform: process.platform,
    packaged: app.isPackaged,
  });

  const config = resolveConfig(paths);
  const device = getDeviceIdentity();
  logger.info('configuration resolved', { environment: config.environment, server: config.licenseServerUrl });

  // Open + migrate the local database before the window appears.
  try {
    const db = dbModule.openDatabase();
    await migrations.runMigrations(db, { createBackup: (opts) => backupLib.createBackup(opts) });
  } catch (err) {
    startupError = err;
    logger.error('database startup failed', { code: err.code, message: err.message });
  }

  registerIpc({ config, device });

  // Harden the renderer session: strict CSP + no permission prompts.
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [
          "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self' data: blob: https:; connect-src 'self' https://*.googleapis.com https://*.gstatic.com https://*.firebaseio.com https://*.firestore.googleapis.com; worker-src 'self' blob:",
        ],
      },
    });
  });
  session.defaultSession.setPermissionRequestHandler((_wc, _permission, callback) => callback(false));

  createWindow();

  if (startupError) {
    if (mainWindow) {
      mainWindow.webContents.on('did-finish-load', () => {
        mainWindow.webContents.send('startup:error', {
          code: startupError.code || 'DATABASE_ERROR',
          message: startupError.message,
        });
      });
    }
  } else {
    // Session restoration (auto-login) + daily backup, quietly in background.
    restoreSessionOnStartup()
      .then((result) => {
        if (result && result.restored && mainWindow) {
          mainWindow.webContents.send('session:restored', { mode: result.mode });
        }
      })
      .catch((err) => logger.error('session restore failed', { message: err.message }));

    backupLib
      .ensureFreshBackup('startup')
      .then((r) => {
        if (r && r.file) logger.info('startup backup created', { file: r.file });
      })
      .catch((err) => logger.warn('startup backup failed', { error: err.message }));

    // Auto-updater only makes sense in packaged builds.
    if (!isDev) {
      const updaterLib = require('./lib/updater');
      updaterLib.initUpdater(mainWindow);
    }
  }
}

app.whenReady().then(() => {
  startup().catch((err) => {
    logger.error('fatal startup error', { message: err.message });
    dialog.showErrorBox(
      'School Management System could not start',
      `${err.message}\n\nYour school data is stored safely in the application data folder. Please restart the application or contact support.`
    );
    app.quit();
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => {
  logger.info('application shutting down');
  try {
    dbModule.closeDatabase();
  } catch {
    /* ignore */
  }
});

// Fail loudly but safely on unhandled rejections.
process.on('unhandledRejection', (reason) => {
  logger.error('unhandled rejection', { message: String(reason && reason.message ? reason.message : reason) });
});
process.on('uncaughtException', (err) => {
  logger.error('uncaught exception', { message: err.message });
});
