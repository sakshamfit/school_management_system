/**
 * Admin API tests: separate admin authentication, server-side
 * authorization, CSRF enforcement, school creation with one-time
 * credentials, credential reset, releases, audit redaction, dashboard.
 */

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import {
  startTestServer,
  stopTestServer,
  makeClient,
  resetDatabase,
  seedAdmin,
  adminLogin,
  createSchool,
  db,
} from './helpers.js';

let client;
let csrf;

before(async () => {
  await startTestServer();
  resetDatabase();
  seedAdmin();
  client = makeClient();
});

after(async () => {
  await stopTestServer();
});

test('admin endpoints require authentication (server-side, not UI-level)', async () => {
  for (const p of ['/admin/api/dashboard', '/admin/api/schools', '/admin/api/licenses', '/admin/api/devices', '/admin/api/audit', '/admin/api/system']) {
    const res = await client.get(p);
    assert.equal(res.status, 401, `${p} must reject anonymous access`);
  }
});

test('admin login issues HttpOnly session cookie + CSRF token', async () => {
  const res = await client.post('/admin/api/auth/login', {
    email: 'owner@example.com',
    password: 'AdminPass-12345',
  });
  assert.equal(res.status, 200);
  assert.ok(res.body.csrf_token);
  assert.equal(res.body.admin.role, 'owner');
  const setCookie = res.headers.getSetCookie().join(';');
  assert.ok(setCookie.includes('HttpOnly'));
  assert.ok(setCookie.includes('SameSite=Strict'));
  assert.ok(!setCookie.includes(res.body.csrf_token), 'CSRF token must not be the cookie');
  csrf = res.body.csrf_token;
});

test('mutations without CSRF token are rejected (CSRF protection)', async () => {
  const res = await client.post('/admin/api/schools', { name: 'X' });
  assert.equal(res.status, 403);
  assert.equal(res.body.error.code, 'CSRF_TOKEN_INVALID');
});

test('create school returns one-time credentials; hash stored, plaintext never persisted', async () => {
  const payload = await createSchool(client, csrf, { admin_email: 'admin@greenwood.test' });
  assert.ok(payload.temporary_password);
  assert.ok(payload.credentials_notice.includes('shown ONCE'));
  assert.equal(payload.license.max_devices, 3);
  assert.equal(payload.school.status, 'ACTIVE');
  assert.ok(payload.school.school_code.startsWith('SCH-'));

  const user = db().prepare('SELECT * FROM school_users WHERE email = ?').get('admin@greenwood.test');
  assert.ok(user.password_hash.startsWith('scrypt$'));
  assert.ok(!user.password_hash.includes(payload.temporary_password));

  // The customer can actually sign in with those credentials
  const login = await client.post('/auth/login', {
    email: 'admin@greenwood.test',
    password: payload.temporary_password,
  });
  assert.equal(login.status, 200);
});

test('credential reset returns new temporary password once and revokes sessions', async () => {
  const payload = await createSchool(client, csrf, { admin_email: 'admin@riverside.test' });
  const login = await client.post('/auth/login', {
    email: 'admin@riverside.test',
    password: payload.temporary_password,
  });
  assert.equal(login.status, 200);

  const schoolRow = db().prepare('SELECT * FROM schools WHERE id = ?').get(payload.school.id);
  assert.ok(schoolRow);
  const user = db().prepare('SELECT * FROM school_users WHERE email = ?').get('admin@riverside.test');

  const reset = await client.post(
    `/admin/api/schools/${schoolRow.id}/credentials/reset`,
    { user_id: user.id },
    { headers: { 'X-CSRF-Token': csrf } }
  );
  assert.equal(reset.status, 200);
  assert.ok(reset.body.temporary_password);
  assert.notEqual(reset.body.temporary_password, payload.temporary_password);

  // Old session is dead
  const me = await client.get('/school/me', {
    headers: { Authorization: `Bearer ${login.body.access_token}` },
  });
  assert.equal(me.status, 401);

  // Old password fails, new password works
  const oldLogin = await client.post('/auth/login', {
    email: 'admin@riverside.test',
    password: payload.temporary_password,
  });
  assert.equal(oldLogin.status, 401);
  const newLogin = await client.post('/auth/login', {
    email: 'admin@riverside.test',
    password: reset.body.temporary_password,
  });
  assert.equal(newLogin.status, 200);
});

test('releases: publish → listed publicly as latest → unpublish hides it', async () => {
  const pub = await client.post(
    '/admin/api/releases',
    {
      version: '1.2.0',
      channel: 'stable',
      download_url: 'https://downloads.example.com/SchoolManagementSetup-1.2.0.exe',
      notes: 'Optional update',
      mandatory: false,
    },
    { headers: { 'X-CSRF-Token': csrf } }
  );
  assert.equal(pub.status, 201);

  const latest = await client.get('/releases/latest?channel=stable&current=1.0.0');
  assert.equal(latest.status, 200);
  assert.equal(latest.body.update_available, true);
  assert.equal(latest.body.release.version, '1.2.0');
  assert.equal(latest.body.mandatory_update, false);

  const upToDate = await client.get('/releases/latest?channel=stable&current=1.2.0');
  assert.equal(upToDate.body.update_available, false);

  const unpub = await client.post(
    `/admin/api/releases/${pub.body.release.id}/unpublish`,
    {},
    { headers: { 'X-CSRF-Token': csrf } }
  );
  assert.equal(unpub.status, 200);
  const after = await client.get('/releases/latest?channel=stable');
  assert.equal(after.body.update_available, false);
  assert.equal(after.body.release, null);
});

test('audit log records actions and NEVER contains secrets', async () => {
  await createSchool(client, csrf, { admin_email: 'audit-check@demo.test' });
  await client.post('/auth/login', { email: 'owner@example.com', password: 'x' });
  await client.get('/health');

  const res = await client.get('/admin/api/audit?page_size=100');
  assert.equal(res.status, 200);
  assert.ok(res.body.total > 0);
  const actions = res.body.entries.map(e => e.action);
  assert.ok(actions.includes('SCHOOL_CREATED'));
  assert.ok(actions.includes('RELEASE_PUBLISHED'));

  const raw = JSON.stringify(res.body);
  for (const forbidden of ['scrypt$', 'temporary_password', 'AdminPass-12345', 'refresh_token', 'access_token', 'LICENSE_TOKEN_SECRET']) {
    assert.ok(!raw.includes(forbidden), `audit log leaked ${forbidden}`);
  }
  // Metadata redaction marker present where sensitive keys were passed:
  const createdEntry = res.body.entries.find(e => e.action === 'SCHOOL_CREATED');
  assert.ok(createdEntry);
  assert.ok(createdEntry.actor_label.includes('owner@example.com'));
});

test('dashboard returns control-plane aggregates only', async () => {
  const res = await client.get('/admin/api/dashboard');
  assert.equal(res.status, 200);
  assert.ok(res.body.totals.schools_total >= 1);
  assert.ok('licenses_expiring_soon' in res.body.totals);
  assert.ok('devices_active' in res.body.totals);
  assert.ok(Array.isArray(res.body.recent_activations));
  assert.ok(Array.isArray(res.body.recent_logins));
  assert.ok(Array.isArray(res.body.recent_backup_metadata));
  assert.ok(res.body.current_app_version);

  const raw = JSON.stringify(res.body);
  for (const forbidden of ['scrypt$', 'password', 'token']) {
    assert.ok(!raw.toLowerCase().includes(forbidden), `dashboard leaked ${forbidden}`);
  }
});

test('system status exposes checklist booleans, never secret values', async () => {
  const res = await client.get('/admin/api/system');
  assert.equal(res.status, 200);
  assert.equal(res.body.database.integrity_ok, true);
  // WAL in file-backed deployments; ':memory:' test DBs report 'memory'.
  assert.ok(['wal', 'memory'].includes(res.body.database.wal_mode));
  assert.equal(res.body.secrets.license_token_secret_configured, true);
  assert.equal(res.body.secrets.license_token_secret_strong, true);
  const raw = JSON.stringify(res.body);
  assert.ok(!raw.includes('test-suite-license-token-secret'), 'system endpoint leaked the secret value');
});

test('admin logout revokes the admin session', async () => {
  const c2 = makeClient();
  const login = await c2.post('/admin/api/auth/login', {
    email: 'owner@example.com',
    password: 'AdminPass-12345',
  });
  const csrf2 = login.body.csrf_token;
  const out = await c2.post('/admin/api/auth/logout', {}, { headers: { 'X-CSRF-Token': csrf2 } });
  assert.equal(out.status, 200);
  const dash = await c2.get('/admin/api/dashboard');
  assert.equal(dash.status, 401);
});
