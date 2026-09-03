/**
 * GET /health — liveness + dependency check for monitoring.
 * Returns no sensitive configuration.
 */

import { Router } from 'express';
import config from '../config.js';
import { checkIntegrity } from '../db.js';

const router = Router();
const startedAt = Date.now();

router.get('/health', (_req, res) => {
  const dbOk = checkIntegrity();
  res.status(dbOk ? 200 : 503).json({
    status: dbOk ? 'ok' : 'degraded',
    version: config.version,
    db: dbOk ? 'ok' : 'error',
    uptime_seconds: Math.floor((Date.now() - startedAt) / 1000),
    time: new Date().toISOString(),
  });
});

export default router;
