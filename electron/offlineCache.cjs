/**
 * Offline grace cache — the MINIMUM information needed to keep the school
 * working when the internet disappears (and nothing more):
 *
 *   - when the last successful online validation happened
 *   - how long the granted offline grace window is (from the server)
 *   - display snapshots of school / license / device so status screens
 *     can render without a connection
 *
 * Security note: this cache is a policy convenience, not an authorization
 * proof. Tampering with it cannot create or extend a license — every
 * online validation re-authorizes from the server, which is authoritative.
 */

const fs = require('fs');
const path = require('path');

const DEFAULT_GRACE_HOURS = 72;

class OfflineCache {
  constructor(userDataDir) {
    this.file = path.join(userDataDir, 'offline-grant.json');
    this.data = null;
    try {
      this.data = JSON.parse(fs.readFileSync(this.file, 'utf8'));
    } catch {
      this.data = null;
    }
  }

  get() {
    return this.data;
  }

  recordValidation({ validatedAt, graceHours, school, license, device }) {
    this.data = {
      lastValidatedAt: validatedAt || new Date().toISOString(),
      graceHours: graceHours || DEFAULT_GRACE_HOURS,
      school: school || null,
      license: license || null,
      device: device ? { name: device.name, device_uid: device.device_uid, status: device.status } : null,
    };
    try {
      fs.mkdirSync(path.dirname(this.file), { recursive: true });
      fs.writeFileSync(this.file, JSON.stringify(this.data, null, 2), { mode: 0o600 });
    } catch (err) {
      console.error('[offline-cache] persist failed:', err.message);
    }
  }

  /**
   * Returns grace status relative to now.
   *   { usable, remainingHours, elapsedHours, lastValidatedAt, graceHours }
   */
  graceStatus() {
    if (!this.data?.lastValidatedAt) {
      return { usable: false, remainingHours: 0, elapsedHours: Infinity, lastValidatedAt: null, graceHours: DEFAULT_GRACE_HOURS };
    }
    const graceMs = (this.data.graceHours || DEFAULT_GRACE_HOURS) * 3600 * 1000;
    const elapsed = Date.now() - new Date(this.data.lastValidatedAt).getTime();
    const remaining = graceMs - elapsed;
    return {
      usable: remaining > 0,
      remainingHours: Math.max(0, remaining / 3600000),
      elapsedHours: elapsed / 3600000,
      lastValidatedAt: this.data.lastValidatedAt,
      graceHours: this.data.graceHours || DEFAULT_GRACE_HOURS,
    };
  }

  clear() {
    this.data = null;
    try {
      fs.rmSync(this.file, { force: true });
    } catch {
      /* ignore */
    }
  }
}

module.exports = { OfflineCache, DEFAULT_GRACE_HOURS };
