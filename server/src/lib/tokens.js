/**
 * Token service.
 *
 * Access tokens  : short-lived JWT (HS256) signed with LICENSE_TOKEN_SECRET.
 * Refresh tokens : opaque random secrets of the form `${sessionId}.${secret}`.
 *                  Only the SHA-256 hash of the secret is stored.
 *
 * Rotation & replay detection:
 *  - Every /auth/refresh rotates the refresh token (hash replaced).
 *  - If a *previously rotated* token is presented, the whole session is
 *    marked REUSED and revoked immediately (replay detection), and the
 *    incident is audit-logged.
 */

import jwt from 'jsonwebtoken';
import config from '../config.js';
import { getDb } from '../db.js';
import { randomId, randomToken, sha256 } from './crypto.js';

const now = () => new Date().toISOString();

export function signAccessToken({ sessionId, subjectType, subjectId, schoolId, role, deviceId }) {
  return jwt.sign(
    {
      sid: sessionId,
      sub: subjectId,
      type: 'access',
      subj: subjectType,
      school_id: schoolId || null,
      role,
      device_id: deviceId || null,
    },
    config.secrets.licenseTokenSecret,
    { expiresIn: config.tokens.accessTtlSeconds }
  );
}

/** Verify an access token. Returns claims or null (never throws). */
export function verifyAccessToken(token) {
  try {
    const claims = jwt.verify(String(token), config.secrets.licenseTokenSecret);
    if (claims.type !== 'access') return null;
    return claims;
  } catch {
    return null;
  }
}

/** Create a new session + refresh token pair. */
export function createSession({
  subjectType,
  subjectId,
  schoolId = null,
  deviceId = null,
  userAgent = '',
  ip = '',
  familyId = null,
}) {
  const db = getDb();
  const id = randomId('ses');
  const secret = randomToken(32);
  const ttlMs =
    (subjectType === 'admin'
      ? config.tokens.adminSessionHours * 3600 * 1000
      : config.tokens.refreshTtlDays * 24 * 3600 * 1000);
  const row = {
    id,
    subject_type: subjectType,
    subject_id: subjectId,
    school_id: schoolId,
    refresh_hash: sha256(secret),
    prev_refresh_hash: null,
    family_id: familyId || randomId('fam'),
    status: 'ACTIVE',
    device_id: deviceId,
    user_agent: userAgent.slice(0, 300),
    ip,
    created_at: now(),
    expires_at: new Date(Date.now() + ttlMs).toISOString(),
  };
  db.prepare(
    `INSERT INTO sessions (id, subject_type, subject_id, school_id, refresh_hash, prev_refresh_hash,
       family_id, status, device_id, user_agent, ip, created_at, expires_at)
     VALUES (@id, @subject_type, @subject_id, @school_id, @refresh_hash, @prev_refresh_hash,
       @family_id, @status, @device_id, @user_agent, @ip, @created_at, @expires_at)`
  ).run(row);
  return { sessionId: id, refreshToken: `${id}.${secret}`, session: row };
}

export function getSession(id) {
  return getDb().prepare('SELECT * FROM sessions WHERE id = ?').get(id);
}

export function isSessionUsable(session) {
  return (
    !!session &&
    session.status === 'ACTIVE' &&
    session.expires_at > now()
  );
}

export class TokenError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

/**
 * Rotate a presented refresh token.
 * Returns a fresh session row + tokens.
 * Throws TokenError('REFRESH_REPLAY_DETECTED') and revokes the session when
 * an already-rotated token is replayed.
 */
export function rotateRefreshToken(refreshToken, { userAgent = '', ip = '' } = {}) {
  const db = getDb();
  const [sessionId, secret] = String(refreshToken || '').split('.');
  if (!sessionId || !secret) {
    throw new TokenError('INVALID_REFRESH_TOKEN', 'Invalid or expired refresh token.');
  }

  const session = getSession(sessionId);
  const presentedHash = sha256(secret);

  if (!session) {
    throw new TokenError('INVALID_REFRESH_TOKEN', 'Invalid or expired refresh token.');
  }

  // Replay detection: matches a previously rotated-out hash, or the session
  // was already revoked/flagged. Revoke the compromised session outright.
  if (
    (session.prev_refresh_hash && session.prev_refresh_hash === presentedHash) ||
    session.status === 'REUSED' ||
    (session.status === 'REVOKED' && session.refresh_hash === presentedHash)
  ) {
    db.prepare(
      `UPDATE sessions SET status = 'REUSED', revoked_at = ? WHERE family_id = ? AND status = 'ACTIVE'`
    ).run(now(), session.family_id);
    db.prepare(`UPDATE sessions SET status = 'REUSED' WHERE id = ?`).run(session.id);
    const err = new TokenError('REFRESH_REPLAY_DETECTED', 'Token reuse detected. Session revoked.');
    err.session = session;
    throw err;
  }

  if (session.status !== 'ACTIVE' || session.refresh_hash !== presentedHash) {
    throw new TokenError('INVALID_REFRESH_TOKEN', 'Invalid or expired refresh token.');
  }
  if (session.expires_at <= now()) {
    throw new TokenError('INVALID_REFRESH_TOKEN', 'Invalid or expired refresh token.');
  }

  const newSecret = randomToken(32);
  db.prepare(
    `UPDATE sessions
     SET refresh_hash = ?, prev_refresh_hash = ?, rotated_at = ?, user_agent = ?, ip = ?
     WHERE id = ?`
  ).run(sha256(newSecret), session.refresh_hash, now(), userAgent.slice(0, 300), ip, sessionId);

  return {
    sessionId,
    refreshToken: `${sessionId}.${newSecret}`,
    session: getSession(sessionId),
  };
}

/** Revoke a single session (logout). Safe to call twice. */
export function revokeSession(sessionId) {
  getDb()
    .prepare(
      `UPDATE sessions SET status = 'REVOKED', revoked_at = ? WHERE id = ? AND status = 'ACTIVE'`
    )
    .run(now(), sessionId);
}

/** Revoke every active session for a subject (password reset, suspension). */
export function revokeAllSessionsFor(subjectType, subjectId) {
  getDb()
    .prepare(
      `UPDATE sessions SET status = 'REVOKED', revoked_at = ?
       WHERE subject_type = ? AND subject_id = ? AND status = 'ACTIVE'`
    )
    .run(now(), subjectType, subjectId);
}

/** Revoke every active session belonging to a school (school suspension). */
export function revokeAllSessionsForSchool(schoolId) {
  getDb()
    .prepare(
      `UPDATE sessions SET status = 'REVOKED', revoked_at = ?
       WHERE school_id = ? AND status = 'ACTIVE'`
    )
    .run(now(), schoolId);
}
