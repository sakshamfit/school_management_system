/**
 * In-memory per-account lockout (second layer of brute-force defense).
 *
 * After MAX_FAILURES consecutive failures for an account identifier,
 * further attempts are rejected for LOCK_MINUTES minutes — regardless
 * of password correctness. Counters reset on a successful sign-in.
 *
 * Deliberately process-local (documented: single control-plane instance).
 */

const MAX_FAILURES = 5;
const LOCK_MINUTES = 15;

const attempts = new Map(); // key -> { failures, lockedUntil }

export function isLockedOut(key) {
  const entry = attempts.get(key);
  if (!entry || !entry.lockedUntil) return false;
  if (entry.lockedUntil > Date.now()) return true;
  attempts.delete(key);
  return false;
}

export function recordFailure(key) {
  const entry = attempts.get(key) || { failures: 0, lockedUntil: 0 };
  entry.failures += 1;
  if (entry.failures >= MAX_FAILURES) {
    entry.lockedUntil = Date.now() + LOCK_MINUTES * 60 * 1000;
    entry.failures = 0;
  }
  attempts.set(key, entry);
}

export function recordSuccess(key) {
  attempts.delete(key);
}

export function lockoutRemainingSeconds(key) {
  const entry = attempts.get(key);
  if (!entry?.lockedUntil) return 0;
  return Math.max(0, Math.ceil((entry.lockedUntil - Date.now()) / 1000));
}

/** Test helper. */
export function _resetLockouts() {
  attempts.clear();
}
