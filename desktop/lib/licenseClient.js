'use strict';

/**
 * License client — the desktop app's only bridge to the central server.
 *
 * - Login / refresh / validate over HTTPS with timeouts + retries.
 * - License state cached locally (AppData/config/license-cache.json) so the
 *   app can operate offline within the server-configured grace period.
 * - The renderer never sees raw tokens; the main process owns them.
 *
 * License states: ACTIVE | EXPIRED | SUSPENDED | REVOKED.
 */

const fs = require('fs');
const https = require('https');
const http = require('http');
const { URL } = require('url');
const logger = require('./logger');
const paths = require('./paths');

const REQUEST_TIMEOUT_MS = 12000;

function readCache() {
  try {
    return JSON.parse(fs.readFileSync(paths.licenseCacheFile(), 'utf8'));
  } catch {
    return null;
  }
}

function writeCache(cache) {
  try {
    fs.mkdirSync(paths.configDir(), { recursive: true });
    fs.writeFileSync(paths.licenseCacheFile(), JSON.stringify(cache, null, 2), { mode: 0o600 });
  } catch (err) {
    logger.error('license cache write failed', { error: err.message });
  }
}

function clearCache() {
  try {
    if (fs.existsSync(paths.licenseCacheFile())) fs.unlinkSync(paths.licenseCacheFile());
  } catch {
    /* ignore */
  }
}

/** Minimal fetch with timeout (Node 18+ global fetch exists; wrap for retries). */
async function request(serverUrl, pathName, { method = 'GET', body, token, timeoutMs = REQUEST_TIMEOUT_MS } = {}) {
  const url = new URL(pathName, serverUrl);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers.Authorization = `Bearer ${token}`;
    const res = await fetch(url.toString(), {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
    let data = null;
    try {
      data = await res.json();
    } catch {
      data = null;
    }
    return { status: res.status, data };
  } catch (err) {
    const e = new Error(
      err.name === 'AbortError'
        ? 'The license server took too long to respond.'
        : 'Could not reach the license server. Check your internet connection.'
    );
    e.code = 'NETWORK';
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

async function withRetry(fn, attempts = 2) {
  let lastErr = null;
  for (let i = 0; i < attempts; i += 1) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (err.code !== 'NETWORK') throw err;
      await new Promise((r) => setTimeout(r, 500 * (i + 1)));
    }
  }
  throw lastErr;
}

class LicenseClient {
  constructor({ serverUrl, appVersion, device }) {
    this.serverUrl = serverUrl;
    this.appVersion = appVersion;
    this.device = device;
  }

  /**
   * Sign in a school user. Resolves with a normalized result:
   * { ok, error?, message?, data? }
   */
  async login({ identifier, password }) {
    const res = await withRetry(() =>
      request(this.serverUrl, '/api/auth/login', {
        method: 'POST',
        body: {
          identifier,
          password,
          device: {
            deviceIdentifier: this.device.deviceIdentifier,
            deviceName: this.device.deviceName,
            osInfo: this.device.osInfo,
            appVersion: this.appVersion,
          },
        },
      })
    );

    if (res.status === 200 && res.data && res.data.accessToken) {
      const cache = {
        school: res.data.school,
        user: res.data.user,
        license: res.data.license,
        policy: res.data.policy,
        support: res.data.support,
        lastVerifiedAt: new Date().toISOString(),
        lastVerifiedOk: true,
      };
      writeCache(cache);
      logger.info('license login ok', { school: res.data.school && res.data.school.schoolCode });
      return { ok: true, data: res.data, cache };
    }

    const code = res.data && res.data.error;
    const message = (res.data && res.data.message) || 'Sign-in failed.';
    logger.warn('license login failed', { code });
    return { ok: false, error: code || 'LOGIN_FAILED', message, raw: res.data };
  }

  async refresh(refreshToken) {
    const res = await request(this.serverUrl, '/api/auth/refresh', {
      method: 'POST',
      body: { refreshToken },
    });
    if (res.status === 200 && res.data && res.data.accessToken) {
      const cache = readCache() || {};
      const updated = {
        ...cache,
        school: res.data.school || cache.school,
        license: res.data.license || cache.license,
        policy: res.data.policy || cache.policy,
        support: res.data.support || cache.support,
        lastVerifiedAt: new Date().toISOString(),
        lastVerifiedOk: true,
      };
      writeCache(updated);
      return { ok: true, data: res.data, cache: updated };
    }
    return { ok: false, error: (res.data && res.data.error) || 'REFRESH_FAILED', raw: res.data };
  }

  /** Periodic license revalidation using the current access token. */
  async validate(accessToken) {
    const res = await request(this.serverUrl, '/api/license/validate', {
      method: 'POST',
      token: accessToken,
    });
    const cache = readCache() || {};
    if (res.status === 200 && res.data && res.data.ok) {
      const updated = {
        ...cache,
        license: res.data.license || cache.license,
        policy: res.data.policy || cache.policy,
        lastVerifiedAt: new Date().toISOString(),
        lastVerifiedOk: true,
      };
      writeCache(updated);
      return { ok: true, data: res.data, cache: updated };
    }

    const code = res.data && res.data.error;
    if (code && code.startsWith('LICENSE_')) {
      const updated = { ...cache, lastVerifiedAt: new Date().toISOString(), lastVerifiedOk: false, license: res.data.license || cache.license };
      writeCache(updated);
      return { ok: false, error: code, message: res.data.message, cache: updated };
    }
    if (res.status === 401) return { ok: false, error: 'INVALID_TOKEN' };
    return { ok: false, error: code || 'VALIDATE_FAILED' };
  }

  async logout(accessToken) {
    try {
      await request(this.serverUrl, '/api/auth/logout', { method: 'POST', token: accessToken, timeoutMs: 5000 });
    } catch {
      /* offline logout is fine */
    }
  }

  /** Public client config (support contact + latest version). */
  async clientConfig() {
    const res = await request(this.serverUrl, '/api/client/config', { timeoutMs: 8000 });
    if (res.status === 200) return res.data;
    return null;
  }

  getCached() {
    return readCache();
  }

  clearCached() {
    clearCache();
  }
}

/**
 * Offline access decision based on the cached license.
 * Returns { allowed, reason, daysSinceVerified, graceDays }.
 */
function offlineAccessDecision(cache, now = Date.now()) {
  if (!cache || !cache.lastVerifiedAt || !cache.license) {
    return { allowed: false, reason: 'NO_CACHE' };
  }
  if (cache.license.effectiveStatus === 'SUSPENDED' || cache.license.effectiveStatus === 'REVOKED') {
    return { allowed: false, reason: cache.license.effectiveStatus };
  }
  const graceDays = cache.policy && Number.isFinite(cache.policy.offlineGraceDays) ? cache.policy.offlineGraceDays : 30;
  const msSince = now - new Date(cache.lastVerifiedAt).getTime();
  const daysSince = msSince / 86400000;

  // License itself expired beyond grace?
  if (cache.license.effectiveStatus === 'EXPIRED') {
    const expiryAge = (now - new Date(cache.license.expiresAt).getTime()) / 86400000;
    if (expiryAge > graceDays) return { allowed: false, reason: 'EXPIRED', daysSinceVerified: daysSince, graceDays };
  }

  if (daysSince > graceDays) {
    return { allowed: false, reason: 'GRACE_EXCEEDED', daysSinceVerified: daysSince, graceDays };
  }
  return { allowed: true, reason: 'WITHIN_GRACE', daysSinceVerified: daysSince, graceDays };
}

module.exports = { LicenseClient, offlineAccessDecision };
