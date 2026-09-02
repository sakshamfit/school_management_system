'use strict';

/**
 * Application vs. data directory separation.
 *
 * Application files live in Program Files (read-only after install).
 * ALL school data lives under the OS application-data directory:
 *
 *   Windows: C:\Users\<USER>\AppData\Local\SchoolManagementSystem\
 *     ├── database/school.sqlite
 *     ├── backups/
 *     ├── uploads/{students,teachers,documents,photos,reports}/
 *     ├── logs/
 *     └── config/
 *
 * Data survives updates, reinstalls and reboots. Nothing here hard-codes
 * usernames — Electron's platform APIs resolve the right location.
 */

const fs = require('fs');
const path = require('path');

let cachedRoot = null;

function appDataRoot() {
  if (cachedRoot) return cachedRoot;

  // Test / portable override.
  if (process.env.SMS_DATA_DIR_OVERRIDE) {
    cachedRoot = path.resolve(process.env.SMS_DATA_DIR_OVERRIDE);
  } else {
    // app.getPath('localAppData') → %LOCALAPPDATA% on Windows.
    const { app } = require('electron');
    cachedRoot = path.join(app.getPath('localAppData'), 'SchoolManagementSystem');
  }

  ensureDirectories();
  return cachedRoot;
}

function ensureDirectories() {
  const root = cachedRoot;
  const dirs = [
    root,
    path.join(root, 'database'),
    path.join(root, 'backups'),
    path.join(root, 'logs'),
    path.join(root, 'config'),
    path.join(root, 'uploads'),
    path.join(root, 'uploads', 'students'),
    path.join(root, 'uploads', 'teachers'),
    path.join(root, 'uploads', 'documents'),
    path.join(root, 'uploads', 'photos'),
    path.join(root, 'uploads', 'reports'),
  ];
  for (const dir of dirs) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

const paths = {
  root: () => appDataRoot(),
  databaseDir: () => path.join(appDataRoot(), 'database'),
  databaseFile: () => path.join(appDataRoot(), 'database', 'school.sqlite'),
  backupDir: () => path.join(appDataRoot(), 'backups'),
  uploadsDir: () => path.join(appDataRoot(), 'uploads'),
  logsDir: () => path.join(appDataRoot(), 'logs'),
  configDir: () => path.join(appDataRoot(), 'config'),
  sessionFile: () => path.join(appDataRoot(), 'config', 'session.bin'),
  licenseCacheFile: () => path.join(appDataRoot(), 'config', 'license-cache.json'),
  deviceFile: () => path.join(appDataRoot(), 'config', 'device.json'),
  serverOverrideFile: () => path.join(appDataRoot(), 'config', 'server.json'),
};

module.exports = paths;
