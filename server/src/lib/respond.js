/**
 * Consistent API response helpers.
 * Errors always look like: { error: { code, message } }
 * Success payloads are plain objects wrapped in { data } only where it
 * simplifies clients; most return their resource object directly.
 */

export class ApiError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export const errors = {
  badRequest: msg => new ApiError(400, 'VALIDATION_ERROR', msg),
  unauthorized: (msg = 'Authentication required.') => new ApiError(401, 'UNAUTHORIZED', msg),
  invalidCredentials: () => new ApiError(401, 'INVALID_CREDENTIALS', 'Invalid email or password.'),
  forbidden: (code, msg) => new ApiError(403, code, msg),
  notFound: (msg = 'Resource not found.') => new ApiError(404, 'NOT_FOUND', msg),
  conflict: (code, msg) => new ApiError(409, code, msg),
  tooMany: (msg = 'Too many requests. Please try again later.') =>
    new ApiError(429, 'RATE_LIMITED', msg),
  internal: () => new ApiError(500, 'INTERNAL', 'Unexpected server error.'),
};

export function ok(res, payload, status = 200) {
  res.status(status).json(payload);
}
