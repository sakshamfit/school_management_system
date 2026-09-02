const { app, BrowserWindow, Menu, shell, safeStorage } = require('electron');
const path = require('path');
const fs = require('fs');

let mainWindow;
let backupService = null;

// Setup secure storage mock for lib that expects electron.safeStorage
// Inject safeStorage into require cache so secureStorage can use it
try {
  const secureStoragePath = path.join(__dirname, 'desktop', 'lib', 'secureStorage.js');
  if (fs.existsSync(secureStoragePath)) {
    // Will be required later, safeStorage will try to get it
  }
} catch (e) {}

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
      sandbox: false, // Need false for preload to access ipcRenderer with contextBridge, but we keep isolation
      preload: preloadPath,
      webSecurity: true,
      allowRunningInsecureContent: false,
    },
  });

  // Open external links (e.g. WhatsApp, emails, docs, Google OAuth) in default browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http:') || url.startsWith('https:') || url.startsWith('mailto:') || url.startsWith('tel:')) {
      // Allow OAuth callback to 127.0.0.1 to be handled internally by auth server, not external
      if (url.includes('127.0.0.1') && url.includes('/callback')) {
        return { action: 'allow' };
      }
      shell.openExternal(url);
      return { action: 'deny' };
    }
    return { action: 'allow' };
  });

  const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;
  if (isDev && process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    // Load production build
    const indexPath = path.join(__dirname, 'dist', 'index.html');
    mainWindow.loadFile(indexPath).catch(() => {
      // Fallback dev server
      mainWindow.loadURL('http://localhost:3000');
    });
  }

  // Set up Desktop Menu
  const template = [
    {
      label: 'File',
      submenu: [
        {
          label: 'Print Active Page / Receipt',
          accelerator: 'CmdOrCtrl+P',
          click: () => mainWindow.webContents.print(),
        },
        { type: 'separator' },
        {
          label: 'Exit M.S. Public School Portal',
          accelerator: 'CmdOrCtrl+Q',
          click: () => app.quit(),
        },
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
        { role: 'reload', accelerator: 'CmdOrCtrl+R' },
        { role: 'forceReload', accelerator: 'CmdOrCtrl+Shift+R' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
      ],
    },
    {
      label: 'Backup',
      submenu: [
        {
          label: 'Open Backup Settings',
          click: () => {
            if (mainWindow) {
              mainWindow.webContents.send('navigate-to', { tab: 'settings', subTab: 'backup' });
            }
          }
        },
        { type: 'separator' },
        {
          label: 'Create Local Safety Backup',
          click: async () => {
            if (mainWindow) {
              mainWindow.webContents.send('backup:progress', { stage: 'local-backup', message: 'Creating local safety backup...' });
            }
          }
        }
      ]
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'School Support & Contact',
          click: () => {
            shell.openExternal('https://wa.me/919876543210');
          },
        },
        { type: 'separator' },
        {
          label: 'About M.S. Public School System',
          click: () => {
            shell.openExternal('https://mspublicschool.edu.in');
          }
        }
      ],
    },
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);

  // Setup IPC and backup service after window creation
  setupBackupSystem();

  mainWindow.on('closed', () => {
    mainWindow = null;
    // Stop scheduler
    try {
      if (backupService) {
        backupService.stopScheduler();
      }
    } catch (e) {}
  });

  // Handle online/offline events from renderer
  mainWindow.webContents.on('did-finish-load', () => {
    // Inject online status listener
    mainWindow.webContents.executeJavaScript(`
      window.addEventListener('online', () => {
        console.log('[Renderer] Online event');
        if (window.electronAPI && window.electronAPI.backup) {
          window.electronAPI.backup.checkConnectivity();
        }
      });
      window.addEventListener('offline', () => {
        console.log('[Renderer] Offline event');
      });
    `).catch(() => {});
  });
}

function setupBackupSystem() {
  try {
    const ipcModulePath = path.join(__dirname, 'desktop', 'ipc.js');
    if (!fs.existsSync(ipcModulePath)) {
      console.warn('[Electron] IPC module not found at', ipcModulePath);
      return;
    }

    const { registerIpcHandlers, setMainWindow, getBackupService } = require(ipcModulePath);
    
    setMainWindow(mainWindow);
    registerIpcHandlers();
    
    backupService = getBackupService();
    
    // Start scheduler
    try {
      backupService.startScheduler();
      console.log('[Electron] Backup scheduler started');
    } catch (e) {
      console.warn('[Electron] Failed to start backup scheduler:', e.message);
    }

    // Ensure app data directories exist
    const { getAppDataPaths } = require('./desktop/lib/constants');
    const paths = getAppDataPaths();
    const dirsToEnsure = [
      paths.base,
      paths.database,
      paths.backups,
      paths.secure,
      path.dirname(paths.metadataFile),
      path.join(paths.base, 'safety_backups'),
    ];
    
    for (const dir of dirsToEnsure) {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    }

    console.log('[Electron] Backup system initialized');
    console.log('[Electron] App data path:', paths.base);
    console.log('[Electron] SafeStorage available:', safeStorage.isEncryptionAvailable());

  } catch (e) {
    console.error('[Electron] Failed to setup backup system:', e);
  }
}

// Ensure single instance
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
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  try {
    if (backupService) {
      backupService.stopScheduler();
    }
  } catch (e) {}
});

// Security: prevent new windows
app.on('web-contents-created', (event, contents) => {
  contents.on('new-window', (event, navigationUrl) => {
    event.preventDefault();
    shell.openExternal(navigationUrl);
  });
});

// Handle protocol for OAuth (optional)
// app.setAsDefaultProtocolClient('schoolmanagementsystem');
