/**
 * License client — the desktop app's control-plane session manager.
 *
 * Responsibilities:
 *   - Customer login / logout against the production control server
 *   - Refresh-token rotation handling (tokens live ONLY in safeStorage —
 *     access tokens additionally only in process memory)
 *   - Device activation using the stable app-generated device identity
 *   - Periodic online validation + offline grace computation
 *   - Broadcasting sanitized state to the renderer (LicenseGate)
 *
 * Data-safety contract: this module NEVER deletes customer data. The only
 * thing cleared on logout is the stored session credential. License
 * problems change what the UI shows — they never touch school data.
 */

const path = require('path');
const crypto = require('crypto');
const { app, ipcMain, BrowserWindow } = require('electron');
const { SecureStore } = require('./secureStore.cjs');
const { OfflineCache } = require('./offlineCache.cjs');
const { loadDeviceIdentity } = require('./deviceIdentity.cjs');
const { resolveApiBaseUrl, loadBuildConfig } = require('./buildConfig.cjs');

const VALIDATE_INTERVAL_MS = 15 * 60 * 1000; // online re-validation cadence
const TICK_MS = 30 * 1000; // scheduler tick
const REQUEST_TIMEOUT_MS = 15000;

class LicenseClient {
  constructor() {
    this.userDataDir = app.getPath('userData');
    this.apiBaseUrl = resolveApiBaseUrl(app.isPackaged);
    this.buildConfig = loadBuildConfig();
    this.secure = new SecureStore(path.join(this.userDataDir, 'session.secure'));
    this.offline = new OfflineCache(this.userDataDir);
    this.identity = loadDeviceIdentity(this.userDataDir);

    // In-memory only — never persisted.
    this.memory = {
      accessToken: null,
      accessTokenExpiresAt: 0,
      sessionId: null,
      user: null,
      school: null,
      license: null,
      device: null,
      lastNetworkErrorAt: null,
    };

    this.phase = 'CHECKING';
    this.blockReason = null;
    this.refreshInFlight = null;
    this.lastValidateAt = 0;
    this.timer = null;
  }

  /* ------------------------------ HTTP core ------------------------------ */

  async api(method, apiPath, { token, body } = {}) {
    if (!this.apiBaseUrl) {
      const err = new Error('Control-plane URL is not configured in this build.');
      err.code = 'CONFIG_MISSING';
      throw err;
    }
    if (app.isPackaged && !this.apiBaseUrl.startsWith('https://')) {
      const err = new Error('Production control-plane URL must use HTTPS.');
      err.code = 'CONFIG_INSECURE';
      throw err;
    }
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const res = await fetch(`${this.apiBaseUrl}${apiPath}`, {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          'User-Agent': `SMS-Desktop/${app.getVersion()}`,
        },
        body: body !== undefined ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });
      let json = null;
      try {
        json = await res.json();
      } catch {
        json = null;
      }
      if (!res.ok) {
        const err = new Error(json?.error?.message || `Server error (${res.status})`);
        err.code = json?.error?.code || `HTTP_${res.status}`;
        err.status = res.status;
        throw err;
      }
      return json;
    } catch (err) {
      if (err.code && err.status) throw err;
      // Network-level failure (offline / DNS / TLS / timeout)
      const net = new Error('Unable to reach the licensing service.');
      net.code = 'NETWORK_ERROR';
      net.cause = err;
      throw net;
    } finally {
      clearTimeout(timeout);
    }
  }

  /* ---------------------------- Public state ----------------------------- */

  publicState() {
    const grace = this.offline.graceStatus();
    return {
      phase: this.phase,
      blockReason: this.blockReason,
      user: this.memory.user,
      school: this.memory.school ?? this.offline.get()?.school ?? null,
      license: this.memory.license ?? this.offline.get()?.license ?? null,
      device: this.memory.device ?? this.offline.get()?.device ?? null,
      deviceIdentity: { deviceUid: this.identity.deviceUid, defaultName: this.identity.defaultName, platform: this.identity.platform },
      secureStoragePersistent: this.secure.isPersistent(),
      offline: {
        lastValidatedAt: grace.lastValidatedAt,
        graceHours: grace.graceHours,
        remainingHours: Number(grace.remainingHours.toFixed(1)),
        graceExpired: this.offline.get() ? !grace.usable : false,
      },
      serverUrlDisplay: this.apiBaseUrl ? new URL(this.apiBaseUrl).host : 'not configured',
      appVersion: app.getVersion(),
    };
  }

  setPhase(phase, blockReason = null) {
    this.phase = phase;
    this.blockReason = blockReason;
    this.broadcast();
  }

  broadcast() {
    const state = this.publicState();
    for (const win of BrowserWindow.getAllWindows()) {
      try {
        win.webContents.send('control-plane:state', state);
      } catch {
        /* window going away */
      }
    }
  }

  /* --------------------------- Session handling -------------------------- */

  storeSession({ refreshToken, sessionId, user, school, license: licenseInfo }) {
    this.secure.set('refresh_token', refreshToken);
    this.secure.set('session_id', sessionId || '');
    this.memory.user = user || this.memory.user;
    this.memory.school = school || this.memory.school;
    this.memory.license = licenseInfo || this.memory.license;
  }

  clearSession() {
    this.secure.clear();
    this.memory.accessToken = null;
    this.memory.accessTokenExpiresAt = 0;
    this.memory.sessionId = null;
    this.memory.user = null;
    this.memory.school = null;
    this.memory.license = null;
    this.memory.device = null;
  }

  async login({ email, password, schoolCode }) {
    const payload = await this.api('POST', '/auth/login', {
      body: {
        email,
        password,
        ...(schoolCode ? { school_code: schoolCode } : {}),
        device_uid: this.identity.deviceUid,
      },
    });
    const [sessionId] = String(payload.refresh_token).split('.');
    this.storeSession({
      refreshToken: payload.refresh_token,
      sessionId,
      user: payload.user,
      school: payload.school,
      licenseInfo: payload.license,
    });
    this.memory.accessToken = payload.access_token;
    this.memory.accessTokenExpiresAt = Date.now() + (payload.expires_in || 900) * 1000;
    this.memory.sessionId = sessionId;

    // Activate this device immediately after login (idempotent if already active).
    let activation;
    try {
      activation = await this.api('POST', '/devices/activate', {
        token: this.memory.accessToken,
        body: {
          device_uid: this.identity.deviceUid,
          name: this.identity.defaultName,
          platform: this.identity.platform,
          app_version: app.getVersion(),
        },
      });
      this.memory.device = activation.device;
      this.offline.recordValidation({
        validatedAt: new Date().toISOString(),
        graceHours: activation.offline_grace_hours,
        school: payload.school ? { id: payload.school.id, name: payload.school.name, school_code: payload.school.school_code } : null,
        license: activation.license,
        device: activation.device,
      });
    } catch (err) {
      // Device-limit and license failures are surfaced to the UI verbatim —
      // the session stays valid so the customer can resolve the situation.
      this.broadcast();
      return { ok: false, code: err.code || 'ACTIVATION_FAILED', message: err.message, state: this.publicState() };
    }

    await this.validateNow();
    return { ok: true, state: this.publicState() };
  }

  async logout() {
    const refreshToken = this.secure.get('refresh_token');
    if (refreshToken) {
      try {
        await this.api('POST', '/auth/logout', { body: { refresh_token: refreshToken } });
      } catch {
        /* best-effort revocation; session dies regardless */
      }
    }
    // IMPORTANT DATA-SAFETY CONTRACT: only credentials are cleared here.
    // Customer application data (SQLite / Drive / local files) is untouched.
    this.clearSession();
    this.offline.clear();
    this.setPhase('LOGGED_OUT');
  }

  async refreshAccessToken() {
    if (this.refreshInFlight) return this.refreshInFlight;
    this.refreshInFlight = (async () => {
      const refreshToken = this.secure.get('refresh_token');
      if (!refreshToken) throw Object.assign(new Error('No session.'), { code: 'NO_SESSION' });
      const payload = await this.api('POST', '/auth/refresh', { body: { refresh_token: refreshToken } });
      this.memory.accessToken = payload.access_token;
      this.memory.accessTokenExpiresAt = Date.now() + (payload.expires_in || 900) * 1000;
      this.secure.set('refresh_token', payload.refresh_token); // rotated
      return payload.access_token;
    })().finally(() => {
      this.refreshInFlight = null;
    });
    return this.refreshInFlight;
  }

  async ensureAccessToken() {
    if (this.memory.accessToken && this.memory.accessTokenExpiresAt - Date.now() > 60000) {
      return this.memory.accessToken;
    }
    return this.refreshAccessToken();
  }

  /* ------------------------------ Validation ----------------------------- */

  async validateNow() {
    if (!this.secure.get('refresh_token')) {
      this.setPhase('LOGGED_OUT');
      return this.publicState();
    }

    let token;
    try {
      token = await this.ensureAccessToken();
    } catch (err) {
      if (err.code === 'NETWORK_ERROR') {
        return this.handleOffline();
      }
      // Session genuinely dead (revoked, replayed, suspended…)
      this.clearSession();
      this.setPhase('LOGGED_OUT');
      return this.publicState();
    }

    try {
      const result = await this.api('POST', '/license/validate', {
        token,
        body: { device_uid: this.identity.deviceUid, app_version: app.getVersion() },
      });
      this.memory.license = result.license;
      this.memory.device = result.device;
      this.memory.school = result.school;
      this.memory.lastNetworkErrorAt = null;
      this.lastValidateAt = Date.now();

      if (result.status === 'AUTHORIZED') {
        this.offline.recordValidation({
          validatedAt: result.validated_at,
          graceHours: result.offline_grace_hours,
          school: result.school,
          license: result.license,
          device: result.device,
        });
        this.setPhase('AUTHORIZED');
      } else {
        this.setPhase('BLOCKED', result.status);
      }
    } catch (err) {
      if (err.code === 'NETWORK_ERROR') {
        return this.handleOffline();
      }
      if (err.status === 401) {
        this.clearSession();
        this.setPhase('LOGGED_OUT');
      } else {
        this.setPhase('BLOCKED', err.code || 'SERVER_ERROR');
      }
    }
    return this.publicState();
  }

  handleOffline() {
    const grace = this.offline.graceStatus();
    if (!this.offline.get()) {
      // Never been validated online — offline use is impossible for a
      // new/logged-out installation.
      this.setPhase('SERVER_UNAVAILABLE');
    } else if (grace.usable) {
      this.setPhase('OFFLINE_GRACE');
    } else {
      this.setPhase('GRACE_EXPIRED');
    }
    return this.publicState();
  }

  /* ----------------------------- Boot + tick ----------------------------- */

  start() {
    this.timer = setInterval(() => this.tick(), TICK_MS);
    this.tick();
  }

  async tick() {
    const hasSession = !!this.secure.get('refresh_token');
    if (!hasSession) {
      if (this.phase !== 'LOGGED_OUT') this.setPhase('LOGGED_OUT');
      return;
    }
    if (this.memory.accessTokenExpiresAt - Date.now() < 120000) {
      try {
        await this.refreshAccessToken();
      } catch {
        /* validate path below decides the user-visible state */
      }
    }
    if (Date.now() - this.lastValidateAt > VALIDATE_INTERVAL_MS) {
      await this.validateNow();
    }
  }

  /* ---------------------------- Support info ----------------------------- */

  /** Settings → About → Support payload (secrets deliberately excluded). */
  supportInfo() {
    const state = this.publicState();
    const diagnosticsId = crypto
      .createHash('sha256')
      .update(`${this.identity.deviceUid}:${this.buildConfig.apiBaseUrl || 'dev'}`)
      .digest('hex')
      .slice(0, 12)
      .toUpperCase();
    return {
      appVersion: app.getVersion(),
      schoolId: state.school?.school_code || null,
      schoolName: state.school?.name || null,
      licenseStatus: state.license?.status || (state.phase === 'LOGGED_OUT' ? 'NOT SIGNED IN' : 'UNKNOWN'),
      licenseExpiresAt: state.license?.expires_at || null,
      deviceReference: this.identity.deviceUid.slice(0, 13),
      deviceName: this.memory.device?.name || this.identity.defaultName,
      platform: this.identity.platform,
      diagnosticsId,
      serverHost: state.serverUrlDisplay,
      lastValidatedAt: state.offline.lastValidatedAt,
    };
  }

  /* --------------------------- IPC registration --------------------------- */

  registerIpc() {
    ipcMain.handle('control-plane:get-state', () => this.publicState());
    ipcMain.handle('control-plane:login', async (_e, input) => {
      try {
        return await this.login({
          email: String(input?.email || '').trim(),
          password: String(input?.password || ''),
          schoolCode: String(input?.schoolCode || '').trim() || undefined,
        });
      } catch (err) {
        return { ok: false, code: err.code || 'LOGIN_FAILED', message: err.message, state: this.publicState() };
      }
    });
    ipcMain.handle('control-plane:logout', () => this.logout());
    ipcMain.handle('control-plane:validate', () => this.validateNow());
    ipcMain.handle('control-plane:support-info', () => this.supportInfo());
  }
}

module.exports = { LicenseClient };
