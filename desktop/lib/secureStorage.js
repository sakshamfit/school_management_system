/**
 * Secure Storage Service
 * Uses Electron safeStorage for OS-level encryption (DPAPI on Windows, Keychain on macOS, libsecret on Linux)
 * Fallback to file-based encryption with machine-bound key for non-Electron contexts
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { getAppDataPaths, ENCRYPTION } = require('./constants');

let safeStorage = null;
try {
  // Try to load Electron safeStorage when available
  const electron = require('electron');
  if (electron && electron.safeStorage) {
    safeStorage = electron.safeStorage;
  } else if (electron && electron.app) {
    // In main process, safeStorage is available via electron
    safeStorage = electron.safeStorage;
  }
} catch (e) {
  // Not in Electron context, will use fallback
  safeStorage = null;
}

// For testing/non-electron, allow injection
function setSafeStorageMock(mock) {
  safeStorage = mock;
}

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function getPaths() {
  const paths = getAppDataPaths();
  ensureDir(paths.secure);
  ensureDir(path.dirname(paths.metadataFile));
  ensureDir(path.dirname(paths.tokensFile));
  ensureDir(path.dirname(paths.keyFile));
  return paths;
}

/**
 * Encrypt string using safeStorage if available, else fallback
 */
function encryptString(plainText) {
  if (!plainText) throw new Error('Cannot encrypt empty value');
  
  if (safeStorage && safeStorage.isEncryptionAvailable && safeStorage.isEncryptionAvailable()) {
    try {
      const buffer = safeStorage.encryptString(plainText);
      return {
        encrypted: buffer.toString('base64'),
        method: 'safeStorage',
      };
    } catch (e) {
      console.warn('[SecureStorage] safeStorage encrypt failed, using fallback:', e.message);
    }
  }
  
  // Fallback: use machine-id derived key (not as secure, but better than plaintext)
  // For production, this should only be used in dev/test
  const fallbackKey = getFallbackKey();
  const iv = crypto.randomBytes(ENCRYPTION.ivLength);
  const cipher = crypto.createCipheriv(ENCRYPTION.algorithm, fallbackKey, iv);
  let encrypted = cipher.update(plainText, 'utf8');
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  const authTag = cipher.getAuthTag();
  
  // Format: iv + authTag + ciphertext, base64 encoded
  const combined = Buffer.concat([iv, authTag, encrypted]);
  return {
    encrypted: combined.toString('base64'),
    method: 'fallback',
  };
}

function decryptString(encryptedData) {
  if (!encryptedData) throw new Error('Cannot decrypt empty value');
  
  let payload;
  let method;
  
  if (typeof encryptedData === 'string') {
    // Legacy format: just base64 string, try safeStorage first
    payload = encryptedData;
    method = 'safeStorage';
  } else if (typeof encryptedData === 'object' && encryptedData.encrypted) {
    payload = encryptedData.encrypted;
    method = encryptedData.method || 'safeStorage';
  } else {
    throw new Error('Invalid encrypted data format');
  }
  
  if (method === 'safeStorage' && safeStorage && safeStorage.isEncryptionAvailable && safeStorage.isEncryptionAvailable()) {
    try {
      const buffer = Buffer.from(payload, 'base64');
      const decrypted = safeStorage.decryptString(buffer);
      return decrypted;
    } catch (e) {
      // If safeStorage fails, try fallback method
      if (method === 'safeStorage') {
        // Try fallback decryption
        try {
          return decryptWithFallback(payload);
        } catch (fallbackErr) {
          throw new Error(`Decryption failed: ${e.message}`);
        }
      }
      throw e;
    }
  }
  
  // Fallback decryption
  return decryptWithFallback(payload);
}

function decryptWithFallback(base64Data) {
  const fallbackKey = getFallbackKey();
  const combined = Buffer.from(base64Data, 'base64');
  
  if (combined.length < ENCRYPTION.ivLength + ENCRYPTION.authTagLength) {
    throw new Error('Invalid encrypted data length');
  }
  
  const iv = combined.subarray(0, ENCRYPTION.ivLength);
  const authTag = combined.subarray(ENCRYPTION.ivLength, ENCRYPTION.ivLength + ENCRYPTION.authTagLength);
  const ciphertext = combined.subarray(ENCRYPTION.ivLength + ENCRYPTION.authTagLength);
  
  const decipher = crypto.createDecipheriv(ENCRYPTION.algorithm, fallbackKey, iv);
  decipher.setAuthTag(authTag);
  let decrypted = decipher.update(ciphertext);
  decrypted = Buffer.concat([decrypted, decipher.final()]);
  return decrypted.toString('utf8');
}

// Fallback key derived from machine-specific info (not secure as safeStorage, but avoids plaintext)
let _fallbackKey = null;
function getFallbackKey() {
  if (_fallbackKey) return _fallbackKey;
  
  // In production Electron, safeStorage should be available. Fallback is for dev/test.
  // We derive a key from a file that persists per machine, or from env
  const paths = getAppDataPaths();
  const keyPath = path.join(paths.secure, '.machine_key');
  
  try {
    if (fs.existsSync(keyPath)) {
      const stored = fs.readFileSync(keyPath, 'utf8').trim();
      if (stored) {
        _fallbackKey = Buffer.from(stored, 'hex');
        if (_fallbackKey.length === ENCRYPTION.keyLength) return _fallbackKey;
      }
    }
  } catch (e) {}
  
  // Generate new fallback key
  _fallbackKey = crypto.randomBytes(ENCRYPTION.keyLength);
  try {
    ensureDir(path.dirname(keyPath));
    fs.writeFileSync(keyPath, _fallbackKey.toString('hex'), { mode: 0o600 });
  } catch (e) {
    // Ignore write errors in test env
  }
  return _fallbackKey;
}

/**
 * Securely store a value to encrypted file
 */
function setSecureValue(filePath, value) {
  ensureDir(path.dirname(filePath));
  const json = JSON.stringify(value);
  const encrypted = encryptString(json);
  fs.writeFileSync(filePath, JSON.stringify(encrypted), { mode: 0o600 });
}

function getSecureValue(filePath) {
  if (!fs.existsSync(filePath)) return null;
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    const encryptedObj = JSON.parse(raw);
    const decryptedJson = decryptString(encryptedObj);
    return JSON.parse(decryptedJson);
  } catch (e) {
    console.error(`[SecureStorage] Failed to read secure file ${filePath}:`, e.message);
    return null;
  }
}

function deleteSecureValue(filePath) {
  if (fs.existsSync(filePath)) {
    try {
      fs.unlinkSync(filePath);
    } catch (e) {
      console.warn(`[SecureStorage] Failed to delete ${filePath}:`, e.message);
    }
  }
}

/**
 * Backup encryption key management
 * The backup encryption key is stored securely via safeStorage
 */
function generateBackupKey() {
  return crypto.randomBytes(ENCRYPTION.keyLength);
}

function getOrCreateBackupKey() {
  const paths = getPaths();
  const existing = getSecureValue(paths.keyFile);
  if (existing && existing.key) {
    try {
      const keyBuffer = Buffer.from(existing.key, 'base64');
      if (keyBuffer.length === ENCRYPTION.keyLength) {
        return keyBuffer;
      }
    } catch (e) {
      console.warn('[SecureStorage] Invalid existing backup key, regenerating');
    }
  }
  
  // Generate new key
  const newKey = generateBackupKey();
  const toStore = {
    key: newKey.toString('base64'),
    createdAt: new Date().toISOString(),
    version: 1,
  };
  setSecureValue(paths.keyFile, toStore);
  return newKey;
}

function getBackupKey() {
  const paths = getPaths();
  const stored = getSecureValue(paths.keyFile);
  if (!stored || !stored.key) return null;
  try {
    const keyBuffer = Buffer.from(stored.key, 'base64');
    if (keyBuffer.length !== ENCRYPTION.keyLength) return null;
    return keyBuffer;
  } catch (e) {
    return null;
  }
}

function hasBackupKey() {
  return !!getBackupKey();
}

function deleteBackupKey() {
  const paths = getPaths();
  deleteSecureValue(paths.keyFile);
}

module.exports = {
  encryptString,
  decryptString,
  setSecureValue,
  getSecureValue,
  deleteSecureValue,
  generateBackupKey,
  getOrCreateBackupKey,
  getBackupKey,
  hasBackupKey,
  deleteBackupKey,
  setSafeStorageMock,
  getAppDataPaths: getPaths,
};
