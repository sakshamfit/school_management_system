'use strict';

/**
 * Administrator control panel API.
 *
 * Admin sessions are separate from school sessions, short-lived, and every
 * mutation is written to the audit log. All routes here require a valid
 * admin bearer token — never rely on the frontend hiding anything.
 */

const express = require('express');
const config = require('../config');
const { getDb } = require('./../db');
const { audit } = require('../audit');
const {
  hashPassword,
  verifyPassword,
  generateToken,
  sha256,
  newId,
  generateLicenseKey,
  generateReadablePassword,
  RateLimiter,
} = require('../security');
const {
  effectiveLicenseStatus,
  activeDeviceCount,
  publicSchool,
  publicLicense,
  publicDevice,
  nowIso,
} = require('../licenseService');

const router = express.Router();
const adminLimiter = new RateLimiter({ windowMs: config.rateLimitWindowMs, max: 10 });

function clientIp(req) {
  const fwd = req.headers['x-forwarded-for'];
  if (typeof fwd === 'string' && fwd.length > 0) return fwd.split(',')[0].trim();
  return req.socket.remoteAddress || 'unknown';
}

// ---------------------------------------------------------------------------
// Bootstrap: ensure at least one administrator exists.
// ---------------------------------------------------------------------------
function bootstrapAdmin() {
  const db = getDb();
  const count = db.prepare('SELECT COUNT(*) AS n FROM admins').get().n;
  if (count > 0) return;

  const email = (config.bootstrapAdminEmail || 'admin@localhost').toLowerCase();
  let password = config.bootstrapAdminPassword;
  let generated = false;
  if (!password) {
    password = generateReadablePassword(16);
    generated = true;
  }

  db.prepare('INSERT INTO admins (id, name, email, password_hash, status, created_at) VALUES (?, ?, ?, ?, ?, ?)').run(
    newId('adm'),
    'System Administrator',
    email,
    hashPassword(password),
    'active',
    nowIso()
  );

  console.log('==========================================================');
  console.log('  License server administrator account created:');
  console.log(`  Email:    ${email}`);
  if (generated) {
    console.log(`  Password: ${password}`);
    console.log('  ^ generated once — store it securely and rotate it.');
  } else {
    console.log('  Password: (from LICENSE_ADMIN_PASSWORD environment)');
  }
  console.log('==========================================================');
}

// ---------------------------------------------------------------------------
// Admin session middleware
// ---------------------------------------------------------------------------
function requireAdmin(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'ADMIN_AUTH_REQUIRED', message: 'Administrator sign-in required.' });

  const db = getDb();
  const session = db.prepare('SELECT * FROM admin_sessions WHERE token_hash = ?').get(sha256(token));
  if (!session || new Date(session.expires_at).getTime() < Date.now()) {
    return res.status(401).json({ error: 'ADMIN_SESSION_EXPIRED', message: 'Administrator session expired. Sign in again.' });
  }
  const admin = db.prepare('SELECT * FROM admins WHERE id = ?').get(session.admin_id);
  if (!admin || admin.status !== 'active') {
    return res.status(401).json({ error: 'ADMIN_AUTH_REQUIRED', message: 'Administrator sign-in required.' });
  }
  req.admin = admin;
  req.adminSessionId = session.id;
  next();
}

// ---------------------------------------------------------------------------
// POST /api/admin/login | /api/admin/logout
// ---------------------------------------------------------------------------
router.post('/admin/login', (req, res) => {
  const ip = clientIp(req);
  if (!adminLimiter.allow(ip)) {
    return res.status(429).json({ error: 'TOO_MANY_REQUESTS', message: 'Too many attempts. Try again later.' });
  }

  const { email, password } = req.body || {};
  if (typeof email !== 'string' || typeof password !== 'string') {
    return res.status(400).json({ error: 'INVALID_INPUT', message: 'Email and password are required.' });
  }

  const db = getDb();
  const admin = db.prepare('SELECT * FROM admins WHERE lower(email) = ?').get(email.trim().toLowerCase());
  if (!admin || admin.status !== 'active' || !verifyPassword(password, admin.password_hash)) {
    audit({ actorType: 'system', action: 'ADMIN_LOGIN_FAILED', target: email.trim().toLowerCase(), ip });
    return res.status(401).json({ error: 'INVALID_CREDENTIALS', message: 'Invalid administrator credentials.' });
  }

  const token = generateToken();
  const expires = new Date(Date.now() + config.adminSessionTtlSec * 1000).toISOString();
  db.prepare('INSERT INTO admin_sessions (id, admin_id, token_hash, expires_at, created_at) VALUES (?, ?, ?, ?, ?)').run(
    newId('ases'),
    admin.id,
    sha256(token),
    expires,
    nowIso()
  );
  db.prepare('UPDATE admins SET last_login_at = ? WHERE id = ?').run(nowIso(), admin.id);
  audit({ actorType: 'admin', actorId: admin.id, actorName: admin.name, action: 'ADMIN_LOGIN', ip });

  res.json({ token, expiresAt: expires, admin: { id: admin.id, name: admin.name, email: admin.email } });
});

router.post('/admin/logout', requireAdmin, (req, res) => {
  getDb().prepare('DELETE FROM admin_sessions WHERE id = ?').run(req.adminSessionId);
  audit({ actorType: 'admin', actorId: req.admin.id, actorName: req.admin.name, action: 'ADMIN_LOGOUT', ip: clientIp(req) });
  res.json({ ok: true });
});

router.post('/admin/change-password', requireAdmin, (req, res) => {
  const { currentPassword, newPassword } = req.body || {};
  if (typeof newPassword !== 'string' || newPassword.length < 10) {
    return res.status(400).json({ error: 'WEAK_PASSWORD', message: 'New password must be at least 10 characters.' });
  }
  const db = getDb();
  if (!verifyPassword(currentPassword || '', req.admin.password_hash)) {
    return res.status(401).json({ error: 'INVALID_CREDENTIALS', message: 'Current password is incorrect.' });
  }
  db.prepare('UPDATE admins SET password_hash = ? WHERE id = ?').run(hashPassword(newPassword), req.admin.id);
  db.prepare('DELETE FROM admin_sessions WHERE admin_id = ? AND id != ?').run(req.admin.id, req.adminSessionId);
  audit({ actorType: 'admin', actorId: req.admin.id, actorName: req.admin.name, action: 'ADMIN_PASSWORD_CHANGED', ip: clientIp(req) });
  res.json({ ok: true });
});

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------
router.get('/admin/dashboard', requireAdmin, (req, res) => {
  const db = getDb();
  const one = (sql, ...p) => (db.prepare(sql).get(...p) || {}).n || 0;

  const totalSchools = one(`SELECT COUNT(*) n FROM schools WHERE status != 'archived'`);
  const activeSchools = one(`SELECT COUNT(*) n FROM schools WHERE status = 'active'`);
  const suspendedSchools = one(`SELECT COUNT(*) n FROM schools WHERE status = 'suspended'`);
  const expiredLicenses = one(`SELECT COUNT(*) n FROM licenses WHERE status = 'active' AND expires_at < ?`, nowIso());
  const activeLicenses = one(`SELECT COUNT(*) n FROM licenses WHERE status = 'active' AND expires_at >= ?`, nowIso());
  const revokedLicenses = one(`SELECT COUNT(*) n FROM licenses WHERE status = 'revoked'`);
  const activeDevices = one(`SELECT COUNT(*) n FROM devices WHERE status = 'active'`);

  const recentLogins = db
    .prepare(
      `SELECT al.action, al.actor_name, al.target, al.created_at, al.metadata
       FROM audit_logs al WHERE al.action = 'LOGIN_SUCCESS' ORDER BY al.created_at DESC LIMIT 8`
    )
    .all()
    .map((r) => ({ ...r, metadata: JSON.parse(r.metadata || '{}') }));

  const recentActivations = db
    .prepare(
      `SELECT d.device_name, d.activated_at, s.name AS school_name, s.school_code
       FROM devices d JOIN schools s ON s.id = d.school_id
       ORDER BY d.activated_at DESC LIMIT 8`
    )
    .all();

  const upcomingExpiries = db
    .prepare(
      `SELECT s.name, s.school_code, l.expires_at FROM licenses l JOIN schools s ON s.id = l.school_id
       WHERE l.status = 'active' ORDER BY l.expires_at ASC LIMIT 8`
    )
    .all();

  res.json({
    totalSchools,
    activeSchools,
    suspendedSchools,
    activeLicenses,
    expiredLicenses,
    revokedLicenses,
    activeDevices,
    recentLogins,
    recentActivations,
    upcomingExpiries,
  });
});

// ---------------------------------------------------------------------------
// Schools
// ---------------------------------------------------------------------------
function validateSchoolInput(body, { partial = false } = {}) {
  const errors = [];
  const str = (v, field, { required = false, max = 200 } = {}) => {
    if (v === undefined || v === null || v === '') {
      if (required && !partial) errors.push(`${field} is required`);
      return '';
    }
    if (typeof v !== 'string') {
      errors.push(`${field} must be a string`);
      return '';
    }
    const t = v.trim();
    if (t.length > max) errors.push(`${field} is too long`);
    return t;
  };

  return {
    errors,
    name: str(body.name, 'School name', { required: true }),
    schoolCode: str(body.schoolCode, 'School ID', { required: true, max: 40 }).toUpperCase(),
    address: str(body.address, 'Address', { max: 300 }),
    phone: str(body.phone, 'Phone', { max: 40 }),
    email: str(body.email, 'Email', { max: 200 }),
    adminName: str(body.adminName, 'Admin name', { required: true }),
    adminEmail: str(body.adminEmail, 'Admin email', { required: true }),
  };
}

router.get('/admin/schools', requireAdmin, (req, res) => {
  const db = getDb();
  const search = (req.query.search || '').toString().trim();
  let rows;
  if (search) {
    const like = `%${search}%`;
    rows = db
      .prepare(
        `SELECT s.*, l.license_key, l.status AS license_status, l.expires_at, l.max_devices
         FROM schools s LEFT JOIN licenses l ON l.school_id = s.id
         WHERE s.name LIKE ? OR s.school_code LIKE ? OR s.email LIKE ?
         ORDER BY s.created_at DESC LIMIT 200`
      )
      .all(like, like, like);
  } else {
    rows = db
      .prepare(
        `SELECT s.*, l.license_key, l.status AS license_status, l.expires_at, l.max_devices
         FROM schools s LEFT JOIN licenses l ON l.school_id = s.id
         ORDER BY s.created_at DESC LIMIT 200`
      )
      .all();
  }
  res.json({
    schools: rows.map((r) => ({
      ...publicSchool(r),
      licenseKey: r.license_key,
      licenseStatus: r.license_status ? effectiveLicenseStatus(r) : null,
      expiresAt: r.expires_at,
      maxDevices: r.max_devices,
      devicesUsed: activeDeviceCount(r.id),
    })),
  });
});

router.post('/admin/schools', requireAdmin, (req, res) => {
  const input = validateSchoolInput(req.body || {});
  if (input.errors.length) return res.status(400).json({ error: 'VALIDATION', messages: input.errors });

  const licenseMonths = Math.min(Math.max(parseInt(req.body.licenseMonths || '12', 10) || 12, 1), 120);
  const maxDevices = Math.min(Math.max(parseInt(req.body.maxDevices || config.defaultMaxDevices, 10) || 1, 1), 50);
  const adminPassword =
    typeof req.body.adminPassword === 'string' && req.body.adminPassword.length >= 10
      ? req.body.adminPassword
      : generateReadablePassword();

  const db = getDb();

  if (db.prepare('SELECT id FROM schools WHERE school_code = ?').get(input.schoolCode)) {
    return res.status(409).json({ error: 'DUPLICATE_SCHOOL_CODE', message: 'A school with this School ID already exists.' });
  }
  if (db.prepare('SELECT id FROM school_users WHERE lower(email) = ?').get(input.adminEmail.toLowerCase())) {
    return res.status(409).json({ error: 'DUPLICATE_EMAIL', message: 'This admin email is already registered.' });
  }

  const schoolId = newId('sch');
  const userId = newId('usr');
  const licenseId = newId('lic');
  const issuedAt = nowIso();
  const expiresAt = new Date(Date.now() + licenseMonths * 30 * 86400000).toISOString();
  const licenseKey = generateLicenseKey();

  const create = db.transaction(() => {
    db.prepare(
      `INSERT INTO schools (id, school_code, name, address, phone, email, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, 'active', ?, ?)`
    ).run(schoolId, input.schoolCode, input.name, input.address, input.phone, input.email, issuedAt, issuedAt);

    db.prepare(
      `INSERT INTO school_users (id, school_id, name, email, password_hash, role, status, must_change_password, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 'admin', 'active', 1, ?, ?)`
    ).run(userId, schoolId, input.adminName, input.adminEmail.toLowerCase(), hashPassword(adminPassword), issuedAt, issuedAt);

    db.prepare(
      `INSERT INTO licenses (id, school_id, license_key, status, issued_at, expires_at, max_devices, offline_grace_days, revalidate_hours, created_at, updated_at)
       VALUES (?, ?, ?, 'active', ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      licenseId,
      schoolId,
      licenseKey,
      issuedAt,
      expiresAt,
      maxDevices,
      config.defaultOfflineGraceDays,
      config.defaultRevalidateHours,
      issuedAt,
      issuedAt
    );
  });
  create();

  audit({
    actorType: 'admin',
    actorId: req.admin.id,
    actorName: req.admin.name,
    action: 'SCHOOL_CREATED',
    target: input.schoolCode,
    metadata: { schoolId, name: input.name, licenseMonths, maxDevices },
    ip: clientIp(req),
  });

  res.status(201).json({
    school: publicSchool(db.prepare('SELECT * FROM schools WHERE id = ?').get(schoolId)),
    licenseKey,
    expiresAt,
    // Shown ONCE so the administrator can hand credentials to the school.
    initialCredentials: { email: input.adminEmail.toLowerCase(), password: adminPassword },
  });
});

function getSchoolOr404(req, res) {
  const db = getDb();
  const school = db.prepare('SELECT * FROM schools WHERE id = ?').get(req.params.id);
  if (!school) {
    res.status(404).json({ error: 'NOT_FOUND', message: 'School not found.' });
    return null;
  }
  return school;
}

router.get('/admin/schools/:id', requireAdmin, (req, res) => {
  const school = getSchoolOr404(req, res);
  if (!school) return;
  const db = getDb();
  const license = db.prepare('SELECT * FROM licenses WHERE school_id = ?').get(school.id);
  const users = db.prepare('SELECT id, name, email, role, status, created_at FROM school_users WHERE school_id = ?').all(school.id);
  const devices = db.prepare('SELECT * FROM devices WHERE school_id = ? ORDER BY activated_at DESC').all(school.id);

  res.json({
    school: publicSchool(school),
    license: license ? publicLicense(license) : null,
    users,
    devices: devices.map(publicDevice),
  });
});

router.patch('/admin/schools/:id', requireAdmin, (req, res) => {
  const school = getSchoolOr404(req, res);
  if (!school) return;
  const body = req.body || {};
  const db = getDb();

  const fields = {};
  if (typeof body.name === 'string' && body.name.trim()) fields.name = body.name.trim().slice(0, 200);
  if (typeof body.address === 'string') fields.address = body.address.trim().slice(0, 300);
  if (typeof body.phone === 'string') fields.phone = body.phone.trim().slice(0, 40);
  if (typeof body.email === 'string') fields.email = body.email.trim().slice(0, 200);
  if (['active', 'suspended', 'archived'].includes(body.status)) fields.status = body.status;

  if (Object.keys(fields).length === 0) {
    return res.status(400).json({ error: 'NO_FIELDS', message: 'No valid fields to update.' });
  }

  const sets = Object.keys(fields).map((k) => `${k} = ?`).join(', ');
  db.prepare(`UPDATE schools SET ${sets}, updated_at = ? WHERE id = ?`).run(...Object.values(fields), nowIso(), school.id);

  if (fields.status && fields.status !== school.status) {
    if (fields.status === 'suspended') {
      db.prepare('DELETE FROM sessions WHERE school_id = ?').run(school.id);
    }
    audit({
      actorType: 'admin',
      actorId: req.admin.id,
      actorName: req.admin.name,
      action: fields.status === 'active' ? 'SCHOOL_ACTIVATED' : `SCHOOL_${fields.status.toUpperCase()}`,
      target: school.school_code,
      ip: clientIp(req),
    });
  } else {
    audit({
      actorType: 'admin',
      actorId: req.admin.id,
      actorName: req.admin.name,
      action: 'SCHOOL_UPDATED',
      target: school.school_code,
      metadata: { fields: Object.keys(fields) },
      ip: clientIp(req),
    });
  }

  res.json({ school: publicSchool(db.prepare('SELECT * FROM schools WHERE id = ?').get(school.id)) });
});

router.post('/admin/schools/:id/reset-credentials', requireAdmin, (req, res) => {
  const school = getSchoolOr404(req, res);
  if (!school) return;
  const db = getDb();
  const user = db
    .prepare(`SELECT * FROM school_users WHERE school_id = ? ORDER BY created_at ASC LIMIT 1`)
    .get(school.id);
  if (!user) return res.status(404).json({ error: 'NO_USER', message: 'This school has no login account.' });

  const newPassword = generateReadablePassword();
  db.prepare('UPDATE school_users SET password_hash = ?, must_change_password = 1, updated_at = ? WHERE id = ?').run(
    hashPassword(newPassword),
    nowIso(),
    user.id
  );
  db.prepare('DELETE FROM sessions WHERE user_id = ?').run(user.id);

  audit({
    actorType: 'admin',
    actorId: req.admin.id,
    actorName: req.admin.name,
    action: 'PASSWORD_RESET',
    target: school.school_code,
    metadata: { userEmail: user.email },
    ip: clientIp(req),
  });

  res.json({ ok: true, email: user.email, newPassword });
});

// ---------------------------------------------------------------------------
// Licenses
// ---------------------------------------------------------------------------
router.get('/admin/licenses', requireAdmin, (req, res) => {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT l.*, s.name AS school_name, s.school_code, s.status AS school_status
       FROM licenses l JOIN schools s ON s.id = l.school_id ORDER BY l.expires_at ASC LIMIT 500`
    )
    .all();
  res.json({
    licenses: rows.map((r) => ({
      id: r.id,
      schoolId: r.school_id,
      schoolName: r.school_name,
      schoolCode: r.school_code,
      schoolStatus: r.school_status,
      ...publicLicense(r),
    })),
  });
});

router.post('/admin/licenses/:schoolId/extend', requireAdmin, (req, res) => {
  const db = getDb();
  const license = db.prepare('SELECT * FROM licenses WHERE school_id = ?').get(req.params.schoolId);
  if (!license) return res.status(404).json({ error: 'NOT_FOUND', message: 'License not found.' });

  const months = Math.min(Math.max(parseInt((req.body || {}).months || '12', 10) || 12, 1), 120);
  const base = Math.max(new Date(license.expires_at).getTime(), Date.now());
  const newExpiry = new Date(base + months * 30 * 86400000).toISOString();
  db.prepare('UPDATE licenses SET expires_at = ?, updated_at = ? WHERE id = ?').run(newExpiry, nowIso(), license.id);

  audit({
    actorType: 'admin',
    actorId: req.admin.id,
    actorName: req.admin.name,
    action: 'LICENSE_EXTENDED',
    target: license.license_key,
    metadata: { months, newExpiry },
    ip: clientIp(req),
  });

  res.json({ ok: true, expiresAt: newExpiry });
});

router.patch('/admin/licenses/:schoolId', requireAdmin, (req, res) => {
  const db = getDb();
  const license = db.prepare('SELECT * FROM licenses WHERE school_id = ?').get(req.params.schoolId);
  if (!license) return res.status(404).json({ error: 'NOT_FOUND', message: 'License not found.' });
  const body = req.body || {};

  const updates = {};
  if (['active', 'suspended', 'revoked'].includes(body.status)) updates.status = body.status;
  if (Number.isInteger(body.maxDevices) && body.maxDevices >= 1 && body.maxDevices <= 50) updates.max_devices = body.maxDevices;
  if (Number.isInteger(body.offlineGraceDays) && body.offlineGraceDays >= 0 && body.offlineGraceDays <= 365)
    updates.offline_grace_days = body.offlineGraceDays;
  if (Number.isInteger(body.revalidateHours) && body.revalidateHours >= 1 && body.revalidateHours <= 24 * 30)
    updates.revalidate_hours = body.revalidateHours;

  if (Object.keys(updates).length === 0) return res.status(400).json({ error: 'NO_FIELDS', message: 'No valid fields.' });

  const sets = Object.keys(updates).map((k) => `${k} = ?`).join(', ');
  db.prepare(`UPDATE licenses SET ${sets}, updated_at = ? WHERE id = ?`).run(...Object.values(updates), nowIso(), license.id);

  // Note: sessions are intentionally NOT deleted on license suspend/revoke.
  // Keeping them lets desktop clients receive the precise LICENSE_SUSPENDED /
  // LICENSE_REVOKED state on their next validation so they can show the right
  // screen. Authentication itself is already denied at login/refresh.

  audit({
    actorType: 'admin',
    actorId: req.admin.id,
    actorName: req.admin.name,
    action: `LICENSE_${(updates.status || 'POLICY').toUpperCase()}_CHANGED`,
    target: license.license_key,
    metadata: Object.keys(updates),
    ip: clientIp(req),
  });

  res.json({ license: publicLicense(db.prepare('SELECT * FROM licenses WHERE id = ?').get(license.id)) });
});

// ---------------------------------------------------------------------------
// Devices
// ---------------------------------------------------------------------------
router.get('/admin/devices', requireAdmin, (req, res) => {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT d.*, s.name AS school_name, s.school_code FROM devices d
       JOIN schools s ON s.id = d.school_id ORDER BY d.activated_at DESC LIMIT 500`
    )
    .all();
  res.json({ devices: rows.map((r) => ({ schoolName: r.school_name, schoolCode: r.school_code, ...publicDevice(r) })) });
});

router.post('/admin/devices/:id/deactivate', requireAdmin, (req, res) => {
  const db = getDb();
  const device = db.prepare('SELECT * FROM devices WHERE id = ?').get(req.params.id);
  if (!device) return res.status(404).json({ error: 'NOT_FOUND', message: 'Device not found.' });

  db.prepare(`UPDATE devices SET status = 'deactivated', updated_at = ? WHERE id = ?`).run(nowIso(), device.id);
  db.prepare('DELETE FROM sessions WHERE device_id = ?').run(device.id);

  audit({
    actorType: 'admin',
    actorId: req.admin.id,
    actorName: req.admin.name,
    action: 'DEVICE_DEACTIVATED',
    target: device.device_name || device.id,
    metadata: { schoolId: device.school_id },
    ip: clientIp(req),
  });

  res.json({ ok: true });
});

router.post('/admin/devices/:id/reactivate', requireAdmin, (req, res) => {
  const db = getDb();
  const device = db.prepare('SELECT * FROM devices WHERE id = ?').get(req.params.id);
  if (!device) return res.status(404).json({ error: 'NOT_FOUND', message: 'Device not found.' });
  db.prepare(`UPDATE devices SET status = 'active', updated_at = ? WHERE id = ?`).run(nowIso(), device.id);
  audit({
    actorType: 'admin',
    actorId: req.admin.id,
    actorName: req.admin.name,
    action: 'DEVICE_REACTIVATED',
    target: device.device_name || device.id,
    ip: clientIp(req),
  });
  res.json({ ok: true });
});

// ---------------------------------------------------------------------------
// School users
// ---------------------------------------------------------------------------
router.post('/admin/users/:id/reset-password', requireAdmin, (req, res) => {
  const db = getDb();
  const user = db.prepare('SELECT * FROM school_users WHERE id = ?').get(req.params.id);
  if (!user) return res.status(404).json({ error: 'NOT_FOUND', message: 'User not found.' });

  const newPassword = generateReadablePassword();
  db.prepare('UPDATE school_users SET password_hash = ?, must_change_password = 1, updated_at = ? WHERE id = ?').run(
    hashPassword(newPassword),
    nowIso(),
    user.id
  );
  db.prepare('DELETE FROM sessions WHERE user_id = ?').run(user.id);

  audit({
    actorType: 'admin',
    actorId: req.admin.id,
    actorName: req.admin.name,
    action: 'PASSWORD_RESET',
    target: user.email,
    ip: clientIp(req),
  });

  res.json({ ok: true, email: user.email, newPassword });
});

router.post('/admin/users/:id/status', requireAdmin, (req, res) => {
  const db = getDb();
  const user = db.prepare('SELECT * FROM school_users WHERE id = ?').get(req.params.id);
  if (!user) return res.status(404).json({ error: 'NOT_FOUND', message: 'User not found.' });
  const status = (req.body || {}).status;
  if (!['active', 'locked'].includes(status)) return res.status(400).json({ error: 'INVALID_STATUS' });
  db.prepare('UPDATE school_users SET status = ?, updated_at = ? WHERE id = ?').run(status, nowIso(), user.id);
  if (status === 'locked') db.prepare('DELETE FROM sessions WHERE user_id = ?').run(user.id);
  audit({
    actorType: 'admin',
    actorId: req.admin.id,
    actorName: req.admin.name,
    action: status === 'locked' ? 'USER_LOCKED' : 'USER_UNLOCKED',
    target: user.email,
    ip: clientIp(req),
  });
  res.json({ ok: true });
});

// ---------------------------------------------------------------------------
// Releases / versions (drives the website download + update notices)
// ---------------------------------------------------------------------------
router.get('/admin/releases', requireAdmin, (req, res) => {
  const rows = getDb().prepare('SELECT * FROM releases ORDER BY released_at DESC LIMIT 100').all();
  res.json({ releases: rows });
});

router.post('/admin/releases', requireAdmin, (req, res) => {
  const body = req.body || {};
  const version = (body.version || '').toString().trim();
  if (!/^\d+\.\d+\.\d+([-+][\w.-]+)?$/.test(version)) {
    return res.status(400).json({ error: 'INVALID_VERSION', message: 'Version must be semantic, e.g. 1.2.0' });
  }
  const channel = body.channel === 'beta' ? 'beta' : 'stable';
  const notes = (body.notes || '').toString().slice(0, 5000);
  const installerUrl = (body.installerUrl || '').toString().slice(0, 1000);

  const db = getDb();
  const existing = db.prepare('SELECT id FROM releases WHERE version = ?').get(version);
  if (existing) return res.status(409).json({ error: 'DUPLICATE_VERSION', message: 'This version already exists.' });

  db.prepare(
    `INSERT INTO releases (id, version, channel, notes, installer_url, released_at, is_latest_stable) VALUES (?, ?, ?, ?, ?, ?, 0)`
  ).run(newId('rel'), version, channel, notes, installerUrl, nowIso());

  if (channel === 'stable' && body.markLatestStable !== false) {
    db.prepare('UPDATE releases SET is_latest_stable = 0');
    db.prepare('UPDATE releases SET is_latest_stable = 1 WHERE version = ?').run(version);
  }

  audit({
    actorType: 'admin',
    actorId: req.admin.id,
    actorName: req.admin.name,
    action: 'RELEASE_PUBLISHED',
    target: `${version} (${channel})`,
    ip: clientIp(req),
  });

  res.status(201).json({ ok: true });
});

// ---------------------------------------------------------------------------
// Client settings (support contact shown inside desktop apps)
// ---------------------------------------------------------------------------
router.get('/admin/client-settings', requireAdmin, (req, res) => {
  const rows = getDb().prepare('SELECT key, value FROM client_settings').all();
  const map = {};
  rows.forEach((r) => {
    map[r.key] = r.value;
  });
  res.json({
    supportUrl: map.support_url || config.support.url,
    supportEmail: map.support_email || config.support.email,
    supportPhone: map.support_phone || config.support.phone,
  });
});

router.put('/admin/client-settings', requireAdmin, (req, res) => {
  const body = req.body || {};
  const db = getDb();
  const upsert = db.prepare(
    `INSERT INTO client_settings (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`
  );
  const apply = (key, value) => {
    if (typeof value === 'string') upsert.run(key, value.trim().slice(0, 500));
  };
  apply('support_url', body.supportUrl);
  apply('support_email', body.supportEmail);
  apply('support_phone', body.supportPhone);
  audit({
    actorType: 'admin',
    actorId: req.admin.id,
    actorName: req.admin.name,
    action: 'CLIENT_SETTINGS_UPDATED',
    ip: clientIp(req),
  });
  res.json({ ok: true });
});

// ---------------------------------------------------------------------------
// Audit log
// ---------------------------------------------------------------------------
router.get('/admin/audit', requireAdmin, (req, res) => {
  const limit = Math.min(Math.max(parseInt(req.query.limit || '100', 10) || 100, 1), 500);
  const rows = getDb()
    .prepare('SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT ?')
    .all(limit);
  res.json({ logs: rows.map((r) => ({ ...r, metadata: JSON.parse(r.metadata || '{}') })) });
});

module.exports = { router, bootstrapAdmin };
