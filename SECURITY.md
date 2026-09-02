# Security Policy — M.S. PUBLIC SCHOOL Management System

## Overview

This document describes security architecture, threat model, and audit checklist.

**Priority:** DATA SAFETY > SECURITY > AUTHENTICATION > BACKUP/RESTORE > LICENSE > RELIABILITY

## Architecture

```
React Renderer (untrusted, sandbox)
    ↓ contextBridge, whitelisted IPC only
Electron Main (trusted)
    ├── safeStorage (OS keychain)
    ├── SQLite (WAL, transactional)
    ├── License verification (server authoritative)
    └── Google Drive backup (encrypted)
```

## Electron Security

- `contextIsolation: true` — renderer cannot access Node
- `nodeIntegration: false` — no Node in renderer
- `sandbox: true` — renderer sandboxed
- `webSecurity: true`, `allowRunningInsecureContent: false`
- Preload exposes only whitelisted IPC via `contextBridge`
- No `fs`, `child_process`, `crypto secrets`, tokens, license secrets in renderer
- External links via `shell.openExternal`, no `new-window` allowed
- `will-navigate` blocked for external URLs

## Authentication Security

- No public signup — admin-issued credentials only
- Passwords hashed via PBKDF2 (100k iterations, SHA512) — never plaintext
- In production, server verifies via bcrypt/argon2
- Tokens stored via `safeStorage` (DPAPI on Windows, Keychain on macOS, libsecret on Linux) — not localStorage
- Session has 7-day offline grace, then requires internet
- Logout clears secure session file
- Forgot password → Contact Administrator (no self-reset that could be abused)

## License Security

- Server-side enforcement authoritative
- No secret in EXE to manufacture license
- States: ACTIVE, EXPIRED, SUSPENDED, REVOKED, DEVICE_LIMIT, OFFLINE_GRACE
- Offline grace: 7 days after last verification
- Device ID stable but not invasive (install ID + hostname hash, no MAC/serial)
- License file cached via safeStorage, no secrets

## Database Security

- SQLite with WAL mode (better crash safety)
- `PRAGMA foreign_keys = ON`, `synchronous = NORMAL` (safe with WAL)
- Migrations transactional with backup-before-migration
- `PRAGMA integrity_check` after recovery
- Safety backup before dangerous ops (restore, migration)
- Corrupted DB handling: move corrupted, restore from safety/local backup, else fresh
- Application binaries separate from mutable data (`%LOCALAPPDATA%\SchoolManagementSystem\`)
- Update never deletes user data (NSIS `deleteAppDataOnUninstall: false`)

## Google Drive Backup Security

### Encryption

- Algorithm: AES-256-GCM (authenticated encryption)
- Key: 32-byte random, stored via safeStorage
- IV: 12-byte random per encryption
- Format: `[version:1][iv:12][authTag:16][ciphertext]`
- No plaintext leakage check
- Raw SQLite never uploaded — always encrypted

### Key Management

- **Never stored in:** localStorage, sessionStorage, plain JSON, .env shipped with app, SQLite plaintext
- Stored via safeStorage (DPAPI/Keychain/libsecret)
- Recovery key = encryption key encoded as XXXX-XXXX-... with checksum, user must write down offline
- Recovery key never put in backup, never sent to server, never logged
- If recovery key + old PC lost → backup unrecoverable (documented)

### OAuth

- OAuth 2.0 with PKCE (best practice for desktop)
- Scopes minimal: `drive.file` (only files app creates) + `userinfo.email`
- No Google password asked/stored
- Official Google consent flow via system browser
- Local loopback server on random port for callback
- Tokens stored via safeStorage, never in renderer
- Auto refresh via refresh_token
- Revoked auth detected, prompts reconnect

### Upload Safety

- Temp file pattern: upload temp → verify size → upload final → verify → delete temp
- Failed uploads never become valid/latest
- Checksum verification (SHA256)
- Size limits: 500MB compressed, 1GB extracted, 10k files max

### Restore Safety

- Safety backup before restore
- Download → verify checksum → decrypt → validate manifest → validate SQLite → atomic replacement
- Path traversal protection (resolved path must be within dest)
- Zip bomb protection (size limits)
- Symlink skipping
- Malicious filename checks
- If fails, current DB untouched

## Secrets Audit

**Never in renderer bundle, public/, EXE resources, Git, logs, localStorage:**

- service-role keys
- API secrets
- passwords
- OAuth access tokens
- OAuth refresh tokens
- encryption keys
- license secrets
- Supabase service role
- Google client secret

**Checks:**
- `build/afterPack.js` scans dist for forbidden patterns
- `tests/security.test.cjs` verifies no tokens in renderer, no plaintext leakage, minimal scopes
- Preload whitelisted only
- `secureStorage` uses safeStorage

**Never log:**
- passwords
- access tokens
- refresh tokens
- encryption keys
- license secrets
- recovery keys

## File System Security

- All file operations validate paths
- No path traversal (`..`, absolute paths)
- Filename length limits (255)
- Symlink attacks prevented (lstat check)
- Oversized file checks
- User data not bundled in installer (afterPack removes database, backups, secure, config)

## Admin Panel Security

- Admin sees only operational metadata:
  ```
  School, Last backup, Backup status, Google account connected, App version
  ```
- **Never** sees actual school database contents
- Credentials: generate/reset, never display plaintext password
- License: create/extend/suspend/revoke, expiration, max devices
- Devices: view/deactivate/reactivate

## Environment Variables

- `GOOGLE_CLIENT_ID` — public for installed app, loaded from env
- `GOOGLE_CLIENT_SECRET` — optional, never ship in EXE
- `LICENSE_SERVER_URL`, `AUTH_SERVER_URL` — production URLs
- **Never ship:** service account private key, Google server secret, license server secret, Supabase service role key

## Production Configuration

Separate dev/staging/prod:

- dev: localhost, mock license/auth, dev Google OAuth
- staging: staging servers
- prod: HTTPS, production license server, production OAuth, production update feed, no localhost URLs, no dev credentials

## Reporting Vulnerabilities

Contact administrator directly. Do not disclose publicly until fixed.

## Security Tests

```bash
npm run test:security  # Checks bundle for secrets, preload whitelisting, electron security, encryption leakage
npm run test:backup    # Checks tokens not in renderer, keys not logged, raw SQLite not uploaded
npm run audit:prod     # Production readiness audit
npm run release:check  # Release build verification
```
