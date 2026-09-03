/**
 * Cryptography helpers — passwords, tokens, identifiers.
 *
 * Password hashing: scrypt with per-credential random salt
 * (node:crypto built-in — production-grade KDF, no external secret).
 * Format: scrypt$N$r$p$salt_hex$hash_hex
 *
 * Never log or return any value produced or consumed here.
 */

import crypto from 'node:crypto';

const SCRYPT_N = 16384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const KEY_LEN = 64;

export function randomId(prefix = '') {
  const id = crypto.randomUUID();
  return prefix ? `${prefix}_${id}` : id;
}

export function randomToken(bytes = 32) {
  return crypto.randomBytes(bytes).toString('base64url');
}

export function sha256(value) {
  return crypto.createHash('sha256').update(String(value)).digest('hex');
}

export function hmacSha256(secret, value) {
  return crypto.createHmac('sha256', secret).update(String(value)).digest('base64url');
}

/** Hash a plaintext password with scrypt. */
export function hashPassword(plaintext) {
  const salt = crypto.randomBytes(16);
  const derived = crypto.scryptSync(String(plaintext), salt, KEY_LEN, {
    N: SCRYPT_N,
    r: SCRYPT_R,
    p: SCRYPT_P,
  });
  return `scrypt$${SCRYPT_N}$${SCRYPT_R}$${SCRYPT_P}$${salt.toString('hex')}$${derived.toString('hex')}`;
}

/** Constant-time verification of a plaintext password against a stored hash. */
export function verifyPassword(plaintext, stored) {
  try {
    const [scheme, n, r, p, saltHex, hashHex] = String(stored).split('$');
    if (scheme !== 'scrypt') return false;
    const salt = Buffer.from(saltHex, 'hex');
    const expected = Buffer.from(hashHex, 'hex');
    const actual = crypto.scryptSync(String(plaintext), salt, expected.length, {
      N: Number(n),
      r: Number(r),
      p: Number(p),
    });
    return crypto.timingSafeEqual(expected, actual);
  } catch {
    return false;
  }
}

/**
 * Generate a human-transcribable temporary password.
 * Shown ONCE to the administrator at creation/reset time, then only its
 * scrypt hash is stored. Never logged.
 */
export function generateTemporaryPassword() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  const pick = n =>
    Array.from(crypto.randomBytes(n)).map(b => alphabet[b % alphabet.length]).join('');
  return `${pick(4)}-${pick(4)}-${pick(4)}`;
}

/** Public license reference like SMS-7K2P-9Q4D-MZ8R. Not a secret. */
export function generateLicenseKey() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const group = () =>
    Array.from(crypto.randomBytes(4)).map(b => alphabet[b % alphabet.length]).join('');
  return `SMS-${group()}-${group()}-${group()}`;
}

/**
 * Generate a human-friendly unique school code like SCH-4821.
 * Retries against the uniqueness check provided by the caller.
 */
export function generateSchoolCode(exists) {
  for (let i = 0; i < 50; i++) {
    const code = `SCH-${crypto.randomInt(1000, 9999)}`;
    if (!exists(code)) return code;
  }
  // Fall back to a longer code if unusually collision-heavy.
  return `SCH-${Date.now().toString(36).toUpperCase()}`;
}
