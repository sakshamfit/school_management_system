# Release Process — M.S. PUBLIC SCHOOL Management System

## Versioning

Semantic versioning: `MAJOR.MINOR.PATCH` e.g., `1.0.0`

- MAJOR: Breaking changes, major features
- MINOR: New features, non-breaking
- PATCH: Bug fixes

## Pre-Release Checklist

- [ ] All tests pass: `npm run test:backup`, `test:recovery`, `test:security`
- [ ] Production audit: `npm run audit:prod` → all PASS
- [ ] TypeScript no errors: `npm run build` (vite build)
- [ ] No secrets in dist: `npm run release:check`
- [ ] Backup system tested: Computer A → Drive → Computer B restore
- [ ] Auth: no signup UI, only admin-issued login
- [ ] License: active/expired/suspended/revoked/device limit/offline grace tested
- [ ] Device activation stable, admin view/deactivate works
- [ ] Local data in %LOCALAPPDATA%/SchoolManagementSystem/, update preserves
- [ ] DB: WAL, transactional migrations, integrity_check, corrupted handling, safety backup
- [ ] Google Drive backup: snapshot→package→encryption→Drive, raw SQLite never uploaded, retry, retention, disconnect/reconnect, token refresh
- [ ] Admin panel: schools CRUD, credentials generate/reset never plaintext, license, devices, backup metadata only
- [ ] Security: IPC/preload whitelisted, safeStorage, no secrets in renderer/bundle/EXE/git/logs/localStorage
- [ ] Electron: contextIsolation true, nodeIntegration false, sandbox true
- [ ] Installer: NSIS SchoolManagementSetup.exe, shortcuts, branded, uninstall preserves data, reinstall/upgrade works
- [ ] Auto update: version→latest.yml→detect→user choice→install→SQLite intact→restart
- [ ] Docs: INSTALLATION_GUIDE, CUSTOMER_GUIDE, BACKUP_GUIDE, RESTORE_GUIDE, ADMIN_GUIDE, TROUBLESHOOTING, RELEASE, SECURITY
- [ ] No Node/npm/Python/SQLite required for customer

## Build Steps (Windows)

```bash
# Clean
npm run clean

# Install deps
npm install

# Build renderer
npm run build

# Build installer (Windows only)
npm run dist:win

# Output: release/SchoolManagementSetup-1.0.0-x64.exe + latest.yml + blockmap

# Verify
npm run release:check
```

### Build Artifacts

```
release/
├── SchoolManagementSetup-1.0.0-x64.exe (NSIS installer)
├── SchoolManagementSetup-1.0.0-x64.exe.blockmap
├── latest.yml (update feed)
└── win-unpacked/ (unpacked for testing)
```

### Inspect EXE for Secrets

- Use `strings` or 7-Zip to inspect resources
- Search for: `service_role`, `client_secret`, `password`, `localhost:3000` in prod
- Should NOT contain: hardcoded test accounts, dev URLs, API secrets, encryption keys

## Manual Windows QA (Required)

Test on **real** Windows 10 and Windows 11 (not just automated):

### Installation

- [ ] Fresh install (no previous)
- [ ] Reinstall over existing (upgrade) — data preserved
- [ ] Uninstall with Keep data YES → reinstall → data preserved
- [ ] Uninstall with Keep data NO → data deleted (expected)

### App Launch & Auth

- [ ] Launch app
- [ ] Principal login with admin-issued credentials
- [ ] Teacher login with 6-digit code
- [ ] Logout → login again
- [ ] Restart app → session persists
- [ ] Restart Windows → launch app → works
- [ ] Offline login within 7-day grace
- [ ] Offline beyond grace → requires internet

### Database Operations

- [ ] Create student, edit, archive
- [ ] Attendance mark
- [ ] Fee collection, receipt
- [ ] Exam marks entry
- [ ] Reports, CSV export
- [ ] File upload (student photo)
- [ ] Printing

### Backup & Restore

- [ ] Connect Google Drive (OAuth flow)
- [ ] Manual backup now → verify in Drive
- [ ] Automatic backup daily
- [ ] Offline → pending message → online retry
- [ ] Disconnect → reconnect same account
- [ ] Disconnect → connect different account
- [ ] Restore backup → safety backup created → data restored
- [ ] Recovery key: show → copy → import on new PC
- [ ] New PC scenario: Install → login → same Google account → import recovery key → restore

### License

- [ ] Active license → works
- [ ] Expired license → blocked after grace
- [ ] Suspended license → blocked
- [ ] Revoked license → blocked
- [ ] Device limit → blocked on 4th device, admin deactivation works
- [ ] Offline grace → works within 7 days, fails after

### Auto Update

- [ ] Old version installed → new version released → detect → prompt → download → install → SQLite intact → new version running
- [ ] Failed update → app still works, retry

### Performance

- [ ] Low-end PC (4GB RAM, HDD) → fast startup (<10s), low RAM (<500MB), UI responsive, backup not freeze UI

## Release Deployment

1. **Build on Windows:** `npm run dist:win`
2. **Test installer:** Manual QA above
3. **Upload to update server:**
   - `SchoolManagementSetup-*.exe`
   - `latest.yml`
   - `*.blockmap`
4. **Update website:** Version, Windows 10/11, file size, date, what's new, requirements, download link
5. **Notify customers:** Email/WhatsApp about new version, auto-update will detect
6. **Keep previous version:** For rollback if needed

## Post-Release

- [ ] Monitor logs / support requests
- [ ] Check license server health
- [ ] Check Google OAuth quota
- [ ] Monitor update feed

## Rollback Plan

If critical bug in release:

1. Re-upload previous `latest.yml` and EXE to update feed
2. Clients will downgrade? electron-updater may not downgrade automatically — may need manual reinstall
3. Fix bug, release patch version
4. Communicate to customers

## Version History Template

### 1.0.0 (02 Sep 2026)

- Initial production release
- Local-first SQLite with WAL, safety backups
- Encrypted Google Drive backup with recovery key
- Admin-issued auth only, no public signup
- License verification with offline grace
- Device activation with stable ID
- NSIS installer with data preservation
- Auto-update with safety backup
- Security hardened Electron

## Checklist for Future Releases

- Update version in package.json
- Update CHANGELOG / what's new
- Run all tests and audits
- Build and verify
- Manual Windows QA
- Deploy to update feed
- Update website
- Notify customers
- Tag in git: `git tag v1.0.1 && git push origin v1.0.1`
