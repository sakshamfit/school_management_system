/**
 * Admin: device management.
 *
 * GET  /admin/api/devices?school_id=
 * POST /admin/api/devices/:id/deactivate
 * POST /admin/api/devices/:id/reactivate   — subject to license max_devices
 */

import { Router } from 'express';
import { getDb } from '../../db.js';
import { ok, errors } from '../../lib/respond.js';
import { audit, AUDIT_ACTIONS } from '../../lib/audit.js';
import { requireAdmin, clientIp } from '../../middleware/auth.js';
import { countActiveDevices } from '../../services/licenses.js';
import { applyLazyExpiry } from '../../services/licenses.js';

const router = Router();
router.use(requireAdmin);

const now = () => new Date().toISOString();

function fullDevice(d) {
  return {
    id: d.id,
    school_id: d.school_id,
    school_name: d.school_name,
    school_code: d.school_code,
    device_uid: d.device_uid,
    name: d.name,
    platform: d.platform,
    app_version: d.app_version,
    status: d.status,
    activated_at: d.activated_at,
    last_seen_at: d.last_seen_at,
    deactivated_at: d.deactivated_at,
    drive_connected: !!d.drive_connected,
    last_backup_at: d.last_backup_at,
    last_backup_status: d.last_backup_status,
  };
}

router.get('/', (req, res) => {
  const db = getDb();
  const params = [];
  let where = '';
  if (typeof req.query.school_id === 'string' && req.query.school_id) {
    where = 'WHERE d.school_id = ?';
    params.push(req.query.school_id);
  }
  const rows = db
    .prepare(
      `SELECT d.*, s.name AS school_name, s.school_code
       FROM devices d JOIN schools s ON s.id = d.school_id
       ${where} ORDER BY d.activated_at DESC LIMIT 500`
    )
    .all(...params);
  ok(res, { devices: rows.map(fullDevice) });
});

function loadDeviceOr404(id) {
  const device = getDb()
    .prepare(
      `SELECT d.*, s.name AS school_name, s.school_code
       FROM devices d JOIN schools s ON s.id = d.school_id WHERE d.id = ?`
    )
    .get(id);
  if (!device) throw errors.notFound('Device not found.');
  return device;
}

router.post('/:id/deactivate', (req, res, next) => {
  try {
    const db = getDb();
    const device = loadDeviceOr404(req.params.id);
    if (device.status === 'DEACTIVATED') return ok(res, { device: fullDevice(device) });

    const nowIso = now();
    db.prepare(`UPDATE devices SET status = 'DEACTIVATED', deactivated_at = ?, updated_at = ? WHERE id = ?`)
      .run(nowIso, nowIso, device.id);
    db.prepare(`UPDATE sessions SET status = 'REVOKED', revoked_at = ? WHERE device_id = ? AND status = 'ACTIVE'`)
      .run(nowIso, device.id);

    audit({
      actorType: 'admin',
      actorId: req.adminAuth.admin.id,
      actorLabel: req.adminAuth.admin.email,
      action: AUDIT_ACTIONS.DEVICE_DEACTIVATED,
      targetType: 'device',
      targetId: device.id,
      metadata: { school_id: device.school_id, device_uid: device.device_uid, name: device.name },
      ip: clientIp(req),
    });

    ok(res, { device: fullDevice(loadDeviceOr404(device.id)) });
  } catch (err) {
    next(err);
  }
});

router.post('/:id/reactivate', (req, res, next) => {
  try {
    const db = getDb();
    const device = loadDeviceOr404(req.params.id);
    if (device.status === 'ACTIVE') return ok(res, { device: fullDevice(device) });

    const license = applyLazyExpiry(
      db.prepare(`SELECT * FROM licenses WHERE school_id = ? ORDER BY created_at DESC LIMIT 1`).get(device.school_id)
    );
    if (!license || license.status !== 'ACTIVE') {
      throw errors.conflict('NO_ACTIVE_LICENSE', 'The school has no ACTIVE license.');
    }
    const used = countActiveDevices(device.school_id);
    if (used >= license.max_devices) {
      throw errors.conflict(
        'DEVICE_LIMIT_REACHED',
        `Device limit reached (${used}/${license.max_devices}). Deactivate an existing device first.`
      );
    }

    db.prepare(`UPDATE devices SET status = 'ACTIVE', deactivated_at = NULL, updated_at = ? WHERE id = ?`)
      .run(now(), device.id);

    audit({
      actorType: 'admin',
      actorId: req.adminAuth.admin.id,
      actorLabel: req.adminAuth.admin.email,
      action: AUDIT_ACTIONS.DEVICE_REACTIVATED,
      targetType: 'device',
      targetId: device.id,
      metadata: { school_id: device.school_id, device_uid: device.device_uid, name: device.name },
      ip: clientIp(req),
    });

    ok(res, { device: fullDevice(loadDeviceOr404(device.id)) });
  } catch (err) {
    next(err);
  }
});

export default router;
