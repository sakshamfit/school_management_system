'use strict';

/**
 * Automatic updates (Windows: NSIS installer via electron-updater).
 *
 * - Update checks happen on startup (after 8s) and every 6h — never constant
 *   polling, and never blocking app use.
 * - Downloads run in the background; the user chooses when to restart.
 * - Updates replace ONLY application files (Program Files). School data lives
 *   in AppData and is untouched by any update. Database migrations (with
 *   pre-backup) handle schema changes on next launch.
 * - Failures are logged and reported to the renderer; the running app never
 *   becomes unusable because an update failed.
 */

const logger = require('./logger');

let updater = null;
let win = null;

function send(channel, payload) {
  try {
    if (win && !win.isDestroyed()) win.webContents.send(channel, payload);
  } catch {
    /* ignore */
  }
}

function initUpdater(mainWindow, { autoDownload = true } = {}) {
  win = mainWindow;
  try {
    // eslint-disable-next-line global-require
    const { autoUpdater } = require('electron-updater');
    updater = autoUpdater;
  } catch (err) {
    logger.warn('electron-updater unavailable (dev mode?)', { error: err.message });
    return { available: false };
  }

  updater.autoDownload = autoDownload;
  updater.autoInstallOnAppQuit = true;
  updater.logger = {
    info: (m) => logger.info(`[updater] ${m}`),
    warn: (m) => logger.warn(`[updater] ${m}`),
    error: (m) => logger.error(`[updater] ${m}`),
    debug: () => {},
  };

  updater.on('checking-for-update', () => send('updater:status', { state: 'checking' }));
  updater.on('update-available', (info) => {
    logger.info('update available', { version: info && info.version });
    send('updater:status', { state: 'available', version: info && info.version });
  });
  updater.on('update-not-available', () => send('updater:status', { state: 'up-to-date' }));
  updater.on('download-progress', (p) =>
    send('updater:status', { state: 'downloading', percent: Math.round(p.percent || 0) })
  );
  updater.on('update-downloaded', (info) => {
    logger.info('update downloaded', { version: info && info.version });
    send('updater:status', { state: 'downloaded', version: info && info.version });
  });
  updater.on('error', (err) => {
    logger.error('update error', { error: err && err.message });
    send('updater:status', { state: 'error', message: (err && err.message) || 'Update failed' });
  });

  // First check shortly after startup; then every 6 hours.
  setTimeout(() => checkForUpdates().catch(() => {}), 8000);
  setInterval(() => checkForUpdates().catch(() => {}), 6 * 3600 * 1000);

  return { available: true };
}

async function checkForUpdates() {
  if (!updater) return { skipped: true };
  try {
    const result = await updater.checkForUpdates();
    return { ok: true, version: result && result.updateInfo && result.updateInfo.version };
  } catch (err) {
    logger.warn('update check failed', { error: err.message });
    send('updater:status', { state: 'error', message: err.message });
    return { ok: false, error: err.message };
  }
}

async function downloadUpdate() {
  if (!updater) return { skipped: true };
  await updater.downloadUpdate();
  return { ok: true };
}

function quitAndInstall() {
  if (!updater) return;
  logger.info('quitting to install update');
  updater.quitAndInstall(false, true);
}

module.exports = { initUpdater, checkForUpdates, downloadUpdate, quitAndInstall };
