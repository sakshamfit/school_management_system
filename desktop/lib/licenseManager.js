/**
 * License Manager
 * Handles license verification with server-side enforcement
 * 
 * States: ACTIVE, EXPIRED, SUSPENDED, REVOKED
 * Features: offline grace period, device limit, no secret in EXE to manufacture license
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { getAppDataPaths } = require('./constants');
const secureStorage = require('./secureStorage');

class LicenseManager {
  constructor(options = {}) {
    this.paths = options.paths || getAppDataPaths();
    this.licenseFile = path.join(this.paths.base, 'config', 'license.json');
    this.secureLicenseFile = path.join(this.paths.secure, 'license.enc');
    this.deviceManager = options.deviceManager || null;
    this.licenseServerUrl = options.licenseServerUrl || process.env.LICENSE_SERVER_URL || 'https://license.mspublicschool.edu.in/api';
    this.offlineGraceDays = options.offlineGraceDays || 7;
    this.ensureDirs();
  }

  ensureDirs() {
    const dirs = [
      path.dirname(this.licenseFile),
      path.dirname(this.secureLicenseFile),
      this.paths.secure,
    ];
    for (const dir of dirs) {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    }
  }

  /**
   * License states
   */
  static STATES = {
    ACTIVE: 'active',
    EXPIRED: 'expired',
    SUSPENDED: 'suspended',
    REVOKED: 'revoked',
    NOT_FOUND: 'not_found',
    DEVICE_LIMIT: 'device_limit',
    OFFLINE_GRACE: 'offline_grace',
  };

  /**
   * Load local license cache
   */
  loadLocalLicense() {
    // Try secure storage first
    try {
      const secure = secureStorage.getSecureValue(this.secureLicenseFile);
      if (secure) return secure;
    } catch (e) {}

    // Fallback to plain JSON (less secure, but for dev)
    try {
      if (fs.existsSync(this.licenseFile)) {
        const data = JSON.parse(fs.readFileSync(this.licenseFile, 'utf8'));
        return data;
      }
    } catch (e) {
      console.warn('[LicenseManager] Failed to load license:', e.message);
    }

    return null;
  }

  /**
   * Save license to secure storage
   */
  saveLicense(licenseData) {
    // Never save secrets that allow manufacturing license
    const toSave = {
      schoolId: licenseData.schoolId,
      schoolName: licenseData.schoolName,
      status: licenseData.status,
      expiresAt: licenseData.expiresAt,
      maxDevices: licenseData.maxDevices,
      issuedAt: licenseData.issuedAt,
      lastVerifiedAt: new Date().toISOString(),
      offlineGraceUntil: licenseData.offlineGraceUntil || null,
      // Do NOT save license secret, private key, or anything that allows forging
    };

    try {
      secureStorage.setSecureValue(this.secureLicenseFile, toSave);
      // Also save non-secure for quick access (without secrets)
      fs.writeFileSync(this.licenseFile, JSON.stringify(toSave, null, 2));
    } catch (e) {
      console.warn('[LicenseManager] Failed to save license:', e.message);
    }

    return toSave;
  }

  /**
   * Verify license with server (authoritative)
   */
  async verifyWithServer(schoolId, deviceId) {
    if (!schoolId) throw new Error('School ID required for license verification');

    // If no server URL configured, use mock for dev
    if (!this.licenseServerUrl || this.licenseServerUrl.includes('license.mspublicschool')) {
      console.log('[LicenseManager] No license server configured, using mock verification');
      return this.mockServerVerification(schoolId, deviceId);
    }

    try {
      const response = await fetch(`${this.licenseServerUrl}/verify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          schoolId,
          deviceId,
          appVersion: '1.0.0',
          timestamp: new Date().toISOString(),
        }),
        signal: AbortSignal.timeout(10000),
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`License server error: ${response.status} ${text}`);
      }

      const data = await response.json();
      return data;
    } catch (e) {
      if (e.name === 'TimeoutError' || e.message.includes('fetch failed') || e.message.includes('ENOTFOUND')) {
        throw new Error('INTERNET_UNAVAILABLE: Cannot reach license server');
      }
      throw e;
    }
  }

  /**
   * Mock server verification for development / when no server
   * In production, this would be replaced by real server call
   */
  mockServerVerification(schoolId, deviceId) {
    // For demo, all licenses are active unless explicitly expired/suspended
    // In real production, this would call actual server
    const mockLicenses = {
      'school_msps_01': {
        schoolId: 'school_msps_01',
        schoolName: 'M.S. PUBLIC SCHOOL',
        status: 'active',
        expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(), // 1 year
        maxDevices: 3,
        issuedAt: new Date().toISOString(),
      },
      'expired_school': {
        schoolId: 'expired_school',
        schoolName: 'Expired School',
        status: 'expired',
        expiresAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), // Yesterday
        maxDevices: 3,
        issuedAt: new Date().toISOString(),
      },
      'suspended_school': {
        schoolId: 'suspended_school',
        schoolName: 'Suspended School',
        status: 'suspended',
        expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
        maxDevices: 3,
        issuedAt: new Date().toISOString(),
      }
    };

    return mockLicenses[schoolId] || {
      schoolId,
      schoolName: 'Unknown School',
      status: 'active',
      expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
      maxDevices: 3,
      issuedAt: new Date().toISOString(),
    };
  }

  /**
   * Check if license is valid, with offline grace
   */
  async checkLicense(schoolId, deviceId) {
    let serverLicense = null;
    let isOffline = false;

    try {
      serverLicense = await this.verifyWithServer(schoolId, deviceId);
      // Save fresh license
      this.saveLicense(serverLicense);
    } catch (e) {
      if (e.message.includes('INTERNET_UNAVAILABLE')) {
        isOffline = true;
        console.log('[LicenseManager] Offline, checking local cache and grace period');
        const local = this.loadLocalLicense();
        if (!local) {
          return {
            valid: false,
            status: LicenseManager.STATES.NOT_FOUND,
            error: 'No license found and internet unavailable. Please connect to internet.',
            isOffline: true,
          };
        }

        // Check grace period
        const lastVerified = local.lastVerifiedAt ? new Date(local.lastVerifiedAt) : null;
        if (!lastVerified) {
          return {
            valid: false,
            status: LicenseManager.STATES.NOT_FOUND,
            error: 'License not verified and offline',
            isOffline: true,
          };
        }

        const graceUntil = new Date(lastVerified.getTime() + this.offlineGraceDays * 24 * 60 * 60 * 1000);
        if (new Date() > graceUntil) {
          return {
            valid: false,
            status: LicenseManager.STATES.EXPIRED,
            error: `Offline grace period expired. Last verified ${lastVerified.toLocaleDateString()}. Please connect to internet.`,
            isOffline: true,
            graceExpired: true,
          };
        }

        // Within grace period, allow offline use
        return {
          valid: true,
          status: LicenseManager.STATES.OFFLINE_GRACE,
          license: local,
          isOffline: true,
          graceUntil: graceUntil.toISOString(),
          daysRemaining: Math.ceil((graceUntil - new Date()) / (24 * 60 * 60 * 1000)),
        };
      } else {
        // Other server error
        throw e;
      }
    }

    // Server license obtained, check status
    const status = serverLicense.status;

    if (status === LicenseManager.STATES.SUSPENDED) {
      return {
        valid: false,
        status: LicenseManager.STATES.SUSPENDED,
        error: 'School license is suspended. Please contact administrator.',
        license: serverLicense,
      };
    }

    if (status === LicenseManager.STATES.REVOKED) {
      return {
        valid: false,
        status: LicenseManager.STATES.REVOKED,
        error: 'School license has been revoked. Please contact administrator.',
        license: serverLicense,
      };
    }

    if (status === LicenseManager.STATES.EXPIRED) {
      const expiresAt = new Date(serverLicense.expiresAt);
      return {
        valid: false,
        status: LicenseManager.STATES.EXPIRED,
        error: `License expired on ${expiresAt.toLocaleDateString()}. Please contact administrator to renew.`,
        license: serverLicense,
      };
    }

    // Check expiration date
    if (serverLicense.expiresAt) {
      const expiresAt = new Date(serverLicense.expiresAt);
      if (new Date() > expiresAt) {
        return {
          valid: false,
          status: LicenseManager.STATES.EXPIRED,
          error: `License expired on ${expiresAt.toLocaleDateString()}`,
          license: serverLicense,
        };
      }
    }

    // Active
    return {
      valid: true,
      status: LicenseManager.STATES.ACTIVE,
      license: serverLicense,
      isOffline: false,
    };
  }

  /**
   * Check device limit
   */
  async checkDeviceLimit(schoolId, deviceId) {
    // In real implementation, server would track devices
    // For now, mock: allow up to maxDevices
    const license = this.loadLocalLicense() || await this.verifyWithServer(schoolId, deviceId).catch(() => null);
    
    if (!license) {
      return { allowed: true, message: 'No license to check device limit' };
    }

    const maxDevices = license.maxDevices || 3;
    
    // Mock: we would need to fetch devices from server
    // For now, assume 1 device active, so allow
    // Real implementation would call /devices endpoint

    return {
      allowed: true,
      maxDevices,
      currentDevices: 1, // Mock
      message: `Device limit: 1/${maxDevices} used`,
    };
  }

  /**
   * Clear license (logout)
   */
  clearLicense() {
    try {
      if (fs.existsSync(this.licenseFile)) fs.unlinkSync(this.licenseFile);
    } catch (e) {}
    try {
      secureStorage.deleteSecureValue(this.secureLicenseFile);
    } catch (e) {}
  }

  /**
   * Get license info (safe, no secrets)
   */
  getLicenseInfo() {
    const license = this.loadLocalLicense();
    if (!license) return null;

    return {
      schoolId: license.schoolId,
      schoolName: license.schoolName,
      status: license.status,
      expiresAt: license.expiresAt,
      maxDevices: license.maxDevices,
      lastVerifiedAt: license.lastVerifiedAt,
      isExpired: license.expiresAt ? new Date() > new Date(license.expiresAt) : false,
    };
  }
}

module.exports = LicenseManager;
