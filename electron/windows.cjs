/**
 * Main BrowserWindow — hardened Electron configuration.
 *
 *  - contextIsolation on, nodeIntegration off, sandbox on
 *  - no remote module, no popup windows, no navigation away from the app
 *  - external links open in the system browser
 *  - production loads ONLY the packaged dist build (no localhost fallback)
 */

const { BrowserWindow, Menu, shell } = require('electron');
const path = require('path');

function blockAllPermissions(session) {
  session.setPermissionRequestHandler((_wc, _permission, callback) => callback(false));
  session.setPermissionCheckHandler(() => false);
}

function createMainWindow({ isDev }) {
  const win = new BrowserWindow({
    width: 1280,
    height: 840,
    minWidth: 1024,
    minHeight: 640,
    title: 'School Management System',
    backgroundColor: '#f5f5f7',
    icon: path.join(__dirname, '..', 'public', 'icon.svg'),
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      preload: path.join(__dirname, 'preload.cjs'),
      webSecurity: true,
      allowRunningInsecureContent: false,
      spellcheck: false,
    },
  });

  blockAllPermissions(win.webContents.session);

  // Open external links in the system browser, never inside the app.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//i.test(url) || url.startsWith('mailto:') || url.startsWith('tel:')) {
      shell.openExternal(url);
    }
    return { action: 'deny' };
  });

  // The app must not be navigated away from its own origin.
  win.webContents.on('will-navigate', (event, url) => {
    const current = win.webContents.getURL();
    let currentHost = '';
    let targetHost = '';
    try {
      currentHost = new URL(current).host;
      targetHost = new URL(url).host;
    } catch {
      /* ignore */
    }
    if (targetHost && targetHost !== currentHost) {
      event.preventDefault();
    }
  });

  win.once('ready-to-show', () => win.show());

  if (isDev && process.env.VITE_DEV_SERVER_URL) {
    win.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    // Production: packaged build ONLY. There is deliberately NO localhost
    // fallback in production — a missing bundle is a build/packaging bug,
    // not a reason to load remote content.
    const indexPath = path.join(__dirname, '..', 'dist', 'index.html');
    win.loadFile(indexPath).catch(() => {
      win.loadURL(
        `data:text/html;charset=utf-8,${encodeURIComponent(
          '<h2 style="font-family:sans-serif;padding:2rem">Application files are missing. Please reinstall School Management System. Your data is safe.</h2>'
        )}`
      );
    });
  }

  return win;
}

function installApplicationMenu() {
  const template = [
    {
      label: 'File',
      submenu: [
        {
          label: 'Print Active Page / Receipt',
          accelerator: 'CmdOrCtrl+P',
          click: (_item, window) => window?.webContents.print(),
        },
        { type: 'separator' },
        { label: 'Exit', accelerator: 'CmdOrCtrl+Q', role: 'quit' },
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
      label: 'Help',
      submenu: [
        {
          label: 'Support & Contact',
          click: () => {
            shell.openExternal('https://wa.me/919876543210');
          },
        },
      ],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

module.exports = { createMainWindow, installApplicationMenu };
