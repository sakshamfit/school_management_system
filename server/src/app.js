/**
 * Control-plane HTTP application.
 *
 * Composition order matters: security headers → CORS allowlist → body
 * parsing (strict limits) → API rate limiting → routes → static admin SPA
 * → 404 → sanitized error handler.
 */

import express from 'express';
import helmet from 'helmet';
import path from 'node:path';
import fs from 'node:fs';
import config from './config.js';
import { apiLimiter } from './middleware/ratelimits.js';
import { notFoundHandler, errorHandler } from './middleware/errorhandler.js';
import authRoutes from './routes/auth.js';
import licenseRoutes from './routes/license.js';
import deviceRoutes from './routes/devices.js';
import releaseRoutes from './routes/releases.js';
import healthRoutes from './routes/health.js';
import adminApiRoutes from './routes/admin/index.js';

/**
 * CORS: exact-origin allowlist only (no wildcards in production).
 * The desktop app is not a browser and does not need CORS; the allowlist
 * exists for the separately-hosted admin panel during development, and
 * for any allowed origins in production.
 */
function corsMiddleware(req, res, next) {
  const origin = req.headers.origin;
  const allowed = new Set(config.cors.origins);

  const isDevSandboxOrigin =
    !config.isProduction && typeof origin === 'string' && /^https:\/\/[a-z0-9-]+\.e2b\.app$/i.test(origin);

  if (origin && (allowed.has(origin) || isDevSandboxOrigin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,PUT,DELETE,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization,X-CSRF-Token');
    res.setHeader('Access-Control-Max-Age', '600');
  }
  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }
  next();
}

export function createApp() {
  const app = express();

  app.disable('x-powered-by');
  if (config.tls.trustProxy) {
    app.set('trust proxy', 1);
  }

  app.use(
    helmet({
      contentSecurityPolicy: false, // Admin SPA sets its own; API returns JSON only.
      crossOriginEmbedderPolicy: false,
    })
  );
  // Explicitly safe headers for API consumers.
  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'no-referrer');
    next();
  });

  app.use(corsMiddleware);
  app.use(express.json({ limit: '200kb' }));

  // Health is deliberately unauthenticated for load balancers/monitors.
  app.use('/', healthRoutes);

  // API rate limiting (sits above route-specific stricter limiters).
  app.use('/auth', apiLimiter, authRoutes);
  app.use('/', apiLimiter, licenseRoutes); // /school/me, /license/*
  app.use('/devices', apiLimiter, deviceRoutes);
  app.use('/releases', apiLimiter, releaseRoutes);
  app.use('/admin/api', apiLimiter, adminApiRoutes);

  // Admin SPA (separate React build served same-origin → no CORS needed).
  const adminDist = config.paths.adminDist;
  if (fs.existsSync(path.join(adminDist, 'index.html'))) {
    app.use(
      '/admin',
      express.static(adminDist, {
        index: 'index.html',
        maxAge: '1h',
        setHeaders(res, filePath) {
          if (filePath.endsWith('.html')) {
            res.setHeader('Cache-Control', 'no-store');
            res.setHeader(
              'Content-Security-Policy',
              "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'"
            );
          }
        },
      })
    );
    // SPA fallback for client-side routes (excluding the API namespace).
    app.get(/^\/admin\/(?!api\/).*/, (_req, res) => {
      res.setHeader('Cache-Control', 'no-store');
      res.setHeader(
        'Content-Security-Policy',
        "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'"
      );
      res.sendFile(path.join(adminDist, 'index.html'));
    });
  } else {
    app.get(/^\/admin\/?$/, (_req, res) => {
      res
        .status(503)
        .type('text/plain')
        .send('Admin panel build not found. Run: npm run build:admin');
    });
  }

  app.use('/admin/api', notFoundHandler);
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
