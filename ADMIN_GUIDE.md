# Admin Guide — School Management System

## Overview

This guide is for system administrator who manages schools, licenses, devices, and support.

## Admin Responsibilities

- Create schools
- Generate credentials (School ID/email + password, teacher codes)
- Manage licenses (create, extend, suspend, revoke, device limits)
- View/deactivate devices
- Monitor backup metadata (not contents)
- Support customers

## School Management

### Create School

1. Admin panel → Schools → Create
2. Enter: School name, tagline, principal, address, phone, email (will be login ID), affiliation, session, currency
3. System generates:
   - School ID (e.g., `msps_2026`)
   - Initial password (random, 12 chars, never shown plaintext after creation except once)
4. **Important:** Copy password immediately and send securely to principal (WhatsApp, phone call, not email if possible). After creation, password not shown plaintext again.

### Credentials

- **Principal login:** School email/ID + password
- **Never plaintext after creation:** Store only hashed (PBKDF2/bcrypt)
- **Reset password:** Admin panel → School → Reset password → new random password generated, show once, send to principal
- **Teacher codes:** Principal creates via app (Teachers → Add), 6-digit, managed by principal, admin can view list if needed

### Archive / Suspend / Delete

- **Suspend:** School cannot login, data preserved, license remains
- **Archive:** Soft delete, hidden from active list, can restore
- **Delete:** Hard delete only after archive, requires confirmation

## License Management

### License States

- **ACTIVE:** School can use app, backup works
- **EXPIRED:** Past expiration date, app shows expired, login blocked after grace
- **SUSPENDED:** Admin suspended (e.g., payment overdue), login blocked
- **REVOKED:** Permanently revoked, cannot be reactivated without admin
- **DEVICE_LIMIT:** Max devices reached, need deactivation or increase limit
- **OFFLINE_GRACE:** Last verification offline, within 7-day grace, works but shows warning

### Create License

1. Admin → Licenses → Create
2. Select school
3. Enter: Expiration date, max devices (default 3), notes
4. Create — status ACTIVE

### Extend License

1. Admin → Licenses → Select license → Extend
2. Enter new expiration date
3. Save — school gets new expiration on next verification (or immediate if online)

### Suspend / Revoke

- **Suspend:** License → Suspend → reason (e.g., payment). School sees SUSPENDED on login attempt, cannot use app.
- **Revoke:** License → Revoke → permanent, requires explicit confirmation
- **Reactivate:** Suspended license can be reactivated → ACTIVE

### Device Limit

- Default 3 devices per school (e.g., office PC, principal laptop, reception)
- If school tries 4th device: DEVICE_LIMIT error, admin must either increase limit or deactivate old device
- Admin can view devices: Admin → Devices → filter by school → see device ID, name, last active, status

## Device Management

### View Devices

- Admin → Devices
- Columns: School, Device ID (hash for privacy), Device name, Last active, Status (active/inactive), IP hash

### Deactivate Device

1. Devices → Select device → Deactivate
2. Device becomes inactive, cannot sync, school can then activate new device within limit
3. Deactivated device on next launch shows "Device deactivated, contact admin"

### Reactivate Device

- Devices → Select deactivated → Reactivate

### Stable Device ID

- Generated per installation: random installId + hostname hash
- Not invasive: no MAC, no serial, no hardware fingerprint
- Stored in `%LOCALAPPDATA%\SchoolManagementSystem\config\device.json` with 0600 perms
- Privacy-preserving hash sent to license server, not raw hostname

## Backup Monitoring

### What Admin Sees

- School name
- Last backup timestamp
- Backup status (success, failed, never)
- Google account connected (email)
- App version
- Backup size

### What Admin NEVER Sees

- Actual school database contents (students, fees, etc.)
- Decrypted backup
- Encryption key / recovery key
- Google access token / refresh token

### Support Backup Issues

- If customer says backup failed: ask for logs at `%LOCALAPPDATA%\SchoolManagementSystem\logs\`
- Common issues: no internet, Google auth revoked, Drive storage full, recovery key lost
- Guide customer to BACKUP_GUIDE.md and TROUBLESHOOTING.md

## Support Workflow

### Forgot Password

1. Verify identity (call principal)
2. Admin → School → Reset password → new password shown once
3. Send securely to principal, instruct to change after login (future feature)

### License Expired

1. Check expiration in admin panel
2. If payment received, extend license
3. Inform customer to connect internet for verification

### Device Limit Reached

1. Check devices list for school
2. Identify old/unused devices, deactivate with customer confirmation
3. Or increase max devices if needed

### Cannot Restore on New PC

1. Ask: Did you connect same Google account?
2. Ask: Do you have recovery key?
3. If no recovery key and old PC lost: explain unrecoverable, need to start fresh (security design)
4. If old PC accessible: guide to show recovery key and import on new PC

### App Crashes / Data Issues

1. Ask for logs
2. Check if database corrupted: app automatically handles via safety backups
3. Guide to restore from Google Drive or local backups
4. If needed, instruct to copy safety backup from `safety_backups/` to `database/school.sqlite` and restart

## Security Practices for Admin

- Never share admin credentials
- Never log passwords, tokens, encryption keys, recovery keys
- Never store school passwords plaintext — only hash
- When sending password to principal, use secure channel, not email if possible
- Admin panel itself should have 2FA (future)
- Regularly rotate admin password
- Keep admin panel HTTPS only

## Production Servers

- License server: `LICENSE_SERVER_URL` (prod)
- Auth server: `AUTH_SERVER_URL` (prod)
- Both HTTPS, no localhost in prod
- Server authoritative for license, client cannot manufacture license

## Release Management

- When new version ready: build via `npm run dist:win` on Windows
- Upload `SchoolManagementSetup-x.x.x.exe` + `latest.yml` to update feed
- Test installer on Win10/11
- Verify data preservation on upgrade
- Notify customers of update (auto-update will detect)
- Keep old installers for rollback

## Documentation for Customers

Provide customers:

- INSTALLATION_GUIDE.md
- CUSTOMER_GUIDE.md
- BACKUP_GUIDE.md
- RESTORE_GUIDE.md
- TROUBLESHOOTING.md

## Logs and Auditing

- Admin actions logged: create school, reset password, suspend license, deactivate device
- Customer app logs at `%LOCALAPPDATA%\SchoolManagementSystem\logs\`
- Never log sensitive data

## Emergency Procedures

### School Data Loss

1. Check if customer has Google Drive backup → guide restore
2. Check if customer has local backups in `backups/` folder
3. Check safety backups in `safety_backups/`
4. If all lost and no recovery key: data unrecoverable, explain, help start fresh

### License Server Down

- Clients have 7-day offline grace, so short downtime OK
- Fix server ASAP, clients auto-reverify when online

### Security Incident

- If suspected breach: suspend affected school licenses, force password reset, review logs
- Notify customers if needed
- Fix vulnerability, release update
