'use strict';

/**
 * Integration tests for the license server. Boots the app on an ephemeral
 * port against a throwaway data dir, then exercises the full flow:
 * admin bootstrap → school creation → login → license validation →
 * device limit → expiry/suspension/revocation → offline policy.
 *
 * Run: npm test   (from license-server/)
 */

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sms-license-test-'));
process.env.LICENSE_DATA_DIR = dataDir;
process.env.LICENSE_ADMIN_EMAIL = 'root-admin@test.local';
process.env.LICENSE_ADMIN_PASSWORD = 'RootAdminPass!123';
process.env.LICENSE_PORT = '0';

const { app, start } = require('../src/index');
const { getDb, closeDb } = require('../src/db');
const { nowIso } = require('../src/licenseService');

let baseUrl = '';
let adminToken = '';
let passed = 0;

async function api(path, { method = 'GET', body, token } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${baseUrl}/api${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  let data = null;
  try { data = await res.json(); } catch { /* ignore */ }
  return { status: res.status, data };
}

function ok(name) {
  passed += 1;
  console.log(`  ✓ ${name}`);
}

async function main() {
  // Boot server on ephemeral port.
  await new Promise((resolve) => {
    getDb();
    require('../src/routes/admin').bootstrapAdmin();
    const server = app.listen(0, '127.0.0.1', () => {
      baseUrl = `http://127.0.0.1:${server.address().port}`;
      resolve();
    });
  });
  console.log(`License server test instance: ${baseUrl}\n`);

  // -- Health ----------------------------------------------------------------
  const health = await api('/health');
  assert.strictEqual(health.status, 200);
  assert.strictEqual(health.data.ok, true);
  ok('health endpoint responds');

  // -- Admin login ------------------------------------------------------------
  const badLogin = await api('/admin/login', { method: 'POST', body: { email: 'root-admin@test.local', password: 'wrong' } });
  assert.strictEqual(badLogin.status, 401);
  ok('admin rejects wrong password');

  const adminLogin = await api('/admin/login', { method: 'POST', body: { email: 'root-admin@test.local', password: 'RootAdminPass!123' } });
  assert.strictEqual(adminLogin.status, 200);
  adminToken = adminLogin.data.token;
  assert.ok(adminToken);
  ok('admin bootstrap login works');

  // -- Dashboard --------------------------------------------------------------
  const dash = await api('/admin/dashboard', { token: adminToken });
  assert.strictEqual(dash.status, 200);
  assert.strictEqual(typeof dash.data.totalSchools, 'number');
  ok('admin dashboard responds');

  // -- Create a school --------------------------------------------------------
  const created = await api('/admin/schools', {
    method: 'POST',
    token: adminToken,
    body: {
      name: 'Delhi Public School',
      schoolCode: 'DPS-2026-001',
      address: 'Test Road',
      phone: '+91 12345 67890',
      email: 'school@dps.test',
      adminName: 'DPS Admin',
      adminEmail: 'admin@dps.test',
      licenseMonths: 12,
      maxDevices: 2,
    },
  });
  assert.strictEqual(created.status, 201);
  assert.ok(created.data.initialCredentials.password);
  assert.ok(created.data.licenseKey.startsWith('SMS1-'));
  const schoolId = created.data.school.id;
  const schoolPassword = created.data.initialCredentials.password;
  ok('admin can create school + license + credentials');

  const dupCode = await api('/admin/schools', {
    method: 'POST',
    token: adminToken,
    body: { name: 'X', schoolCode: 'DPS-2026-001', adminName: 'A', adminEmail: 'other@dps.test' },
  });
  assert.strictEqual(dupCode.status, 409);
  ok('duplicate school codes rejected');

  // -- School login + device activation ---------------------------------------
  const badSchoolLogin = await api('/auth/login', { method: 'POST', body: { identifier: 'admin@dps.test', password: 'nope', device: { deviceIdentifier: 'dev-A' } } });
  assert.strictEqual(badSchoolLogin.status, 401);
  ok('school login rejects wrong password');

  const login1 = await api('/auth/login', {
    method: 'POST',
    body: { identifier: 'admin@dps.test', password: schoolPassword, device: { deviceIdentifier: 'dev-A', deviceName: 'OFFICE-PC', osInfo: 'win32', appVersion: '1.0.0' } },
  });
  assert.strictEqual(login1.status, 200);
  assert.strictEqual(login1.data.newDeviceActivated, true);
  assert.strictEqual(login1.data.license.effectiveStatus, 'ACTIVE');
  assert.ok(login1.data.policy.offlineGraceDays >= 0);
  const accessToken = login1.data.accessToken;
  ok('first login activates device and returns license ACTIVE');

  // Login by school code should also work.
  const loginByCode = await api('/auth/login', {
    method: 'POST',
    body: { identifier: 'DPS-2026-001', password: schoolPassword, device: { deviceIdentifier: 'dev-B', deviceName: 'ACCOUNT-PC' } },
  });
  assert.strictEqual(loginByCode.status, 200);
  assert.strictEqual(loginByCode.data.newDeviceActivated, true);
  ok('login by school code activates second device');

  // Third device should be blocked (maxDevices = 2).
  const login3 = await api('/auth/login', {
    method: 'POST',
    body: { identifier: 'admin@dps.test', password: schoolPassword, device: { deviceIdentifier: 'dev-C', deviceName: 'EXTRA-PC' } },
  });
  assert.strictEqual(login3.status, 403);
  assert.strictEqual(login3.data.error, 'DEVICE_LIMIT_REACHED');
  ok('device limit enforced (3rd device blocked)');

  // -- License validation -----------------------------------------------------
  const validate = await api('/license/validate', { method: 'POST', token: accessToken });
  assert.strictEqual(validate.status, 200);
  assert.strictEqual(validate.data.ok, true);
  assert.ok(validate.data.daysRemaining > 300);
  ok('periodic license validation works');

  // -- Refresh token rotation -------------------------------------------------
  const refreshed = await api('/auth/refresh', { method: 'POST', body: { refreshToken: login1.data.refreshToken } });
  assert.strictEqual(refreshed.status, 200);
  assert.ok(refreshed.data.accessToken !== accessToken);
  const newAccess = refreshed.data.accessToken;
  ok('refresh rotates tokens');

  const staleRefresh = await api('/auth/refresh', { method: 'POST', body: { refreshToken: login1.data.refreshToken } });
  assert.strictEqual(staleRefresh.status, 401);
  ok('used refresh token cannot be replayed');

  // -- Device deactivation frees a slot ---------------------------------------
  const schoolDetail = await api(`/admin/schools/${schoolId}`, { token: adminToken });
  const deviceA = schoolDetail.data.devices.find((d) => d.deviceIdentifier === 'dev-A');
  const deactivated = await api(`/admin/devices/${deviceA.id}/deactivate`, { method: 'POST', token: adminToken });
  assert.strictEqual(deactivated.status, 200);
  ok('admin can deactivate a device');

  const loginAfterFree = await api('/auth/login', {
    method: 'POST',
    body: { identifier: 'admin@dps.test', password: schoolPassword, device: { deviceIdentifier: 'dev-C', deviceName: 'PRINCIPAL-PC' } },
  });
  assert.strictEqual(loginAfterFree.status, 200);
  assert.strictEqual(loginAfterFree.data.newDeviceActivated, true);
  ok('deactivating a device frees a slot for a new computer');

  // Session on the live device (dev-C) — used for the license-state checks below.
  const liveAccess = loginAfterFree.data.accessToken;

  // Deactivated device itself is refused.
  const deactivatedDeviceLogin = await api('/auth/login', {
    method: 'POST',
    body: { identifier: 'admin@dps.test', password: schoolPassword, device: { deviceIdentifier: 'dev-A', deviceName: 'OFFICE-PC' } },
  });
  assert.strictEqual(deactivatedDeviceLogin.status, 403);
  assert.strictEqual(deactivatedDeviceLogin.data.error, 'DEVICE_DEACTIVATED');
  ok('deactivated device is refused');

  // -- Suspend license --------------------------------------------------------
  const susp = await api(`/admin/licenses/${schoolId}`, { method: 'PATCH', token: adminToken, body: { status: 'suspended' } });
  assert.strictEqual(susp.status, 200);
  const suspendedLogin = await api('/auth/login', {
    method: 'POST',
    body: { identifier: 'admin@dps.test', password: schoolPassword, device: { deviceIdentifier: 'dev-B' } },
  });
  assert.strictEqual(suspendedLogin.status, 403);
  assert.strictEqual(suspendedLogin.data.error, 'LICENSE_SUSPENDED');
  ok('suspended license blocks login');

  // Existing session receives the precise suspension state on validation.
  const valSuspended = await api('/license/validate', { method: 'POST', token: liveAccess });
  assert.strictEqual(valSuspended.status, 403);
  assert.strictEqual(valSuspended.data.error, 'LICENSE_SUSPENDED');
  ok('suspended license invalidates live sessions with explicit state');

  // Reactivate.
  await api(`/admin/licenses/${schoolId}`, { method: 'PATCH', token: adminToken, body: { status: 'active' } });

  // -- Expire license ---------------------------------------------------------
  getDb().prepare('UPDATE licenses SET expires_at = ? WHERE school_id = ?').run(new Date(Date.now() - 86400000).toISOString(), schoolId);
  const expiredLogin = await api('/auth/login', {
    method: 'POST',
    body: { identifier: 'admin@dps.test', password: schoolPassword, device: { deviceIdentifier: 'dev-B' } },
  });
  assert.strictEqual(expiredLogin.status, 403);
  assert.strictEqual(expiredLogin.data.error, 'LICENSE_EXPIRED');
  ok('expired license blocks login with EXPIRED error');

  // -- Extend license ---------------------------------------------------------
  const extended = await api(`/admin/licenses/${schoolId}/extend`, { method: 'POST', token: adminToken, body: { months: 12 } });
  assert.strictEqual(extended.status, 200);
  assert.ok(new Date(extended.data.expiresAt).getTime() > Date.now());
  const loginAfterExtend = await api('/auth/login', {
    method: 'POST',
    body: { identifier: 'admin@dps.test', password: schoolPassword, device: { deviceIdentifier: 'dev-B' } },
  });
  assert.strictEqual(loginAfterExtend.status, 200);
  ok('extending license restores access');

  // -- Revoke license ---------------------------------------------------------
  await api(`/admin/licenses/${schoolId}`, { method: 'PATCH', token: adminToken, body: { status: 'revoked' } });
  const revokedLogin = await api('/auth/login', {
    method: 'POST',
    body: { identifier: 'admin@dps.test', password: schoolPassword, device: { deviceIdentifier: 'dev-B' } },
  });
  assert.strictEqual(revokedLogin.status, 403);
  assert.strictEqual(revokedLogin.data.error, 'LICENSE_REVOKED');
  ok('revoked license denies authentication immediately');
  await api(`/admin/licenses/${schoolId}`, { method: 'PATCH', token: adminToken, body: { status: 'active' } });

  // -- Reset credentials ------------------------------------------------------
  const reset = await api(`/admin/schools/${schoolId}/reset-credentials`, { method: 'POST', token: adminToken });
  assert.strictEqual(reset.status, 200);
  const oldPassLogin = await api('/auth/login', { method: 'POST', body: { identifier: 'admin@dps.test', password: schoolPassword, device: { deviceIdentifier: 'dev-B' } } });
  assert.strictEqual(oldPassLogin.status, 401);
  const newPassLogin = await api('/auth/login', { method: 'POST', body: { identifier: 'admin@dps.test', password: reset.data.newPassword, device: { deviceIdentifier: 'dev-B' } } });
  assert.strictEqual(newPassLogin.status, 200);
  ok('credential reset invalidates old password and accepts new one');

  // -- Client config + releases ------------------------------------------------
  const rel = await api('/admin/releases', { method: 'POST', token: adminToken, body: { version: '1.0.0', channel: 'stable', installerUrl: 'https://example.com/SchoolManagementSetup.exe', notes: 'First' } });
  assert.strictEqual(rel.status, 201);
  const clientConfig = await api('/client/config');
  assert.strictEqual(clientConfig.status, 200);
  assert.strictEqual(clientConfig.data.latestRelease.version, '1.0.0');
  ok('release feed serves latest stable to website/client');

  // -- Audit log ----------------------------------------------------------------
  const auditResp = await api('/admin/audit?limit=200', { token: adminToken });
  const actions = auditResp.data.logs.map((l) => l.action);
  for (const expected of ['SCHOOL_CREATED', 'LOGIN_SUCCESS', 'LICENSE_EXTENDED', 'PASSWORD_RESET', 'RELEASE_PUBLISHED']) {
    assert.ok(actions.includes(expected), `audit log should include ${expected}`);
  }
  ok('audit log captures admin actions');

  // -- Unauthenticated admin access is refused ---------------------------------
  const noAuth = await api('/admin/schools');
  assert.strictEqual(noAuth.status, 401);
  ok('admin APIs refuse unauthenticated callers');

  console.log(`\n✅ ALL ${passed} LICENSE SERVER TESTS PASSED\n`);
  closeDb();
  fs.rmSync(dataDir, { recursive: true, force: true });
  process.exit(0);
}

main().catch((err) => {
  console.error('\n❌ TEST FAILURE:', err);
  try { closeDb(); } catch { /* ignore */ }
  fs.rmSync(dataDir, { recursive: true, force: true });
  process.exit(1);
});
