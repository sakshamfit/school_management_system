/**
 * Admin: license management.
 *
 * GET  /admin/api/licenses?school_id=
 * POST /admin/api/schools/:id/licenses        — create (supersedes ACTIVE)
 * POST /admin/api/licenses/:id/extend         { days }
 * POST /admin/api/licenses/:id/suspend
 * POST /admin/api/licenses/:id/reactivate
 * POST /admin/api/licenses/:id/revoke
 *
 * The server is authoritative for license state. No license secrets ever
 * ship inside the desktop application — the license_key is a reference,
 * not an authorization credential.
 */

import { Router } from 'express';
import { getDb } from '../../db.js';
import { randomId, generateLicenseKey } from '../../lib/crypto.js';
import { ok, errors } from '../../lib/respond.js';
import { vInt, assertAllowedKeys } from '../../lib/validate.js';
import { audit, AUDIT_ACTIONS } from '../../lib/audit.js';
import { requireAdmin, clientIp } from '../../middleware/auth.js';
import { publicLicense, applyLazyExpiry } from '../../services/licenses.js';
import { revokeAllSessionsForSchool } from '../../lib/tokens.js';

const router = Router();
router.use(requireAdmin);

const now = () => new Date().toISOString();

function loadLicenseOr404(id) {
  const lic = applyLazyExpiry(getDb().prepare('SELECT * FROM licenses WHERE id = ?').get(id));
  if (!lic) throw errors.notFound('License not found.');
  return lic;
}

router.get('/', (req, res) => {
  const db = getDb();
  const params = [];
  let where = '';
  if (typeof req.query.school_id === 'string' && req.query.school_id) {
    where = 'WHERE l.school_id = ?';
    params.push(req.query.school_id);
  }
  const rows = db
    .prepare(
      `SELECT l.*, s.name AS school_name, s.school_code
       FROM licenses l JOIN schools s ON s.id = l.school_id
       ${where}
       ORDER BY l.created_at DESC LIMIT 500`
    )
    .all(...params)
    .map(l => applyLazyExpiry(l));
  ok(res, {
    licenses: rows.map(l => ({
      ...publicLicense(l),
      school_id: l.school_id,
      school_name: l.school_name,
      school_code: l.school_code,
      created_at: l.created_at,
    })),
  });
});

function setStatus(req, license, toStatus, auditAction) {
  const db = getDb();
  db.prepare(`UPDATE licenses SET status = ?, updated_at = ? WHERE id = ?`).run(toStatus, now(), license.id);
  if (toStatus === 'SUSPENDED' || toStatus === 'REVOKED') {
    revokeAllSessionsForSchool(license.school_id);
  }
  audit({
    actorType: 'admin',
    actorId: req.adminAuth.admin.id,
    actorLabel: req.adminAuth.admin.email,
    action: auditAction,
    targetType: 'license',
    targetId: license.id,
    metadata: { school_id: license.school_id, from: license.status, to: toStatus },
    ip: clientIp(req),
  });
  return db.prepare('SELECT * FROM licenses WHERE id = ?').get(license.id);
}

router.post('/:id/extend', (req, res, next) => {
  try {
    assertAllowedKeys(req.body, ['days']);
    const days = vInt(req.body.days, 'days', { min: 1, max: 3650 });
    const db = getDb();
    const license = loadLicenseOr404(req.params.id);
    if (license.status === 'REVOKED') {
      throw errors.conflict('INVALID_STATE', 'A revoked license cannot be extended. Create a new license instead.');
    }
    const base = license.expires_at > now() ? new Date(license.expires_at) : new Date();
    const newExpiry = new Date(base.getTime() + days * 24 * 3600 * 1000).toISOString();
    // Extending restores an expired license to ACTIVE; a SUSPENDED license
    // stays suspended (its expiry simply moves) until explicit reactivation.
    const newStatus = license.status === 'SUSPENDED' ? 'SUSPENDED' : newExpiry > now() ? 'ACTIVE' : license.status;
    db.prepare(`UPDATE licenses SET expires_at = ?, status = ?, updated_at = ? WHERE id = ?`)
      .run(newExpiry, newStatus, now(), license.id);

    audit({
      actorType: 'admin',
      actorId: req.adminAuth.admin.id,
      actorLabel: req.adminAuth.admin.email,
      action: AUDIT_ACTIONS.LICENSE_EXTENDED,
      targetType: 'license',
      targetId: license.id,
      metadata: { school_id: license.school_id, days, new_expires_at: newExpiry },
      ip: clientIp(req),
    });

    ok(res, { license: publicLicense(db.prepare('SELECT * FROM licenses WHERE id = ?').get(license.id)) });
  } catch (err) {
    next(err);
  }
});

router.post('/:id/suspend', (req, res, next) => {
  try {
    const license = loadLicenseOr404(req.params.id);
    if (!['ACTIVE', 'EXPIRED'].includes(license.status)) {
      throw errors.conflict('INVALID_STATE', `Cannot suspend a ${license.status} license.`);
    }
    const updated = setStatus(req, license, 'SUSPENDED', AUDIT_ACTIONS.LICENSE_SUSPENDED);
    ok(res, { license: publicLicense(updated) });
  } catch (err) {
    next(err);
  }
});

router.post('/:id/reactivate', (req, res, next) => {
  try {
    const license = loadLicenseOr404(req.params.id);
    if (license.status !== 'SUSPENDED') {
      throw errors.conflict('INVALID_STATE', `Only a suspended license can be reactivated (current: ${license.status}).`);
    }
    const to = license.expires_at > now() ? 'ACTIVE' : 'EXPIRED';
    const updated = setStatus(req, license, to, AUDIT_ACTIONS.LICENSE_REACTIVATED);
    ok(res, {
      license: publicLicense(updated),
      notice:
        to === 'EXPIRED'
          ? 'License reactivated but already past expiry — extend it to restore access.'
          : undefined,
    });
  } catch (err) {
    next(err);
  }
});

router.post('/:id/revoke', (req, res, next) => {
  try {
    const license = loadLicenseOr404(req.params.id);
    if (license.status === 'REVOKED') {
      return ok(res, { license: publicLicense(license) });
    }
    const updated = setStatus(req, license, 'REVOKED', AUDIT_ACTIONS.LICENSE_REVOKED);
    ok(res, { license: publicLicense(updated) });
  } catch (err) {
    next(err);
  }
});

/** POST /admin/api/licenses/schools/:schoolId/licenses — create a license for a school. */
export function createLicenseForSchool(req, schoolId, { durationDays, maxDevices }) {
  const db = getDb();
  const nowIso = now();
  const licenseId = randomId('lic');

  const tx = db.transaction(() => {
    // One ACTIVE (or SUSPENDED-by-policy) license per school: supersede others.
    db.prepare(
      `UPDATE licenses SET status = 'REVOKED', updated_at = ? WHERE school_id = ? AND status IN ('ACTIVE','SUSPENDED','EXPIRED')`
    ).run(nowIso, schoolId);
    db.prepare(
      `INSERT INTO licenses (id, school_id, license_key, status, issued_at, expires_at, max_devices, created_at, updated_at)
       VALUES (?, ?, ?, 'ACTIVE', ?, ?, ?, ?, ?)`
    ).run(
      licenseId,
      schoolId,
      generateLicenseKey(),
      nowIso,
      new Date(Date.now() + durationDays * 24 * 3600 * 1000).toISOString(),
      maxDevices,
      nowIso,
      nowIso
    );
  });
  tx();

  audit({
    actorType: 'admin',
    actorId: req.adminAuth.admin.id,
    actorLabel: req.adminAuth.admin.email,
    action: AUDIT_ACTIONS.LICENSE_CREATED,
    targetType: 'license',
    targetId: licenseId,
    metadata: { school_id: schoolId, duration_days: durationDays, max_devices: maxDevices },
    ip: clientIp(req),
  });

  return db.prepare('SELECT * FROM licenses WHERE id = ?').get(licenseId);
}

export default router;
