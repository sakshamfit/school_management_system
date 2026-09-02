const { app, BrowserWindow, Menu, shell, safeStorage } = require('electron');
const path = require('path');
const fs = require('fs');

let mainWindow;
let backupService = null;
let databaseService = null;

function getPreloadPath() {
  const possible = [
    path.join(__dirname, 'desktop', 'preload.js'),
    path.join(__dirname, 'desktop', 'preload.cjs'),
  ];
  for (const p of possible) {
    if (fs.existsSync(p)) return p;
  }
  return path.join(__dirname, 'desktop', 'preload.js');
}

function createWindow() {
  const preloadPath = getPreloadPath();
  
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 840,
    minWidth: 1024,
    minHeight: 640,
    title: 'M.S. PUBLIC SCHOOL | Management System',
    backgroundColor: '#f5f5f7',
    icon: path.join(__dirname, 'public', 'icon.svg'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true, // Hardened: sandbox enabled
      preload: preloadPath,
      webSecurity: true,
      allowRunningInsecureContent: false,
      enableRemoteModule: false,
    },
  });

  // Security: prevent new windows, open external in browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.includes('127.0.0.1') && url.includes('/callback')) {
      return { action: 'allow' };
    }
    if (url.startsWith('http:') || url.startsWith('https:') || url.startsWith('mailto:') || url.startsWith('tel:')) {
      shell.openExternal(url);
      return { action: 'deny' };
    }
    return { action: 'deny' };
  });

  // Security: prevent navigation to external URLs
  mainWindow.webContents.on('will-navigate', (event, navigationUrl) => {
    const parsedUrl = new URL(navigationUrl);
    if (parsedUrl.origin !== 'http://localhost:3000' && parsedUrl.origin !== 'http://127.0.0.1:3000' && !navigationUrl.includes('127.0.0.1')) {
      // Allow file:// for production build
      if (!navigationUrl.startsWith('file://')) {
        event.preventDefault();
      }
    }
  });

  const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;
  const appVersion = app.getVersion();

  if (isDev && process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    const indexPath = path.join(__dirname, 'dist', 'index.html');
    mainWindow.loadFile(indexPath).catch(() => {
      mainWindow.loadURL('http://localhost:3000');
    });
  }

  // Production menu
  const template = [
    {
      label: 'File',
      submenu: [
        { label: 'Print', accelerator: 'CmdOrCtrl+P', click: () => mainWindow.webContents.print() },
        { type: 'separator' },
        { label: 'Exit', accelerator: 'CmdOrCtrl+Q', click: () => app.quit() },
      ],
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' }, { role: 'redo' }, { type: 'separator' },
        { role: 'cut' }, { role: 'copy' }, { role: 'paste' }, { role: 'selectAll' },
      ],
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' }, { role: 'forceReload' }, { type: 'separator' },
        { role: 'resetZoom' }, { role: 'zoomIn' }, { role: 'zoomOut' }, { type: 'separator' },
        { role: 'togglefullscreen' },
        ...(isDev ? [{ label: 'Toggle DevTools', accelerator: 'F12', click: () => mainWindow.webContents.toggleDevTools() }] : []),
      ],
    },
    {
      label: 'Backup',
      submenu: [
        {
          label: 'Open Backup Settings',
          click: () => { if (mainWindow) mainWindow.webContents.send('navigate-to', { tab: 'settings', subTab: 'backup' }); }
        },
        { type: 'separator' },
        {
          label: 'Create Safety Backup',
          click: async () => {
            if (mainWindow) mainWindow.webContents.send('backup:progress', { stage: 'local-backup', message: 'Creating local safety backup...' });
            try {
              const DatabaseService = require('./desktop/lib/database');
              const dbService = new DatabaseService();
              dbService.createSafetyBackup();
            } catch (e) {}
          }
        },
        {
          label: 'Check Database Integrity',
          click: async () => {
            try {
              const DatabaseService = require('./desktop/lib/database');
              const dbService = new DatabaseService();
              const result = dbService.checkIntegrity();
              const { dialog } = require('electron');
              dialog.showMessageBox(mainWindow, {
                type: result.ok ? 'info' : 'error',
                title: 'Database Integrity',
                message: result.ok ? 'Database integrity check passed' : `Integrity check failed: ${result.error}`,
              });
            } catch (e) {
              const { dialog } = require('electron');
              dialog.showErrorBox('Database Check Failed', e.message);
            }
          }
        }
      ]
    },
    {
      label: 'Help',
      submenu: [
        { label: 'Support', click: () => shell.openExternal('https://wa.me/919876543210') },
        { type: 'separator' },
        { label: `Version ${appVersion}`, enabled: false },
        { label: 'About', click: () => shell.openExternal('https://mspublicschool.edu.in') },
      ],
    },
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);

  setupProductionSystem();

  mainWindow.on('closed', () => {
    mainWindow = null;
    try {
      if (backupService) backupService.stopScheduler();
      if (databaseService) databaseService.close();
    } catch (e) {}
  });

  mainWindow.webContents.on('did-finish-load', () => {
    mainWindow.webContents.executeJavaScript(`
      window.addEventListener('online', () => console.log('[Renderer] Online'));
      window.addEventListener('offline', () => console.log('[Renderer] Offline'));
    `).catch(() => {});
  });
}

let autoUpdaterService = null;

function setupProductionSystem() {
  try {
    const ipcModulePath = path.join(__dirname, 'desktop', 'ipc.js');
    if (!fs.existsSync(ipcModulePath)) {
      console.warn('[Electron] IPC module not found');
      return;
    }

    const { registerIpcHandlers, setMainWindow, getBackupService, getDatabaseService } = require(ipcModulePath);
    
    setMainWindow(mainWindow);
    registerIpcHandlers();
    
    backupService = getBackupService();
    databaseService = getDatabaseService();

    // Initialize database
    try {
      const dbResult = databaseService.initialize();
      console.log('[Electron] Database initialized:', dbResult.mode);
      
      // Integrity check
      const integrity = databaseService.checkIntegrity();
      if (!integrity.ok) {
        console.error('[Electron] Database integrity failed, handling corrupted DB');
        databaseService.handleCorruptedDatabase();
      }
    } catch (e) {
      console.error('[Electron] Database init failed:', e.message);
    }

    // Start backup scheduler
    try {
      backupService.startScheduler();
      console.log('[Electron] Backup scheduler started');
    } catch (e) {
      console.warn('[Electron] Failed to start scheduler:', e.message);
    }

    // Ensure app data directories
    const { getAppDataPaths } = require('./desktop/lib/constants');
    const paths = getAppDataPaths();
    const dirsToEnsure = [
      paths.base,
      paths.database,
      paths.backups,
      paths.secure,
      path.dirname(paths.metadataFile),
      path.join(paths.base, 'safety_backups'),
      path.join(paths.base, 'config'),
      path.join(paths.base, 'files'),
      path.join(paths.base, 'logs'),
    ];
    
    for (const dir of dirsToEnsure) {
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    }

    // Initialize auto-updater
    try {
      const autoUpdaterPath = path.join(__dirname, 'desktop', 'lib', 'autoUpdater.js');
      if (fs.existsSync(autoUpdaterPath)) {
        const { initializeAutoUpdater, setMainWindow: setUpdaterWindow } = require(autoUpdaterPath);
        autoUpdaterService = initializeAutoUpdater();
        setUpdaterWindow(mainWindow);
        console.log('[Electron] Auto-updater initialized');
        
        // Check for updates after 5 seconds if packaged
        if (app.isPackaged) {
          setTimeout(() => {
            try {
              autoUpdaterService.checkForUpdates();
            } catch (e) {
              console.warn('[Electron] Auto-update check failed:', e.message);
            }
          }, 5000);
        }
      }
    } catch (e) {
      console.warn('[Electron] Failed to initialize auto-updater:', e.message);
    }

    console.log('[Electron] Production system initialized');
    console.log('[Electron] App data:', paths.base);
    console.log('[Electron] SafeStorage:', safeStorage.isEncryptionAvailable());
    console.log('[Electron] Version:', app.getVersion());
    console.log('[Electron] Production:', app.isPackaged);

  } catch (e) {
    console.error('[Electron] Failed to setup production system:', e);
  }
}

// Single instance
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.whenReady().then(() => {
    createWindow();
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => {
  try {
    if (backupService) backupService.stopScheduler();
    if (databaseService) databaseService.close();
  } catch (e) {}
});

// Security: prevent new windows
app.on('web-contents-created', (event, contents) => {
  contents.on('new-window', (event, navigationUrl) => {
    event.preventDefault();
    shell.openExternal(navigationUrl);
  });
  
  // Security: prevent remote module
  contents.on('will-attach-webview', (event) => {
    event.preventDefault();
  });
});
