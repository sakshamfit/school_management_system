/**
 * Production Control Plane — central configuration.
 *
 * All secrets arrive exclusively through environment variables.
 * Nothing in this file may contain a hard-coded credential.
 *
 * Production safety:
 *  - NODE_ENV=production refuses to boot without explicit, strong secrets.
 *  - Production never falls back to localhost / insecure defaults.
 *  - TLS is mandatory in production (direct TLS files or a trusted proxy).
 */

import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SERVER_ROOT = path.resolve(__dirname, '..');

const env = process.env;
const NODE_ENV = env.NODE_ENV || 'development';
const isProduction = NODE_ENV === 'production';
const isTest = NODE_ENV === 'test';

/** Parse an integer env var with a fallback. */
function int(value, fallback) {
  const n = parseInt(value ?? '', 10);
  return Number.isFinite(n) ? n : fallback;
}

function bool(value, fallback = false) {
  if (value === undefined || value === null || value === '') return fallback;
  return ['1', 'true', 'yes', 'on'].includes(String(value).toLowerCase());
}

const LOCAL_HOSTNAMES = new Set(['localhost', '127.0.0.1', '::1', '0.0.0.0', '[::1]']);

export function isLocalUrl(rawUrl) {
  try {
    const u = new URL(rawUrl);
    return LOCAL_HOSTNAMES.has(u.hostname) || u.hostname.endsWith('.local') || u.hostname.endsWith('.internal');
  } catch {
    return true;
  }
}

const config = {
  nodeEnv: NODE_ENV,
  isProduction,
  isTest,

  server: {
    host: env.HOST || '0.0.0.0',
    port: int(env.PORT, 8080),
    publicBaseUrl: env.PUBLIC_BASE_URL || '',
  },

  tls: {
    certFile: env.TLS_CERT_FILE || '',
    keyFile: env.TLS_KEY_FILE || '',
    trustProxy: bool(env.TRUST_PROXY, false),
  },

  db: {
    // Control-plane database ONLY. Never school operational data.
    path: env.DATABASE_PATH || path.join(SERVER_ROOT, 'data', 'control-plane.db'),
  },

  backup: {
    dir: env.BACKUP_DIR || path.join(SERVER_ROOT, 'backups'),
    keep: int(env.BACKUP_KEEP, 14),
  },

  secrets: {
    // Signs short-lived access tokens + admin CSRF tokens. Server only. Never shipped.
    licenseTokenSecret: env.LICENSE_TOKEN_SECRET || '',
    // One-time bootstrap guard for creating the first administrator.
    adminBootstrapSecret: env.ADMIN_BOOTSTRAP_SECRET || '',
  },

  tokens: {
    accessTtlSeconds: int(env.ACCESS_TOKEN_TTL_SECONDS, 900), // 15 minutes
    refreshTtlDays: int(env.REFRESH_TOKEN_TTL_DAYS, 30),
    adminSessionHours: int(env.ADMIN_SESSION_HOURS, 12),
  },

  licensing: {
    // How long a verified device may operate fully offline after last
    // successful online validation before the app must re-verify.
    offlineGraceHours: int(env.OFFLINE_GRACE_HOURS, 72),
    // "Expiring soon" window used by the admin dashboard.
    expiringSoonDays: int(env.LICENSE_EXPIRING_SOON_DAYS, 30),
  },

  cors: {
    // Comma-separated exact origins allowed to call the API.
    // In development, local dev servers are allowed automatically,
    // plus the sandbox preview host (*.e2b.app) used by Arena.
    origins: (env.CORS_ORIGINS || '')
      .split(',')
      .map(s => s.trim())
      .filter(Boolean),
  },

  paths: {
    serverRoot: SERVER_ROOT,
    adminDist: env.ADMIN_DIST_PATH || path.join(SERVER_ROOT, 'public', 'admin'),
  },

  version: env.APP_VERSION || '1.0.0',
};

/** Development-only fallbacks so a fresh clone runs locally without setup. */
function applyDevelopmentDefaults() {
  if (!config.secrets.licenseTokenSecret) {
    config.secrets.licenseTokenSecret =
      'dev-only-insecure-license-token-secret-change-me-0123456789abcdef';
    config._devSecretWarning = true;
  }
  if (config.cors.origins.length === 0) {
    config.cors.origins = [
      'http://localhost:3000',
      'http://localhost:3001',
      'http://localhost:5173',
      'http://127.0.0.1:3000',
    ];
  }
}

/**
 * Hard production gate. The process MUST NOT start in production
 * with insecure or missing configuration. Returns a list of problems;
 * index.js refuses to boot when the list is non-empty.
 */
export function validateProductionConfig(cfg = config) {
  const problems = [];

  if (!cfg.secrets.licenseTokenSecret) {
    problems.push('LICENSE_TOKEN_SECRET is required.');
  } else if (cfg.secrets.licenseTokenSecret.length < 32) {
    problems.push('LICENSE_TOKEN_SECRET must be at least 32 characters.');
  } else if (cfg.secrets.licenseTokenSecret.startsWith('dev-only')) {
    problems.push('LICENSE_TOKEN_SECRET must not use the development default.');
  }

  if (!cfg.tls.trustProxy && !(cfg.tls.certFile && cfg.tls.keyFile)) {
    problems.push(
      'TLS is mandatory in production: set TLS_CERT_FILE + TLS_KEY_FILE, ' +
        'or run behind a TLS-terminating proxy with TRUST_PROXY=1.'
    );
  }

  if (!cfg.server.publicBaseUrl) {
    problems.push('PUBLIC_BASE_URL is required (e.g. https://api.example.com).');
  } else {
    if (!cfg.server.publicBaseUrl.startsWith('https://')) {
      problems.push('PUBLIC_BASE_URL must use https:// in production.');
    }
    if (isLocalUrl(cfg.server.publicBaseUrl)) {
      problems.push('PUBLIC_BASE_URL must not point to localhost in production.');
    }
  }

  if (!process.env.DATABASE_PATH) {
    problems.push('DATABASE_PATH must be set explicitly in production.');
  }

  if (cfg.cors.origins.length === 0) {
    problems.push('CORS_ORIGINS must list the exact admin/desktop origins allowed.');
  }
  for (const origin of cfg.cors.origins) {
    if (isLocalUrl(origin)) {
      problems.push(`CORS_ORIGINS contains a local origin (${origin}) which is not allowed in production.`);
    }
  }

  return problems;
}

if (!isProduction) {
  applyDevelopmentDefaults();
} else {
  const problems = validateProductionConfig(config);
  if (problems.length > 0) {
    // Fail fast — never run a production control plane with insecure config.
    console.error('');
    console.error('❌ PRODUCTION CONFIGURATION REJECTED — refusing to start:');
    for (const p of problems) console.error(`   • ${p}`);
    console.error('');
    process.exit(78); // EX_CONFIG
  }
}

export default config;
