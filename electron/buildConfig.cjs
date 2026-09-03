/**
 * Desktop build configuration resolution.
 *
 * The production API base URL is injected at BUILD TIME by
 * scripts/write-build-config.mjs (env SMS_API_URL) into
 * electron/build-config.json, which gets packaged into the installer.
 *
 * Rules:
 *  - Packaged builds must point at an https:// control-plane URL and
 *    must never resolve to localhost (release:check enforces this too).
 *  - Unpackaged development defaults to the local control server.
 */

const fs = require('fs');
const path = require('path');

const LOCAL_DEV_URL = 'http://localhost:8080';

function loadBuildConfig() {
  let fromFile = {};
  try {
    fromFile = JSON.parse(
      fs.readFileSync(path.join(__dirname, 'build-config.json'), 'utf8')
    );
  } catch {
    fromFile = {};
  }

  const envUrl = process.env.SMS_API_URL || '';
  return {
    apiBaseUrl: envUrl || fromFile.apiBaseUrl || '',
    updateChannel: process.env.SMS_UPDATE_CHANNEL || fromFile.updateChannel || 'stable',
    supportContact: fromFile.supportContact || '',
  };
}

function resolveApiBaseUrl(isPackaged) {
  const cfg = loadBuildConfig();
  if (cfg.apiBaseUrl) return cfg.apiBaseUrl;
  if (!isPackaged) return LOCAL_DEV_URL;
  return ''; // packaged build with no configured URL — surfacing a config error
}

module.exports = { loadBuildConfig, resolveApiBaseUrl, LOCAL_DEV_URL };
