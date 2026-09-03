/**
 * Customer authentication: login / refresh / logout / school profile.
 *
 * - No public signup exists anywhere in this system; administrators create
 *   every school account from the admin panel.
 * - Login errors never reveal whether an email exists.
 * - Refresh tokens are rotated with replay detection (lib/tokens.js).
 * - Access tokens are short-lived; refresh secrets live only in Electron
 *   safeStorage on the device — never in localStorage.
 */

import { Router } from 'express';
import config from '../config.js';
import { getDb } from '../db.js';
import { verifyPassword } from '../lib/crypto.js';
import { createSession, signAccessToken, rotateRefreshToken, revokeSession, TokenError } from '../lib/tokens.js';
import { ok, errors, ApiError } from '../lib/respond.js';
import { vEmail, vString, vOptionalString, assertAllowedKeys } from '../lib/validate.js';
import { audit, AUDIT_ACTIONS } from '../lib/audit.js';
import { clientIp } from '../middleware/auth.js';
import { loginLimiter, refreshLimiter } from '../middleware/ratelimits.js';
import { isLockedOut, recordFailure, recordSuccess } from '../lib/lockout.js';
import { getLatestLicenseForSchool, applyLazyExpiry, publicLicense } from '../services/licenses.js';

const router = Router();

function publicSchool(school) {
  return {
    id: school.id,
    school_code: school.school_code,
    name: school.name,
    contact_name: school.contact_name,
    email: school.email,
    phone: school.phone,
    status: school.status,
  };
}

function publicUser(user) {
  // Never returns password_hash.
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    must_change_password: !!user.must_change_password,
  };
}

function issueSessionPayload({ user, school, sessionId, refreshToken, deviceId }) {
  const accessToken = signAccessToken({
    sessionId,
    subjectType: 'school_user',
    subjectId: user.id,
    schoolId: school.id,
    role: user.role,
    deviceId: deviceId || null,
  });
  const license = applyLazyExpiry(getLatestLicenseForSchool(school.id));
  return {
    access_token: accessToken,
    token_type: 'Bearer',
    expires_in: config.tokens.accessTtlSeconds,
    refresh_token: refreshToken,
    school: publicSchool(school),
    user: publicUser(user),
    license: publicLicense(license),
  };
}

/**
 * POST /auth/login
 * Body: { email, password, school_code?, device_uid? }
 */
router.post('/login', loginLimiter, (req, res, next) => {
  try {
    assertAllowedKeys(req.body, ['email', 'password', 'school_code', 'device_uid']);
    const email = vEmail(req.body.email);
    const password = vString(req.body.password, 'password', { min: 1, max: 200 });
    const schoolCode = vOptionalString(req.body.school_code, 'school_code', { max: 40 });
    const ip = clientIp(req);
    const lockKey = `school:${email}`;

    if (isLockedOut(lockKey)) {
      audit({
        actorType: 'school_user',
        actorLabel: email,
        action: AUDIT_ACTIONS.SCHOOL_LOGIN_FAILED,
        targetType: 'account',
        metadata: { reason: 'account_locked' },
        ip,
      });
      throw new ApiError(429, 'ACCOUNT_LOCKED', 'Account temporarily locked. Please try again later.');
    }

    const db = getDb();
    const user = db.prepare('SELECT * FROM school_users WHERE email = ?').get(email);

    // Uniform failure: never reveal whether the email exists.
    if (!user || !verifyPassword(password, user.password_hash)) {
      recordFailure(lockKey);
      audit({
        actorType: 'school_user',
        actorLabel: email,
        action: AUDIT_ACTIONS.SCHOOL_LOGIN_FAILED,
        targetType: 'account',
        metadata: { reason: 'invalid_credentials' },
        ip,
      });
      throw errors.invalidCredentials();
    }

    if (user.status !== 'ACTIVE') {
      throw errors.forbidden('ACCOUNT_DISABLED', 'This account has been disabled. Contact your administrator.');
    }

    const school = db.prepare('SELECT * FROM schools WHERE id = ?').get(user.school_id);
    if (!school) throw errors.invalidCredentials();
    if (schoolCode && school.school_code.toLowerCase() !== schoolCode.toLowerCase()) {
      recordFailure(lockKey);
      throw errors.invalidCredentials();
    }
    if (school.status === 'SUSPENDED') {
      throw errors.forbidden(
        'SCHOOL_SUSPENDED',
        'This school account is suspended. Please contact your provider.'
      );
    }
    if (school.status === 'ARCHIVED') {
      throw errors.forbidden('SCHOOL_ARCHIVED', 'This school account is archived.');
    }

    recordSuccess(lockKey);
    db.prepare(`UPDATE school_users SET failed_logins = 0, locked_until = NULL WHERE id = ?`).run(user.id);

    const { sessionId, refreshToken } = createSession({
      subjectType: 'school_user',
      subjectId: user.id,
      schoolId: school.id,
      userAgent: req.headers['user-agent'] || '',
      ip,
    });

    audit({
      actorType: 'school_user',
      actorId: user.id,
      actorLabel: user.email,
      action: AUDIT_ACTIONS.SCHOOL_LOGIN,
      targetType: 'school',
      targetId: school.id,
      ip,
    });

    ok(res, issueSessionPayload({ user, school, sessionId, refreshToken }));
  } catch (err) {
    next(err);
  }
});

/**
 * POST /auth/refresh
 * Body: { refresh_token }
 * Rotates the refresh token; replay of an old token revokes the session.
 */
router.post('/refresh', refreshLimiter, (req, res, next) => {
  try {
    assertAllowedKeys(req.body, ['refresh_token']);
    const presented = vString(req.body.refresh_token, 'refresh_token', { min: 10, max: 500 });
    const ip = clientIp(req);

    try {
      const { sessionId, refreshToken, session } = rotateRefreshToken(presented, {
        userAgent: req.headers['user-agent'] || '',
        ip,
      });

      const db = getDb();
      const user = db.prepare('SELECT * FROM school_users WHERE id = ?').get(session.subject_id);
      const school = user ? db.prepare('SELECT * FROM schools WHERE id = ?').get(user.school_id) : null;
      if (!user || !school || user.status !== 'ACTIVE' || school.status !== 'ACTIVE') {
        revokeSession(sessionId);
        throw new ApiError(401, 'SESSION_EXPIRED', 'Session is no longer valid. Please sign in again.');
      }

      const accessToken = signAccessToken({
        sessionId,
        subjectType: 'school_user',
        subjectId: user.id,
        schoolId: school.id,
        role: user.role,
        deviceId: session.device_id,
      });

      ok(res, {
        access_token: accessToken,
        token_type: 'Bearer',
        expires_in: config.tokens.accessTtlSeconds,
        refresh_token: refreshToken,
      });
    } catch (err) {
      if (err instanceof TokenError && err.code === 'REFRESH_REPLAY_DETECTED') {
        audit({
          actorType: 'system',
          actorLabel: 'token-service',
          action: AUDIT_ACTIONS.REFRESH_REPLAY_DETECTED,
          targetType: 'session',
          targetId: err.session?.id || null,
          metadata: { family_id: err.session?.family_id },
          ip,
        });
      }
      throw err;
    }
  } catch (err) {
    next(err);
  }
});

/**
 * POST /auth/logout
 * Body: { refresh_token } — revokes the session. Idempotent.
 */
router.post('/logout', (req, res, next) => {
  try {
    assertAllowedKeys(req.body, ['refresh_token']);
    const presented = vString(req.body.refresh_token, 'refresh_token', { min: 10, max: 500 });
    const [sessionId] = presented.split('.');
    if (sessionId) {
      revokeSession(sessionId);
      audit({
        actorType: 'school_user',
        action: AUDIT_ACTIONS.SESSION_REVOKED,
        targetType: 'session',
        targetId: sessionId,
        ip: clientIp(req),
      });
    }
    ok(res, { revoked: true });
  } catch (err) {
    next(err);
  }
});

export { publicSchool, publicUser, issueSessionPayload };
export default router;
