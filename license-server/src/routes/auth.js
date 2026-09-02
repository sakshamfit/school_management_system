'use strict';

/**
 * School-facing authentication & license endpoints.
 *
 * POST /api/auth/login        — school login + license check + device activation
 * POST /api/auth/refresh      — rotate tokens with a refresh token
 * POST /api/auth/logout       — destroy session
 * POST /api/license/validate  — periodic license revalidation (Bearer token)
 * POST /api/devices/deactivate — school deactivates one of its own devices
 * GET  /api/client/config     — public client configuration (support, releases)
 * GET  /api/health            — health probe
 */

const express = require('express');
const config = require('../config');
const { getDb } = require('../db');
const { audit } = require('../audit');
const {
  hashPassword,
  verifyPassword,
  generateToken,
  sha256,
  newId,
  RateLimiter,
} = require('../security');
const {
  effectiveLicenseStatus,
  activeDeviceCount,
  publicSchool,
  publicLicense,
  publicDevice,
  findOrActivateDevice,
  authError,
  nowIso,
} = require('../licenseService');

const router = express.Router();
const loginLimiter = new RateLimiter({ windowMs: config.rateLimitWindowMs, max: config.rateLimitMax });

function clientIp(req) {
  const fwd = req.headers['x-forwarded-for'];
  if (typeof fwd === 'string' && fwd.length > 0) return fwd.split(',')[0].trim();
  return req.socket.remoteAddress || 'unknown';
}

function createSession({ schoolId, userId, deviceId }) {
  const db = getDb();
  const accessToken = generateToken();
  const refreshToken = generateToken();
  const sessionId = newId('ses');
  const accessExpires = new Date(Date.now() + config.accessTokenTtlSec * 1000).toISOString();
  const refreshExpires = new Date(Date.now() + config.refreshTokenTtlSec * 1000).toISOString();

  db.prepare(
    `INSERT INTO sessions (id, school_id, user_id, device_id, access_token_hash, refresh_token_hash, access_expires_at, refresh_expires_at, created_at, last_used_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    sessionId,
    schoolId,
    userId,
    deviceId || null,
    sha256(accessToken),
    sha256(refreshToken),
    accessExpires,
    refreshExpires,
    nowIso(),
    nowIso()
  );

  return { accessToken, refreshToken, sessionId, accessExpires, refreshExpires };
}

function findSessionByAccess(req) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return null;
  const db = getDb();
  const session = db
    .prepare('SELECT * FROM sessions WHERE access_token_hash = ?')
    .get(sha256(token));
  if (!session) return null;
  if (new Date(session.access_expires_at).getTime() < Date.now()) return null;
  const school = db.prepare('SELECT * FROM schools WHERE id = ?').get(session.school_id);
  const license = db.prepare('SELECT * FROM licenses WHERE school_id = ?').get(session.school_id);
  if (!school || school.status !== 'active') return null;
  if (!license) return null;
  db.prepare('UPDATE sessions SET last_used_at = ? WHERE id = ?').run(nowIso(), session.id);
  return { session, school, license };
}

function supportBlock() {
  const db = getDb();
  const get = (key, fallback) => {
    const row = db.prepare('SELECT value FROM client_settings WHERE key = ?').get(key);
    return row ? row.value : fallback;
  };
  return {
    url: get('support_url', config.support.url),
    email: get('support_email', config.support.email),
    phone: get('support_phone', config.support.phone),
  };
}

function latestRelease(channel) {
  const db = getDb();
  if (channel === 'beta') {
    return db.prepare('SELECT * FROM releases ORDER BY released_at DESC LIMIT 1').get() || null;
  }
  return (
    db.prepare('SELECT * FROM releases WHERE is_latest_stable = 1 ORDER BY released_at DESC LIMIT 1').get() ||
    db.prepare("SELECT * FROM releases WHERE channel = 'stable' ORDER BY released_at DESC LIMIT 1").get() ||
    null
  );
}

// ---------------------------------------------------------------------------
// POST /api/auth/login
// ---------------------------------------------------------------------------
router.post('/auth/login', (req, res) => {
  const ip = clientIp(req);
  if (!loginLimiter.allow(ip)) return authError(res, 'TOO_MANY_REQUESTS');

  const { identifier, password, device } = req.body || {};
  if (typeof identifier !== 'string' || typeof password !== 'string' || !identifier.trim() || !password) {
    return authError(res, 'INVALID_CREDENTIALS');
  }

  const db = getDb();
  const idInput = identifier.trim().toLowerCase();

  // Find school user by email, or by school code (school-level credential).
  let user = db
    .prepare(`SELECT * FROM school_users WHERE lower(email) = ? AND status = 'active'`)
    .get(idInput);

  let school = null;
  if (user) {
    school = db.prepare('SELECT * FROM schools WHERE id = ?').get(user.school_id);
  } else {
    school = db
      .prepare(`SELECT * FROM schools WHERE lower(school_code) = ? OR lower(email) = ?`)
      .get(idInput, idInput);
    if (school) {
      user = db
        .prepare(`SELECT * FROM school_users WHERE school_id = ? AND status = 'active' ORDER BY created_at ASC LIMIT 1`)
        .get(school.id);
    }
  }

  if (!school || !user) {
    audit({ actorType: 'system', action: 'LOGIN_FAILED', target: idInput, metadata: { reason: 'unknown_account' }, ip });
    return authError(res, 'INVALID_CREDENTIALS');
  }

  if (user.status !== 'active') return authError(res, 'ACCOUNT_LOCKED');
  if (school.status === 'suspended') return authError(res, 'SCHOOL_SUSPENDED');
  if (school.status === 'archived') return authError(res, 'SCHOOL_ARCHIVED');

  if (!verifyPassword(password, user.password_hash)) {
    audit({
      actorType: 'school',
      actorId: user.id,
      actorName: user.name,
      action: 'LOGIN_FAILED',
      target: school.school_code,
      metadata: { reason: 'bad_password' },
      ip,
    });
    return authError(res, 'INVALID_CREDENTIALS');
  }

  const license = db.prepare('SELECT * FROM licenses WHERE school_id = ?').get(school.id);
  if (!license) return authError(res, 'NO_LICENSE');

  const licenseStatus = effectiveLicenseStatus(license);
  if (licenseStatus === 'EXPIRED') return authError(res, 'LICENSE_EXPIRED', { support: supportBlock() });
  if (licenseStatus === 'SUSPENDED') return authError(res, 'LICENSE_SUSPENDED', { support: supportBlock() });
  if (licenseStatus === 'REVOKED') return authError(res, 'LICENSE_REVOKED', { support: supportBlock() });

  // Device activation (device info is required from desktop clients).
  const deviceInfo = device || {};
  const deviceIdentifier = typeof deviceInfo.deviceIdentifier === 'string' ? deviceInfo.deviceIdentifier.trim() : '';
  let deviceRow = null;
  let newlyActivated = false;
  if (deviceIdentifier) {
    const result = findOrActivateDevice(school.id, {
      deviceIdentifier,
      deviceName: typeof deviceInfo.deviceName === 'string' ? deviceInfo.deviceName.slice(0, 120) : '',
      osInfo: typeof deviceInfo.osInfo === 'string' ? deviceInfo.osInfo.slice(0, 120) : '',
      appVersion: typeof deviceInfo.appVersion === 'string' ? deviceInfo.appVersion.slice(0, 40) : '',
    });
    if (result.error) {
      audit({
        actorType: 'school',
        actorId: user.id,
        actorName: user.name,
        action: 'DEVICE_ACTIVATION_DENIED',
        target: school.school_code,
        metadata: { reason: result.error, deviceName: deviceInfo.deviceName || '' },
        ip,
      });
      return authError(res, result.error, { maxDevices: result.maxDevices, devicesUsed: result.devicesUsed });
    }
    deviceRow = result.device;
    newlyActivated = result.newlyActivated;
  }

  const session = createSession({ schoolId: school.id, userId: user.id, deviceId: deviceRow ? deviceRow.id : null });

  if (user.must_change_password) {
    db.prepare('UPDATE school_users SET must_change_password = 0, updated_at = ? WHERE id = ?').run(nowIso(), user.id);
  }

  audit({
    actorType: 'school',
    actorId: user.id,
    actorName: user.name,
    action: 'LOGIN_SUCCESS',
    target: school.school_code,
    metadata: { deviceName: deviceInfo.deviceName || '', newDevice: newlyActivated },
    ip,
  });

  res.json({
    tokenType: 'Bearer',
    accessToken: session.accessToken,
    refreshToken: session.refreshToken,
    accessTokenExpiresAt: session.accessExpires,
    refreshTokenExpiresAt: session.refreshExpires,
    school: publicSchool(school),
    user: { id: user.id, name: user.name, email: user.email, role: user.role },
    license: publicLicense(license),
    device: deviceRow ? publicDevice(deviceRow) : null,
    newDeviceActivated: newlyActivated,
    policy: {
      offlineGraceDays: license.offline_grace_days,
      revalidateHours: license.revalidate_hours,
    },
    support: supportBlock(),
  });
});

// ---------------------------------------------------------------------------
// POST /api/auth/refresh
// ---------------------------------------------------------------------------
router.post('/auth/refresh', (req, res) => {
  const { refreshToken } = req.body || {};
  if (typeof refreshToken !== 'string' || !refreshToken) return authError(res, 'INVALID_TOKEN');

  const db = getDb();
  const session = db
    .prepare('SELECT * FROM sessions WHERE refresh_token_hash = ?')
    .get(sha256(refreshToken));
  if (!session || new Date(session.refresh_expires_at).getTime() < Date.now()) {
    return authError(res, 'INVALID_TOKEN');
  }

  const school = db.prepare('SELECT * FROM schools WHERE id = ?').get(session.school_id);
  const license = db.prepare('SELECT * FROM licenses WHERE school_id = ?').get(session.school_id);
  if (!school || school.status !== 'active' || !license) return authError(res, 'INVALID_TOKEN');
  const licenseStatus = effectiveLicenseStatus(license);
  if (licenseStatus !== 'ACTIVE') return authError(res, `LICENSE_${licenseStatus}`, { support: supportBlock() });

  const rotated = createSession({ schoolId: school.id, userId: session.user_id, deviceId: session.device_id });
  db.prepare('DELETE FROM sessions WHERE id = ?').run(session.id);

  const user = db.prepare('SELECT * FROM school_users WHERE id = ?').get(session.user_id);

  res.json({
    tokenType: 'Bearer',
    accessToken: rotated.accessToken,
    refreshToken: rotated.refreshToken,
    accessTokenExpiresAt: rotated.accessExpires,
    refreshTokenExpiresAt: rotated.refreshExpires,
    school: publicSchool(school),
    user: user ? { id: user.id, name: user.name, email: user.email, role: user.role } : null,
    license: publicLicense(license),
    policy: { offlineGraceDays: license.offline_grace_days, revalidateHours: license.revalidate_hours },
    support: supportBlock(),
  });
});

// ---------------------------------------------------------------------------
// POST /api/auth/logout
// ---------------------------------------------------------------------------
router.post('/auth/logout', (req, res) => {
  const ctx = findSessionByAccess(req);
  if (ctx) {
    getDb().prepare('DELETE FROM sessions WHERE id = ?').run(ctx.session.id);
    audit({
      actorType: 'school',
      actorId: ctx.session.user_id,
      action: 'LOGOUT',
      target: ctx.school.school_code,
      ip: clientIp(req),
    });
  }
  res.json({ ok: true });
});

// ---------------------------------------------------------------------------
// POST /api/license/validate  (periodic online revalidation)
// ---------------------------------------------------------------------------
router.post('/license/validate', (req, res) => {
  const ctx = findSessionByAccess(req);
  if (!ctx) return authError(res, 'INVALID_TOKEN');

  const { school, license } = ctx;
  const licenseStatus = effectiveLicenseStatus(license);
  const daysRemaining = Math.ceil((new Date(license.expires_at).getTime() - Date.now()) / 86400000);

  if (licenseStatus !== 'ACTIVE') {
    return authError(res, `LICENSE_${licenseStatus}`, {
      license: publicLicense(license),
      daysRemaining,
      support: supportBlock(),
    });
  }

  audit({
    actorType: 'school',
    actorId: school.id,
    action: 'LICENSE_VALIDATED',
    target: school.school_code,
    metadata: { status: licenseStatus },
    ip: clientIp(req),
  });

  res.json({
    ok: licenseStatus === 'ACTIVE',
    license: publicLicense(license),
    daysRemaining,
    policy: { offlineGraceDays: license.offline_grace_days, revalidateHours: license.revalidate_hours },
    support: supportBlock(),
    serverTime: nowIso(),
  });
});

// ---------------------------------------------------------------------------
// POST /api/devices/deactivate — school frees one of its own device slots
// ---------------------------------------------------------------------------
router.post('/devices/deactivate', (req, res) => {
  const ctx = findSessionByAccess(req);
  if (!ctx) return authError(res, 'INVALID_TOKEN');

  const { deviceId, deviceIdentifier } = req.body || {};
  const db = getDb();

  let device = null;
  if (deviceId) device = db.prepare('SELECT * FROM devices WHERE id = ?').get(deviceId);
  else if (deviceIdentifier)
    device = db
      .prepare('SELECT * FROM devices WHERE school_id = ? AND device_identifier = ?')
      .get(ctx.school.id, deviceIdentifier);

  if (!device || device.school_id !== ctx.school.id) {
    return res.status(404).json({ error: 'DEVICE_NOT_FOUND', message: 'Device not found for this school.' });
  }

  if (device.id === ctx.session.device_id) {
    return res.status(400).json({
      error: 'CANNOT_DEACTIVATE_CURRENT_DEVICE',
      message: 'You cannot deactivate the device you are currently signed in on.',
    });
  }

  db.prepare(`UPDATE devices SET status = 'deactivated', updated_at = ? WHERE id = ?`).run(nowIso(), device.id);
  db.prepare('DELETE FROM sessions WHERE device_id = ?').run(device.id);

  audit({
    actorType: 'school',
    actorId: ctx.session.user_id,
    action: 'DEVICE_DEACTIVATED',
    target: device.device_name || device.id,
    metadata: { schoolCode: ctx.school.school_code },
    ip: clientIp(req),
  });

  res.json({ ok: true, device: publicDevice({ ...device, status: 'deactivated' }) });
});

// ---------------------------------------------------------------------------
// GET /api/client/config — public, non-secret client configuration
// ---------------------------------------------------------------------------
router.get('/client/config', (req, res) => {
  const release = latestRelease(req.query.channel === 'beta' ? 'beta' : 'stable');
  res.json({
    support: supportBlock(),
    latestRelease: release
      ? { version: release.version, channel: release.channel, notes: release.notes, installerUrl: release.installer_url, releasedAt: release.released_at }
      : null,
  });
});

router.get('/health', (req, res) => {
  res.json({ ok: true, service: 'sms-license-server', time: nowIso() });
});

module.exports = router;
module.exports.findSessionByAccess = findSessionByAccess;
