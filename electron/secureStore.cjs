/**
 * Encrypted secure store — the ONLY place long-lived secrets may persist.
 *
 * Uses Electron safeStorage (Windows DPAPI / macOS Keychain / system
 * keyring) to encrypt values before they touch the disk. The written file
 * contains ciphertext only; plaintext tokens never reach the filesystem
 * and never go anywhere near localStorage.
 *
 * If OS-level encryption is unavailable, the store degrades to MEMORY-ONLY
 * (nothing is persisted) instead of ever writing plaintext.
 */

const { safeStorage } = require('electron');
const fs = require('fs');
const path = require('path');

class SecureStore {
  constructor(filePath) {
    this.filePath = filePath;
    this.available = false;
    this.memoryOnly = new Map();
    this.data = {};
    try {
      this.available = safeStorage.isEncryptionAvailable();
    } catch {
      this.available = false;
    }
    this._load();
  }

  _load() {
    try {
      if (fs.existsSync(this.filePath)) {
        this.data = JSON.parse(fs.readFileSync(this.filePath, 'utf8'));
      }
    } catch {
      this.data = {};
    }
  }

  _persist() {
    if (!this.available) return; // memory-only mode persists nothing
    try {
      fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
      const tmp = `${this.filePath}.tmp`;
      fs.writeFileSync(tmp, JSON.stringify(this.data), { mode: 0o600 });
      fs.renameSync(tmp, this.filePath);
    } catch (err) {
      console.error('[secure-store] persist failed:', err.message);
    }
  }

  isPersistent() {
    return this.available;
  }

  get(key) {
    if (!this.available) return this.memoryOnly.get(key) || null;
    const blob = this.data[key];
    if (!blob) return null;
    try {
      return safeStorage.decryptString(Buffer.from(blob, 'base64'));
    } catch {
      return null;
    }
  }

  set(key, value) {
    if (!this.available) {
      this.memoryOnly.set(key, String(value));
      return;
    }
    this.data[key] = safeStorage.encryptString(String(value)).toString('base64');
    this._persist();
  }

  delete(key) {
    if (!this.available) {
      this.memoryOnly.delete(key);
      return;
    }
    if (key in this.data) {
      delete this.data[key];
      this._persist();
    }
  }

  /** Remove all stored secrets (logout). App data elsewhere is untouched. */
  clear() {
    this.memoryOnly.clear();
    this.data = {};
    this._persist();
  }
}

module.exports = { SecureStore };
