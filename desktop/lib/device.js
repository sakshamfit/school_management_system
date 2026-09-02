'use strict';

/**
 * Stable, non-aggressive device identity.
 *
 * A random UUID is generated on first launch and persisted in the app-data
 * config directory. It identifies "this installation of the app on this
 * computer" for license device limits — deliberately NOT a deep hardware
 * fingerprint (per product policy). The OS hostname is included for display
 * purposes only.
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const paths = require('./paths');

let cached = null;

function getDeviceIdentity() {
  if (cached) return cached;

  const file = paths.deviceFile();
  let deviceIdentifier = null;
  let createdAt = null;

  try {
    if (fs.existsSync(file)) {
      const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
      if (parsed && typeof parsed.deviceIdentifier === 'string' && parsed.deviceIdentifier.length >= 16) {
        deviceIdentifier = parsed.deviceIdentifier;
        createdAt = parsed.createdAt;
      }
    }
  } catch {
    deviceIdentifier = null;
  }

  if (!deviceIdentifier) {
    deviceIdentifier = crypto.randomUUID();
    createdAt = new Date().toISOString();
    try {
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, JSON.stringify({ deviceIdentifier, createdAt }, null, 2), {
        mode: 0o600,
      });
    } catch (err) {
      // Keep working in-memory if the file can't be written; activation will
      // simply look like a new device next launch.
    }
  }

  cached = {
    deviceIdentifier,
    deviceName: (os.hostname() || 'DESKTOP').slice(0, 120),
    osInfo: `${process.platform} ${os.release()}`,
  };
  return cached;
}

module.exports = { getDeviceIdentity };
