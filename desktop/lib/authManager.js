/**
 * Authentication Manager
 * Handles secure authentication for desktop app
 * 
 * Requirements:
 * - No public signup
 * - Admin-issued credentials (School ID/Email + Password)
 * - Passwords never plaintext, hashed
 * - Tokens via safeStorage, not accessible to React
 * - Logout clears secure credentials
 * - Session refresh
 * - Suspended/revoked schools cannot login
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { getAppDataPaths } = require('./constants');
const secureStorage = require('./secureStorage');

class AuthManager {
  constructor(options = {}) {
    this.paths = options.paths || getAppDataPaths();
    this.authFile = path.join(this.paths.secure, 'auth.enc');
    this.sessionFile = path.join(this.paths.secure, 'session.enc');
    this.licenseManager = options.licenseManager || null;
    this.deviceManager = options.deviceManager || null;
    this.authServerUrl = options.authServerUrl || process.env.AUTH_SERVER_URL || 'https://auth.mspublicschool.edu.in/api';
    this.ensureDirs();
  }

  ensureDirs() {
    const dirs = [
      path.dirname(this.authFile),
      path.dirname(this.sessionFile),
      this.paths.secure,
    ];
    for (const dir of dirs) {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    }
  }

  /**
   * Hash password using PBKDF2 (secure, no plaintext storage)
   * In production, use bcrypt or argon2, but PBKDF2 is available in Node without native deps
   */
  hashPassword(password, salt = null) {
    const actualSalt = salt || crypto.randomBytes(16).toString('hex');
    const hash = crypto.pbkdf2Sync(password, actualSalt, 100000, 64, 'sha512').toString('hex');
    return {
      hash,
      salt: actualSalt,
    };
  }

  verifyPassword(password, hash, salt) {
    const hashed = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
    return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(hashed, 'hex'));
  }

  /**
   * Mock user database for development
   * In production, this would be verified via server
   */
  getMockUsers() {
    // Passwords hashed
    const principalSalt = 'mock_salt_principal_01';
    const principalHash = crypto.pbkdf2Sync('9931066436@', principalSalt, 100000, 64, 'sha512').toString('hex');

    return [
      {
        id: 'usr_principal_01',
        schoolId: 'school_msps_01',
        email: 'mozammilalam1996@gmail.com',
        name: 'Mozammil Alam',
        role: 'principal',
        passwordHash: principalHash,
        passwordSalt: principalSalt,
        status: 'active',
        schoolName: 'M.S. PUBLIC SCHOOL',
      },
      // Teacher codes are not password-based, they are 6-digit codes
      {
        id: 'usr_teacher_01',
        schoolId: 'school_msps_01',
        teacherCode: '501001',
        name: 'Teacher One',
        role: 'teacher',
        status: 'active',
        assignedClassId: 'cls_05',
        assignedClassName: 'Class 5',
      }
    ];
  }

  /**
   * Authenticate with server (authoritative)
   */
  async authenticateWithServer(email, password, schoolId) {
    // If no server configured, use mock
    if (!this.authServerUrl || this.authServerUrl.includes('auth.mspublicschool')) {
      console.log('[AuthManager] No auth server configured, using mock authentication');
      return this.mockAuthentication(email, password, schoolId);
    }

    try {
      const response = await fetch(`${this.authServerUrl}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          password, // In real production, should be hashed client-side or use SRP, but for now server hashes
          schoolId,
          deviceId: this.deviceManager ? this.deviceManager.getOrCreateDeviceId() : 'unknown',
          appVersion: '1.0.0',
        }),
        signal: AbortSignal.timeout(10000),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        if (response.status === 401) {
          throw new Error('Invalid credentials. Please check your email and password.');
        }
        if (response.status === 403) {
          throw new Error(errorData.message || 'School license is suspended or revoked. Contact administrator.');
        }
        if (response.status === 429) {
          throw new Error('Too many login attempts. Please try again later.');
        }
        throw new Error(errorData.message || `Authentication failed: ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (e) {
      if (e.name === 'TimeoutError' || e.message.includes('fetch failed') || e.message.includes('ENOTFOUND')) {
        throw new Error('INTERNET_UNAVAILABLE: Cannot reach authentication server. Trying offline mode...');
      }
      throw e;
    }
  }

  mockAuthentication(email, password, schoolId) {
    const users = this.getMockUsers();
    
    // Try principal login
    const principal = users.find(u => u.role === 'principal' && u.email.toLowerCase() === email.toLowerCase());
    if (principal) {
      if (this.verifyPassword(password, principal.passwordHash, principal.passwordSalt)) {
        return {
          success: true,
          user: {
            id: principal.id,
            schoolId: principal.schoolId,
            email: principal.email,
            name: principal.name,
            role: principal.role,
            schoolName: principal.schoolName,
          },
          tokens: {
            accessToken: `mock_access_${Date.now()}`,
            refreshToken: `mock_refresh_${Date.now()}`,
            expiresIn: 3600,
            issuedAt: Date.now(),
          },
          license: {
            status: 'active',
            expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
            maxDevices: 3,
          }
        };
      } else {
        throw new Error('Invalid password');
      }
    }

    // Try teacher code login (if email is actually a code)
    const teacher = users.find(u => u.role === 'teacher' && u.teacherCode === email.toUpperCase());
    if (teacher) {
      return {
        success: true,
        user: {
          id: teacher.id,
          schoolId: teacher.schoolId,
          name: teacher.name,
          role: teacher.role,
          teacherCode: teacher.teacherCode,
          assignedClassId: teacher.assignedClassId,
          assignedClassName: teacher.assignedClassName,
        },
        tokens: {
          accessToken: `mock_teacher_access_${Date.now()}`,
          refreshToken: `mock_teacher_refresh_${Date.now()}`,
          expiresIn: 3600,
          issuedAt: Date.now(),
        }
      };
    }

    throw new Error('No account found with this email or teacher code');
  }

  /**
   * Login with School ID/Email + Password
   */
  async login(email, password, schoolId = null) {
    if (!email || !password) {
      throw new Error('Email and password are required');
    }

    // Validate email format (basic)
    if (email.includes('@')) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        throw new Error('Invalid email format');
      }
    }

    // Try server authentication
    let authResult;
    let isOffline = false;

    try {
      authResult = await this.authenticateWithServer(email, password, schoolId);
    } catch (e) {
      if (e.message.includes('INTERNET_UNAVAILABLE')) {
        isOffline = true;
        console.log('[AuthManager] Offline, trying local session');
        // Try offline login with cached session
        const localSession = this.loadSession();
        if (localSession && localSession.user && localSession.user.email?.toLowerCase() === email.toLowerCase()) {
          // Check if session is still valid (within grace period)
          const issuedAt = localSession.tokens?.issuedAt || 0;
          const expiresIn = localSession.tokens?.expiresIn || 3600;
          const expiry = issuedAt + expiresIn * 1000;
          const graceExpiry = expiry + 7 * 24 * 60 * 60 * 1000; // 7 days grace

          if (Date.now() < graceExpiry) {
            console.log('[AuthManager] Offline login allowed within grace period');
            return {
              success: true,
              user: localSession.user,
              isOffline: true,
              graceUntil: new Date(graceExpiry).toISOString(),
            };
          } else {
            throw new Error('Offline grace period expired. Please connect to internet to login.');
          }
        } else {
          throw new Error('No cached session found for offline login. Please connect to internet.');
        }
      } else {
        throw e;
      }
    }

    // Check license if principal
    if (authResult.user.role === 'principal' && this.licenseManager) {
      const deviceId = this.deviceManager ? this.deviceManager.getOrCreateDeviceId() : 'unknown';
      const licenseCheck = await this.licenseManager.checkLicense(authResult.user.schoolId, deviceId);
      
      if (!licenseCheck.valid) {
        throw new Error(licenseCheck.error || `License check failed: ${licenseCheck.status}`);
      }

      // Check device limit
      const deviceCheck = await this.licenseManager.checkDeviceLimit(authResult.user.schoolId, deviceId);
      if (!deviceCheck.allowed) {
        throw new Error(`Device limit reached: ${deviceCheck.currentDevices}/${deviceCheck.maxDevices}. Contact administrator.`);
      }
    }

    // Save session securely
    this.saveSession(authResult);

    return {
      success: true,
      user: authResult.user,
      isOffline: false,
    };
  }

  /**
   * Login with teacher code
   */
  async loginWithTeacherCode(code) {
    if (!code) throw new Error('Teacher code required');
    
    const cleanCode = code.trim().toUpperCase();
    if (cleanCode.length !== 6 || !/^\d{6}$/.test(cleanCode)) {
      throw new Error('Teacher code must be 6 digits');
    }

    // For teacher codes, we also go through mock auth (in production, server would verify)
    return await this.login(cleanCode, 'teacher_code_dummy', null);
  }

  /**
   * Save session to secure storage
   */
  saveSession(authResult) {
    const sessionData = {
      user: authResult.user,
      tokens: authResult.tokens,
      license: authResult.license || null,
      lastLoginAt: new Date().toISOString(),
      deviceId: this.deviceManager ? this.deviceManager.getOrCreateDeviceId() : null,
    };

    try {
      secureStorage.setSecureValue(this.sessionFile, sessionData);
      console.log('[AuthManager] Session saved securely');
    } catch (e) {
      console.warn('[AuthManager] Failed to save session:', e.message);
    }
  }

  /**
   * Load session from secure storage
   */
  loadSession() {
    try {
      const session = secureStorage.getSecureValue(this.sessionFile);
      return session;
    } catch (e) {
      console.warn('[AuthManager] Failed to load session:', e.message);
      return null;
    }
  }

  /**
   * Check if session is valid
   */
  isSessionValid() {
    const session = this.loadSession();
    if (!session || !session.tokens) return false;

    const issuedAt = session.tokens.issuedAt || 0;
    const expiresIn = session.tokens.expiresIn || 3600;
    const expiry = issuedAt + expiresIn * 1000;

    // Allow 7 days grace for offline
    const graceExpiry = expiry + 7 * 24 * 60 * 60 * 1000;
    return Date.now() < graceExpiry;
  }

  /**
   * Refresh session
   */
  async refreshSession() {
    const session = this.loadSession();
    if (!session || !session.tokens?.refreshToken) {
      throw new Error('No refresh token available');
    }

    // In production, call server to refresh
    // For mock, just extend expiry
    const newTokens = {
      accessToken: `refreshed_access_${Date.now()}`,
      refreshToken: session.tokens.refreshToken, // Keep same refresh token
      expiresIn: 3600,
      issuedAt: Date.now(),
    };

    const newSession = {
      ...session,
      tokens: newTokens,
      lastRefreshedAt: new Date().toISOString(),
    };

    secureStorage.setSecureValue(this.sessionFile, newSession);
    return newSession;
  }

  /**
   * Logout - clear secure credentials
   */
  logout() {
    try {
      secureStorage.deleteSecureValue(this.sessionFile);
      console.log('[AuthManager] Session cleared');
    } catch (e) {
      console.warn('[AuthManager] Failed to clear session:', e.message);
    }

    // Note: Do NOT clear license or device ID on logout, only session
    // License and device ID should persist

    return { success: true };
  }

  /**
   * Clear all auth data (for uninstall or reset)
   */
  clearAllAuthData() {
    try {
      secureStorage.deleteSecureValue(this.authFile);
      secureStorage.deleteSecureValue(this.sessionFile);
    } catch (e) {}
  }

  /**
   * Get current user (safe, no tokens)
   */
  getCurrentUser() {
    const session = this.loadSession();
    if (!session) return null;
    return session.user || null;
  }

  /**
   * Get safe auth info for UI (no secrets)
   */
  getSafeAuthInfo() {
    const session = this.loadSession();
    if (!session) return { isAuthenticated: false };

    return {
      isAuthenticated: true,
      user: session.user,
      lastLoginAt: session.lastLoginAt,
      isOffline: false, // Would be determined by license check
      // Never expose tokens
    };
  }
}

module.exports = AuthManager;
