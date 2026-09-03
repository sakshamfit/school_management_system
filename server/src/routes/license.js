/**
 * License endpoints (customer-facing, Bearer auth).
 *
 * GET  /school/me        — school profile + signed-in user
 * GET  /license          — latest license + usage + offline policy
 * POST /license/validate — full online validation handshake:
 *                          validate school → license → device → session
 */

import { Router } from 'express';
import config from '../config.js';
import { getDb } from '../db.js';
import { ok } from '../lib/respond.js';
import { vString, assertAllowedKeys } from '../lib/validate.js';
import { requireSchoolAuth } from '../middleware/auth.js';
import {
  getLatestLicenseForSchool,
  applyLazyExpiry,
  publicLicense,
  resolveAuthorization,
  countActiveDevices,
} from '../services/licenses.js';
import { publicSchool, publicUser } from './auth.js';

const router = Router();

router.get('/school/me', requireSchoolAuth, (req, res) => {
  ok(res, {
    school: publicSchool(req.auth.school),
    user: publicUser(req.auth.user),
  });
});

router.get('/license', requireSchoolAuth, (req, res) => {
  const school = req.auth.school;
  const license = applyLazyExpiry(getLatestLicenseForSchool(school.id));
  const devicesUsed = countActiveDevices(school.id);
  ok(res, {
    school_status: school.status,
    license: publicLicense(license),
    devices: { used: devicesUsed, max: license ? license.max_devices : 0 },
    offline_policy: {
      grace_hours: config.licensing.offlineGraceHours,
      data_safety:
        'Local data is never deleted or locked by licensing. When the offline grace period expires, online verification is required to continue.',
    },
    server_time: new Date().toISOString(),
  });
});

/**
 * POST /license/validate
 * Body: { device_uid }
 * The desktop calls this whenever online (startup + periodic).
 * The response is the authoritative authorization decision; the desktop
 * caches only the minimum needed for the offline grace window.
 */
router.post('/license/validate', requireSchoolAuth, (req, res, next) => {
  try {
    assertAllowedKeys(req.body, ['device_uid', 'app_version']);
    const deviceUid = vString(req.body.device_uid, 'device_uid', { min: 8, max: 120 });

    const db = getDb();
    const school = req.auth.school;
    const license = applyLazyExpiry(getLatestLicenseForSchool(school.id));
    const device = db
      .prepare(`SELECT * FROM devices WHERE school_id = ? AND device_uid = ?`)
      .get(school.id, deviceUid);

    const decision = resolveAuthorization(school, license, device);

    if (device && decision.status === 'AUTHORIZED') {
      db.prepare(`UPDATE devices SET last_seen_at = ?, app_version = COALESCE(?, app_version), updated_at = ? WHERE id = ?`)
        .run(new Date().toISOString(), req.body.app_version ? String(req.body.app_version).slice(0, 40) : null, new Date().toISOString(), device.id);
    }

    ok(res, {
      ...decision,
      validated_at: new Date().toISOString(),
      offline_grace_hours: config.licensing.offlineGraceHours,
      school: { id: school.id, school_code: school.school_code, name: school.name, status: school.status },
      license: publicLicense(license),
      device: device
        ? {
            id: device.id,
            device_uid: device.device_uid,
            name: device.name,
            platform: device.platform,
            app_version: device.app_version,
            status: device.status,
          }
        : null,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
