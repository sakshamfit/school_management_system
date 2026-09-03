/**
 * Admin: system status & configuration checklist.
 *
 * Reports booleans about configuration completeness — never the values
 * of secrets or environment variables.
 */

import { Router } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import config from '../../config.js';
import { getDb, checkIntegrity } from '../../db.js';
import { ok } from '../../lib/respond.js';
import { requireAdmin } from '../../middleware/auth.js';
import { validateProductionConfig } from '../../config.js';

const router = Router();
router.use(requireAdmin);

const startedAt = Date.now();

router.get('/', (_req, res) => {
  let dbSize = 0;
  try {
    dbSize = fs.statSync(config.db.path).size;
  } catch {
    /* in-memory or missing */
  }

  let lastBackup = null;
  try {
    const files = fs
      .readdirSync(config.backup.dir)
      .filter(f => f.endsWith('.db'))
      .map(f => ({ f, m: fs.statSync(path.join(config.backup.dir, f)).mtime }))
      .sort((a, b) => b.m - a.m);
    if (files.length) lastBackup = { file: files[0].f, at: files[0].m.toISOString() };
  } catch {
    /* backup dir may not exist yet */
  }

  const productionChecklist = validateProductionConfig({
    ...config,
    secrets: {
      ...config.secrets,
      licenseTokenSecret: config.secrets.licenseTokenSecret || '',
    },
  });

  ok(res, {
    version: config.version,
    node_env: config.nodeEnv,
    node_version: process.version,
    uptime_seconds: Math.floor((Date.now() - startedAt) / 1000),
    database: {
      integrity_ok: checkIntegrity(),
      size_bytes: dbSize,
      wal_mode: getDb().pragma('journal_mode', { simple: true }),
    },
    backup: { directory_configured: !!config.backup.dir, last_backup: lastBackup },
    tls: {
      direct_tls_configured: !!(config.tls.certFile && config.tls.keyFile),
      trust_proxy: config.tls.trustProxy,
      https_ready: config.isProduction
        ? !!(config.tls.certFile && config.tls.keyFile) || config.tls.trustProxy
        : true,
    },
    secrets: {
      license_token_secret_configured: !!config.secrets.licenseTokenSecret,
      license_token_secret_strong: (config.secrets.licenseTokenSecret || '').length >= 32,
      admin_bootstrap_secret_configured: !!config.secrets.adminBootstrapSecret,
    },
    public_base_url_configured: !!config.server.publicBaseUrl,
    cors_origins_count: config.cors.origins.length,
    production_checklist_errors: config.isProduction ? productionChecklist : [],
    offline_grace_hours: config.licensing.offlineGraceHours,
  });
});

export default router;
