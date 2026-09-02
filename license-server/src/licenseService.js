'use strict';

/**
 * Core license & device domain logic shared by auth + admin routes.
 */

const { getDb } = require('./db');

const LICENSE_STATES = ['ACTIVE', 'EXPIRED', 'SUSPENDED', 'REVOKED'];

function nowIso() {
  return new Date().toISOString();
}

/**
 * Resolve the effective license state for a school row.
 * Returns one of ACTIVE | EXPIRED | SUSPENDED | REVOKED.
 */
function effectiveLicenseStatus(license) {
  if (!license) return 'REVOKED';
  if (license.status === 'revoked') return 'REVOKED';
  if (license.status === 'suspended') return 'SUSPENDED';
  if (new Date(license.expires_at).getTime() < Date.now()) return 'EXPIRED';
  return 'ACTIVE';
}

function activeDeviceCount(schoolId) {
  const row = getDb()
    .prepare(`SELECT COUNT(*) AS n FROM devices WHERE school_id = ? AND status = 'active'`)
    .get(schoolId);
  return row ? row.n : 0;
}

function publicSchool(school) {
  return {
    id: school.id,
    schoolCode: school.school_code,
    name: school.name,
    address: school.address,
    phone: school.phone,
    email: school.email,
    status: school.status,
  };
}

function publicLicense(license, devicesUsed) {
  return {
    licenseKey: license.license_key,
    status: license.status,
    effectiveStatus: effectiveLicenseStatus(license),
    issuedAt: license.issued_at,
    expiresAt: license.expires_at,
    maxDevices: license.max_devices,
    devicesUsed: typeof devicesUsed === 'number' ? devicesUsed : activeDeviceCount(license.school_id),
    offlineGraceDays: license.offline_grace_days,
    revalidateHours: license.revalidate_hours,
  };
}

function publicDevice(device) {
  return {
    id: device.id,
    deviceIdentifier: device.device_identifier,
    deviceName: device.device_name,
    osInfo: device.os_info,
    appVersion: device.app_version,
    status: device.status,
    activatedAt: device.activated_at,
    lastSeenAt: device.last_seen_at,
  };
}

/**
 * Find or activate a device for a school.
 * Returns { device, newlyActivated, error }.
 */
function findOrActivateDevice(schoolId, { deviceIdentifier, deviceName, osInfo, appVersion }) {
  const db = getDb();
  if (!deviceIdentifier || typeof deviceIdentifier !== 'string' || deviceIdentifier.length > 128) {
    return { error: 'INVALID_DEVICE_IDENTIFIER' };
  }

  const existing = db
    .prepare('SELECT * FROM devices WHERE school_id = ? AND device_identifier = ?')
    .get(schoolId, deviceIdentifier);

  if (existing) {
    if (existing.status === 'deactivated') {
      return { error: 'DEVICE_DEACTIVATED' };
    }
    db.prepare(
      `UPDATE devices SET device_name = ?, os_info = ?, app_version = ?, last_seen_at = ?, updated_at = ? WHERE id = ?`
    ).run(
      deviceName || existing.device_name,
      osInfo || existing.os_info,
      appVersion || existing.app_version,
      nowIso(),
      nowIso(),
      existing.id
    );
    return { device: { ...existing, device_name: deviceName || existing.device_name }, newlyActivated: false };
  }

  const license = db.prepare('SELECT * FROM licenses WHERE school_id = ?').get(schoolId);
  if (!license) return { error: 'NO_LICENSE' };

  const used = activeDeviceCount(schoolId);
  if (used >= license.max_devices) {
    return { error: 'DEVICE_LIMIT_REACHED', maxDevices: license.max_devices, devicesUsed: used };
  }

  const id = `dev_${require('crypto').randomBytes(10).toString('hex')}`;
  db.prepare(
    `INSERT INTO devices (id, school_id, device_identifier, device_name, os_info, app_version, status, activated_at, last_seen_at, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, 'active', ?, ?, ?, ?)`
  ).run(id, schoolId, deviceIdentifier, deviceName || '', osInfo || '', appVersion || '', nowIso(), nowIso(), nowIso(), nowIso());

  const device = db.prepare('SELECT * FROM devices WHERE id = ?').get(id);
  return { device, newlyActivated: true };
}

/** Error catalog used by the desktop client (stable contracts). */
const AUTH_ERRORS = {
  INVALID_CREDENTIALS: { http: 401, message: 'Invalid school ID/email or password.' },
  ACCOUNT_LOCKED: { http: 403, message: 'This account is locked. Contact your software administrator.' },
  SCHOOL_SUSPENDED: { http: 403, message: 'This school account is suspended. Contact your software administrator.' },
  SCHOOL_ARCHIVED: { http: 403, message: 'This school account is archived. Contact your software administrator.' },
  LICENSE_EXPIRED: { http: 403, message: 'Your school license has expired. Please contact the administrator.' },
  LICENSE_SUSPENDED: { http: 403, message: 'Your school license is suspended. Please contact the administrator.' },
  LICENSE_REVOKED: { http: 403, message: 'Your school license has been revoked. Please contact the administrator.' },
  NO_LICENSE: { http: 403, message: 'No license is assigned to this school. Contact your software administrator.' },
  DEVICE_LIMIT_REACHED: {
    http: 403,
    message: 'Device limit reached for this license. Ask your administrator to deactivate another device, then try again.',
  },
  DEVICE_DEACTIVATED: {
    http: 403,
    message: 'This device was deactivated by the administrator. Contact your software administrator.',
  },
  INVALID_TOKEN: { http: 401, message: 'Session expired. Please sign in again.' },
  TOO_MANY_REQUESTS: { http: 429, message: 'Too many attempts. Please wait a few minutes and try again.' },
};

function authError(res, code, extra) {
  const spec = AUTH_ERRORS[code] || { http: 500, message: 'Unexpected error.' };
  res.status(spec.http).json({ error: code, message: spec.message, ...(extra || {}) });
}

module.exports = {
  LICENSE_STATES,
  effectiveLicenseStatus,
  activeDeviceCount,
  publicSchool,
  publicLicense,
  publicDevice,
  findOrActivateDevice,
  AUTH_ERRORS,
  authError,
  nowIso,
};
