/**
 * Release metadata feed.
 *
 * GET /releases/latest?channel=stable&current=1.0.0
 * Public metadata only (version, notes, download URL, mandatory flag).
 * The desktop updater consumes this over HTTPS and applies the safe
 * update procedure (backup → verify → install → restart → validate DB).
 */

import { Router } from 'express';
import semverCompare from '../lib/semver.js';
import { getDb } from '../db.js';
import { ok } from '../lib/respond.js';

const router = Router();

router.get('/latest', (req, res) => {
  const channel = ['stable', 'beta'].includes(req.query.channel) ? req.query.channel : 'stable';
  const current = typeof req.query.current === 'string' ? req.query.current : null;

  const release = getDb()
    .prepare(
      `SELECT version, channel, download_url, notes, mandatory, sha256, published_at
       FROM releases
       WHERE status = 'PUBLISHED' AND channel = ?
       ORDER BY published_at DESC, created_at DESC
       LIMIT 1`
    )
    .get(channel);

  if (!release) {
    return ok(res, { update_available: false, channel, release: null });
  }

  const updateAvailable = current ? semverCompare(release.version, current) > 0 : true;

  ok(res, {
    update_available: updateAvailable,
    channel,
    release: {
      version: release.version,
      release_date: release.published_at,
      download_url: release.download_url,
      notes: release.notes,
      mandatory: !!release.mandatory,
      sha256: release.sha256,
    },
    mandatory_update: updateAvailable && !!release.mandatory,
  });
});

export default router;
