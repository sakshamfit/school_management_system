/**
 * Minimal, strict request validation helpers.
 * Every public endpoint validates its body before touching the database.
 */

export class ValidationError extends Error {
  constructor(message) {
    super(message);
    this.code = 'VALIDATION_ERROR';
    this.status = 400;
  }
}

export function vString(value, field, { min = 0, max = 500, pattern = null } = {}) {
  if (typeof value !== 'string') throw new ValidationError(`${field} must be a string.`);
  const trimmed = value.trim();
  if (trimmed.length < min) throw new ValidationError(`${field} is required.`);
  if (trimmed.length > max) throw new ValidationError(`${field} is too long (max ${max}).`);
  if (pattern && !pattern.test(trimmed)) throw new ValidationError(`${field} is invalid.`);
  return trimmed;
}

export function vOptionalString(value, field, opts = {}) {
  if (value === undefined || value === null || value === '') return '';
  return vString(value, field, { ...opts, min: 0 });
}

export function vEmail(value, field = 'email') {
  const s = vString(value, field, { min: 1, max: 320 }).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)) {
    throw new ValidationError(`${field} must be a valid email address.`);
  }
  return s;
}

export function vOptionalEmail(value, field = 'email') {
  if (value === undefined || value === null || value === '') return '';
  return vEmail(value, field);
}

export function vInt(value, field, { min = 0, max = Number.MAX_SAFE_INTEGER } = {}) {
  const n = typeof value === 'string' && value !== '' ? Number(value) : value;
  if (!Number.isInteger(n)) throw new ValidationError(`${field} must be an integer.`);
  if (n < min) throw new ValidationError(`${field} must be at least ${min}.`);
  if (n > max) throw new ValidationError(`${field} must be at most ${max}.`);
  return n;
}

export function vEnum(value, field, allowed) {
  const s = vString(value, field, { min: 1, max: 60 });
  if (!allowed.includes(s)) {
    throw new ValidationError(`${field} must be one of: ${allowed.join(', ')}.`);
  }
  return s;
}

export function vBool(value, field) {
  if (typeof value === 'boolean') return value;
  throw new ValidationError(`${field} must be a boolean.`);
}

export function vIsoDate(value, field) {
  const s = vString(value, field, { min: 4, max: 40 });
  if (Number.isNaN(Date.parse(s))) throw new ValidationError(`${field} must be a valid date/time.`);
  return new Date(s).toISOString();
}

export function vUrl(value, field, { mustBeHttps = false } = {}) {
  const s = vString(value, field, { min: 8, max: 2000 });
  let u;
  try {
    u = new URL(s);
  } catch {
    throw new ValidationError(`${field} must be a valid URL.`);
  }
  if (mustBeHttps && u.protocol !== 'https:') {
    throw new ValidationError(`${field} must use https://`);
  }
  if (!['https:', 'http:'].includes(u.protocol)) {
    throw new ValidationError(`${field} must be an http(s) URL.`);
  }
  return s;
}

/** Reject a body that contains fields we never expect (defense in depth). */
export function assertAllowedKeys(body, allowed, context = 'request') {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new ValidationError(`${context} body must be an object.`);
  }
  for (const key of Object.keys(body)) {
    if (!allowed.includes(key)) {
      throw new ValidationError(`Unexpected field '${key}' in ${context}.`);
    }
  }
}
