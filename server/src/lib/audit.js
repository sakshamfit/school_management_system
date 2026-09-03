/**
 * Control-plane audit logging.
 *
 * Records WHO did WHAT to WHICH target and WHEN, plus safe metadata.
 *
 * Hard rule: secrets are never written to the audit log. The redactor
 * drops any field that could contain a password, password hash, access
 * or refresh token, OAuth token, backup encryption key, or license secret.
 */

import { getDb } from '../db.js';

const SENSITIVE_KEY_PATTERN =
  /pass(word)?|hash|token|secret|key|authorization|cookie|credential|oauth/i;

const REDACTED = '[redacted]';

export function sanitizeMetadata(input, depth = 0) {
  if (input === null || input === undefined) return null;
  if (depth > 4) return null;
  if (typeof input === 'string') return input.slice(0, 500);
  if (typeof input === 'number' || typeof input === 'boolean') return input;
  if (Array.isArray(input)) {
    return input.slice(0, 25).map(v => sanitizeMetadata(v, depth + 1));
  }
  if (typeof input === 'object') {
    const out = {};
    for (const [key, value] of Object.entries(input)) {
      if (SENSITIVE_KEY_PATTERN.test(key)) {
        out[key] = REDACTED;
      } else {
        out[key] = sanitizeMetadata(value, depth + 1);
      }
    }
    return out;
  }
  return null;
}

/**
 * Write an audit entry. Never throws — auditing must not break requests.
 *
 * @param {object} entry
 * @param {'admin'|'school_user'|'system'|null} entry.actorType
 * @param {string|null} entry.actorId
 * @param {string|null} entry.actorLabel  human readable (name/email)
 * @param {string} entry.action           e.g. 'SCHOOL_CREATED'
 * @param {string|null} entry.targetType  e.g. 'school'
 * @param {string|null} entry.targetId
 * @param {object|null} entry.metadata    automatically redacted
 * @param {string|null} entry.ip
 */
export function audit(entry) {
  try {
    const db = getDb();
    db.prepare(
      `INSERT INTO audit_logs
         (actor_type, actor_id, actor_label, action, target_type, target_id, metadata, ip, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      entry.actorType || null,
      entry.actorId || null,
      entry.actorLabel ? String(entry.actorLabel).slice(0, 200) : null,
      String(entry.action).slice(0, 80),
      entry.targetType ? String(entry.targetType).slice(0, 80) : null,
      entry.targetId ? String(entry.targetId).slice(0, 120) : null,
      entry.metadata ? JSON.stringify(sanitizeMetadata(entry.metadata)) : null,
      entry.ip || null,
      new Date().toISOString()
    );
  } catch (err) {
    console.error('[audit] failed to write entry:', err.message);
  }
}

/** Standard action vocabulary for the control plane. */
export const AUDIT_ACTIONS = {
  ADMIN_LOGIN: 'ADMIN_LOGIN',
  ADMIN_LOGIN_FAILED: 'ADMIN_LOGIN_FAILED',
  ADMIN_LOGOUT: 'ADMIN_LOGOUT',
  ADMIN_CREATED: 'ADMIN_CREATED',
  SCHOOL_LOGIN: 'SCHOOL_LOGIN',
  SCHOOL_LOGIN_FAILED: 'SCHOOL_LOGIN_FAILED',
  SCHOOL_CREATED: 'SCHOOL_CREATED',
  SCHOOL_UPDATED: 'SCHOOL_UPDATED',
  SCHOOL_SUSPENDED: 'SCHOOL_SUSPENDED',
  SCHOOL_REACTIVATED: 'SCHOOL_REACTIVATED',
  SCHOOL_ARCHIVED: 'SCHOOL_ARCHIVED',
  CREDENTIAL_RESET: 'CREDENTIAL_RESET',
  LICENSE_CREATED: 'LICENSE_CREATED',
  LICENSE_EXTENDED: 'LICENSE_EXTENDED',
  LICENSE_SUSPENDED: 'LICENSE_SUSPENDED',
  LICENSE_REACTIVATED: 'LICENSE_REACTIVATED',
  LICENSE_REVOKED: 'LICENSE_REVOKED',
  LICENSE_EXPIRED: 'LICENSE_EXPIRED',
  DEVICE_ACTIVATED: 'DEVICE_ACTIVATED',
  DEVICE_DEACTIVATED: 'DEVICE_DEACTIVATED',
  DEVICE_REACTIVATED: 'DEVICE_REACTIVATED',
  DEVICE_LIMIT_REACHED: 'DEVICE_LIMIT_REACHED',
  SESSION_REVOKED: 'SESSION_REVOKED',
  REFRESH_REPLAY_DETECTED: 'REFRESH_REPLAY_DETECTED',
  RELEASE_PUBLISHED: 'RELEASE_PUBLISHED',
  RELEASE_UNPUBLISHED: 'RELEASE_UNPUBLISHED',
  BACKUP_CREATED: 'BACKUP_CREATED',
};
