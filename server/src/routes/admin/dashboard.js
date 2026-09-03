/**
 * Admin dashboard metrics (control-plane aggregates only — never any
 * school operational data such as students, attendance or fees).
 */

import { Router } from 'express';
import config from '../../config.js';
import { getDb } from '../../db.js';
import { ok } from '../../lib/respond.js';
import { requireAdmin } from '../../middleware/auth.js';

const router = Router();
router.use(requireAdmin);

router.get('/', (_req, res) => {
  const db = getDb();
  const nowIso = new Date().toISOString();
  const soonIso = new Date(Date.now() + config.licensing.expiringSoonDays * 24 * 3600 * 1000).toISOString();
  const one = (sql, ...params) => db.prepare(sql).get(...params);

  const schoolCounts = one(
    `SELECT
       COUNT(*) AS total,
       SUM(CASE WHEN status = 'ACTIVE' THEN 1 ELSE 0 END) AS active,
       SUM(CASE WHEN status = 'SUSPENDED' THEN 1 ELSE 0 END) AS suspended,
       SUM(CASE WHEN status = 'ARCHIVED' THEN 1 ELSE 0 END) AS archived
     FROM schools`
  );

  const expiredLicenses = one(
    `SELECT COUNT(*) c FROM licenses
     WHERE (status = 'EXPIRED') OR (status = 'ACTIVE' AND expires_at <= ?)`,
    nowIso
  ).c;

  const expiringSoon = one(
    `SELECT COUNT(*) c FROM licenses
     WHERE status = 'ACTIVE' AND expires_at > ? AND expires_at <= ?`,
    nowIso,
    soonIso
  ).c;

  const activeDevices = one(`SELECT COUNT(*) c FROM devices WHERE status = 'ACTIVE'`).c;

  const recentActivations = db
    .prepare(
      `SELECT d.id, d.name, d.platform, d.activated_at, s.name AS school_name, s.school_code
       FROM devices d JOIN schools s ON s.id = d.school_id
       WHERE d.status = 'ACTIVE' ORDER BY d.activated_at DESC LIMIT 8`
    )
    .all();

  const recentLogins = db
    .prepare(
      `SELECT id, actor_type, actor_label, created_at, ip
       FROM audit_logs
       WHERE action IN ('ADMIN_LOGIN','SCHOOL_LOGIN')
       ORDER BY id DESC LIMIT 8`
    )
    .all();

  // Backup METADATA only (drive_connected / timestamps) — never contents.
  const recentBackups = db
    .prepare(
      `SELECT d.id AS device_id, d.name AS device_name, d.app_version, d.drive_connected,
              d.last_backup_at, d.last_backup_status, s.name AS school_name, s.school_code
       FROM devices d JOIN schools s ON s.id = d.school_id
       WHERE d.last_backup_at IS NOT NULL OR d.drive_connected = 1
       ORDER BY d.last_backup_at DESC LIMIT 8`
    )
    .all()
    .map(r => ({ ...r, drive_connected: !!r.drive_connected }));

  ok(res, {
    totals: {
      schools_total: schoolCounts.total || 0,
      schools_active: schoolCounts.active || 0,
      schools_suspended: schoolCounts.suspended || 0,
      schools_archived: schoolCounts.archived || 0,
      licenses_expired: expiredLicenses,
      licenses_expiring_soon: expiringSoon,
      devices_active: activeDevices,
    },
    recent_activations: recentActivations,
    recent_logins: recentLogins,
    recent_backup_metadata: recentBackups,
    current_app_version: config.version,
    expiring_soon_window_days: config.licensing.expiringSoonDays,
  });
});

export default router;
