'use strict';

/**
 * School Management System — Central License & Authentication Server
 *
 * Responsibilities:
 *   - School account authentication (no signup; accounts are admin-created)
 *   - License validation (ACTIVE / EXPIRED / SUSPENDED / REVOKED)
 *   - Device activation & limits
 *   - Offline-grace policy distribution
 *   - Administrator control panel (served at /admin)
 *   - Release/version feed for the public website download button
 *
 * This server intentionally has no dependencies beyond express + SQLite so it
 * can run on any small VPS. Privileged secrets live ONLY here — never in the
 * desktop application.
 */

const path = require('path');
const express = require('express');
const config = require('./config');
const { getDb } = require('./db');
const authRoutes = require('./routes/auth');
const { router: adminRoutes, bootstrapAdmin } = require('./routes/admin');

const app = express();

app.disable('x-powered-by');
app.use(express.json({ limit: '256kb' }));

// Baseline security headers.
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Cache-Control', 'no-store');
  next();
});

// Small request logger (no bodies — never log credentials).
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    if (req.path.startsWith('/api/')) {
      console.log(`${req.method} ${req.path} ${res.statusCode} ${Date.now() - start}ms`);
    }
  });
  next();
});

// API routes
app.use('/api', authRoutes);
app.use('/api', adminRoutes);

// Administrator control panel (static SPA)
app.use('/admin', express.static(path.join(__dirname, '..', 'admin'), { index: 'index.html' }));

// Root: minimal public landing pointer.
app.get('/', (req, res) => {
  res
    .type('text/plain')
    .send('School Management System license service. Administrator panel: /admin');
});

// JSON 404 for unknown API routes.
app.use('/api', (req, res) => {
  res.status(404).json({ error: 'NOT_FOUND', message: 'Unknown API endpoint.' });
});

// Central error handler — never leak stack traces.
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error('[server] unhandled error:', err.message);
  if (res.headersSent) return;
  res.status(500).json({ error: 'SERVER_ERROR', message: 'The license service hit a problem. Please try again.' });
});

function start() {
  getDb(); // run migrations
  bootstrapAdmin();

  const server = app.listen(config.port, config.host, () => {
    console.log(`[sms-license-server] listening on http://${config.host}:${config.port} (env=${config.env})`);
  });

  const shutdown = (signal) => {
    console.log(`[sms-license-server] ${signal} received, shutting down…`);
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 3000).unref();
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

if (require.main === module) {
  start();
}

module.exports = { app, start };
