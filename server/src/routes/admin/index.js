/**
 * Admin API router composition.
 */

import { Router } from 'express';
import adminAuth from './auth.js';
import adminSchools from './schools.js';
import adminLicenses, { createLicenseForSchool } from './licenses.js';
import adminDevices from './devices.js';
import adminReleases from './releases.js';
import adminAudit from './audit.js';
import adminDashboard from './dashboard.js';
import adminSystem from './system.js';
import { getDb } from '../../db.js';
import { ok, errors } from '../../lib/respond.js';
import { vInt, assertAllowedKeys } from '../../lib/validate.js';
import { requireAdmin } from '../../middleware/auth.js';
import { publicLicense } from '../../services/licenses.js';

const router = Router();

router.use('/auth', adminAuth);
router.use('/dashboard', adminDashboard);
router.use('/schools', adminSchools);
router.use('/licenses', adminLicenses);
router.use('/devices', adminDevices);
router.use('/releases', adminReleases);
router.use('/audit', adminAudit);
router.use('/system', adminSystem);

// Create a license for a school: POST /admin/api/schools/:id/licenses
router.post('/schools/:id/licenses', requireAdmin, (req, res, next) => {
  try {
    assertAllowedKeys(req.body, ['duration_days', 'max_devices']);
    const durationDays = vInt(req.body.duration_days, 'duration_days', { min: 1, max: 3650 });
    const maxDevices = vInt(req.body.max_devices, 'max_devices', { min: 1, max: 500 });
    const school = getDb().prepare('SELECT * FROM schools WHERE id = ?').get(req.params.id);
    if (!school) throw errors.notFound('School not found.');
    if (school.status === 'ARCHIVED') {
      throw errors.conflict('INVALID_STATE', 'Cannot create a license for an archived school.');
    }
    const license = createLicenseForSchool(req, school.id, { durationDays, maxDevices });
    ok(res, { license: publicLicense(license) }, 201);
  } catch (err) {
    next(err);
  }
});

export default router;
