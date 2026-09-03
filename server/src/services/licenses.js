/**
 * License domain logic. The server is authoritative for all license state.
 *
 * License statuses: ACTIVE | EXPIRED | SUSPENDED | REVOKED
 *
 * Expiry is resolved lazily and deterministically: an ACTIVE license whose
 * expires_at has passed is treated as EXPIRED and transitioned (once) with
 * an audit entry. Expiration NEVER deletes or locks customer data — it only
 * changes the authorization answer the server gives the desktop app, whose
 * offline policy then applies on the customer machine.
 */

import { getDb } from '../db.js';
import { audit, AUDIT_ACTIONS } from '../lib/audit.js';

const now = () => new Date().toISOString();

export function getActiveLicenseForSchool(schoolId) {
  return getDb()
    .prepare(`SELECT * FROM licenses WHERE school_id = ? AND status = 'ACTIVE' ORDER BY expires_at DESC`)
    .all(schoolId)
    .at(0);
}

export function getLatestLicenseForSchool(schoolId) {
  const license = getDb()
    .prepare(`SELECT * FROM licenses WHERE school_id = ? ORDER BY created_at DESC, expires_at DESC`)
    .all(schoolId);
  return license.at(0) || null;
}

/** Transition ACTIVE licenses past their expiry to EXPIRED (audited once). */
export function applyLazyExpiry(license) {
  if (!license) return null;
  if (license.status === 'ACTIVE' && license.expires_at <= now()) {
    getDb()
      .prepare(`UPDATE licenses SET status = 'EXPIRED', updated_at = ? WHERE id = ? AND status = 'ACTIVE'`)
      .run(now(), license.id);
    audit({
      actorType: 'system',
      actorLabel: 'license-scheduler',
      action: AUDIT_ACTIONS.LICENSE_EXPIRED,
      targetType: 'license',
      targetId: license.id,
      metadata: { school_id: license.school_id, expired_at: license.expires_at },
    });
    return { ...license, status: 'EXPIRED' };
  }
  return license;
}

export function countActiveDevices(schoolId) {
  return (
    getDb()
      .prepare(`SELECT COUNT(*) AS c FROM devices WHERE school_id = ? AND status = 'ACTIVE'`)
      .get(schoolId)?.c || 0
  );
}

/**
 * Resolve the full authorization state for (school, device_uid).
 * This is the single decision point consumed by /license/validate.
 * Returns a machine-readable status plus the reason the desktop shows.
 */
export function resolveAuthorization(school, license, device) {
  if (!school) return { status: 'SCHOOL_NOT_FOUND' };
  if (school.status === 'SUSPENDED') return { status: 'SCHOOL_SUSPENDED' };
  if (school.status === 'ARCHIVED') return { status: 'SCHOOL_ARCHIVED' };

  if (!license) return { status: 'NO_ACTIVE_LICENSE' };
  if (license.status === 'SUSPENDED') return { status: 'LICENSE_SUSPENDED' };
  if (license.status === 'REVOKED') return { status: 'LICENSE_REVOKED' };
  if (license.status === 'EXPIRED') return { status: 'LICENSE_EXPIRED' };

  if (device && device.status === 'DEACTIVATED') return { status: 'DEVICE_DEACTIVATED' };

  return { status: 'AUTHORIZED' };
}

export function publicLicense(license) {
  if (!license) return null;
  return {
    id: license.id,
    license_key: license.license_key,
    status: license.status,
    issued_at: license.issued_at,
    expires_at: license.expires_at,
    max_devices: license.max_devices,
  };
}
