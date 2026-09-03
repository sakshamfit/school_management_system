/**
 * Device endpoints (customer-facing, Bearer auth).
 *
 * POST /devices/activate              — activate this installation
 * GET  /devices                       — list this school's devices
 * POST /devices/:id/deactivate        — deactivate a device (own school)
 * POST /devices/:id/backup-status     — report backup METADATA only
 *
 * Device identity is a stable, application-generated random ID created by
 * the desktop app at first launch. No invasive hardware fingerprinting.
 */

import { Router } from 'express';
import { getDb } from '../db.js';
import { randomId } from '../lib/crypto.js';
import { ok, errors, ApiError } from '../lib/respond.js';
import { vString, vOptionalString, vBool, vIsoDate, assertAllowedKeys } from '../lib/validate.js';
import { audit, AUDIT_ACTIONS } from '../lib/audit.js';
import { requireSchoolAuth, clientIp } from '../middleware/auth.js';
import { activationLimiter } from '../middleware/ratelimits.js';
import {
  getActiveLicenseForSchool,
  applyLazyExpiry,
  countActiveDevices,
  publicLicense,
} from '../services/licenses.js';
import config from '../config.js';

const router = Router();

export function publicDevice(d) {
  return {
    id: d.id,
    device_uid: d.device_uid,
    name: d.name,
    platform: d.platform,
    app_version: d.app_version,
    status: d.status,
    activated_at: d.activated_at,
    last_seen_at: d.last_seen_at,
  };
}

/**
 * POST /devices/activate
 * Flow: authenticated login → license check → device count check → activate.
 * Body: { device_uid, name?, platform?, app_version? }
 */
router.post('/activate', requireSchoolAuth, activationLimiter, (req, res, next) => {
  try {
    assertAllowedKeys(req.body, ['device_uid', 'name', 'platform', 'app_version']);
    const deviceUid = vString(req.body.device_uid, 'device_uid', { min: 8, max: 120 });
    const name = vOptionalString(req.body.name, 'name', { max: 120 });
    const platform = vOptionalString(req.body.platform, 'platform', { max: 60 });
    const appVersion = vOptionalString(req.body.app_version, 'app_version', { max: 40 });

    const db = getDb();
    const school = req.auth.school;
    const ip = clientIp(req);

    const license = applyLazyExpiry(getActiveLicenseForSchool(school.id));
    const existing = db
      .prepare(`SELECT * FROM devices WHERE school_id = ? AND device_uid = ?`)
      .get(school.id, deviceUid);

    // Existing ACTIVE device re-validating itself (e.g. app reinstalled) is fine.
    if (existing && existing.status === 'ACTIVE') {
      db.prepare(`UPDATE devices SET last_seen_at = ?, name = COALESCE(NULLIF(?, ''), name),
                  platform = COALESCE(NULLIF(?, ''), platform),
                  app_version = COALESCE(NULLIF(?, ''), app_version), updated_at = ? WHERE id = ?`)
        .run(new Date().toISOString(), name, platform, appVersion, new Date().toISOString(), existing.id);
      return ok(res, {
        status: 'DEVICE_ALREADY_ACTIVE',
        device: publicDevice(db.prepare('SELECT * FROM devices WHERE id = ?').get(existing.id)),
        license: publicLicense(license),
        offline_grace_hours: config.licensing.offlineGraceHours,
      });
    }

    // License must be in an authorizable state to activate (new or re-).
    if (!license) {
      throw errors.forbidden('NO_ACTIVE_LICENSE', 'No active license. Please contact your administrator.');
    }

    const used = countActiveDevices(school.id);
    if (used >= license.max_devices) {
      audit({
        actorType: 'school_user',
        actorId: req.auth.user.id,
        actorLabel: req.auth.user.email,
        action: AUDIT_ACTIONS.DEVICE_LIMIT_REACHED,
        targetType: 'school',
        targetId: school.id,
        metadata: { max_devices: license.max_devices },
        ip,
      });
      throw new ApiError(
        409,
        'DEVICE_LIMIT_REACHED',
        'Device limit reached.\n\nContact your administrator to deactivate\nan existing device.'
      );
    }

    const nowIso = new Date().toISOString();
    let device;
    if (existing && existing.status === 'DEACTIVATED') {
      db.prepare(
        `UPDATE devices SET status = 'ACTIVE', deactivated_at = NULL, activated_at = ?, last_seen_at = ?,
           name = COALESCE(NULLIF(?, ''), name), platform = COALESCE(NULLIF(?, ''), platform),
           app_version = COALESCE(NULLIF(?, ''), app_version), updated_at = ?
         WHERE id = ?`
      ).run(nowIso, nowIso, name, platform, appVersion, nowIso, existing.id);
      device = db.prepare('SELECT * FROM devices WHERE id = ?').get(existing.id);
    } else {
      const id = randomId('dev');
      db.prepare(
        `INSERT INTO devices (id, school_id, device_uid, name, platform, app_version, status,
           activated_at, last_seen_at, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, 'ACTIVE', ?, ?, ?, ?)`
      ).run(id, school.id, deviceUid, name || null, platform || null, appVersion || null, nowIso, nowIso, nowIso, nowIso);
      device = db.prepare('SELECT * FROM devices WHERE id = ?').get(id);
    }

    // Bind the login session to the device.
    db.prepare(`UPDATE sessions SET device_id = ? WHERE id = ?`).run(device.id, req.auth.session.id);

    audit({
      actorType: 'school_user',
      actorId: req.auth.user.id,
      actorLabel: req.auth.user.email,
      action: AUDIT_ACTIONS.DEVICE_ACTIVATED,
      targetType: 'device',
      targetId: device.id,
      metadata: { device_uid: deviceUid, name: device.name, platform: device.platform },
      ip,
    });

    ok(
      res,
      {
        status: 'DEVICE_ACTIVATED',
        device: publicDevice(device),
        license: publicLicense(license),
        offline_grace_hours: config.licensing.offlineGraceHours,
      },
      201
    );
  } catch (err) {
    next(err);
  }
});

/** GET /devices — devices of the signed-in school only. */
router.get('/', requireSchoolAuth, (req, res) => {
  const rows = getDb()
    .prepare(`SELECT * FROM devices WHERE school_id = ? ORDER BY activated_at DESC`)
    .all(req.auth.school.id);
  ok(res, { devices: rows.map(publicDevice) });
});

/** POST /devices/:id/deactivate — own school only. */
router.post('/:id/deactivate', requireSchoolAuth, (req, res, next) => {
  try {
    const db = getDb();
    const device = db
      .prepare(`SELECT * FROM devices WHERE id = ? AND school_id = ?`)
      .get(req.params.id, req.auth.school.id);
    if (!device) throw errors.notFound('Device not found.');
    if (device.status === 'DEACTIVATED') return ok(res, { device: publicDevice(device) });

    const nowIso = new Date().toISOString();
    db.prepare(`UPDATE devices SET status = 'DEACTIVATED', deactivated_at = ?, updated_at = ? WHERE id = ?`)
      .run(nowIso, nowIso, device.id);
    db.prepare(`UPDATE sessions SET status = 'REVOKED', revoked_at = ? WHERE device_id = ? AND status = 'ACTIVE'`)
      .run(nowIso, device.id);

    audit({
      actorType: 'school_user',
      actorId: req.auth.user.id,
      actorLabel: req.auth.user.email,
      action: AUDIT_ACTIONS.DEVICE_DEACTIVATED,
      targetType: 'device',
      targetId: device.id,
      metadata: { device_uid: device.device_uid, name: device.name },
      ip: clientIp(req),
    });

    ok(res, { device: publicDevice(db.prepare('SELECT * FROM devices WHERE id = ?').get(device.id)) });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /devices/:id/backup-status — backup METADATA only.
 * The control plane NEVER receives backup contents; the administrator can
 * only see whether Drive is connected and when the last backup succeeded.
 * Body: { drive_connected, last_backup_at?, status? }
 */
router.post('/:id/backup-status', requireSchoolAuth, (req, res, next) => {
  try {
    assertAllowedKeys(req.body, ['drive_connected', 'last_backup_at', 'status']);
    const driveConnected = vBool(req.body.drive_connected, 'drive_connected');
    const lastBackupAt = req.body.last_backup_at ? vIsoDate(req.body.last_backup_at, 'last_backup_at') : null;
    const status = vOptionalString(req.body.status, 'status', { max: 60 });

    const db = getDb();
    const device = db
      .prepare(`SELECT * FROM devices WHERE id = ? AND school_id = ?`)
      .get(req.params.id, req.auth.school.id);
    if (!device) throw errors.notFound('Device not found.');

    db.prepare(
      `UPDATE devices SET drive_connected = ?, last_backup_at = COALESCE(?, last_backup_at),
         last_backup_status = COALESCE(NULLIF(?, ''), last_backup_status), updated_at = ?
       WHERE id = ?`
    ).run(driveConnected ? 1 : 0, lastBackupAt, status, new Date().toISOString(), device.id);

    ok(res, { recorded: true });
  } catch (err) {
    next(err);
  }
});

export default router;
