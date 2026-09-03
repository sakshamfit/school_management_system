/**
 * Administrator authentication — completely separate from school login.
 *
 * POST /admin/api/auth/login   { email, password } → HttpOnly cookie + CSRF token
 * POST /admin/api/auth/logout
 * GET  /admin/api/auth/me
 */

import { Router } from 'express';
import { getDb } from '../../db.js';
import { verifyPassword } from '../../lib/crypto.js';
import { createSession, revokeSession } from '../../lib/tokens.js';
import { ok, errors } from '../../lib/respond.js';
import { vEmail, vString, assertAllowedKeys } from '../../lib/validate.js';
import { audit, AUDIT_ACTIONS } from '../../lib/audit.js';
import {
  clientIp,
  requireAdmin,
  setAdminSessionCookie,
  clearAdminSessionCookie,
  adminCsrfToken,
} from '../../middleware/auth.js';
import { loginLimiter } from '../../middleware/ratelimits.js';
import { isLockedOut, recordFailure, recordSuccess } from '../../lib/lockout.js';

const router = Router();

function publicAdmin(a) {
  return { id: a.id, email: a.email, name: a.name, role: a.role, last_login_at: a.last_login_at };
}

router.post('/login', loginLimiter, (req, res, next) => {
  try {
    assertAllowedKeys(req.body, ['email', 'password']);
    const email = vEmail(req.body.email);
    const password = vString(req.body.password, 'password', { min: 1, max: 200 });
    const ip = clientIp(req);
    const lockKey = `admin:${email}`;

    if (isLockedOut(lockKey)) {
      throw errors.tooMany('Account temporarily locked. Please try again later.');
    }

    const db = getDb();
    const admin = db.prepare('SELECT * FROM admins WHERE email = ?').get(email);
    if (!admin || !verifyPassword(password, admin.password_hash)) {
      recordFailure(lockKey);
      audit({
        actorType: 'admin',
        actorLabel: email,
        action: AUDIT_ACTIONS.ADMIN_LOGIN_FAILED,
        targetType: 'admin_account',
        metadata: { reason: 'invalid_credentials' },
        ip,
      });
      throw errors.invalidCredentials();
    }
    if (admin.status !== 'ACTIVE') {
      throw errors.forbidden('ACCOUNT_DISABLED', 'This administrator account is disabled.');
    }

    recordSuccess(lockKey);

    const { sessionId, refreshToken } = createSession({
      subjectType: 'admin',
      subjectId: admin.id,
      userAgent: req.headers['user-agent'] || '',
      ip,
    });
    const [, secret] = refreshToken.split('.');
    setAdminSessionCookie(res, sessionId, secret);

    db.prepare('UPDATE admins SET last_login_at = ? WHERE id = ?').run(new Date().toISOString(), admin.id);

    audit({
      actorType: 'admin',
      actorId: admin.id,
      actorLabel: admin.email,
      action: AUDIT_ACTIONS.ADMIN_LOGIN,
      targetType: 'admin_account',
      targetId: admin.id,
      ip,
    });

    ok(res, { admin: publicAdmin(admin), csrf_token: adminCsrfToken(sessionId) });
  } catch (err) {
    next(err);
  }
});

router.post('/logout', requireAdmin, (req, res, next) => {
  try {
    revokeSession(req.adminAuth.session.id);
    clearAdminSessionCookie(res);
    audit({
      actorType: 'admin',
      actorId: req.adminAuth.admin.id,
      actorLabel: req.adminAuth.admin.email,
      action: AUDIT_ACTIONS.ADMIN_LOGOUT,
      targetType: 'admin_account',
      targetId: req.adminAuth.admin.id,
      ip: clientIp(req),
    });
    ok(res, { logged_out: true });
  } catch (err) {
    next(err);
  }
});

router.get('/me', requireAdmin, (req, res) => {
  ok(res, {
    admin: publicAdmin(req.adminAuth.admin),
    csrf_token: adminCsrfToken(req.adminAuth.session.id),
  });
});

export default router;
