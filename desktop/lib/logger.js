'use strict';

/**
 * Safe file logging.
 *
 * - Logs live under AppData/.../logs/app-YYYY-MM-DD.log
 * - Secrets are redacted before anything is written.
 * - Console mirror is enabled in development only.
 */

const fs = require('fs');
const path = require('path');

const SENSITIVE_KEYS = /password|passwd|secret|token|authorization|credential|apikey|api_key/i;

let logsDir = null;
let devMode = false;

function init({ dir, isDev }) {
  logsDir = dir;
  devMode = !!isDev;
  try {
    fs.mkdirSync(logsDir, { recursive: true });
  } catch {
    /* best effort */
  }
}

function redact(value) {
  if (value === null || value === undefined) return value;
  if (typeof value === 'string') return value;
  if (typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map(redact);
  const out = {};
  for (const [k, v] of Object.entries(value)) {
    if (SENSITIVE_KEYS.test(k)) {
      out[k] = '[REDACTED]';
    } else if (v && typeof v === 'object') {
      out[k] = redact(v);
    } else {
      out[k] = v;
    }
  }
  return out;
}

function logFile() {
  const day = new Date().toISOString().slice(0, 10);
  return path.join(logsDir || '.', `app-${day}.log`);
}

function write(level, message, meta) {
  const line = {
    time: new Date().toISOString(),
    level,
    message,
    ...(meta !== undefined ? { meta: redact(meta) } : {}),
  };
  const text = JSON.stringify(line);
  if (devMode) {
    // eslint-disable-next-line no-console
    console.log(`[desktop:${level}] ${message}`, meta ? redact(meta) : '');
  }
  try {
    fs.appendFileSync(logFile(), `${text}\n`);
  } catch {
    /* never crash because of logging */
  }
}

module.exports = {
  init,
  info: (m, meta) => write('info', m, meta),
  warn: (m, meta) => write('warn', m, meta),
  error: (m, meta) => write('error', m, meta),
  logFilePath: logFile,
};
