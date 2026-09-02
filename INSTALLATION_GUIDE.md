# Installation Guide — M.S. PUBLIC SCHOOL Management System

## System Requirements

- **OS:** Windows 10 or Windows 11 (64-bit recommended)
- **RAM:** 4 GB minimum, 8 GB recommended
- **Disk:** 500 MB for app + 2 GB for data/backups
- **Internet:** Required for license verification and Google Drive backup (app works offline after first login)
- **No additional software needed:** No Node.js, npm, Python, SQLite, database server required — everything packaged with installer

## Download

1. Go to the official download page (provided by administrator)
2. Click **Download for Windows**
3. File: `SchoolManagementSetup-1.0.0-x64.exe` (approx. 150-200 MB)
4. Save to Downloads folder

## Installation

1. **Run installer:** Double-click `SchoolManagementSetup-1.0.0-x64.exe`
2. **Windows SmartScreen:** If Windows shows "Windows protected your PC", click **More info → Run anyway** (app is not yet signed with EV certificate, future versions will be signed)
3. **Choose install location:** Default is `%LOCALAPPDATA%\Programs\MS PUBLIC SCHOOL Management System` — you can change if needed
4. **Shortcuts:** Installer creates Desktop shortcut and Start Menu shortcut
5. **Finish:** Click **Finish** to launch app

## First Launch

1. App opens to login screen: **Principal Console** or **Teacher Portal**
2. Principal: Enter **School ID / Email** and **Password** issued by administrator
   - There is NO public signup — credentials are admin-issued only
   - If you forgot password, contact administrator
3. Teacher: Enter **6-digit teacher code** issued by principal
4. On first login, app verifies license with server (requires internet)
   - If internet unavailable, uses 7-day offline grace period if previously verified

## Data Location

Your school data is stored locally:

```
%LOCALAPPDATA%\SchoolManagementSystem\
├── database\
│   └── school.sqlite (primary database)
├── backups\
│   └── local-backup-*.json (rolling 10 local backups)
├── safety_backups\
│   └── safety-*.sqlite (pre-restore safety)
├── files\
│   └── uploaded files (photos, etc.)
├── logs\
│   └── app logs, install log
├── config\
│   ├── device.json (stable device ID)
│   └── license.json (license cache)
└── secure\
    ├── auth.enc (session, OS-encrypted)
    ├── license.enc (license, OS-encrypted)
    ├── gdrive_tokens.enc (Google tokens, OS-encrypted)
    └── backup_key.enc (backup encryption key, OS-encrypted)
```

**Important:** Application binaries are separate from mutable data. Updates never delete your data.

## Uninstallation

1. Windows Settings → Apps → M.S. PUBLIC SCHOOL → Uninstall
2. Dialog asks: "Do you want to keep your school data for future reinstall?"
   - **YES:** Keeps `%LOCALAPPDATA%\SchoolManagementSystem\` for future reinstall
   - **NO:** Deletes all data permanently

**Recommendation:** Always choose YES unless you are sure you want to delete all school data.

## Reinstall / Upgrade

- **Reinstall:** Run installer again, it will upgrade existing installation, data preserved
- **Upgrade via auto-update:** App detects new version → prompts → downloads → restarts → data intact
- **Manual upgrade:** Download new EXE and run, same as reinstall

## Troubleshooting Installation

**Installer won't run:**
- Right-click → Run as administrator
- Check antivirus — add exception if needed
- Ensure Windows 10/11 64-bit

**App won't launch:**
- Check `%LOCALAPPDATA%\SchoolManagementSystem\logs\` for logs
- Try reinstall with "Keep data = YES"
- Contact administrator with logs

**License error on first launch:**
- Ensure internet connected for first verification
- Check School ID/email correct
- Contact admin if license expired/suspended

## Security Notes

- App uses OS keychain (DPAPI on Windows) to encrypt sensitive files
- No passwords stored plaintext
- No Google password stored — uses OAuth
- Backup encryption key stored via DPAPI — if Windows user profile deleted, key lost
- Keep recovery key safe (see BACKUP_GUIDE.md)
