/**
 * Authentication & authorization middleware.
 *
 * School users  : Bearer access token (JWT) + live session + live DB checks.
 * Administrators: HttpOnly cookie session + CSRF header for mutations.
 *
 * Authorization is always enforced server-side here — never by the UI.
 */

import config from '../config.js';
import { getDb } from '../db.js';
import { verifyAccessToken, isSessionUsable, getSession } from '../lib/tokens.js';
import { sha256, hmacSha256 } from '../lib/crypto.js';
import { ApiError } from '../lib/respond.js';

const ADMIN_COOKIE = 'sms_admin_session';

export function adminCookieName() {
  return ADMIN_COOKIE;
}

export function parseCookies(req) {
  const header = req.headers.cookie || '';
  const out = {};
  for (const part of header.split(';')) {
    const idx = part.indexOf('=');
    if (idx > -1) out[part.slice(0, idx).trim()] = decodeURIComponent(part.slice(idx + 1).trim());
  }
  return out;
}

export function clientIp(req) {
  if (config.tls.trustProxy) {
    const fwd = req.headers['x-forwarded-for'];
    if (typeof fwd === 'string' && fwd.length > 0) {
      return fwd.split(',')[0].trim().slice(0, 64);
    }
  }
  return (req.socket?.remoteAddress || '').slice(0, 64);
}

function touchDeviceLastSeen(deviceId) {
  if (!deviceId) return;
  try {
    getDb()
      .prepare(`UPDATE devices SET last_seen_at = ? WHERE id = ?`)
      .run(new Date().toISOString(), deviceId);
  } catch {
    /* non-fatal */
  }
}

/**
 * Require an authenticated school user.
 * Validates: JWT signature/expiry → session is active → user active →
 * school status. Attaches req.auth { user, school, session, claims }.
 */
export function requireSchoolAuth(req, _res, next) {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) throw new ApiError(401, 'UNAUTHORIZED', 'Authentication required.');

    const claims = verifyAccessToken(token);
    if (!claims || claims.subj !== 'school_user') {
      throw new ApiError(401, 'UNAUTHORIZED', 'Invalid or expired access token.');
    }

    const session = getSession(claims.sid);
    if (!isSessionUsable(session) || session.subject_id !== claims.sub) {
      throw new ApiError(401, 'SESSION_EXPIRED', 'Session expired. Please sign in again.');
    }

    const db = getDb();
    const user = db.prepare('SELECT * FROM school_users WHERE id = ?').get(claims.sub);
    if (!user || user.status !== 'ACTIVE') {
      throw new ApiError(401, 'ACCOUNT_DISABLED', 'This account is no longer active.');
    }
    const school = db.prepare('SELECT * FROM schools WHERE id = ?').get(user.school_id);
    if (!school) throw new ApiError(401, 'UNAUTHORIZED', 'School not found.');

    touchDeviceLastSeen(session.device_id);

    req.auth = { user, school, session, claims };
    next();
  } catch (err) {
    next(err);
  }
}

/**
 * Require an authenticated administrator (cookie session).
 * Mutating requests must also carry a matching X-CSRF-Token header.
 * Attaches req.adminAuth { admin, session }.
 */
export function requireAdmin(req, _res, next) {
  try {
    const cookies = parseCookies(req);
    const raw = cookies[ADMIN_COOKIE];
    if (!raw) throw new ApiError(401, 'UNAUTHORIZED', 'Administrator sign-in required.');

    const [sessionId, secret] = raw.split('.');
    if (!sessionId || !secret) throw new ApiError(401, 'UNAUTHORIZED', 'Invalid session.');

    const db = getDb();
    const session = db
      .prepare(`SELECT * FROM sessions WHERE id = ? AND subject_type = 'admin'`)
      .get(sessionId);
    if (!isSessionUsable(session) || session.refresh_hash !== sha256(secret)) {
      throw new ApiError(401, 'SESSION_EXPIRED', 'Session expired. Please sign in again.');
    }

    const admin = db.prepare('SELECT * FROM admins WHERE id = ?').get(session.subject_id);
    if (!admin || admin.status !== 'ACTIVE') {
      throw new ApiError(401, 'ACCOUNT_DISABLED', 'This administrator account is disabled.');
    }

    if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
      const csrf = req.headers['x-csrf-token'];
      const expected = hmacSha256(config.secrets.licenseTokenSecret, `admin-csrf:${sessionId}`);
      if (!csrf || csrf !== expected) {
        throw new ApiError(403, 'CSRF_TOKEN_INVALID', 'Invalid or missing CSRF token.');
      }
    }

    req.adminAuth = { admin, session };
    next();
  } catch (err) {
    next(err);
  }
}

export function setAdminSessionCookie(res, sessionId, secret) {
  const maxAge = config.tokens.adminSessionHours * 3600 * 1000;
  const parts = [
    `${ADMIN_COOKIE}=${encodeURIComponent(`${sessionId}.${secret}`)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Strict',
    `Max-Age=${Math.floor(maxAge / 1000)}`,
  ];
  if (config.isProduction) parts.push('Secure');
  res.setHeader('Set-Cookie', parts.join('; '));
}

export function clearAdminSessionCookie(res) {
  const parts = [`${ADMIN_COOKIE}=`, 'Path=/', 'HttpOnly', 'SameSite=Strict', 'Max-Age=0'];
  if (config.isProduction) parts.push('Secure');
  res.setHeader('Set-Cookie', parts.join('; '));
}

export function adminCsrfToken(sessionId) {
  return hmacSha256(config.secrets.licenseTokenSecret, `admin-csrf:${sessionId}`);
}
