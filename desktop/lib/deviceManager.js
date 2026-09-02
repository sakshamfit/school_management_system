/**
 * Device Manager
 * Generates stable device identifier without invasive hardware fingerprinting
 * 
 * Requirements:
 * - Stable per device/installation
 * - No unnecessary personal hardware info
 * - Not invasive
 * - Works offline
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { getAppDataPaths } = require('./constants');

class DeviceManager {
  constructor(options = {}) {
    this.paths = options.paths || getAppDataPaths();
    this.deviceIdFile = path.join(this.paths.base, 'config', 'device.json');
    this.ensureDir();
  }

  ensureDir() {
    const dir = path.dirname(this.deviceIdFile);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  /**
   * Generate stable device ID
   * Uses: machine-id (if available) + install ID + hostname hash
   * Does NOT collect: MAC address, serial numbers, invasive hardware info
   */
  getOrCreateDeviceId() {
    // Try to load existing
    if (fs.existsSync(this.deviceIdFile)) {
      try {
        const data = JSON.parse(fs.readFileSync(this.deviceIdFile, 'utf8'));
        if (data.deviceId && data.deviceId.length >= 16) {
          return data.deviceId;
        }
      } catch (e) {
        console.warn('[DeviceManager] Failed to load device ID:', e.message);
      }
    }

    // Generate new device ID
    // Use a combination that is stable but not invasive
    // 1. Generate a random install ID (stable per installation)
    const installId = crypto.randomBytes(16).toString('hex');
    
    // 2. Get hostname (not too personal, but helps identify)
    const hostname = os.hostname();
    
    // 3. Get platform (win32, darwin, linux)
    const platform = os.platform();
    
    // 4. Create a hash that is stable but not reversible to hardware
    // We use installId as primary, with hostname/platform as additional entropy
    // This ensures device ID is unique per installation, stable, but not invasive
    const deviceId = crypto.createHash('sha256')
      .update(`${installId}-${hostname}-${platform}-${Date.now()}`)
      .digest('hex')
      .slice(0, 32); // 32 hex chars = 128-bit

    const deviceInfo = {
      deviceId,
      installId,
      deviceName: this.getDeviceName(),
      platform,
      arch: os.arch(),
      hostnameHash: crypto.createHash('sha256').update(hostname).digest('hex').slice(0, 16), // Hashed, not raw
      createdAt: new Date().toISOString(),
      version: 1,
    };

    try {
      fs.writeFileSync(this.deviceIdFile, JSON.stringify(deviceInfo, null, 2), { mode: 0o600 });
      console.log(`[DeviceManager] Created new device ID: ${deviceId.slice(0, 8)}...`);
    } catch (e) {
      console.warn('[DeviceManager] Failed to save device ID:', e.message);
    }

    return deviceId;
  }

  getDeviceInfo() {
    const deviceId = this.getOrCreateDeviceId();
    
    try {
      if (fs.existsSync(this.deviceIdFile)) {
        const data = JSON.parse(fs.readFileSync(this.deviceIdFile, 'utf8'));
        return {
          deviceId: data.deviceId || deviceId,
          deviceName: data.deviceName || this.getDeviceName(),
          platform: data.platform || os.platform(),
          arch: data.arch || os.arch(),
          createdAt: data.createdAt,
        };
      }
    } catch (e) {}

    return {
      deviceId,
      deviceName: this.getDeviceName(),
      platform: os.platform(),
      arch: os.arch(),
      createdAt: new Date().toISOString(),
    };
  }

  getDeviceName() {
    // Friendly device name: e.g., "DESKTOP-ABC123 (Windows)"
    const hostname = os.hostname();
    const platform = os.platform();
    const platformName = platform === 'win32' ? 'Windows' : platform === 'darwin' ? 'macOS' : platform;
    return `${hostname} (${platformName})`.slice(0, 50); // Limit length
  }

  /**
   * Get device ID hash for license server (doesn't send raw ID, sends hash)
   * Actually for license verification we need to send device ID, but we can hash it
   * For privacy, we send a hash of device ID + school ID
   */
  getDeviceHash(schoolId) {
    const deviceId = this.getOrCreateDeviceId();
    if (!schoolId) return crypto.createHash('sha256').update(deviceId).digest('hex').slice(0, 32);
    return crypto.createHash('sha256').update(`${schoolId}-${deviceId}`).digest('hex').slice(0, 32);
  }

  /**
   * Reset device ID (for testing or reinstall)
   */
  resetDeviceId() {
    if (fs.existsSync(this.deviceIdFile)) {
      try {
        fs.unlinkSync(this.deviceIdFile);
      } catch (e) {}
    }
    return this.getOrCreateDeviceId();
  }
}

module.exports = DeviceManager;
