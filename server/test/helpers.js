/**
 * Shared test harness: boots the real app on an ephemeral port with an
 * in-memory database, exactly as production code paths do.
 *
 * Environment is configured BEFORE any server module is imported.
 */

process.env.NODE_ENV = 'test';
process.env.DATABASE_PATH = ':memory:';
process.env.LICENSE_TOKEN_SECRET = 'test-suite-license-token-secret-32chars-minimum!';
process.env.CORS_ORIGINS = 'https://admin.example.com';

const { initDb, getDb } = await import('../src/db.js');
const { createApp } = await import('../src/app.js');
const cryptoLib = await import('../src/lib/crypto.js');
const { _resetLockouts } = await import('../src/lib/lockout.js');

initDb(':memory:');

let server = null;
let baseUrl = '';

export async function startTestServer() {
  const app = createApp();
  await new Promise(resolve => {
    server = app.listen(0, '127.0.0.1', resolve);
  });
  baseUrl = `http://127.0.0.1:${server.address().port}`;
  return baseUrl;
}

export async function stopTestServer() {
  if (server) await new Promise(resolve => server.close(resolve));
  server = null;
}

/**
 * Minimal JSON fetch helper with cookie capture (for admin sessions).
 */
export function makeClient() {
  const jar = new Map(); // cookie name -> value
  async function request(method, path, { body, headers = {}, raw = false } = {}) {
    const cookieHeader = [...jar.entries()].map(([k, v]) => `${k}=${v}`).join('; ');
    const res = await fetch(`${baseUrl}${path}`, {
      method,
      headers: {
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(cookieHeader ? { Cookie: cookieHeader } : {}),
        ...headers,
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      redirect: 'manual',
    });
    const setCookies = res.headers.getSetCookie?.() || [];
    for (const sc of setCookies) {
      const [pair] = sc.split(';');
      const idx = pair.indexOf('=');
      const name = pair.slice(0, idx).trim();
      const value = pair.slice(idx + 1).trim();
      if (value === '') jar.delete(name);
      else jar.set(name, value);
    }
    const text = await res.text();
    let json = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      /* non-JSON */
    }
    return raw ? { status: res.status, text, headers: res.headers, json } : { status: res.status, body: json, headers: res.headers };
  }
  return {
    get: (p, opts) => request('GET', p, opts),
    post: (p, body, opts) => request('POST', p, { ...opts, body }),
    patch: (p, body, opts) => request('PATCH', p, { ...opts, body }),
    raw: request,
    cookies: jar,
  };
}

/** Reset DB fully between scenarios. */
export function resetDatabase() {
  const db = getDb();
  db.exec(`
    DELETE FROM audit_logs; DELETE FROM releases; DELETE FROM sessions;
    DELETE FROM devices; DELETE FROM licenses; DELETE FROM school_users;
    DELETE FROM schools; DELETE FROM admins;
  `);
  _resetLockouts();
}

export function db() {
  return getDb();
}

export function hashPassword(pw) {
  return cryptoLib.hashPassword(pw);
}

/** Seed an admin directly (bypasses HTTP bootstrap for setup speed). */
export function seedAdmin({ email = 'owner@example.com', password = 'AdminPass-12345', name = 'Owner' } = {}) {
  const id = cryptoLib.randomId('adm');
  getDb()
    .prepare(
      `INSERT INTO admins (id, email, name, password_hash, role, status, created_at)
       VALUES (?, ?, ?, ?, 'owner', 'ACTIVE', ?)`
    )
    .run(id, email, name, hashPassword(password), new Date().toISOString());
  return { id, email, password, name };
}

/** Log in as admin; returns { session cookie set, csrf_token }. */
export async function adminLogin(client, email = 'owner@example.com', password = 'AdminPass-12345') {
  const res = await client.post('/admin/api/auth/login', { email, password });
  if (res.status !== 200) throw new Error(`admin login failed: ${JSON.stringify(res.body)}`);
  return res.body;
}

/** Create a school via admin API; returns full creation payload incl. temp password. */
export async function createSchool(client, csrf, overrides = {}) {
  const res = await client.post(
    '/admin/api/schools',
    {
      name: 'Demo Public School',
      contact_name: 'Principal Demo',
      email: 'contact@demo-school.test',
      phone: '+91 90000 00000',
      address: 'Demo Road',
      admin_name: 'School Admin',
      admin_email: `admin-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@demo-school.test`,
      license_duration_days: 365,
      max_devices: 3,
      ...overrides,
    },
    { headers: { 'X-CSRF-Token': csrf } }
  );
  if (res.status !== 201) throw new Error(`create school failed: ${JSON.stringify(res.body)}`);
  return res.body;
}

/** Log in as a school customer; returns tokens payload. */
export async function schoolLogin(client, email, password, extra = {}) {
  const res = await client.post('/auth/login', { email, password, ...extra });
  return res;
}
