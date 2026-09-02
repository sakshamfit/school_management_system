# Security Model

Threat assumption: **the customer owns the Windows machine** and can inspect
files. The desktop app is therefore treated as untrusted; all authoritative
decisions (auth, license, device limits) happen on the license server.

## Implemented controls

### Electron hardening
- `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`,
  `webSecurity: true`; renderer ↔ OS boundary is a minimal, namespaced
  `contextBridge` (`window.schoolApp.auth|database|backup|files|system|updater`).
- No `require/process/fs/child_process/shell` in the renderer.
- Every IPC handler validates arguments in the main process; unknown
  collections/fields are rejected; filenames sanitized; resolved paths are
  confined to approved AppData roots (traversal tested).
- `window.open` allowlisted (https/http/mailto), in-app navigation blocked,
  permissions denied, strict CSP, DevTools development-only, single-instance
  lock (no competing SQLite writers).

### Credentials & sessions
- **No hard-coded credentials anywhere** in source, bundle, config or docs.
- No signup; accounts are administrator-provisioned only.
- Server-side: scrypt password hashing, opaque random tokens (sha256-stored),
  rotated refresh, per-IP rate limiting on auth endpoints.
- Client-side: tokens in `safeStorage` (DPAPI); obfuscated-file fallback only
  when OS encryption is unavailable (flagged); logout wipes the store.
- Renderer never receives tokens; plaintext passwords never persisted,
  never logged (logger redacts sensitive keys).

### Licensing & devices
- License states ACTIVE/EXPIRED/SUSPENDED/REVOKED enforced server-side on
  login, refresh and periodic validation; suspension/revocation terminates
  or denies sessions; offline grace is server-configurable.
- Device limits enforced server-side; device IDs are stable random UUIDs
  (no invasive hardware fingerprinting); deactivation paths for both the
  administrator and the school.

### Data safety
- WAL SQLite with integrity checks; transactional migrations with automatic
  pre-migration backup and post-migration validation; restore always takes a
  pre-restore backup; uninstalls and updates never delete AppData.
- Diagnostics export deliberately excludes tokens, passwords and student data.

### Admin panel
- Separate session space, 8 h expiry, rate-limited login, full audit log
  (actor/action/target/timestamp; metadata never contains secrets),
  server-side authorization on every route (nothing hidden client-side).

## Production security checklist

```
[✓] No service-role keys / admin passwords / customer passwords in renderer or repo
[✓] HTTPS-only license communication; secrets env-provided on the server
[✓] contextIsolation on / nodeIntegration off / sandbox on
[✓] Passwords never logged; tokens never exposed to the renderer
[✓] Database & file paths validated; uploads confined; traversal tested
[✓] School isolation (single-school local DB; server keys by school_id)
[✓] Device activation + license validation enforced server-side
[✓] Backups + update safety + migration safety implemented
```

## Remaining considerations (be aware)

1. **Code signing** — ship a real certificate (see RELEASE.md); unsigned
   builds trigger SmartScreen warnings.
2. **Client tampering** — a determined owner can patch the app; commercial
   protection relies on server-side license/device enforcement, not DRM.
3. **TLS in this sandbox** — `scripts/sandbox-build-win.mjs` supports
   `NODE_TLS_REJECT_UNAUTHORIZED=0` strictly for sandbox verification builds;
   never use it in CI or production.
4. **Firebase web config** — the legacy web edition still ships a public
   Firebase client config; restrict its Firestore rules to the legacy
   deployment and keep the desktop edition independent of it.
5. **Operator hygiene** — rotate the bootstrap admin password, protect
   `LICENSE_TOKEN_SECRET`, keep server + OS patched, and review the audit log.
