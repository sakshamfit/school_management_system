'use strict';

/**
 * Central license server configuration.
 *
 * All secrets come from environment variables — NEVER hard-code credentials.
 * See license-server/README.md for the full variable list.
 */

const path = require('path');

const env = process.env.NODE_ENV === 'production' ? 'production' : process.env.NODE_ENV === 'staging' ? 'staging' : 'development';

const config = {
  env,
  port: parseInt(process.env.LICENSE_PORT || '8787', 10),
  host: process.env.LICENSE_HOST || '0.0.0.0',

  // Data directory (database file). Defaults to ./data inside the server folder.
  dataDir: process.env.LICENSE_DATA_DIR || path.join(__dirname, '..', 'data'),

  // HMAC secret used for additional token derivation. Generated randomly per
  // installation when not provided (fine for single-node deployments).
  tokenSecret: process.env.LICENSE_TOKEN_SECRET || '',

  // Session lifetimes
  accessTokenTtlSec: parseInt(process.env.LICENSE_ACCESS_TTL_SEC || String(12 * 3600), 10), // 12h
  refreshTokenTtlSec: parseInt(process.env.LICENSE_REFRESH_TTL_SEC || String(90 * 24 * 3600), 10), // 90d
  adminSessionTtlSec: parseInt(process.env.LICENSE_ADMIN_TTL_SEC || String(8 * 3600), 10), // 8h

  // Rate limiting (auth endpoints)
  rateLimitWindowMs: 15 * 60 * 1000,
  rateLimitMax: 20,

  // Bootstrap administrator account (first run only, when no admin exists).
  bootstrapAdminEmail: process.env.LICENSE_ADMIN_EMAIL || '',
  bootstrapAdminPassword: process.env.LICENSE_ADMIN_PASSWORD || '',

  // Default license policy applied to new licenses (overridable per license).
  defaultOfflineGraceDays: 30,
  defaultRevalidateHours: 24,
  defaultMaxDevices: 3,

  // Public support information served to clients (never secrets).
  support: {
    url: process.env.LICENSE_SUPPORT_URL || 'https://github.com/sakshamfit/school_management_system',
    email: process.env.LICENSE_SUPPORT_EMAIL || 'support@schoolms.example.com',
    phone: process.env.LICENSE_SUPPORT_PHONE || '',
  },
};

module.exports = config;
