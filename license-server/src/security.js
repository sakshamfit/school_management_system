'use strict';

/**
 * Cryptographic helpers: password hashing (scrypt), opaque tokens,
 * constant-time comparison and a small in-memory rate limiter.
 */

const crypto = require('crypto');

const SCRYPT_PARAMS = { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };
const KEY_LEN = 64;

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(String(password), salt, KEY_LEN, SCRYPT_PARAMS).toString('hex');
  return `scrypt:${salt}:${derived}`;
}

function verifyPassword(password, stored) {
  try {
    if (typeof stored !== 'string') return false;
    const [scheme, salt, expected] = stored.split(':');
    if (scheme !== 'scrypt' || !salt || !expected) return false;
    const derived = crypto.scryptSync(String(password), salt, KEY_LEN, SCRYPT_PARAMS);
    const expectedBuf = Buffer.from(expected, 'hex');
    if (derived.length !== expectedBuf.length) return false;
    return crypto.timingSafeEqual(derived, expectedBuf);
  } catch {
    return false;
  }
}

function generateToken() {
  return crypto.randomBytes(32).toString('base64url');
}

function sha256(value) {
  return crypto.createHash('sha256').update(String(value)).digest('hex');
}

function newId(prefix) {
  return `${prefix}_${crypto.randomBytes(10).toString('hex')}`;
}

function generateLicenseKey() {
  // Readable grouped key, e.g. SMS1-XXXX-XXXX-XXXX
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const group = () =>
    Array.from(crypto.randomBytes(4))
      .map((b) => alphabet[b % alphabet.length])
      .join('');
  return `SMS1-${group()}-${group()}-${group()}`;
}

function generateReadablePassword(length = 14) {
  // Avoid ambiguous characters for humans receiving credentials once.
  const alphabet = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789@#$%';
  const bytes = crypto.randomBytes(length);
  let out = '';
  for (let i = 0; i < length; i += 1) out += alphabet[bytes[i] % alphabet.length];
  return out;
}

/**
 * Fixed-window in-memory rate limiter keyed by an arbitrary string (IP).
 * Deliberately simple: single-node deployments only.
 */
class RateLimiter {
  constructor({ windowMs, max }) {
    this.windowMs = windowMs;
    this.max = max;
    this.hits = new Map();
  }

  allow(key) {
    const now = Date.now();
    let entry = this.hits.get(key);
    if (!entry || now - entry.start > this.windowMs) {
      entry = { start: now, count: 0 };
      this.hits.set(key, entry);
    }
    entry.count += 1;
    if (this.hits.size > 10000) {
      for (const [k, v] of this.hits) {
        if (now - v.start > this.windowMs) this.hits.delete(k);
      }
    }
    return entry.count <= this.max;
  }
}

module.exports = {
  hashPassword,
  verifyPassword,
  generateToken,
  sha256,
  newId,
  generateLicenseKey,
  generateReadablePassword,
  RateLimiter,
};
