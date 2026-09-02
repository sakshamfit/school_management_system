'use strict';

/**
 * Secure session/token storage for the desktop app.
 *
 * Uses Electron's safeStorage API, which is backed by the platform credential
 * store (Windows DPAPI / user-account-bound encryption). Raw passwords are
 * never persisted anywhere; only opaque session tokens are stored, encrypted.
 *
 * If OS-level encryption is unavailable, we fall back to an obfuscated file
 * and flag it so the UI can warn — never plaintext tokens.
 */

const fs = require('fs');
const path = require('path');
const paths = require('./paths');
const logger = require('./logger');

const MAGIC = 'SMSSESS1';

function encryptionAvailable() {
  try {
    const { safeStorage } = require('electron');
    return safeStorage && safeStorage.isEncryptionAvailable();
  } catch {
    return false;
  }
}

function obfuscate(buffer) {
  // Lightweight XOR mask so tokens are never stored readable if DPAPI is
  // unavailable. This is obfuscation, not real encryption — flagged in UI.
  const mask = Buffer.from('SchoolMgmtSystemSessionMask_v1');
  const out = Buffer.alloc(buffer.length);
  for (let i = 0; i < buffer.length; i += 1) out[i] = buffer[i] ^ mask[i % mask.length];
  return out;
}

function saveSession(sessionObject) {
  const payload = Buffer.from(JSON.stringify(sessionObject), 'utf8');
  const file = paths.sessionFile();
  fs.mkdirSync(path.dirname(file), { recursive: true });

  if (encryptionAvailable()) {
    const { safeStorage } = require('electron');
    const encrypted = safeStorage.encryptString(payload.toString('base64'));
    fs.writeFileSync(file, Buffer.concat([Buffer.from(MAGIC, 'utf8'), Buffer.from(':enc:', 'utf8'), encrypted]), {
      mode: 0o600,
    });
    return { encrypted: true };
  }

  fs.writeFileSync(file, Buffer.concat([Buffer.from(MAGIC, 'utf8'), Buffer.from(':obf:', 'utf8'), obfuscate(payload)]), {
    mode: 0o600,
  });
  logger.warn('secureStore: OS encryption unavailable — session stored obfuscated');
  return { encrypted: false };
}

function loadSession() {
  const file = paths.sessionFile();
  try {
    if (!fs.existsSync(file)) return null;
    const raw = fs.readFileSync(file);
    const header = raw.slice(0, MAGIC.length).toString('utf8');
    if (header !== MAGIC) return null;

    const rest = raw.slice(MAGIC.length);
    if (rest.slice(0, 5).toString('utf8') === ':enc:') {
      if (!encryptionAvailable()) {
        logger.warn('secureStore: encrypted session found but OS encryption now unavailable');
        return null;
      }
      const { safeStorage } = require('electron');
      const decrypted = safeStorage.decryptString(rest.slice(5));
      return JSON.parse(Buffer.from(decrypted, 'base64').toString('utf8'));
    }
    if (rest.slice(0, 5).toString('utf8') === ':obf:') {
      return JSON.parse(obfuscate(rest.slice(5)).toString('utf8'));
    }
    return null;
  } catch (err) {
    logger.error('secureStore: failed to load session', { error: err.message });
    return null;
  }
}

function clearSession() {
  try {
    const file = paths.sessionFile();
    if (fs.existsSync(file)) fs.unlinkSync(file);
  } catch (err) {
    logger.error('secureStore: failed to clear session', { error: err.message });
  }
}

module.exports = { saveSession, loadSession, clearSession, encryptionAvailable };
