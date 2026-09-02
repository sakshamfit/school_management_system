'use strict';

/**
 * IPC handlers. Every renderer request passes through here and every argument
 * is validated in the main process. The renderer is never trusted.
 *
 * Sessions: the main process owns authentication state. Tokens live in
 * OS-encrypted storage (safeStorage); the renderer only receives sanitized
 * session/license info — never tokens or secrets.
 */

const { ipcMain, shell, app } = require('electron');
const os = require('os');
const fs = require('fs');
const path = require('path');

const logger = require('./lib/logger');
const paths = require('./lib/paths');
const dbModule = require('./lib/db');
const repository = require('./lib/repository');
const migrations = require('./lib/migrations');
const backup = require('./lib/backup');
const files = require('./lib/files');
const secureStore = require('./lib/secureStore');
const { LicenseClient, offlineAccessDecision } = require('./lib/licenseClient');
const updater = require('./lib/updater');

const SESSION_REFRESH_MARGIN_MS = 30 * 60 * 1000;

let ctx = null; // set by registerIpc()

function makeSessionState() {
  return {
    authenticated: false,
    mode: null, // 'online' | 'offline'
    tokens: null,
    school: null,
    user: null, // principal/school-admin user object presented to the renderer
    teacher: null, // set when a teacher signs in locally on top of a school session
    policy: null,
    support: null,
  };
}

let session = makeSessionState();
let revalidateTimer = null;

function licenseClient() {
  return new LicenseClient({
    serverUrl: ctx.config.licenseServerUrl,
    appVersion: ctx.config.appVersion,
    device: ctx.device,
  });
}

function publicSessionInfo() {
  const cache = licenseClient().getCached();
  const decision = offlineAccessDecision(cache);
  return {
    authenticated: session.authenticated,
    mode: session.mode,
    school: session.school,
    user: session.teacher || session.user,
    isTeacherSession: !!session.teacher,
    license: cache && cache.license ? cache.license : null,
    policy: cache && cache.policy ? cache.policy : null,
    support: cache && cache.support ? cache.support : null,
    lastVerifiedAt: cache ? cache.lastVerifiedAt : null,
    offline: decision,
  };
}

function requireSession() {
  if (!session.authenticated) {
    const err = new Error('Not signed in');
    err.code = 'NO_SESSION';
    throw err;
  }
}

function requirePrincipal() {
  requireSession();
  if (session.teacher) {
    const err = new Error('This action requires the school administrator.');
    err.code = 'FORBIDDEN';
    throw err;
  }
}

function serializeError(err) {
  return { error: true, code: err.code || 'ERROR', message: err.message || 'Unexpected error' };
}

function guard(channel, handler) {
  ipcMain.handle(channel, async (_event, payload) => {
    try {
      return await handler(payload);
    } catch (err) {
      logger.error(`ipc ${channel} failed`, { code: err.code, message: err.message });
      return serializeError(err);
    }
  });
}

// ---------------------------------------------------------------------------
// Seed the local database on first sign-in (fresh install).
// ---------------------------------------------------------------------------
function buildSeedDatabase(schoolProfile) {
  const now = new Date();
  const year = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1; // Indian academic year starts April
  const currentYear = `${year}-${year + 1}`;
  const nextYear = `${year + 1}-${year + 2}`;
  const iso = now.toISOString();

  const classes = [
    ['Nursery', 'cls_nur'], ['LKG', 'cls_lkg'], ['UKG', 'cls_ukg'],
  ];
  for (let i = 1; i <= 10; i += 1) classes.push([`Class ${i}`, `cls_${String(i).padStart(2, '0')}`]);

  return {
    schoolInfo: {
      id: `school_${schoolProfile.id}`,
      name: schoolProfile.name || 'School',
      tagline: '',
      affiliationNumber: '',
      address: schoolProfile.address || '',
      phone: schoolProfile.phone || '',
      email: schoolProfile.email || '',
      currentAcademicYear: currentYear,
      setupCompleted: true,
      principalName: '',
    },
    academicYears: [
      { id: `ay_${year}`, name: currentYear, isCurrent: true, startDate: `${year}-04-01`, endDate: `${year + 1}-03-31` },
      { id: `ay_${year + 1}`, name: nextYear, isCurrent: false, startDate: `${year + 1}-04-01`, endDate: `${year + 2}-03-31` },
    ],
    users: [
      {
        id: `usr_admin_${schoolProfile.id}`,
        name: schoolProfile.adminName || 'School Administrator',
        email: schoolProfile.email || '',
        role: 'principal',
        phone: schoolProfile.phone || '',
        status: 'active',
        joiningDate: iso.slice(0, 10),
        createdAt: iso,
        // NOTE: no password — desktop authentication is server-managed.
      },
    ],
    classes: classes.map(([name, id], idx) => ({
      id,
      name,
      section: 'A',
      roomNumber: `R-${101 + idx}`,
      capacity: 40,
      totalStudents: 0,
    })),
    students: [],
    attendance: [],
    teacherAttendance: [],
    feeAccounts: [],
    feeTransactions: [],
    exams: [],
    results: [],
    performance: [],
    activityLogs: [],
    notifications: [],
  };
}

function ensureDatabaseSeeded(loginData) {
  const db = dbModule.getDb();
  const existing = db.prepare('SELECT data FROM school_info WHERE id = 1').get();
  if (existing) return false;
  const seed = buildSeedDatabase({
    id: loginData.school.id,
    name: loginData.school.name,
    address: loginData.school.address,
    phone: loginData.school.phone,
    email: loginData.school.email,
    adminName: loginData.user && loginData.user.name,
  });
  repository.replaceFullDatabase(seed);
  logger.info('local database seeded for school', { schoolCode: loginData.school.schoolCode });
  return true;
}

// ---------------------------------------------------------------------------
// License revalidation (online heartbeat)
// ---------------------------------------------------------------------------
function scheduleRevalidation() {
  if (revalidateTimer) clearInterval(revalidateTimer);
  const hours = session.policy && session.policy.revalidateHours ? Math.min(Math.max(session.policy.revalidateHours, 1), 720) : 24;
  revalidateTimer = setInterval(() => revalidateOnline().catch(() => {}), hours * 3600 * 1000);
}

async function revalidateOnline() {
  if (!session.authenticated || !session.tokens) return;
  const client = licenseClient();
  let result;
  try {
    result = await client.validate(session.tokens.accessToken);
  } catch (err) {
    logger.warn('periodic revalidation network failure', { message: err.message });
    return; // offline — grace policy already governs
  }

  if (!result.ok && result.error === 'INVALID_TOKEN') {
    const refreshed = await client.refresh(session.tokens.refreshToken).catch(() => ({ ok: false }));
    if (refreshed.ok) {
      session.tokens = {
        accessToken: refreshed.data.accessToken,
        refreshToken: refreshed.data.refreshToken,
      };
      secureStore.saveSession({ tokens: session.tokens, schoolId: session.school && session.school.id });
      result = await client.validate(session.tokens.accessToken).catch(() => ({ ok: false }));
    }
  }

  if (!result.ok && result.error && result.error.startsWith('LICENSE_')) {
    logger.warn('license revalidation denied', { error: result.error });
    broadcast('auth:license-changed', { status: result.error, message: result.message });
  } else if (result.ok) {
    broadcast('auth:license-changed', { status: 'ACTIVE' });
  }
}

function broadcast(channel, payload) {
  try {
    const { BrowserWindow } = require('electron');
    BrowserWindow.getAllWindows().forEach((w) => {
      if (!w.isDestroyed()) w.webContents.send(channel, payload);
    });
  } catch {
    /* ignore */
  }
}

function applyLoginSuccess(data) {
  session.authenticated = true;
  session.mode = 'online';
  session.tokens = { accessToken: data.accessToken, refreshToken: data.refreshToken };
  session.school = data.school;
  session.user = {
    id: data.user.id,
    name: data.user.name,
    email: data.user.email,
    role: 'principal', // school account holder maps to the principal console
    status: 'active',
  };
  session.teacher = null;
  session.policy = data.policy;
  session.support = data.support;
  secureStore.saveSession({ tokens: session.tokens, schoolId: data.school.id });
  scheduleRevalidation();
}

// ---------------------------------------------------------------------------
// Handler registration
// ---------------------------------------------------------------------------
function registerIpc(context) {
  ctx = context;

  // --------------------------- AUTH ----------------------------------------
  guard('auth:login', async (payload) => {
    const identifier = payload && typeof payload.identifier === 'string' ? payload.identifier.trim() : '';
    const password = payload && typeof payload.password === 'string' ? payload.password : '';
    if (!identifier || !password) return serializeError({ code: 'INVALID_INPUT', message: 'Enter your school ID/email and password.' });
    if (identifier.length > 200 || password.length > 200) return serializeError({ code: 'INVALID_INPUT', message: 'Input too long.' });

    if (!ctx.config.licenseServerUrl) {
      return serializeError({ code: 'NO_SERVER', message: 'This installation has no license server configured. Contact support.' });
    }

    const client = licenseClient();
    let result;
    try {
      result = await client.login({ identifier, password });
    } catch (err) {
      return serializeError({ code: err.code || 'NETWORK', message: err.message });
    }

    if (!result.ok) {
      return { error: true, code: result.error, message: result.message, raw: result.raw && result.raw.support ? { support: result.raw.support } : undefined };
    }

    if (result.data.newDeviceActivated) {
      logger.info('new device activated', {
        device: ctx.device.deviceName,
        maxDevices: result.data.license && result.data.license.maxDevices,
      });
    }

    applyLoginSuccess(result.data);
    try {
      dbModule.openDatabase();
      await migrations.runMigrations(dbModule.getDb(), { createBackup: (opts) => backup.createBackup(opts) });
      ensureDatabaseSeeded(result.data);
    } catch (err) {
      logger.error('post-login database init failed', { message: err.message });
      return serializeError(err);
    }

    return {
      ok: true,
      session: publicSessionInfo(),
      newDeviceActivated: !!result.data.newDeviceActivated,
    };
  });

  guard('auth:login-teacher-local', async (payload) => {
    requireSession();
    const code = typeof payload === 'string' ? payload.trim().toUpperCase() : '';
    if (!code) return serializeError({ code: 'INVALID_INPUT', message: 'Enter the teacher code.' });

    const dbData = repository.loadFullDatabase(null);
    const teacher = dbData.users.find((u) => u.role === 'teacher' && (u.teacherCode || '').toUpperCase() === code);
    if (!teacher) return serializeError({ code: 'INVALID_CODE', message: 'Invalid teacher code. Please contact the school administrator.' });
    if (teacher.status === 'archived') return serializeError({ code: 'ARCHIVED', message: 'This teacher account is archived. Contact the school administrator.' });

    session.teacher = teacher;
    logger.info('teacher signed in locally', { teacherId: teacher.id });
    return { ok: true, session: publicSessionInfo() };
  });

  guard('auth:logout', async () => {
    const client = licenseClient();
    if (session.tokens) await client.logout(session.tokens.accessToken).catch(() => {});
    const who = session.teacher ? session.teacher.name : session.user && session.user.name;
    secureStore.clearSession();
    session = makeSessionState();
    if (revalidateTimer) clearInterval(revalidateTimer);
    logger.info('logout', { who });
    return { ok: true };
  });

  guard('auth:session-status', async () => ({ ok: true, session: publicSessionInfo() }));

  guard('auth:license-status', async () => {
    const cache = licenseClient().getCached();
    return { ok: true, license: cache && cache.license, lastVerifiedAt: cache && cache.lastVerifiedAt, device: { name: ctx.device.deviceName, id: ctx.device.deviceIdentifier.slice(0, 8) } };
  });

  guard('auth:validate-now', async () => {
    if (!session.authenticated) return serializeError({ code: 'NO_SESSION', message: 'Not signed in.' });
    const client = licenseClient();
    try {
      const result = await client.validate(session.tokens.accessToken);
      if (result.ok) return { ok: true, license: result.data.license, daysRemaining: result.data.daysRemaining };
      if (result.error === 'INVALID_TOKEN') {
        const refreshed = await client.refresh(session.tokens.refreshToken).catch(() => null);
        if (refreshed && refreshed.ok) {
          session.tokens = { accessToken: refreshed.data.accessToken, refreshToken: refreshed.data.refreshToken };
          secureStore.saveSession({ tokens: session.tokens, schoolId: session.school && session.school.id });
          const again = await client.validate(session.tokens.accessToken).catch(() => null);
          if (again && again.ok) return { ok: true, license: again.data.license, daysRemaining: again.data.daysRemaining };
        }
      }
      return { error: true, code: result.error || 'VALIDATE_FAILED', message: result.message || 'License validation failed.' };
    } catch (err) {
      return serializeError({ code: 'NETWORK', message: err.message });
    }
  });

  guard('auth:get-support', async () => {
    const cache = licenseClient().getCached();
    return { ok: true, support: cache && cache.support };
  });

  // --------------------------- DATABASE ------------------------------------
  guard('db:load', async (payload) => {
    requireSession();
    const dbData = repository.loadFullDatabase(null);
    // One-time migration of a legacy browser localStorage export if provided.
    if (payload && payload.legacyDatabase) {
      repository.migrateLegacyIfPresent(payload.legacyDatabase);
      return repository.loadFullDatabase(null);
    }
    return dbData;
  });

  guard('db:import-legacy', async (payload) => {
    requireSession();
    const imported = repository.migrateLegacyIfPresent(payload && payload.legacyDatabase);
    return { ok: true, imported };
  });

  const COLLECTION_SET = new Set(Object.keys(repository.COLLECTIONS));

  guard('db:upsert', async ({ collection, doc }) => {
    requireSession();
    if (!COLLECTION_SET.has(collection)) return serializeError({ code: 'INVALID_INPUT', message: 'Unknown collection' });
    if (!doc || typeof doc !== 'object') return serializeError({ code: 'INVALID_INPUT', message: 'Missing document' });
    repository.upsertDoc(collection, doc);
    return { ok: true };
  });

  guard('db:upsert-many', async ({ collection, docs }) => {
    requireSession();
    if (!COLLECTION_SET.has(collection)) return serializeError({ code: 'INVALID_INPUT', message: 'Unknown collection' });
    if (!Array.isArray(docs)) return serializeError({ code: 'INVALID_INPUT', message: 'Missing documents' });
    repository.upsertDocs(collection, docs);
    return { ok: true };
  });

  guard('db:remove', async ({ collection, id }) => {
    requireSession();
    if (!COLLECTION_SET.has(collection)) return serializeError({ code: 'INVALID_INPUT', message: 'Unknown collection' });
    if (typeof id !== 'string') return serializeError({ code: 'INVALID_INPUT', message: 'Missing id' });
    repository.deleteDoc(collection, id);
    return { ok: true };
  });

  guard('db:remove-where', async ({ collection, where }) => {
    requireSession();
    if (!COLLECTION_SET.has(collection)) return serializeError({ code: 'INVALID_INPUT', message: 'Unknown collection' });
    repository.deleteWhere(collection, where || {});
    return { ok: true };
  });

  guard('db:replace-where', async ({ collection, where, docs }) => {
    requireSession();
    if (!COLLECTION_SET.has(collection)) return serializeError({ code: 'INVALID_INPUT', message: 'Unknown collection' });
    repository.replaceWhere(collection, where || {}, Array.isArray(docs) ? docs : []);
    return { ok: true };
  });

  guard('db:delete-student', async (id) => {
    requireSession();
    if (typeof id !== 'string') return serializeError({ code: 'INVALID_INPUT', message: 'Missing id' });
    repository.deleteStudentCascade(id);
    return { ok: true };
  });

  guard('db:delete-teacher', async (id) => {
    requireSession();
    if (typeof id !== 'string') return serializeError({ code: 'INVALID_INPUT', message: 'Missing id' });
    repository.deleteTeacherCascade(id);
    return { ok: true };
  });

  guard('db:set-school-info', async (info) => {
    requireSession();
    if (!info || typeof info !== 'object') return serializeError({ code: 'INVALID_INPUT', message: 'Missing school info' });
    repository.setSchoolInfo(info);
    return { ok: true };
  });

  guard('db:replace-all', async (database) => {
    requirePrincipal();
    if (!database || typeof database !== 'object' || !database.schoolInfo) {
      return serializeError({ code: 'INVALID_INPUT', message: 'Invalid database payload' });
    }
    await backup.createBackup({ reason: 'pre-import' }).catch((err) => logger.warn('pre-import backup failed', { error: err.message }));
    repository.replaceFullDatabase(database);
    return { ok: true };
  });

  // --------------------------- BACKUP --------------------------------------
  guard('backup:create', async () => backup.createBackup({ reason: 'manual' }));

  guard('backup:list', async () => ({ ok: true, backups: backup.listBackups(), externalDir: backup.getExternalBackupDir() }));

  guard('backup:restore', async (fileName) => {
    requirePrincipal();
    const result = await backup.restoreBackup(fileName, {
      runMigrations: (db) => migrations.runMigrations(db, { createBackup: (opts) => backup.createBackup(opts) }),
    });
    return result;
  });

  guard('backup:get-external-dir', async () => ({ ok: true, dir: backup.getExternalBackupDir() }));

  guard('backup:choose-external-dir', async () => {
    requirePrincipal();
    const { dialog, BrowserWindow } = require('electron');
    const win = BrowserWindow.getFocusedWindow();
    const result = await dialog.showOpenDialog(win, {
      properties: ['openDirectory', 'createDirectory'],
      title: 'Choose external backup folder',
    });
    if (result.canceled || !result.filePaths.length) return { ok: false, canceled: true };
    return { ok: true, dir: result.filePaths[0] };
  });

  guard('backup:set-external-dir', async (dir) => {
    requirePrincipal();
    if (dir !== null && (typeof dir !== 'string' || dir.length > 500)) {
      return serializeError({ code: 'INVALID_INPUT', message: 'Invalid directory' });
    }
    return backup.setExternalBackupDir(dir);
  });

  guard('backup:open-folder', async () => {
    shell.openPath(paths.backupDir()).catch(() => {});
    return { ok: true };
  });

  // --------------------------- FILES ---------------------------------------
  guard('files:save-upload', async (payload) => {
    requireSession();
    return files.saveUpload(payload || {});
  });

  guard('files:list', async (category) => {
    requireSession();
    return { ok: true, files: files.listUploads(category) };
  });

  guard('files:open', async ({ category, fileName }) => {
    requireSession();
    const target = files.uploadAbsolutePath(category, fileName);
    await shell.openPath(target);
    return { ok: true };
  });

  // --------------------------- SYSTEM --------------------------------------
  guard('system:info', async () => ({
    ok: true,
    appVersion: ctx.config.appVersion,
    electron: process.versions.electron,
    chrome: process.versions.chrome,
    node: process.versions.node,
    platform: `${os.platform()} ${os.release()}`,
    environment: ctx.config.environment,
    deviceIdShort: ctx.device.deviceIdentifier.slice(0, 8),
    deviceName: ctx.device.deviceName,
  }));

  guard('system:diagnostics', async () => {
    const cache = licenseClient().getCached();
    const decision = offlineAccessDecision(cache);
    let stats = {};
    let schemaVersion = 0;
    try {
      stats = dbModule.databaseStats();
      schemaVersion = migrations.schemaVersion(dbModule.getDb());
    } catch {
      stats = { error: 'database unavailable' };
    }
    let diskFree = null;
    try {
      const stat = fs.statfsSync(paths.root());
      diskFree = stat.bavail * stat.bsize;
    } catch {
      diskFree = null;
    }
    const report = {
      generatedAt: new Date().toISOString(),
      application: {
        name: 'School Management System',
        version: ctx.config.appVersion,
        electron: process.versions.electron,
        environment: ctx.config.environment,
      },
      database: { healthy: !stats.error, schemaVersion, tables: stats },
      license: {
        status: cache && cache.license ? cache.license.effectiveStatus : 'UNKNOWN',
        expiresAt: cache && cache.license ? cache.license.expiresAt : null,
        lastVerifiedAt: cache ? cache.lastVerifiedAt : null,
        offlineDecision: decision.reason,
      },
      school: session.school ? { code: session.school.schoolCode, name: session.school.name } : null,
      device: { id: ctx.device.deviceIdentifier.slice(0, 8), name: ctx.device.deviceName },
      storageFreeBytes: diskFree,
      // Deliberately no tokens, passwords or student data.
    };
    return { ok: true, report };
  });

  const ALLOWED_EXTERNAL = /^https?:\/\/|^mailto:|^tel:/i;
  guard('system:open-external', async (url) => {
    if (typeof url !== 'string' || url.length > 2000 || !ALLOWED_EXTERNAL.test(url)) {
      return serializeError({ code: 'BLOCKED_URL', message: 'This link cannot be opened.' });
    }
    await shell.openExternal(url);
    return { ok: true };
  });

  guard('system:log', async ({ level, message }) => {
    const lvl = ['info', 'warn', 'error'].includes(level) ? level : 'info';
    if (typeof message === 'string') logger[lvl](`[renderer] ${message.slice(0, 500)}`);
    return { ok: true };
  });

  // --------------------------- UPDATER -------------------------------------
  guard('updater:check', async () => updater.checkForUpdates());
  guard('updater:download', async () => updater.downloadUpdate());
  guard('updater:install', async () => {
    updater.quitAndInstall();
    return { ok: true };
  });
}

// ---------------------------------------------------------------------------
// Startup session restoration (auto login)
// ---------------------------------------------------------------------------
async function restoreSessionOnStartup() {
  const stored = secureStore.loadSession();
  if (!stored || !stored.tokens || !stored.tokens.refreshToken) {
    return { restored: false };
  }

  const client = licenseClient();

  // Try to come back online quietly.
  try {
    const refreshed = await client.refresh(stored.tokens.refreshToken);
    if (refreshed.ok) {
      session.authenticated = true;
      session.mode = 'online';
      session.tokens = { accessToken: refreshed.data.accessToken, refreshToken: refreshed.data.refreshToken };
      session.school = refreshed.data.school || client.getCached().school;
      session.user = refreshed.data.user
        ? { id: refreshed.data.user.id, name: refreshed.data.user.name, email: refreshed.data.user.email, role: 'principal', status: 'active' }
        : null;
      session.policy = refreshed.data.policy;
      session.support = refreshed.data.support;
      secureStore.saveSession({ tokens: session.tokens, schoolId: session.school && session.school.id });
      scheduleRevalidation();
      logger.info('session restored online');
      return { restored: true, mode: 'online' };
    }
    // Hard denial from the server (revoked/suspended/expired): no offline entry.
    if (refreshed.error && refreshed.error.startsWith('LICENSE_')) {
      logger.warn('session restore denied by license state', { error: refreshed.error });
      secureStore.clearSession();
      return { restored: false, denied: refreshed.error };
    }
  } catch (err) {
    logger.warn('online session restore failed (offline?)', { message: err.message });
  }

  // Offline path: consult the cached license + grace period.
  const cache = client.getCached();
  const decision = offlineAccessDecision(cache);
  if (decision.allowed && cache && cache.school) {
    session.authenticated = true;
    session.mode = 'offline';
    session.tokens = stored.tokens;
    session.school = cache.school;
    session.user = cache.user
      ? { id: cache.user.id, name: cache.user.name, email: cache.user.email, role: 'principal', status: 'active' }
      : { id: 'offline_user', name: 'School Administrator', email: cache.school.email || '', role: 'principal', status: 'active' };
    session.policy = cache.policy;
    session.support = cache.support;
    scheduleRevalidation();
    logger.info('session restored offline', { daysSinceVerified: Math.round(decision.daysSinceVerified * 10) / 10 });
    return { restored: true, mode: 'offline', decision };
  }

  logger.info('offline restore not permitted', { reason: decision.reason });
  secureStore.clearSession();
  return { restored: false, offlineDenied: decision.reason };
}

module.exports = { registerIpc, restoreSessionOnStartup, backup };
