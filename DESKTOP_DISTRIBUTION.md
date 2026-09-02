# Desktop Distribution — Architecture & Operations

This document describes how the **School Management System — Windows Desktop
Edition** works end to end. Read `README.md` first for the quick start.

---

## 1. High-level architecture

```
                 ┌──────────────────────────────────────────┐
                 │            Windows customer PC            │
  WEBSITE ──────►│  SchoolManagementSetup.exe (NSIS)         │
  download       │        ┌──────────────────────────────┐  │
                 │        │  Renderer (React, sandboxed)  │  │
                 │        │   window.schoolApp (preload)  │  │
                 │        └──────────────┬───────────────┘  │
                 │        Secure IPC (validated in main)    │
                 │        ┌──────────────▼───────────────┐  │
                 │        │  Electron main process        │  │
                 │        │  • SQLite repository (WAL)    │  │
                 │        │  • safeStorage session store  │  │
                 │        │  • backup manager             │  │
                 │        │  • license client (HTTPS)     │  │
                 │        │  • auto-updater               │  │
                 │        └──────────────┬───────────────┘  │
                 └───────────────────────┼──────────────────┘
                                         │ HTTPS (timeout + retry)
                 ┌───────────────────────▼──────────────────┐
                 │  License server (Express + SQLite)        │
                 │  /api/auth/*  /api/license/*  /api/admin/*│
                 │  /admin  (administrator control panel)    │
                 └───────────────────────────────────────────┘
```

Security posture of the Electron window: `contextIsolation: true`,
`nodeIntegration: false`, `sandbox: true`, a minimal `contextBridge` API,
CSP headers, permission prompts denied, `window.open` restricted, navigation
locked, DevTools only in development, single-instance lock.

---

## 2. Authentication (no signup)

* Accounts are created **only** by the software owner in `/admin` → *Add School*.
* The panel returns generated credentials **once**; they are never stored in
  plaintext server-side (scrypt-hashed) and never shipped in the app.
* Desktop login (`auth:login` IPC) posts identifier + password to
  `POST /api/auth/login` over HTTPS. The server checks: account → school
  status → **license state** → device limits, then returns short-lived access +
  long-lived refresh tokens.
* Tokens are stored with Electron `safeStorage` (Windows DPAPI). The renderer
  never sees tokens, passwords or secrets.
* **Auto-login**: on launch the main process refreshes the session silently; if
  offline, it falls back to the cached license + offline grace policy
  (§5). Otherwise the sign-in screen appears.
* Teacher sign-in uses the local 6-digit code and is **local-only**, possible
  only on a computer that already holds a valid school session (offline-first).
* `Forgot password` is not a public flow: the admin panel has *Reset
  Credentials* per school/user (new password shown once, sessions terminated).

---

## 3. License model

`licenses` rows carry `status ∈ {active, suspended, revoked}`, `expires_at`,
`max_devices`, `offline_grace_days`, `revalidate_hours`. Effective state is
computed server-side as **ACTIVE / EXPIRED / SUSPENDED / REVOKED**:

| State | Desktop behavior |
| :--- | :--- |
| ACTIVE | Normal operation. |
| EXPIRED | Login denied: "Your school license has expired. Please contact the administrator." In-app: lock screen after grace period; warnings at 30 and 7 days remaining. |
| SUSPENDED | Access blocked; live sessions receive the explicit state on validation. |
| REVOKED | Authentication denied immediately. |

The desktop app revalidates on the server-configured interval (default 24 h)
and caches the last verdict; the **License** settings tab shows status, expiry,
device usage and last verification, plus a *Verify Online* action.

## 4. Device activation

* Each installation gets a stable random device ID stored in AppData (not an
  aggressive hardware fingerprint) plus OS hostname for display.
* First login on a new computer activates a device if a slot is free
  (`newDeviceActivated` → logged + visible in admin panel); otherwise the
  server answers `DEVICE_LIMIT_REACHED` and the school must ask the
  administrator to *Deactivate* a device (or the school deactivates one of its
  own from a live device via `POST /api/devices/deactivate`).
* Deactivated devices are refused at login.

## 5. Offline-first operation

* After a successful online login, all school operations (students, teachers,
  attendance, fees, results, reports, printing, CSV export) are fully local.
* If the internet or license server is down: the cached license + policy
  decide. Offline access is allowed while
  `now − lastVerifiedAt ≤ offlineGraceDays` (server-configurable, default 30)
  and the license is not suspended/revoked.
* Network calls always use timeouts + one retry + backoff; the UI never blocks
  on the server. On failure the app explains: "Your local school data remains
  safe."

## 6. Local database, migrations, backups

* SQLite at `AppData/…/database/school.sqlite`, WAL mode, `busy_timeout`,
  foreign keys, integrity check on open. Single writer (main process); the
  renderer accesses it exclusively through validated IPC.
* Schema versioning in `schema_migrations`; **every migration of an existing
  database is preceded by an automatic backup**, wrapped in a transaction and
  followed by an integrity check. On failure the original backup is preserved
  and a recovery message is shown — data is never silently destroyed.
* Backups: SQLite online-backup API → `backups/school-<stamp>.sqlite`,
  automatic daily (startup + 6 h freshness check), manual *Backup Now*,
  14-day retention (min 5), optional external mirror folder (USB/network).
* Restore validates the file (integrity + school_info presence), takes a
  pre-restore safety backup, swaps files, re-runs migrations, reloads the UI.
* Existing web/localStorage data can be imported once (`migrateLegacyIfPresent`)
  and never overwrites real data.

## 7. Updates

* `electron-updater` with the GitHub provider (`publish` config in
  package.json). Check at startup (+8 s) and every 6 h; download in background;
  user-controlled *Restart & Install*.
* Updates touch only application files. School data lives in AppData and is
  untouched; schema changes ride on §6 migrations with pre-backup.
* NSIS `deleteAppDataOnUninstall: false`; uninstall is clean and reversible.

## 8. Administrator control panel (`/admin`)

Dashboard (schools/active/expired/suspended/devices), Schools (create, edit,
suspend, activate, archive, reset credentials, view devices/users), Licenses
(extend, suspend, reactivate, revoke, device limit, grace days), Devices
(deactivate/reactivate), Downloads & Versions (release feed consumed by the
website download button), Settings (support contact shown inside desktop apps),
System Logs (audit trail). Admin auth is separate, rate-limited, scrypt-hashed,
8-hour sessions; every mutation is audited.

## 9. Renderer storage boundary

`src/services/dataService.ts` selects the backend: desktop → SQLite IPC
adapter (`desktopSync.ts`), web → Firestore (`firestoreSync.ts`, unchanged).
All existing modules (students, fees, attendance, results, reports, printing,
CSV/PDF flows) operate on the same in-memory model, so no feature was rebuilt.

## 10. Future LAN mode

The repository layer (collection-per-table SQLite) is the same shape a future
school-server API would expose; a LAN edition can replace the IPC transport
with HTTP without touching the renderer's model.
