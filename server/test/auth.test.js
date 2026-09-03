/**
 * Authentication tests: login, token rotation, replay detection, logout,
 * lockout, and membership checks.
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
} from './helpers.js';

let client;
let adminCsrf;
let school;
let customerEmail;
let customerPassword;

before(async () => {
  await startTestServer();
  resetDatabase();
  seedAdmin();
  client = makeClient();
  adminCsrf = (await adminLogin(client)).csrf_token;
  school = await createSchool(client, adminCsrf);
  customerEmail = school.user.email;
  customerPassword = school.temporary_password;
});

after(async () => {
  await stopTestServer();
});

test('health endpoint responds ok without auth', async () => {
  const res = await client.get('/health');
  assert.equal(res.status, 200);
  assert.equal(res.body.status, 'ok');
  assert.equal(res.body.db, 'ok');
});

test('successful customer login returns tokens and safe profile', async () => {
  const res = await client.post('/auth/login', { email: customerEmail, password: customerPassword });
  assert.equal(res.status, 200);
  assert.ok(res.body.access_token);
  assert.ok(res.body.refresh_token);
  assert.equal(res.body.token_type, 'Bearer');
  assert.equal(res.body.user.email, customerEmail);
  assert.equal(res.body.user.must_change_password, true);
  assert.equal(res.body.school.status, 'ACTIVE');
  assert.ok(res.body.license);
  assert.equal(res.body.license.status, 'ACTIVE');
  // Never leak password material:
  assert.ok(!('password_hash' in res.body.user));
  assert.ok(!('passwordHash' in res.body.user));
  const dump = JSON.stringify(res.body);
  assert.ok(!dump.includes('password_hash'));
});

test('login failure is uniform — email existence is not revealed', async () => {
  const badEmail = await client.post('/auth/login', {
    email: 'nobody@nowhere.test',
    password: 'whatever-12345',
  });
  const badPass = await client.post('/auth/login', {
    email: customerEmail,
    password: 'wrong-password-1',
  });
  assert.equal(badEmail.status, 401);
  assert.equal(badPass.status, 401);
  assert.equal(badEmail.body.error.code, 'INVALID_CREDENTIALS');
  assert.equal(badPass.body.error.code, 'INVALID_CREDENTIALS');
  assert.equal(badEmail.body.error.message, badPass.body.error.message);
});

test('refresh rotates the token and old token cannot be replayed', async () => {
  const login = await client.post('/auth/login', { email: customerEmail, password: customerPassword });
  const first = login.body.refresh_token;

  const refreshed = await client.post('/auth/refresh', { refresh_token: first });
  assert.equal(refreshed.status, 200);
  const second = refreshed.body.refresh_token;
  assert.ok(second);
  assert.notEqual(second, first);

  // Replay of the ORIGINAL token must be rejected and the session revoked.
  const replay = await client.post('/auth/refresh', { refresh_token: first });
  assert.equal(replay.status, 401);
  assert.equal(replay.body.error.code, 'REFRESH_REPLAY_DETECTED');

  // The rotated token is now also revoked (session nuked by replay defense).
  const afterRevoke = await client.post('/auth/refresh', { refresh_token: second });
  assert.equal(afterRevoke.status, 401);
});

test('logout revokes the session; access token and refresh both die', async () => {
  const login = await client.post('/auth/login', { email: customerEmail, password: customerPassword });
  const { access_token, refresh_token } = login.body;

  const out = await client.post('/auth/logout', { refresh_token });
  assert.equal(out.status, 200);

  const me = await client.get('/school/me', {
    headers: { Authorization: `Bearer ${access_token}` },
  });
  assert.equal(me.status, 401);

  const reuse = await client.post('/auth/refresh', { refresh_token });
  assert.equal(reuse.status, 401);
});

test('/school/me requires a valid access token', async () => {
  const noToken = await client.get('/school/me');
  assert.equal(noToken.status, 401);

  const login = await client.post('/auth/login', { email: customerEmail, password: customerPassword });
  const me = await client.get('/school/me', {
    headers: { Authorization: `Bearer ${login.body.access_token}` },
  });
  assert.equal(me.status, 200);
  assert.equal(me.body.school.school_code, school.school.school_code);
  assert.equal(me.body.user.email, customerEmail);
});

test('school_code check (when supplied) must match', async () => {
  const wrongCode = await client.post('/auth/login', {
    email: customerEmail,
    password: customerPassword,
    school_code: 'NOPE-000',
  });
  assert.equal(wrongCode.status, 401);

  const right = await client.post('/auth/login', {
    email: customerEmail,
    password: customerPassword,
    school_code: school.school.school_code,
  });
  assert.equal(right.status, 200);
});

test('repeated failures lock the account temporarily (brute-force defense)', async () => {
  const created = await createSchool(client, adminCsrf, {
    admin_email: 'lockme@demo-school.test',
    name: 'Lockout Test School',
  });
  const email2 = created.user.email;

  for (let i = 0; i < 5; i++) {
    const attempt = await client.post('/auth/login', { email: email2, password: 'definitely-wrong-1' });
    assert.equal(attempt.status, 401);
  }
  // 6th attempt: locked — even the CORRECT password is refused during the window.
  const locked = await client.post('/auth/login', {
    email: email2,
    password: created.temporary_password,
  });
  assert.equal(locked.status, 429);
  assert.equal(locked.body.error.code, 'ACCOUNT_LOCKED');
});
