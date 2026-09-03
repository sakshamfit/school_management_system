/**
 * Admin: release metadata management.
 *
 * GET  /admin/api/releases
 * POST /admin/api/releases            { version, channel, download_url, notes?, mandatory?, sha256? }
 * POST /admin/api/releases/:id/unpublish
 */

import { Router } from 'express';
import { getDb } from '../../db.js';
import { randomId } from '../../lib/crypto.js';
import { ok, errors } from '../../lib/respond.js';
import { vString, vOptionalString, vEnum, vUrl, assertAllowedKeys } from '../../lib/validate.js';
import { audit, AUDIT_ACTIONS } from '../../lib/audit.js';
import { requireAdmin, clientIp } from '../../middleware/auth.js';
import config from '../../config.js';

const router = Router();
router.use(requireAdmin);

const now = () => new Date().toISOString();

function publicRelease(r) {
  return {
    id: r.id,
    version: r.version,
    channel: r.channel,
    download_url: r.download_url,
    notes: r.notes,
    mandatory: !!r.mandatory,
    sha256: r.sha256,
    status: r.status,
    published_at: r.published_at,
  };
}

router.get('/', (_req, res) => {
  const rows = getDb()
    .prepare(`SELECT * FROM releases ORDER BY published_at DESC LIMIT 200`)
    .all();
  ok(res, { releases: rows.map(publicRelease), current_app_version: config.version });
});

router.post('/', (req, res, next) => {
  try {
    assertAllowedKeys(req.body, ['version', 'channel', 'download_url', 'notes', 'mandatory', 'sha256']);
    const version = vString(req.body.version, 'version', {
      min: 3,
      max: 30,
      pattern: /^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/,
    });
    const channel = vEnum(req.body.channel, 'channel', ['stable', 'beta']);
    const downloadUrl = vUrl(req.body.download_url, 'download_url', {
      mustBeHttps: config.isProduction,
    });
    const notes = vOptionalString(req.body.notes, 'notes', { max: 5000 });
    const mandatory = req.body.mandatory === true;
    const sha256 =
      req.body.sha256 !== undefined && req.body.sha256 !== ''
        ? vString(req.body.sha256, 'sha256', { min: 64, max: 64, pattern: /^[0-9a-f]+$/i }).toLowerCase()
        : null;

    const db = getDb();
    if (db.prepare('SELECT 1 FROM releases WHERE version = ? AND channel = ?').get(version, channel)) {
      throw errors.conflict('RELEASE_EXISTS', `Release ${version} (${channel}) already exists.`);
    }

    const id = randomId('rel');
    const nowIso = now();
    db.prepare(
      `INSERT INTO releases (id, version, channel, download_url, notes, mandatory, sha256, status, published_at, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'PUBLISHED', ?, ?)`
    ).run(id, version, channel, downloadUrl, notes || null, mandatory ? 1 : 0, sha256, nowIso, nowIso);

    audit({
      actorType: 'admin',
      actorId: req.adminAuth.admin.id,
      actorLabel: req.adminAuth.admin.email,
      action: AUDIT_ACTIONS.RELEASE_PUBLISHED,
      targetType: 'release',
      targetId: id,
      metadata: { version, channel, mandatory },
      ip: clientIp(req),
    });

    ok(res, { release: publicRelease(db.prepare('SELECT * FROM releases WHERE id = ?').get(id)) }, 201);
  } catch (err) {
    next(err);
  }
});

router.post('/:id/unpublish', (req, res, next) => {
  try {
    const db = getDb();
    const release = db.prepare('SELECT * FROM releases WHERE id = ?').get(req.params.id);
    if (!release) throw errors.notFound('Release not found.');
    db.prepare(`UPDATE releases SET status = 'UNPUBLISHED' WHERE id = ?`).run(release.id);

    audit({
      actorType: 'admin',
      actorId: req.adminAuth.admin.id,
      actorLabel: req.adminAuth.admin.email,
      action: AUDIT_ACTIONS.RELEASE_UNPUBLISHED,
      targetType: 'release',
      targetId: release.id,
      metadata: { version: release.version, channel: release.channel },
      ip: clientIp(req),
    });

    ok(res, { release: publicRelease(db.prepare('SELECT * FROM releases WHERE id = ?').get(release.id)) });
  } catch (err) {
    next(err);
  }
});

export default router;
