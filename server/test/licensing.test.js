/**
 * End-to-end licensing lifecycle simulation (mirrors the §31 E2E plan at
 * API level):
 *
 *   admin creates school (3 devices) → PC1 login + activate → PC2 login +
 *   activate → PC3 login + activate (limit OK) → PC4 → DEVICE_LIMIT_REACHED
 *   → admin deactivates PC1 → PC1 validation = DEVICE_DEACTIVATED
 *   → license expires → LICENSE_EXPIRED → suspended → LICENSE_SUSPENDED
 *   → reactivated → AUTHORIZED (expired+suspended → extend → AUTHORIZED)
 *   → revoked → LICENSE_REVOKED
 *
 * Data-safety invariant: no license state ever deletes or locks local data —
 * the server answers authorization only; the desktop's offline policy owns
 * the customer-side experience.
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
let school;
let email;
let password;

async function login() {
  const res = await client.post('/auth/login', { email, password });
  assert.equal(res.status, 200, `login failed: ${JSON.stringify(res.body)}`);
  return res.body;
}

function authed(token) {
  return { Authorization: `Bearer ${token}` };
}

before(async () => {
  await startTestServer();
  resetDatabase();
  seedAdmin();
  client = makeClient();
  csrf = (await adminLogin(client)).csrf_token;
  school = await createSchool(client, csrf, {
    admin_email: 'principal@sunrise-school.test',
    max_devices: 3,
    license_duration_days: 365,
  });
  email = school.user.email;
  password = school.temporary_password;
});

after(async () => {
  await stopTestServer();
});

test('device activation up to the license limit, then hard stop', async () => {
  // PC1, PC2, PC3 activate fine (max_devices = 3)
  for (const n of [1, 2, 3]) {
    const t = await login();
    const act = await client.post(
      '/devices/activate',
      { device_uid: `stable-device-uid-pc${n}`, name: `Office PC ${n}`, platform: 'win32', app_version: '1.0.0' },
      { headers: authed(t.access_token) }
    );
    assert.equal(act.status, 201, JSON.stringify(act.body));
    assert.equal(act.body.status, 'DEVICE_ACTIVATED');
  }

  // PC4 must be rejected with the exact product message
  const t4 = await login();
  const blocked = await client.post(
    '/devices/activate',
    { device_uid: 'stable-device-uid-pc4', name: 'Library PC', platform: 'win32' },
    { headers: authed(t4.access_token) }
  );
  assert.equal(blocked.status, 409);
  assert.equal(blocked.body.error.code, 'DEVICE_LIMIT_REACHED');
  assert.ok(blocked.body.error.message.includes('Device limit reached.'));
  assert.ok(blocked.body.error.message.includes('Contact your administrator'));
});

test('school can list its own devices', async () => {
  const t = await login();
  const list = await client.get('/devices', { headers: authed(t.access_token) });
  assert.equal(list.status, 200);
  assert.equal(list.body.devices.length, 3);
  assert.ok(list.body.devices.every(d => d.status === 'ACTIVE'));
});

test('admin deactivates PC1 → that device fails validation, others stay AUTHORIZED', async () => {
  const devices = db().prepare(`SELECT * FROM devices`).all();
  const pc1 = devices.find(d => d.device_uid === 'stable-device-uid-pc1');

  const before = await client.get(`/admin/api/devices?school_id=${school.school.id}`);
  assert.equal(before.status, 200);
  assert.equal(before.body.devices.length, 3);

  const dec = await client.post(
    `/admin/api/devices/${pc1.id}/deactivate`,
    {},
    { headers: { 'X-CSRF-Token': csrf } }
  );
  assert.equal(dec.status, 200);
  assert.equal(dec.body.device.status, 'DEACTIVATED');

  const t1 = await login();
  const v1 = await client.post(
    '/license/validate',
    { device_uid: 'stable-device-uid-pc1' },
    { headers: authed(t1.access_token) }
  );
  assert.equal(v1.status, 200);
  assert.equal(v1.body.status, 'DEVICE_DEACTIVATED');

  const v2 = await client.post(
    '/license/validate',
    { device_uid: 'stable-device-uid-pc2' },
    { headers: authed(t1.access_token) }
  );
  assert.equal(v2.body.status, 'AUTHORIZED');

  // Deactivation frees a slot → PC4 can now activate
  const t4 = await login();
  const act4 = await client.post(
    '/devices/activate',
    { device_uid: 'stable-device-uid-pc4', name: 'Library PC', platform: 'win32' },
    { headers: authed(t4.access_token) }
  );
  assert.equal(act4.status, 201);
});

test('license expiry → expiry response (data never deleted/locked by design)', async () => {
  const t = await login();
  const ok = await client.post(
    '/license/validate',
    { device_uid: 'stable-device-uid-pc2' },
    { headers: authed(t.access_token) }
  );
  assert.equal(ok.body.status, 'AUTHORIZED');

  // Time-travel: push expiry into the past; lazy transition should flip it.
  db().prepare(`UPDATE licenses SET expires_at = ? WHERE school_id = ?`)
    .run(new Date(Date.now() - 1000).toISOString(), school.school.id);

  const expired = await client.post(
    '/license/validate',
    { device_uid: 'stable-device-uid-pc2' },
    { headers: authed(t.access_token) }
  );
  assert.equal(expired.status, 200);
  assert.equal(expired.body.status, 'LICENSE_EXPIRED');
  assert.equal(expired.body.license.status, 'EXPIRED');

  const stored = db().prepare(`SELECT status FROM licenses WHERE school_id = ?`).get(school.school.id);
  assert.equal(stored.status, 'EXPIRED');
});

test('license extension after expiry restores AUTHORIZED', async () => {
  const license = db().prepare(`SELECT * FROM licenses WHERE school_id = ?`).get(school.school.id);
  const ext = await client.post(
    `/admin/api/licenses/${license.id}/extend`,
    { days: 30 },
    { headers: { 'X-CSRF-Token': csrf } }
  );
  assert.equal(ext.status, 200);
  assert.equal(ext.body.license.status, 'ACTIVE');

  const t = await login();
  const v = await client.post(
    '/license/validate',
    { device_uid: 'stable-device-uid-pc2' },
    { headers: authed(t.access_token) }
  );
  assert.equal(v.body.status, 'AUTHORIZED');
});

test('suspend → LICENSE_SUSPENDED → reactivate → AUTHORIZED', async () => {
  const license = db().prepare(`SELECT * FROM licenses WHERE school_id = ?`).get(school.school.id);

  const sus = await client.post(
    `/admin/api/licenses/${license.id}/suspend`,
    {},
    { headers: { 'X-CSRF-Token': csrf } }
  );
  assert.equal(sus.status, 200);

  // Suspension revokes sessions → a fresh login is required
  const t = await login();
  const v = await client.post(
    '/license/validate',
    { device_uid: 'stable-device-uid-pc2' },
    { headers: authed(t.access_token) }
  );
  assert.equal(v.body.status, 'LICENSE_SUSPENDED');

  const rea = await client.post(
    `/admin/api/licenses/${license.id}/reactivate`,
    {},
    { headers: { 'X-CSRF-Token': csrf } }
  );
  assert.equal(rea.status, 200);
  assert.equal(rea.body.license.status, 'ACTIVE');

  const t2 = await login();
  const v2 = await client.post(
    '/license/validate',
    { device_uid: 'stable-device-uid-pc2' },
    { headers: authed(t2.access_token) }
  );
  assert.equal(v2.body.status, 'AUTHORIZED');
});

test('revoke → LICENSE_REVOKED and sessions are revoked', async () => {
  const license = db().prepare(`SELECT * FROM licenses WHERE school_id = ?`).get(school.school.id);
  const t = await login();

  const rev = await client.post(
    `/admin/api/licenses/${license.id}/revoke`,
    {},
    { headers: { 'X-CSRF-Token': csrf } }
  );
  assert.equal(rev.status, 200);
  assert.equal(rev.body.license.status, 'REVOKED');

  // Old access token dies with session revocation
  const stale = await client.post(
    '/license/validate',
    { device_uid: 'stable-device-uid-pc2' },
    { headers: authed(t.access_token) }
  );
  assert.equal(stale.status, 401);

  // Fresh login still works (account exists) but validation says REVOKED
  const t2 = await login();
  const v = await client.post(
    '/license/validate',
    { device_uid: 'stable-device-uid-pc2' },
    { headers: authed(t2.access_token) }
  );
  assert.equal(v.body.status, 'LICENSE_REVOKED');
});

test('school suspension blocks customer login entirely', async () => {
  const sus = await client.post(
    `/admin/api/schools/${school.school.id}/suspend`,
    {},
    { headers: { 'X-CSRF-Token': csrf } }
  );
  assert.equal(sus.status, 200);

  const attempt = await client.post('/auth/login', { email, password });
  assert.equal(attempt.status, 403);
  assert.equal(attempt.body.error.code, 'SCHOOL_SUSPENDED');

  const rea = await client.post(
    `/admin/api/schools/${school.school.id}/reactivate`,
    {},
    { headers: { 'X-CSRF-Token': csrf } }
  );
  assert.equal(rea.status, 200);
  const okAgain = await client.post('/auth/login', { email, password });
  assert.equal(okAgain.status, 200);
});

test('device backup metadata endpoint stores metadata only', async () => {
  const device = db().prepare(`SELECT * FROM devices WHERE device_uid = 'stable-device-uid-pc2'`).get();
  const t = await login();
  const res = await client.post(
    `/devices/${device.id}/backup-status`,
    { drive_connected: true, last_backup_at: new Date().toISOString(), status: 'SUCCESS' },
    { headers: authed(t.access_token) }
  );
  assert.equal(res.status, 200);
  const stored = db().prepare(`SELECT * FROM devices WHERE id = ?`).get(device.id);
  assert.equal(stored.drive_connected, 1);
  assert.equal(stored.last_backup_status, 'SUCCESS');
});
