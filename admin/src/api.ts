/**
 * Admin API client — same-origin, cookie session + CSRF header.
 * The session cookie is HttpOnly; this module never sees it.
 * The CSRF token is held in memory + sessionStorage (not localStorage).
 */

const CSRF_KEY = 'sms_admin_csrf';

export function getCsrf(): string | null {
  return sessionStorage.getItem(CSRF_KEY);
}

export function setCsrf(token: string | null) {
  if (token) sessionStorage.setItem(CSRF_KEY, token);
  else sessionStorage.removeItem(CSRF_KEY);
}

export interface ApiErrorShape {
  code: string;
  message: string;
}

export class AdminApiError extends Error {
  code: string;
  status: number;
  constructor(status: number, error: ApiErrorShape) {
    super(error.message);
    this.status = status;
    this.code = error.code;
  }
}

async function request<T = any>(
  method: string,
  path: string,
  body?: unknown
): Promise<T> {
  const headers: Record<string, string> = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const csrf = getCsrf();
  if (csrf && !['GET', 'HEAD'].includes(method)) headers['X-CSRF-Token'] = csrf;

  const res = await fetch(`/admin/api${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
    credentials: 'same-origin',
  });

  let json: any = null;
  try {
    json = await res.json();
  } catch {
    /* empty body */
  }

  if (!res.ok) {
    throw new AdminApiError(res.status, json?.error ?? { code: 'INTERNAL', message: 'Unexpected server error.' });
  }
  return json as T;
}

export const api = {
  get: <T = any>(path: string) => request<T>('GET', path),
  post: <T = any>(path: string, body?: unknown) => request<T>('POST', path, body),
  patch: <T = any>(path: string, body?: unknown) => request<T>('PATCH', path, body),
};

export interface AdminProfile {
  id: string;
  email: string;
  name: string;
  role: 'owner' | 'admin';
  last_login_at: string | null;
}

export async function fetchMe(): Promise<{ admin: AdminProfile; csrf_token: string } | null> {
  try {
    const data = await api.get<{ admin: AdminProfile; csrf_token: string }>('/auth/me');
    setCsrf(data.csrf_token);
    return data;
  } catch {
    return null;
  }
}

export async function login(email: string, password: string) {
  const data = await api.post<{ admin: AdminProfile; csrf_token: string }>('/auth/login', {
    email,
    password,
  });
  setCsrf(data.csrf_token);
  return data;
}

export async function logout() {
  try {
    await api.post('/auth/logout', {});
  } finally {
    setCsrf(null);
  }
}

export function fmtDate(iso?: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function fmtDateOnly(iso?: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString(undefined, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export function daysUntil(iso?: string | null): number | null {
  if (!iso) return null;
  return Math.ceil((new Date(iso).getTime() - Date.now()) / (24 * 3600 * 1000));
}
