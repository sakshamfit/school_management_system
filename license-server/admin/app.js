/* global document, window, fetch, sessionStorage, alert, confirm, prompt */
'use strict';

/**
 * School Management System — Administrator Control Panel
 * Self-contained SPA (no build step). All privileged operations go through
 * /api/admin/* with a bearer token; the server enforces authorization.
 */

const state = {
  token: sessionStorage.getItem('sms_admin_token') || null,
  admin: JSON.parse(sessionStorage.getItem('sms_admin_profile') || 'null'),
};

const $app = document.getElementById('app');

// ---------------------------------------------------------------------------
// API helper
// ---------------------------------------------------------------------------
async function api(path, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  if (state.token) headers.Authorization = `Bearer ${state.token}`;
  const res = await fetch(`/api${path}`, {
    method: options.method || 'GET',
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  let data = null;
  try {
    data = await res.json();
  } catch {
    /* empty */
  }
  if (res.status === 401 && !path.startsWith('/admin/login')) {
    logout(true);
    throw new Error((data && data.message) || 'Session expired');
  }
  if (!res.ok) {
    const msg =
      (data && (data.message || (data.messages && data.messages.join(', ')))) ||
      `Request failed (${res.status})`;
    const err = new Error(msg);
    err.data = data;
    throw err;
  }
  return data;
}

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------
function esc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function fmtDate(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch {
    return iso;
  }
}

function fmtDateTime(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

function licenseBadge(status) {
  const map = {
    ACTIVE: 'green',
    EXPIRED: 'amber',
    SUSPENDED: 'amber',
    REVOKED: 'red',
    active: 'green',
    suspended: 'amber',
    revoked: 'red',
    archived: 'gray',
    deactivated: 'gray',
    locked: 'red',
  };
  return `<span class="badge ${map[status] || 'gray'}">${esc(String(status || 'UNKNOWN').toUpperCase())}</span>`;
}

function openModal(html) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `<div class="modal">${html}</div>`;
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) overlay.remove();
  });
  document.body.appendChild(overlay);
  return overlay;
}

function closeModal() {
  const el = document.querySelector('.modal-overlay');
  if (el) el.remove();
}

function toast(message, kind = 'success') {
  const el = document.createElement('div');
  el.className = `alert ${kind}`;
  el.style.cssText = 'position:fixed;top:16px;right:16px;z-index:99;max-width:380px;box-shadow:0 8px 30px rgba(0,0,0,.12)';
  el.textContent = message;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 4200);
}

// ---------------------------------------------------------------------------
// Auth flow
// ---------------------------------------------------------------------------
function logout(silent) {
  if (state.token && !silent) {
    api('/admin/logout', { method: 'POST' }).catch(() => {});
  }
  state.token = null;
  state.admin = null;
  sessionStorage.removeItem('sms_admin_token');
  sessionStorage.removeItem('sms_admin_profile');
  renderLogin();
}

function renderLogin() {
  const tpl = document.getElementById('tpl-login');
  $app.innerHTML = '';
  $app.appendChild(tpl.content.cloneNode(true));

  document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const errorEl = document.getElementById('login-error');
    errorEl.classList.add('hidden');
    try {
      const data = await api('/admin/login', {
        method: 'POST',
        body: {
          email: document.getElementById('login-email').value,
          password: document.getElementById('login-password').value,
        },
      });
      state.token = data.token;
      state.admin = data.admin;
      sessionStorage.setItem('sms_admin_token', data.token);
      sessionStorage.setItem('sms_admin_profile', JSON.stringify(data.admin));
      window.location.hash = '#/dashboard';
      renderShell();
    } catch (err) {
      errorEl.textContent = err.message;
      errorEl.classList.remove('hidden');
    }
  });
}

function renderShell() {
  const tpl = document.getElementById('tpl-shell');
  $app.innerHTML = '';
  $app.appendChild(tpl.content.cloneNode(true));
  document.getElementById('admin-name').textContent = state.admin ? state.admin.email : '';
  document.getElementById('logout-btn').addEventListener('click', () => logout(false));
  route();
}

// ---------------------------------------------------------------------------
// Pages
// ---------------------------------------------------------------------------
async function pageDashboard(main) {
  main.innerHTML = '<div class="card">Loading…</div>';
  try {
    const d = await api('/admin/dashboard');
    main.innerHTML = `
      <div class="page-head"><div><h2>Dashboard</h2><div class="sub">Live overview of schools, licenses and devices</div></div></div>
      <div class="stat-grid">
        <div class="stat"><div class="num">${d.totalSchools}</div><div class="lbl">Total Schools</div></div>
        <div class="stat good"><div class="num">${d.activeSchools}</div><div class="lbl">Active Schools</div></div>
        <div class="stat warn"><div class="num">${d.expiredLicenses}</div><div class="lbl">Expired Licenses</div></div>
        <div class="stat bad"><div class="num">${d.suspendedSchools}</div><div class="lbl">Suspended Schools</div></div>
        <div class="stat"><div class="num">${d.activeDevices}</div><div class="lbl">Active Devices</div></div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
        <div class="card">
          <h3>Recent Logins</h3>
          ${d.recentLogins.length === 0 ? '<p class="muted">No logins yet.</p>' : d.recentLogins.map((r) => `
            <div class="log-line"><span class="t">${fmtDateTime(r.created_at)}</span>
            <span><strong>${esc(r.actor_name || 'Unknown')}</strong> → ${esc(r.target || '')}${r.metadata && r.metadata.newDevice ? ' <span class="badge green">new device</span>' : ''}</span></div>`).join('')}
        </div>
        <div class="card">
          <h3>Upcoming License Expiries</h3>
          ${d.upcomingExpiries.length === 0 ? '<p class="muted">No licenses.</p>' : d.upcomingExpiries.map((r) => `
            <div class="log-line"><span class="t">${fmtDate(r.expires_at)}</span>
            <span>${esc(r.name)} <span class="mono muted">(${esc(r.school_code)})</span></span></div>`).join('')}
        </div>
      </div>
      <div class="card">
        <h3>Recent Device Activations</h3>
        ${d.recentActivations.length === 0 ? '<p class="muted">No device activations yet.</p>' : d.recentActivations.map((r) => `
          <div class="log-line"><span class="t">${fmtDateTime(r.activated_at)}</span>
          <span><strong>${esc(r.device_name || 'Unnamed device')}</strong> — ${esc(r.school_name)}</span></div>`).join('')}
      </div>`;
  } catch (err) {
    main.innerHTML = `<div class="alert error">${esc(err.message)}</div>`;
  }
}

function addSchoolModal() {
  const overlay = openModal(`
    <h3>Add School</h3>
    <p class="muted">Creates the school, its license and the login account you hand to the owner. There is no public signup.</p>
    <div id="modal-error"></div>
    <form id="add-school-form">
      <div class="form-grid">
        <div class="full"><label>School Name *</label><input name="name" required maxlength="200" placeholder="Delhi Public School" /></div>
        <div><label>School ID *</label><input name="schoolCode" required maxlength="40" placeholder="DPS-2026-001" /></div>
        <div><label>Admin Name *</label><input name="adminName" required maxlength="200" placeholder="School Administrator" /></div>
        <div><label>Admin Email *</label><input name="adminEmail" type="email" required maxlength="200" placeholder="admin@school.com" /></div>
        <div><label>Phone</label><input name="phone" maxlength="40" placeholder="+91 …" /></div>
        <div><label>License Duration</label>
          <select name="licenseMonths">
            <option value="3">3 months</option><option value="6">6 months</option>
            <option value="12" selected>12 months</option><option value="24">24 months</option>
            <option value="36">36 months</option>
          </select></div>
        <div><label>Maximum Devices</label><input name="maxDevices" type="number" min="1" max="50" value="3" /></div>
        <div class="full"><label>Address</label><input name="address" maxlength="300" /></div>
      </div>
      <div class="modal-actions">
        <button type="button" class="btn" id="cancel-btn">Cancel</button>
        <button type="submit" class="btn primary">Create School</button>
      </div>
    </form>`);

  overlay.querySelector('#cancel-btn').addEventListener('click', closeModal);
  overlay.querySelector('#add-school-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const form = e.target;
    const body = Object.fromEntries(new FormData(form).entries());
    body.licenseMonths = parseInt(body.licenseMonths, 10);
    body.maxDevices = parseInt(body.maxDevices, 10);
    try {
      const data = await api('/admin/schools', { method: 'POST', body });
      closeModal();
      showCredentials(data);
      route();
    } catch (err) {
      overlay.querySelector('#modal-error').innerHTML = `<div class="alert error">${esc(err.message)}</div>`;
    }
  });
}

function showCredentials(data) {
  const overlay = openModal(`
    <h3>School created ✓</h3>
    <p class="muted">Share these credentials with the school owner through a secure channel. The password is shown only once.</p>
    <div class="cred-reveal">
      <div class="row"><span>School</span><strong>${esc(data.school.name)}</strong></div>
      <div class="row"><span>School ID</span><span class="mono">${esc(data.school.schoolCode)}</span></div>
      <div class="row"><span>Sign-in email</span><span class="mono">${esc(data.initialCredentials.email)}</span></div>
      <div class="row"><span>Temporary password</span><span class="mono">${esc(data.initialCredentials.password)}</span></div>
      <div class="row"><span>License key</span><span class="mono">${esc(data.licenseKey)}</span></div>
      <div class="row"><span>Expires</span><strong>${fmtDate(data.expiresAt)}</strong></div>
    </div>
    <div class="modal-actions">
      <button class="btn" id="copy-creds">Copy credentials</button>
      <button class="btn primary" id="done-btn">Done</button>
    </div>`);
  overlay.querySelector('#done-btn').addEventListener('click', closeModal);
  overlay.querySelector('#copy-creds').addEventListener('click', async () => {
    const text = `School: ${data.school.name}\nSchool ID: ${data.school.schoolCode}\nEmail: ${data.initialCredentials.email}\nPassword: ${data.initialCredentials.password}\nLicense: ${data.licenseKey}\nExpires: ${data.expiresAt}`;
    try {
      await navigator.clipboard.writeText(text);
      toast('Credentials copied to clipboard');
    } catch {
      prompt('Copy the credentials manually:', text);
    }
  });
}

async function pageSchools(main) {
  main.innerHTML = `
    <div class="page-head">
      <div><h2>Schools</h2><div class="sub">Create, manage and control every school account</div></div>
      <div style="display:flex;gap:10px">
        <input id="school-search" placeholder="Search schools…" style="width:220px" />
        <button class="btn primary" id="add-school-btn">+ Add School</button>
      </div>
    </div>
    <div id="schools-table"><div class="card">Loading…</div></div>`;

  main.querySelector('#add-school-btn').addEventListener('click', addSchoolModal);

  let timer = null;
  main.querySelector('#school-search').addEventListener('input', (e) => {
    clearTimeout(timer);
    timer = setTimeout(() => loadSchools(main.querySelector('#schools-table'), e.target.value), 250);
  });
  await loadSchools(main.querySelector('#schools-table'), '');
}

async function loadSchools(container, search) {
  try {
    const data = await api(`/admin/schools?search=${encodeURIComponent(search)}`);
    if (data.schools.length === 0) {
      container.innerHTML = '<div class="card muted">No schools found.</div>';
      return;
    }
    container.innerHTML = `
      <table>
        <thead><tr><th>School</th><th>School ID</th><th>Status</th><th>License</th><th>Expires</th><th>Devices</th><th></th></tr></thead>
        <tbody>
        ${data.schools.map((s) => `
          <tr>
            <td><strong>${esc(s.name)}</strong><div class="muted" style="font-size:11px">${esc(s.email)}</div></td>
            <td class="mono">${esc(s.schoolCode)}</td>
            <td>${licenseBadge(s.status)}</td>
            <td>${s.licenseStatus ? licenseBadge(s.licenseStatus) : '—'}</td>
            <td>${fmtDate(s.expiresAt)}</td>
            <td>${s.devicesUsed} / ${s.maxDevices}</td>
            <td><button class="btn small" data-open="${s.id}">Manage</button></td>
          </tr>`).join('')}
        </tbody>
      </table>`;
    container.querySelectorAll('[data-open]').forEach((btn) => {
      btn.addEventListener('click', () => {
        window.location.hash = `#/schools/${btn.dataset.open}`;
      });
    });
  } catch (err) {
    container.innerHTML = `<div class="alert error">${esc(err.message)}</div>`;
  }
}

async function pageSchoolDetail(main, schoolId) {
  main.innerHTML = '<div class="card">Loading…</div>';
  try {
    const d = await api(`/admin/schools/${schoolId}`);
    const s = d.school;
    main.innerHTML = `
      <div class="page-head">
        <div><h2>${esc(s.name)}</h2>
        <div class="sub mono">${esc(s.schoolCode)} · ${licenseBadge(s.status)} ${d.license ? licenseBadge(d.license.effectiveStatus) : ''}</div></div>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <a class="btn" href="#/schools">← All schools</a>
          ${s.status === 'active'
            ? '<button class="btn danger" id="suspend-btn">Suspend School</button>'
            : s.status === 'suspended' ? '<button class="btn primary" id="activate-btn">Activate School</button>' : ''}
          ${s.status !== 'archived' ? '<button class="btn danger" id="archive-btn">Archive</button>' : ''}
        </div>
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
        <div class="card">
          <h3>School Details</h3>
          <p><span class="muted">Address:</span> ${esc(s.address || '—')}</p>
          <p><span class="muted">Phone:</span> ${esc(s.phone || '—')}</p>
          <p><span class="muted">Email:</span> ${esc(s.email || '—')}</p>
          <div style="margin-top:12px;display:flex;gap:8px">
            <button class="btn small" id="reset-creds-btn">Reset Credentials</button>
          </div>
        </div>

        <div class="card">
          <h3>License</h3>
          ${d.license ? `
            <p><span class="muted">Key:</span> <span class="mono">${esc(d.license.licenseKey)}</span></p>
            <p><span class="muted">Status:</span> ${licenseBadge(d.license.effectiveStatus)}</p>
            <p><span class="muted">Issued:</span> ${fmtDate(d.license.issuedAt)}</p>
            <p><span class="muted">Expires:</span> ${fmtDate(d.license.expiresAt)}</p>
            <p><span class="muted">Devices:</span> ${d.license.devicesUsed} / ${d.license.maxDevices}</p>
            <div style="margin-top:12px;display:flex;gap:8px;flex-wrap:wrap">
              <button class="btn small primary" id="extend-btn">Extend License</button>
              ${d.license.status === 'active'
                ? '<button class="btn small danger" id="lic-suspend">Suspend License</button>'
                : '<button class="btn small" id="lic-reactivate">Reactivate License</button>'}
              <button class="btn small danger" id="lic-revoke">Revoke</button>
              <button class="btn small" id="lic-limit">Device Limit</button>
            </div>` : '<p class="muted">No license assigned.</p>'}
        </div>
      </div>

      <div class="card">
        <h3>Devices (${d.devices.length})</h3>
        ${d.devices.length === 0 ? '<p class="muted">No devices activated yet.</p>' : `
        <table><thead><tr><th>Device</th><th>OS</th><th>App</th><th>Activated</th><th>Last Seen</th><th>Status</th><th></th></tr></thead>
        <tbody>${d.devices.map((dev) => `
          <tr>
            <td><strong>${esc(dev.deviceName || 'Unnamed')}</strong><div class="mono muted" style="font-size:10px">${esc(dev.deviceIdentifier)}</div></td>
            <td>${esc(dev.osInfo || '—')}</td>
            <td>${esc(dev.appVersion || '—')}</td>
            <td>${fmtDate(dev.activatedAt)}</td>
            <td>${fmtDateTime(dev.lastSeenAt)}</td>
            <td>${licenseBadge(dev.status)}</td>
            <td>${dev.status === 'active'
              ? `<button class="btn small danger" data-deactivate="${dev.id}">Deactivate</button>`
              : `<button class="btn small" data-reactivate="${dev.id}">Reactivate</button>`}</td>
          </tr>`).join('')}
        </tbody></table>`}
      </div>

      <div class="card">
        <h3>Login Accounts</h3>
        <table><thead><tr><th>Name</th><th>Email</th><th>Status</th><th></th></tr></thead>
        <tbody>${d.users.map((u) => `
          <tr>
            <td>${esc(u.name)}</td><td class="mono">${esc(u.email)}</td><td>${licenseBadge(u.status)}</td>
            <td><button class="btn small" data-reset-user="${u.id}">Reset Password</button>
            ${u.status === 'active'
              ? `<button class="btn small danger" data-lock-user="${u.id}">Lock</button>`
              : `<button class="btn small" data-unlock-user="${u.id}">Unlock</button>`}</td>
          </tr>`).join('')}
        </tbody></table>
      </div>`;

    const refresh = () => pageSchoolDetail(main, schoolId);

    main.querySelector('#suspend-btn')?.addEventListener('click', async () => {
      if (!confirm('Suspend this school? All active sessions are terminated.')) return;
      await api(`/admin/schools/${schoolId}`, { method: 'PATCH', body: { status: 'suspended' } });
      toast('School suspended'); refresh();
    });
    main.querySelector('#activate-btn')?.addEventListener('click', async () => {
      await api(`/admin/schools/${schoolId}`, { method: 'PATCH', body: { status: 'active' } });
      toast('School activated'); refresh();
    });
    main.querySelector('#archive-btn')?.addEventListener('click', async () => {
      if (!confirm('Archive this school? It can no longer sign in.')) return;
      await api(`/admin/schools/${schoolId}`, { method: 'PATCH', body: { status: 'archived' } });
      toast('School archived'); refresh();
    });
    main.querySelector('#reset-creds-btn')?.addEventListener('click', async () => {
      if (!confirm('Generate a new password for this school? Existing sessions are signed out.')) return;
      const data = await api(`/admin/schools/${schoolId}/reset-credentials`, { method: 'POST' });
      showCredentials({
        school: s,
        licenseKey: d.license ? d.license.licenseKey : '—',
        expiresAt: d.license ? d.license.expiresAt : '',
        initialCredentials: { email: data.email, password: data.newPassword },
      });
    });
    main.querySelector('#extend-btn')?.addEventListener('click', async () => {
      const months = prompt('Extend license by how many months? (1–120)', '12');
      if (!months) return;
      const data = await api(`/admin/licenses/${schoolId}/extend`, { method: 'POST', body: { months: parseInt(months, 10) } });
      toast(`License extended to ${fmtDate(data.expiresAt)}`); refresh();
    });
    main.querySelector('#lic-suspend')?.addEventListener('click', async () => {
      await api(`/admin/licenses/${schoolId}`, { method: 'PATCH', body: { status: 'suspended' } });
      toast('License suspended'); refresh();
    });
    main.querySelector('#lic-reactivate')?.addEventListener('click', async () => {
      await api(`/admin/licenses/${schoolId}`, { method: 'PATCH', body: { status: 'active' } });
      toast('License reactivated'); refresh();
    });
    main.querySelector('#lic-revoke')?.addEventListener('click', async () => {
      if (!confirm('Revoke this license? The school is denied access immediately. This is intended for permanent withdrawal.')) return;
      await api(`/admin/licenses/${schoolId}`, { method: 'PATCH', body: { status: 'revoked' } });
      toast('License revoked'); refresh();
    });
    main.querySelector('#lic-limit')?.addEventListener('click', async () => {
      const limit = prompt('New maximum devices (1–50):', String(d.license.maxDevices));
      if (!limit) return;
      await api(`/admin/licenses/${schoolId}`, { method: 'PATCH', body: { maxDevices: parseInt(limit, 10) } });
      toast('Device limit updated'); refresh();
    });

    main.querySelectorAll('[data-deactivate]').forEach((b) =>
      b.addEventListener('click', async () => {
        if (!confirm('Deactivate this device? The school can then activate a different computer.')) return;
        await api(`/admin/devices/${b.dataset.deactivate}/deactivate`, { method: 'POST' });
        toast('Device deactivated'); refresh();
      })
    );
    main.querySelectorAll('[data-reactivate]').forEach((b) =>
      b.addEventListener('click', async () => {
        await api(`/admin/devices/${b.dataset.reactivate}/reactivate`, { method: 'POST' });
        toast('Device reactivated'); refresh();
      })
    );
    main.querySelectorAll('[data-reset-user]').forEach((b) =>
      b.addEventListener('click', async () => {
        const data = await api(`/admin/users/${b.dataset.resetUser}/reset-password`, { method: 'POST' });
        showCredentials({
          school: s,
          licenseKey: d.license ? d.license.licenseKey : '—',
          expiresAt: d.license ? d.license.expiresAt : '',
          initialCredentials: { email: data.email, password: data.newPassword },
        });
      })
    );
    main.querySelectorAll('[data-lock-user]').forEach((b) =>
      b.addEventListener('click', async () => {
        await api(`/admin/users/${b.dataset.lockUser}/status`, { method: 'POST', body: { status: 'locked' } });
        refresh();
      })
    );
    main.querySelectorAll('[data-unlock-user]').forEach((b) =>
      b.addEventListener('click', async () => {
        await api(`/admin/users/${b.dataset.unlockUser}/status`, { method: 'POST', body: { status: 'active' } });
        refresh();
      })
    );
  } catch (err) {
    main.innerHTML = `<div class="alert error">${esc(err.message)}</div>`;
  }
}

async function pageLicenses(main) {
  main.innerHTML = '<div class="card">Loading…</div>';
  try {
    const d = await api('/admin/licenses');
    main.innerHTML = `
      <div class="page-head"><div><h2>Licenses</h2><div class="sub">Every license with expiry, device limits and state controls</div></div></div>
      <table><thead><tr><th>School</th><th>License Key</th><th>Status</th><th>Issued</th><th>Expires</th><th>Devices</th><th></th></tr></thead>
      <tbody>${d.licenses.map((l) => `
        <tr>
          <td><strong>${esc(l.schoolName)}</strong><div class="mono muted" style="font-size:10px">${esc(l.schoolCode)}</div></td>
          <td class="mono">${esc(l.licenseKey)}</td>
          <td>${licenseBadge(l.effectiveStatus)}</td>
          <td>${fmtDate(l.issuedAt)}</td>
          <td>${fmtDate(l.expiresAt)}</td>
          <td>${l.devicesUsed} / ${l.maxDevices}</td>
          <td><a class="btn small" href="#/schools/${l.schoolId}">Manage</a></td>
        </tr>`).join('')}
      </tbody></table>`;
  } catch (err) {
    main.innerHTML = `<div class="alert error">${esc(err.message)}</div>`;
  }
}

async function pageDevices(main) {
  main.innerHTML = '<div class="card">Loading…</div>';
  try {
    const d = await api('/admin/devices');
    main.innerHTML = `
      <div class="page-head"><div><h2>Devices</h2><div class="sub">All activated school computers across every school</div></div></div>
      ${d.devices.length === 0 ? '<div class="card muted">No devices activated yet.</div>' : `
      <table><thead><tr><th>Device</th><th>School</th><th>OS</th><th>Activated</th><th>Last Seen</th><th>Status</th><th></th></tr></thead>
      <tbody>${d.devices.map((dev) => `
        <tr>
          <td><strong>${esc(dev.deviceName || 'Unnamed')}</strong></td>
          <td>${esc(dev.schoolName)}</td>
          <td>${esc(dev.osInfo || '—')}</td>
          <td>${fmtDate(dev.activatedAt)}</td>
          <td>${fmtDateTime(dev.lastSeenAt)}</td>
          <td>${licenseBadge(dev.status)}</td>
          <td>${dev.status === 'active'
            ? `<button class="btn small danger" data-deactivate="${dev.id}">Deactivate</button>`
            : `<button class="btn small" data-reactivate="${dev.id}">Reactivate</button>`}</td>
        </tr>`).join('')}
      </tbody></table>`}`;

    const refresh = () => pageDevices(main);
    main.querySelectorAll('[data-deactivate]').forEach((b) =>
      b.addEventListener('click', async () => {
        if (!confirm('Deactivate this device?')) return;
        await api(`/admin/devices/${b.dataset.deactivate}/deactivate`, { method: 'POST' });
        toast('Device deactivated'); refresh();
      })
    );
    main.querySelectorAll('[data-reactivate]').forEach((b) =>
      b.addEventListener('click', async () => {
        await api(`/admin/devices/${b.dataset.reactivate}/reactivate`, { method: 'POST' });
        toast('Device reactivated'); refresh();
      })
    );
  } catch (err) {
    main.innerHTML = `<div class="alert error">${esc(err.message)}</div>`;
  }
}

async function pageReleases(main) {
  main.innerHTML = '<div class="card">Loading…</div>';
  try {
    const d = await api('/admin/releases');
    main.innerHTML = `
      <div class="page-head">
        <div><h2>Downloads & Versions</h2><div class="sub">The website download button and update checks read this feed</div></div>
        <button class="btn primary" id="add-release">+ Publish Version</button>
      </div>
      ${d.releases.length === 0 ? '<div class="card muted">No releases published yet. Publish the current stable version after each GitHub release.</div>' : `
      <table><thead><tr><th>Version</th><th>Channel</th><th>Released</th><th>Installer URL</th><th>Latest Stable</th></tr></thead>
      <tbody>${d.releases.map((r) => `
        <tr>
          <td class="mono"><strong>${esc(r.version)}</strong></td>
          <td>${licenseBadge(r.channel === 'stable' ? 'ACTIVE' : 'SUSPENDED').replace('>ACTIVE<', `>STABLE<`).replace('>SUSPENDED<', `>BETA<`)}</td>
          <td>${fmtDate(r.released_at)}</td>
          <td style="max-width:340px;overflow:hidden;text-overflow:ellipsis"><a href="${esc(r.installer_url)}" target="_blank" rel="noopener">${esc(r.installer_url || '—')}</a></td>
          <td>${r.is_latest_stable ? '<span class="badge green">YES</span>' : ''}</td>
        </tr>`).join('')}
      </tbody></table>`}`;

    main.querySelector('#add-release').addEventListener('click', () => {
      const overlay = openModal(`
        <h3>Publish Version</h3>
        <div id="modal-error"></div>
        <form id="release-form">
          <label>Version (semantic)</label><input name="version" required placeholder="1.0.0" />
          <label>Channel</label>
          <select name="channel"><option value="stable">Stable</option><option value="beta">Beta</option></select>
          <label>Installer download URL</label><input name="installerUrl" placeholder="https://github.com/…/releases/download/v1.0.0/SchoolManagementSetup-1.0.0.exe" />
          <label>Release notes</label><textarea name="notes" rows="4"></textarea>
          <div class="modal-actions">
            <button type="button" class="btn" id="cancel-btn">Cancel</button>
            <button type="submit" class="btn primary">Publish</button>
          </div>
        </form>`);
      overlay.querySelector('#cancel-btn').addEventListener('click', closeModal);
      overlay.querySelector('#release-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const body = Object.fromEntries(new FormData(e.target).entries());
        try {
          await api('/admin/releases', { method: 'POST', body });
          closeModal();
          toast('Version published');
          pageReleases(main);
        } catch (err) {
          overlay.querySelector('#modal-error').innerHTML = `<div class="alert error">${esc(err.message)}</div>`;
        }
      });
    });
  } catch (err) {
    main.innerHTML = `<div class="alert error">${esc(err.message)}</div>`;
  }
}

async function pageSettings(main) {
  main.innerHTML = '<div class="card">Loading…</div>';
  try {
    const d = await api('/admin/client-settings');
    main.innerHTML = `
      <div class="page-head"><div><h2>Settings</h2><div class="sub">Support contact shown inside every installed desktop app, plus security tools</div></div></div>
      <div class="card" style="max-width:560px">
        <h3>Client Support Contact</h3>
        <form id="settings-form">
          <label>Support website URL</label><input name="supportUrl" value="${esc(d.supportUrl)}" />
          <label>Support email</label><input name="supportEmail" value="${esc(d.supportEmail)}" />
          <label>Support phone</label><input name="supportPhone" value="${esc(d.supportPhone)}" />
          <div style="margin-top:14px"><button class="btn primary" type="submit">Save</button></div>
        </form>
      </div>
      <div class="card" style="max-width:560px">
        <h3>Change Administrator Password</h3>
        <form id="pw-form">
          <label>Current password</label><input name="currentPassword" type="password" required />
          <label>New password (min 10 chars)</label><input name="newPassword" type="password" required minlength="10" />
          <div style="margin-top:14px"><button class="btn" type="submit">Change password</button></div>
        </form>
      </div>`;

    main.querySelector('#settings-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const body = Object.fromEntries(new FormData(e.target).entries());
      await api('/admin/client-settings', { method: 'PUT', body });
      toast('Client settings saved');
    });
    main.querySelector('#pw-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const body = Object.fromEntries(new FormData(e.target).entries());
      try {
        await api('/admin/change-password', { method: 'POST', body });
        toast('Administrator password changed');
        e.target.reset();
      } catch (err) {
        alert(err.message);
      }
    });
  } catch (err) {
    main.innerHTML = `<div class="alert error">${esc(err.message)}</div>`;
  }
}

async function pageLogs(main) {
  main.innerHTML = '<div class="card">Loading…</div>';
  try {
    const d = await api('/admin/audit?limit=300');
    main.innerHTML = `
      <div class="page-head"><div><h2>System Logs</h2><div class="sub">Audit trail of every administrator and licensing action (secrets are never logged)</div></div></div>
      <div class="card">
        ${d.logs.length === 0 ? '<p class="muted">No audit entries yet.</p>' : d.logs.map((l) => `
          <div class="log-line">
            <span class="t">${fmtDateTime(l.created_at)}</span>
            <span class="badge gray">${esc(l.actor_type)}</span>
            <span><strong>${esc(l.action)}</strong> ${l.target ? `→ ${esc(l.target)}` : ''} <span class="muted">${esc(l.actor_name || '')}</span></span>
          </div>`).join('')}
      </div>`;
  } catch (err) {
    main.innerHTML = `<div class="alert error">${esc(err.message)}</div>`;
  }
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------
function route() {
  const main = document.getElementById('main');
  if (!main) return;
  const hash = window.location.hash || '#/dashboard';

  document.querySelectorAll('.sidebar nav a').forEach((a) => {
    const r = a.dataset.route;
    a.classList.toggle('active', hash.startsWith(`#/${r}`));
  });

  if (hash.startsWith('#/dashboard')) return pageDashboard(main);
  if (hash.startsWith('#/schools/')) return pageSchoolDetail(main, hash.split('/')[2]);
  if (hash.startsWith('#/schools')) return pageSchools(main);
  if (hash.startsWith('#/licenses')) return pageLicenses(main);
  if (hash.startsWith('#/devices')) return pageDevices(main);
  if (hash.startsWith('#/releases')) return pageReleases(main);
  if (hash.startsWith('#/settings')) return pageSettings(main);
  if (hash.startsWith('#/logs')) return pageLogs(main);
  return pageDashboard(main);
}

window.addEventListener('hashchange', () => {
  if (state.token) route();
});

// Boot
if (state.token) {
  renderShell();
} else {
  renderLogin();
}
