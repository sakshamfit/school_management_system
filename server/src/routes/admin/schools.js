/**
 * Admin: school management.
 *
 * GET    /admin/api/schools
 * POST   /admin/api/schools                      — create school + admin user
 *                                                  + license; returns the
 *                                                  generated temporary password
 *                                                  ONCE (never stored).
 * GET    /admin/api/schools/:id
 * PATCH  /admin/api/schools/:id
 * POST   /admin/api/schools/:id/suspend
 * POST   /admin/api/schools/:id/reactivate
 * POST   /admin/api/schools/:id/archive
 * POST   /admin/api/schools/:id/credentials/reset — new temporary password,
 *                                                  shown once, hash stored.
 */

import { Router } from 'express';
import { getDb } from '../../db.js';
import {
  randomId,
  generateTemporaryPassword,
  hashPassword,
  generateSchoolCode,
} from '../../lib/crypto.js';
import { revokeAllSessionsFor, revokeAllSessionsForSchool } from '../../lib/tokens.js';
import { ok, errors } from '../../lib/respond.js';
import {
  vString,
  vOptionalString,
  vEmail,
  vOptionalEmail,
  vInt,
  assertAllowedKeys,
} from '../../lib/validate.js';
import { audit, AUDIT_ACTIONS } from '../../lib/audit.js';
import { requireAdmin, clientIp } from '../../middleware/auth.js';
import { generateLicenseKey } from '../../lib/crypto.js';
import { publicLicense } from '../../services/licenses.js';

const router = Router();
router.use(requireAdmin);

const now = () => new Date().toISOString();

function schoolCodeExists(code) {
  return !!getDb().prepare('SELECT 1 FROM schools WHERE school_code = ?').get(code);
}

function publicSchoolRow(s) {
  return {
    id: s.id,
    school_code: s.school_code,
    name: s.name,
    contact_name: s.contact_name,
    email: s.email,
    phone: s.phone,
    address: s.address,
    status: s.status,
    created_at: s.created_at,
    updated_at: s.updated_at,
  };
}

router.get('/', (req, res) => {
  const db = getDb();
  const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
  const status = typeof req.query.status === 'string' ? req.query.status : '';
  const page = Math.max(1, parseInt(req.query.page || '1', 10) || 1);
  const pageSize = Math.min(100, Math.max(1, parseInt(req.query.page_size || '25', 10) || 25));

  const where = [];
  const params = [];
  if (q) {
    where.push('(s.name LIKE ? OR s.school_code LIKE ? OR s.email LIKE ?)');
    const like = `%${q}%`;
    params.push(like, like, like);
  }
  if (['ACTIVE', 'SUSPENDED', 'ARCHIVED'].includes(status)) {
    where.push('s.status = ?');
    params.push(status);
  }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const total = db.prepare(`SELECT COUNT(*) c FROM schools s ${whereSql}`).get(...params).c;
  const rows = db
    .prepare(
      `SELECT s.*,
              (SELECT COUNT(*) FROM devices d WHERE d.school_id = s.id AND d.status = 'ACTIVE') AS active_devices,
              (SELECT l.status FROM licenses l WHERE l.school_id = s.id ORDER BY l.created_at DESC LIMIT 1) AS license_status,
              (SELECT l.expires_at FROM licenses l WHERE l.school_id = s.id ORDER BY l.created_at DESC LIMIT 1) AS license_expires_at
       FROM schools s ${whereSql}
       ORDER BY s.created_at DESC
       LIMIT ? OFFSET ?`
    )
    .all(...params, pageSize, (page - 1) * pageSize);

  ok(res, {
    schools: rows.map(s => ({
      ...publicSchoolRow(s),
      active_devices: s.active_devices,
      license_status: s.license_status,
      license_expires_at: s.license_expires_at,
    })),
    total,
    page,
    page_size: pageSize,
  });
});

/**
 * POST /admin/api/schools
 * Body: { name, school_code?, contact_name?, email?, phone?, address?,
 *         admin_name, admin_email, license_duration_days, max_devices }
 * Response: { school, user: { email }, temporary_password, license }
 * The temporary password is returned ONCE and only its scrypt hash is kept.
 */
router.post('/', (req, res, next) => {
  try {
    assertAllowedKeys(req.body, [
      'name',
      'school_code',
      'contact_name',
      'email',
      'phone',
      'address',
      'admin_name',
      'admin_email',
      'license_duration_days',
      'max_devices',
    ]);
    const name = vString(req.body.name, 'name', { min: 2, max: 200 });
    const schoolCode = req.body.school_code
      ? vString(req.body.school_code, 'school_code', { min: 3, max: 40, pattern: /^[A-Za-z0-9-]+$/ }).toUpperCase()
      : generateSchoolCode(schoolCodeExists);
    const contactName = vOptionalString(req.body.contact_name, 'contact_name', { max: 120 });
    const email = vOptionalEmail(req.body.email, 'email');
    const phone = vOptionalString(req.body.phone, 'phone', { max: 40 });
    const address = vOptionalString(req.body.address, 'address', { max: 500 });
    const adminName = vString(req.body.admin_name, 'admin_name', { min: 2, max: 120 });
    const adminEmail = vEmail(req.body.admin_email, 'admin_email');
    const durationDays = vInt(req.body.license_duration_days, 'license_duration_days', { min: 1, max: 3650 });
    const maxDevices = vInt(req.body.max_devices, 'max_devices', { min: 1, max: 500 });

    const db = getDb();
    if (schoolCodeExists(schoolCode)) {
      throw errors.conflict('SCHOOL_CODE_TAKEN', 'This School ID is already in use.');
    }
    if (db.prepare('SELECT 1 FROM school_users WHERE email = ?').get(adminEmail)) {
      throw errors.conflict('EMAIL_TAKEN', 'A user with this email already exists.');
    }

    const nowIso = now();
    const schoolId = randomId('sch');
    const userId = randomId('usr');
    const licenseId = randomId('lic');
    const temporaryPassword = generateTemporaryPassword();
    const passwordHash = hashPassword(temporaryPassword);
    const expiresAt = new Date(Date.now() + durationDays * 24 * 3600 * 1000).toISOString();

    const tx = db.transaction(() => {
      db.prepare(
        `INSERT INTO schools (id, school_code, name, contact_name, email, phone, address, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'ACTIVE', ?, ?)`
      ).run(schoolId, schoolCode, name, contactName || null, email || null, phone || null, address || null, nowIso, nowIso);

      db.prepare(
        `INSERT INTO school_users (id, school_id, name, email, password_hash, role, status, must_change_password, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, 'school_admin', 'ACTIVE', 1, ?, ?)`
      ).run(userId, schoolId, adminName, adminEmail, passwordHash, nowIso, nowIso);

      db.prepare(
        `INSERT INTO licenses (id, school_id, license_key, status, issued_at, expires_at, max_devices, created_at, updated_at)
         VALUES (?, ?, ?, 'ACTIVE', ?, ?, ?, ?, ?)`
      ).run(licenseId, schoolId, generateLicenseKey(), nowIso, expiresAt, maxDevices, nowIso, nowIso);
    });
    tx();

    audit({
      actorType: 'admin',
      actorId: req.adminAuth.admin.id,
      actorLabel: req.adminAuth.admin.email,
      action: AUDIT_ACTIONS.SCHOOL_CREATED,
      targetType: 'school',
      targetId: schoolId,
      metadata: { school_code: schoolCode, user_email: adminEmail, license_duration_days: durationDays, max_devices: maxDevices },
      ip: clientIp(req),
    });

    const school = db.prepare('SELECT * FROM schools WHERE id = ?').get(schoolId);
    const license = db.prepare('SELECT * FROM licenses WHERE id = ?').get(licenseId);

    ok(
      res,
      {
        school: publicSchoolRow(school),
        user: { id: userId, name: adminName, email: adminEmail },
        temporary_password: temporaryPassword,
        credentials_notice:
          'This temporary password is shown ONCE and is never stored in plaintext. Deliver it to the customer through a secure channel.',
        license: publicLicense(license),
      },
      201
    );
  } catch (err) {
    next(err);
  }
});

function loadSchoolOr404(id) {
  const school = getDb().prepare('SELECT * FROM schools WHERE id = ?').get(id);
  if (!school) throw errors.notFound('School not found.');
  return school;
}

router.get('/:id', (req, res, next) => {
  try {
    const db = getDb();
    const school = loadSchoolOr404(req.params.id);
    const users = db
      .prepare('SELECT id, name, email, role, status, must_change_password, created_at FROM school_users WHERE school_id = ?')
      .all(school.id);
    const licenses = db.prepare('SELECT * FROM licenses WHERE school_id = ? ORDER BY created_at DESC').all(school.id);
    const devices = db
      .prepare(
        `SELECT id, device_uid, name, platform, app_version, status, activated_at, last_seen_at,
                drive_connected, last_backup_at, last_backup_status
         FROM devices WHERE school_id = ? ORDER BY activated_at DESC`
      )
      .all(school.id);
    const recentAudit = db
      .prepare(`SELECT id, actor_type, actor_label, action, metadata, created_at FROM audit_logs WHERE target_id = ? ORDER BY id DESC LIMIT 25`)
      .all(school.id);

    ok(res, {
      school: publicSchoolRow(school),
      users,
      licenses: licenses.map(publicLicense),
      devices,
      recent_audit: recentAudit,
    });
  } catch (err) {
    next(err);
  }
});

router.patch('/:id', (req, res, next) => {
  try {
    assertAllowedKeys(req.body, ['name', 'contact_name', 'email', 'phone', 'address']);
    const school = loadSchoolOr404(req.params.id);
    const db = getDb();

    const updates = {
      name: req.body.name !== undefined ? vString(req.body.name, 'name', { min: 2, max: 200 }) : school.name,
      contact_name: req.body.contact_name !== undefined ? vOptionalString(req.body.contact_name, 'contact_name', { max: 120 }) : school.contact_name,
      email: req.body.email !== undefined ? vOptionalEmail(req.body.email, 'email') || null : school.email,
      phone: req.body.phone !== undefined ? vOptionalString(req.body.phone, 'phone', { max: 40 }) || null : school.phone,
      address: req.body.address !== undefined ? vOptionalString(req.body.address, 'address', { max: 500 }) || null : school.address,
    };

    db.prepare(
      `UPDATE schools SET name = @name, contact_name = @contact_name, email = @email,
         phone = @phone, address = @address, updated_at = @updated_at WHERE id = @id`
    ).run({ ...updates, updated_at: now(), id: school.id });

    audit({
      actorType: 'admin',
      actorId: req.adminAuth.admin.id,
      actorLabel: req.adminAuth.admin.email,
      action: AUDIT_ACTIONS.SCHOOL_UPDATED,
      targetType: 'school',
      targetId: school.id,
      ip: clientIp(req),
    });

    ok(res, { school: publicSchoolRow(db.prepare('SELECT * FROM schools WHERE id = ?').get(school.id)) });
  } catch (err) {
    next(err);
  }
});

function transitionSchool(req, res, id, action, fromStatuses, toStatus, auditAction) {
  const db = getDb();
  const school = loadSchoolOr404(id);
  if (!fromStatuses.includes(school.status)) {
    throw errors.conflict('INVALID_STATE', `School cannot be ${auditAction.toLowerCase()} from status ${school.status}.`);
  }
  db.prepare(`UPDATE schools SET status = ?, updated_at = ? WHERE id = ?`).run(toStatus, now(), id);
  if (toStatus === 'SUSPENDED' || toStatus === 'ARCHIVED') {
    revokeAllSessionsForSchool(id);
  }
  audit({
    actorType: 'admin',
    actorId: req.adminAuth.admin.id,
    actorLabel: req.adminAuth.admin.email,
    action: auditAction,
    targetType: 'school',
    targetId: id,
    metadata: { from: school.status, to: toStatus },
    ip: clientIp(req),
  });
  action && action(db, id);
  ok(res, { school: publicSchoolRow(db.prepare('SELECT * FROM schools WHERE id = ?').get(id)) });
}

router.post('/:id/suspend', (req, res, next) => {
  try {
    transitionSchool(req, res, req.params.id, null, ['ACTIVE'], 'SUSPENDED', AUDIT_ACTIONS.SCHOOL_SUSPENDED);
  } catch (err) {
    next(err);
  }
});

router.post('/:id/reactivate', (req, res, next) => {
  try {
    transitionSchool(req, res, req.params.id, null, ['SUSPENDED'], 'ACTIVE', AUDIT_ACTIONS.SCHOOL_REACTIVATED);
  } catch (err) {
    next(err);
  }
});

router.post('/:id/archive', (req, res, next) => {
  try {
    transitionSchool(req, res, req.params.id, ['ACTIVE', 'SUSPENDED'], 'ARCHIVED', AUDIT_ACTIONS.SCHOOL_ARCHIVED);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /admin/api/schools/:id/credentials/reset
 * Body: { user_id } → { user: { email }, temporary_password } (shown once).
 */
router.post('/:id/credentials/reset', (req, res, next) => {
  try {
    assertAllowedKeys(req.body, ['user_id']);
    const userId = vString(req.body.user_id, 'user_id', { min: 5, max: 120 });
    const db = getDb();
    const school = loadSchoolOr404(req.params.id);
    const user = db
      .prepare('SELECT * FROM school_users WHERE id = ? AND school_id = ?')
      .get(userId, school.id);
    if (!user) throw errors.notFound('User not found for this school.');

    const temporaryPassword = generateTemporaryPassword();
    db.prepare(
      `UPDATE school_users SET password_hash = ?, must_change_password = 1, failed_logins = 0,
         locked_until = NULL, updated_at = ? WHERE id = ?`
    ).run(hashPassword(temporaryPassword), now(), user.id);
    revokeAllSessionsFor('school_user', user.id);

    audit({
      actorType: 'admin',
      actorId: req.adminAuth.admin.id,
      actorLabel: req.adminAuth.admin.email,
      action: AUDIT_ACTIONS.CREDENTIAL_RESET,
      targetType: 'school_user',
      targetId: user.id,
      metadata: { school_id: school.id, user_email: user.email },
      ip: clientIp(req),
    });

    ok(res, {
      user: { id: user.id, email: user.email, name: user.name },
      temporary_password: temporaryPassword,
      credentials_notice:
        'This temporary password is shown ONCE and is never stored in plaintext. Deliver it to the customer through a secure channel.',
    });
  } catch (err) {
    next(err);
  }
});

export default router;
