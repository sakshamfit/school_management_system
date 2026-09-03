/**
 * Stable, application-generated device identity.
 *
 * A random ID created at first launch and persisted in the user-data
 * directory. It contains NO hardware fingerprinting (no MAC, no disk ID,
 * no motherboard serial) — only a generated UUID plus the friendly name
 * the customer gives the device (defaults to the OS hostname).
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const os = require('os');

function loadDeviceIdentity(userDataDir) {
  const file = path.join(userDataDir, 'device-identity.json');
  let identity = null;
  try {
    identity = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    identity = null;
  }
  if (!identity || !identity.deviceUid) {
    identity = {
      deviceUid: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
    };
    try {
      fs.mkdirSync(userDataDir, { recursive: true });
      fs.writeFileSync(file, JSON.stringify(identity, null, 2), { mode: 0o600 });
    } catch (err) {
      console.error('[device-identity] persist failed:', err.message);
    }
  }
  return {
    deviceUid: identity.deviceUid,
    defaultName: os.hostname().slice(0, 60) || 'This PC',
    platform: process.platform,
  };
}

module.exports = { loadDeviceIdentity };
