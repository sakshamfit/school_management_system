# Troubleshooting Guide — M.S. PUBLIC SCHOOL Management System

## Installation Issues

### Installer won't run

- **Symptom:** Double-click does nothing or error
- **Fix:**
  - Right-click → Run as administrator
  - Check Windows 10/11 64-bit
  - Disable antivirus temporarily, add exception
  - Ensure file not corrupted — re-download

### SmartScreen blocks installer

- **Symptom:** "Windows protected your PC"
- **Fix:** Click **More info → Run anyway** (app not yet EV-signed, future will be signed)

### App won't launch after install

- **Symptom:** Click shortcut, nothing happens
- **Fix:**
  - Check Task Manager → End existing SchoolManagement processes → Try again
  - Check logs: `%LOCALAPPDATA%\SchoolManagementSystem\logs\`
  - Reinstall with "Keep data = YES"
  - Contact admin with logs

## Login Issues

### "Invalid credentials"

- **Fix:**
  - Check School ID/email exactly as issued (case sensitive? email lowercased)
  - Check password — ensure Caps Lock off
  - Contact admin to reset password
  - No public signup — credentials admin-issued only

### "License expired"

- **Fix:**
  - Connect internet, restart app — may need re-verification
  - Contact admin to extend license

### "License suspended/revoked"

- **Fix:** Contact admin — payment or policy issue

### "Device limit reached"

- **Fix:**
  - Contact admin to deactivate old device or increase limit
  - Default 3 devices — if you changed PC, old device counts

### "Device deactivated"

- **Fix:** Contact admin to reactivate

### Offline login fails

- **Fix:**
  - First login requires internet
  - After first login, 7-day offline grace — if beyond 7 days without internet, connect internet once
  - Check system date/time correct (affects token expiry)

## Database / Data Issues

### "Database corrupted"

- **Fix:** App auto-handles:
  - Moves corrupted to `*.corrupted-*`
  - Restores from `safety_backups/` or `backups/`
  - If auto fails, manually copy safety backup:
    ```
    Copy: %LOCALAPPDATA%\SchoolManagementSystem\safety_backups\safety-*.sqlite
    To: %LOCALAPPDATA%\SchoolManagementSystem\database\school.sqlite
    Restart app
    ```
  - Contact admin if still fails

### App freezes / slow

- **Fix:**
  - Low RAM — close other apps, 4GB min, 8GB recommended
  - Large DB — backup may take time, wait
  - Check Task Manager CPU/RAM
  - Restart app, restart Windows
  - Check logs for errors

### Data missing after update

- **Fix:**
  - Updates preserve data — check if you accidentally chose "NO" on uninstall prompt
  - Check `safety_backups/` for pre-update backup
  - Restore from Google Drive backup if available
  - Contact admin

## Backup Issues

### "Not connected to Google Drive"

- **Fix:** Settings → Backup → Connect Google Drive → complete OAuth flow

### "Internet unavailable" during backup

- **Fix:**
  - Check internet connection
  - App auto-retries when online
  - Manual backup: click Backup Now when online

### Backup fails / "Upload failed"

- **Fix:**
  - Check Google Drive storage full? Free space or buy more
  - Check internet stable
  - Check logs
  - Try again later — exponential backoff
  - Contact admin if persistent

### "Google authorization revoked"

- **Symptom:** You removed app access in Google account
- **Fix:** Settings → Backup → Connect Google Drive again

### "Decryption failed: invalid key" on restore

- **Fix:**
  - Wrong recovery key — ensure you entered correct key from old PC
  - Recovery key is case-insensitive but must be exact hex
  - If key lost and old PC lost → backup unrecoverable (security design)

### "Checksum mismatch, corrupted archive"

- **Fix:** Backup file corrupted in Drive — try older backup from list

### "Database validation failed" on restore

- **Fix:** Backup contains invalid data — try older backup, contact admin

### No backups listed after connecting Drive

- **Fix:**
  - Ensure same Google account as backups
  - Check drive.google.com → My Drive → SchoolManagementSystem → School_Backup → files exist?
  - Click Refresh
  - If new PC, ensure recovery key imported (otherwise cannot decrypt list? Actually list should still show encrypted files)
  - Check internet

### Recovery key lost

- **Fix:**
  - If old PC accessible: Old PC → Settings → Backup → Show Recovery Key → write down
  - If old PC lost and key lost: Backups unrecoverable — start fresh, set up new backup and immediately save recovery key
  - Keep two copies in safe places in future

## Google Drive Backup Confusion

### Can I see backup contents in Drive?

- **No** — encrypted `.smbak` file, cannot read without app and key
- Don't try to open directly — use app Restore

### Can I share backup file with someone?

- **No** — contains encrypted school data, but if they have recovery key they can decrypt
- Don't share `.smbak` or recovery key

### Drive storage full

- **Fix:** Free up Drive space or purchase Google One storage
- Retention auto-deletes old backups beyond 7 daily, but if Drive full, upload fails

## Printing Issues

### Print not working

- **Fix:**
  - Check printer connected, default printer set
  - Try Ctrl+P → select printer
  - Export CSV and print via Excel if needed

## Update Issues

### Update available but fails to install

- **Fix:**
  - Close app completely, run installer manually
  - Check internet
  - Check logs
  - Safety backup created before update — data safe

### After update, app version still old

- **Fix:**
  - Restart Windows
  - Check if you have two installations (user vs machine) — uninstall one with Keep data YES, reinstall new

## Uninstall / Reinstall

### Uninstall asks "Keep data?"

- **Choose YES** unless you want to permanently delete all school data
- Data at `%LOCALAPPDATA%\SchoolManagementSystem\` kept if YES

### Reinstall shows empty data

- **Fix:**
  - Did you choose NO on uninstall? Data deleted
  - Check if you have Google Drive backup → restore
  - Check if you have local JSON export → import
  - Check `safety_backups/` folder still exists?

## Logs Location

```
%LOCALAPPDATA%\SchoolManagementSystem\logs\
```

Include logs when contacting support.

## When to Contact Admin

- License issues
- Forgot password / device limit / deactivation
- Recovery key lost but old PC accessible (guide to retrieve)
- Backup/restore fails after trying above
- Database corrupted and auto-recovery fails
- App crashes repeatedly — provide logs

## Quick Checklist

- [ ] Windows 10/11 64-bit?
- [ ] 4GB RAM min?
- [ ] Internet for first login and backup?
- [ ] Correct School ID/email + password?
- [ ] License active?
- [ ] Device limit not exceeded?
- [ ] Google Drive connected with correct account?
- [ ] Recovery key saved offline?
- [ ] Disk space at %LOCALAPPDATA%?
- [ ] Logs checked?
