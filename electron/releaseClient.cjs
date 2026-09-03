/**
 * Release client — consumes the trusted HTTPS release metadata feed.
 *
 * This phase implements the update CHECK (metadata). The download/install
 * pipeline lands with the signed-installer phase and MUST follow the
 * update-safety procedure: safety database backup → verify backup →
 * install → restart → validate database; %LOCALAPPDATA% data is never
 * deleted by an update.
 */

const { app } = require('electron');
const { loadBuildConfig, resolveApiBaseUrl } = require('./buildConfig.cjs');

async function checkForUpdates() {
  const base = resolveApiBaseUrl(app.isPackaged);
  const { updateChannel } = loadBuildConfig();
  if (!base) {
    return { ok: false, code: 'CONFIG_MISSING', message: 'Control-plane URL not configured.' };
  }
  try {
    const res = await fetch(
      `${base}/releases/latest?channel=${encodeURIComponent(updateChannel)}&current=${encodeURIComponent(app.getVersion())}`,
      { signal: AbortSignal.timeout(12000) }
    );
    if (!res.ok) {
      return { ok: false, code: `HTTP_${res.status}`, message: 'Update check failed.' };
    }
    const json = await res.json();
    return { ok: true, ...json };
  } catch {
    return { ok: false, code: 'NETWORK_ERROR', message: 'Could not reach the update service.' };
  }
}

module.exports = { checkForUpdates };
