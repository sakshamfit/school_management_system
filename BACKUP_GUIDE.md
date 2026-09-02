# Backup Guide — Encrypted Google Drive Backup

## Concept (Simple Language)

```
Your school data is stored locally on your computer.

Google Drive is used as an encrypted backup.

If your computer is lost or damaged,
you can install the application on another
computer and restore your backup after
secure account/recovery verification.
```

Like WhatsApp backup: local chat + encrypted cloud backup to your own Google Drive.

## Why Encrypted?

- Even if someone accesses your Google Drive, they cannot read backup without encryption key
- Encryption key stored securely via Windows keychain (DPAPI)
- Only you can decrypt

## Setup (First Time)

1. Open app → Login → **Settings → Backup** tab
2. You see:

```
Google Drive Backup

Your school data can be safely backed up
to your own Google Drive.

[ Connect Google Drive ]
```

3. Click **Connect Google Drive**
4. System browser opens to **official Google login** (we never ask your Google password)
5. Select your Google account (e.g., `schoolname@gmail.com`)
6. Click **Allow** — app requests only minimal permission: `drive.file` (only files it creates) + email
7. Browser shows "Google Drive Connected — you can close this window"
8. Return to app, you see:

```
Status: ● Connected to Google Drive
Google Account: schoolname@gmail.com
Last Backup: —
[ Backup Now ] [ Restore Backup ] [ Disconnect ]
Automatic Backup: [ ON ] Frequency: Daily
```

## Manual Backup (Backup Now)

1. Click **Backup Now**
2. App does:

```
Check database health
Create snapshot
Package files
Encrypt (AES-256-GCM)
Upload to Google Drive
Verify upload
```

3. Success modal:

```
Backup successful
Google Drive: schoolname@gmail.com
Backup: 02 Sep 2026, 8:42 PM
Size: 24.6 MB
Status: ✓ Verified
[ Close ]
```

4. Verify in Google Drive: Go to drive.google.com → My Drive → SchoolManagementSystem → School_Backup → you see `school-backup-latest.smbak` and timestamped files

## Automatic Backup

- **Default:** Daily, when data changed
- Runs in background, even if Backup page not open
- If no data changed since last backup, skips to avoid unnecessary uploads
- Options: Daily, Weekly, Manual only (in Backup settings)
- Toggle: Automatic Backup [ ON / OFF ]

**No internet?**

```
Cloud backup pending
Internet connection unavailable.
Your local data is safe.
The application will retry the cloud backup automatically.
```

When internet returns, automatic backup resumes.

## Backup History & Retention

In Backup page, you see:

```
Available Google Drive Backups

02 Sep 2026   24.6 MB   ✓ Verified   [ Restore ]
01 Sep 2026   24.1 MB   ✓ Verified   [ Restore ]
...

Retention: Latest + last 7 daily kept, older auto-deleted. Only good backup never deleted before new verified.
```

## Recovery Key — VERY IMPORTANT

### What is it?

Your backup encryption key encoded as human-readable code:

```
Example: AB12-CD34-EF56-...-1234-ABCD (16 groups + checksum)
```

This key can decrypt ALL your backups. **Anyone with this key can access your school data.**

### Why needed?

- Encryption key stored via Windows DPAPI is **machine-bound**
- If Computer A is lost, key is lost → backups unrecoverable
- Recovery key lets you restore on **new PC**

### How to get it?

1. **Settings → Backup → Recovery Key section**
2. Click **Show Recovery Key**
3. App shows warning and key in black box:

```
⚠️ This key can decrypt all your backups. Do not share, email, or store online.
Write it down and keep offline in a safe.

AB12-CD34-... (your key)

[ Copy Key ] [ I Have Saved It ]
```

4. **Write it down on paper, keep in safe/locker**
5. Do NOT email, WhatsApp, or store in Google Drive (it's the key to your Drive backups!)

### New PC Recovery Scenario

```
Computer A lost
    ↓
Computer B: Install app
    ↓
Login with admin-issued credentials
    ↓
Settings → Backup → [ Connect Google Drive ] → same Google account
    ↓
Recovery Key section → [ Import Recovery Key (New PC) ] → enter key you wrote down
    ↓
Available backups appear → [ Restore ] → safety backup created → data restored
    ↓
School dashboard with all data
```

### If you lose recovery key AND old computer?

**Backups become permanently unrecoverable.** This is by design for security — we never store key on server or in backup.

**Mitigation:**
- Write down recovery key immediately after first backup
- Keep two copies in different safe places
- Future: we may add optional secure recovery key export with strong password

## Restore

1. **Settings → Backup → Available Google Drive Backups**
2. Choose date, click **Restore**
3. Warning:

```
WARNING

Restoring this backup will replace the current
local school data with the selected backup.

A safety backup of your current data will
automatically be created first.

Continue? [ Cancel ] [ Restore ]
```

4. App does:

```
Current database → Safety backup
Download cloud backup → Verify checksum → Decrypt → Validate manifest → Validate SQLite → Atomic replacement → Reload
```

5. If anything fails, current database untouched
6. After restore, app reloads with restored data

## Disconnect / Account Change

- **Disconnect:** Settings → Backup → [ Disconnect Google Drive ] → Confirmation: "Your existing cloud backups will remain in your Google Drive. Disconnecting only removes connection." → [ Disconnect ]
- **Connect another account:** After disconnect, [ Connect Google Drive ] again with different Google account
- Old backups remain in old account's Drive, not deleted

## Local Backup (Still Exists)

Google Drive backup does NOT replace local backup:

```
%LOCALAPPDATA%\SchoolManagementSystem\
├── database\school.sqlite (primary)
├── backups\local-backup-*.json (rolling 10)
└── Google Drive Backup (encrypted)
```

You can also manually export JSON via Settings → School Profile → Export JSON or Client Handover Hub.

## Troubleshooting Backup

**"Not connected to Google Drive":**
- Click Connect, complete OAuth flow

**"Internet unavailable":**
- Check internet, backup will retry automatically

**"Decryption failed: invalid key":**
- Wrong recovery key or key lost — try correct recovery key
- If key permanently lost, backup unrecoverable

**"Checksum mismatch, corrupted archive":**
- Backup file corrupted in Drive — try older backup
- Check Google Drive storage full?

**"Database validation failed":**
- Backup contains invalid data — try older backup, contact admin with logs

**"Google authorization revoked":**
- You removed app access in Google account settings → Reconnect Drive

**Logs:** `%LOCALAPPDATA%\SchoolManagementSystem\logs\`

## Security Summary

- Backup encrypted with AES-256-GCM before leaving computer
- Key stored via OS keychain, never plaintext, never in .env, never in backup, never sent to server, never logged
- Raw SQLite never uploaded
- Only you can access backup in your Drive
- We never store Google password
- Official Google OAuth flow, minimal scopes
