# Restore Guide — Recover Your School Data

## When to Restore?

- You deleted students/teachers by mistake
- Database corrupted
- You want to go back to previous date
- New PC after old PC lost (see BACKUP_GUIDE.md recovery key section)

## Restore from Google Drive (Desktop App)

### Prerequisites

- Desktop app installed
- Logged in as principal
- Google Drive connected (same account that has backups)
- Recovery key available if new PC (see BACKUP_GUIDE.md)

### Steps

1. **Open Backup page:** Settings → Backup tab
2. **Check connection:** Should show "Connected to Google Drive" with your email
   - If not connected: Click **Connect Google Drive** → same Google account → Allow
   - If new PC: Also import recovery key via **Recovery Key → Import Recovery Key (New PC)**
3. **View available backups:** List shows date, size, Verified badge

```
Available Google Drive Backups

02 Sep 2026   24.6 MB   ✓ Verified   [ Restore ]
01 Sep 2026   24.1 MB   ✓ Verified   [ Restore ]
31 Aug 2026   23.9 MB   ✓ Verified   [ Restore ]
```

4. **Choose backup:** Pick date you want to restore (newest is usually best unless you need older)
5. **Click Restore:** Warning modal appears

```
WARNING

Restoring this backup will replace the current
local school data with the selected backup.

A safety backup of your current data will
automatically be created first.

Continue? [ Cancel ] [ Restore ]
```

6. **Confirm Restore:** Click **Restore**
7. **Wait:** App shows progress

```
Downloading backup from Google Drive...
Verifying checksum...
Decrypting...
Validating...
Creating safety backup...
Replacing database...
```

8. **Success:** App reloads with restored data

```
Your school data has been restored to 02 Sep 2026, 8:42 PM
Safety backup of previous data saved at: .../safety_backups/safety-*.sqlite
```

9. **Verify:** Check dashboard, students, fees — should match backup date

### Safety Backup

Before restore, app creates safety backup at:

```
%LOCALAPPDATA%\SchoolManagementSystem\safety_backups\safety-*.sqlite
```

If restore was wrong, you can restore safety backup via manual file copy or contact admin.

### What if restore fails?

- **"Decryption failed":** Wrong recovery key — enter correct key
- **"Checksum mismatch":** Corrupted backup — try older backup
- **"Database validation failed":** Invalid backup — try older
- **"Internet unavailable":** Connect internet and retry
- **Current database remains untouched** if restore fails

## Restore from Local JSON Backup

If you have local JSON backup (from Export JSON):

1. **Settings → School Profile → Client Handover Hub → Database Backup & Restore tab**
2. **Upload & Restore Backup:** Click button, select `.json` file
3. App imports and syncs

Or via file system:

1. Copy backup JSON to `%LOCALAPPDATA%\SchoolManagementSystem\database\restored.json`
2. Restart app
3. App should load restored data (if implemented) or manually import via UI

## New PC Full Recovery (Computer Lost)

**You need:**
- New PC with app installed
- Admin-issued login credentials
- Same Google account that has backups
- Recovery key you wrote down from old PC

**Steps:**

```
1. Install app on Computer B (SchoolManagementSetup.exe)

2. Launch → Login with admin credentials

3. Settings → Backup

4. Connect Google Drive → select SAME Google account as old PC → Allow

5. Recovery Key section → Import Recovery Key (New PC) → enter key you saved

6. Available backups appear from Drive

7. Click Restore on latest backup

8. Confirm warning → wait → app reloads with all data

9. Verify dashboard
```

**If you don't have recovery key:**

- If old PC still accessible: Go to old PC → Settings → Backup → Show Recovery Key → write down
- If old PC lost AND recovery key lost: **Backups unrecoverable** — security design, key never stored on server
- Contact admin — may need to start fresh, but local backups on old PC also lost if PC lost

## Restore Best Practices

- **Before restore:** Export current data via Export JSON as extra safety (in addition to automatic safety backup)
- **Test restore:** Occasionally test restore on test PC to ensure backups work
- **Keep multiple backups:** Retention keeps 7 daily + latest, but also keep external JSON backups monthly
- **Verify after restore:** Check student count, fee totals, recent attendance

## Troubleshooting

**No backups listed:**
- Check Google Drive connected with correct account
- Check Drive folder: My Drive → SchoolManagementSystem → School_Backup → files exist?
- Check internet
- Click Refresh

**Restore button disabled:**
- Backup in progress — wait
- Check internet

**"Safety backup failed":**
- Check disk space at `%LOCALAPPDATA%\SchoolManagementSystem\`
- Check permissions

**App crashes after restore:**
- Restore safety backup manually: copy file from `safety_backups/` to `database/school.sqlite`
- Check logs at `logs/`
- Contact admin

## Logs Location

```
%LOCALAPPDATA%\SchoolManagementSystem\logs\
```

Include logs when contacting support.
