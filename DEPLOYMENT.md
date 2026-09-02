# 🏫 M.S. PUBLIC SCHOOL — Deployment & Client Handover Guide

Comprehensive guide for deploying, packaging as a Desktop App, and delivering the **M.S. Public School Management Portal** to your client.

---

## 📋 Client Credentials & Master Access Sheet

Share these credentials with the school principal and administrators:

| Role | Access Type | Login Identifier | Password / Access Code | Permissions |
| :--- | :--- | :--- | :--- | :--- |
| **Principal / Super Admin** | Email & Password | `mozammilalam1996@gmail.com` | `9931066436@` | Full system control: Faculty, Students, Fee Treasury, Marksheets, Audit Logs, Settings, Backup |
| **Faculty / Class Teachers** | 6-Digit Code | Any registered Teacher Code (e.g. `501001`, `501002`) | *No password required* | Live Class Attendance, Mark Entry, Student Observations, Multi-device access |

---

## 🚀 Option 1: Live Web & Cloud Deployment (Recommended)

This allows the principal and all teachers to access the school portal simultaneously from any PC, laptop, or mobile phone.

### 1. Build the Production Application
Run the build script to generate the optimized, production-ready static bundle in `/dist`:

```bash
npm run build
```

### 2. Deployment Targets

#### A. Vercel (Fastest — 1 Minute)
1. Push this project to GitHub.
2. Go to [vercel.com](https://vercel.com) and click **"Add New Project"**.
3. Import the repository.
4. Set:
   - **Framework Preset**: `Vite`
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
5. Click **Deploy**. You will receive a live URL (e.g. `https://mspublicschool.vercel.app`) with free automatic SSL.

#### B. Firebase Hosting
```bash
# Install Firebase CLI if not already installed
npm install -g firebase-tools

# Login to Firebase
firebase login

# Deploy static files
firebase deploy --only hosting
```

#### C. Custom School Domain (e.g. `portal.mspublicschool.edu.in`)
In your Vercel or Firebase dashboard, navigate to **Domains** and add the school's custom sub-domain with a standard CNAME record.

---

## 🖥️ Option 2: 1-Click Desktop App (Windows & Mac)

Once the app is running (or deployed), the client can install it as a **native desktop application** with zero technical setup:

### On Windows 10 / 11 (Google Chrome or Microsoft Edge):
1. Open the portal URL in **Chrome** or **Edge**.
2. Click the **Install App icon (⊕)** on the right side of the address bar, or click **Settings (⋮) → "Install M.S. Public School"**.
3. Click **Install**.
4. ✅ A dedicated desktop window will launch, and a shortcut is placed on the **Windows Desktop** and **Start Menu**.

### On macOS (Apple Safari):
1. Open the portal in **Safari**.
2. From the top Apple menu bar, select **File → Add to Dock...**
3. Click **Add**.
4. ✅ The school app will appear directly in the **Mac Dock** and **Launchpad / Applications**.

---

## 📦 Option 3: Standalone Desktop Executable (.exe / .dmg) — Production

This is the **recommended production delivery** for schools that want a fully offline-capable Windows app with Google Drive encrypted backup.

### Architecture

```
Windows PC
    ↓
Local SQLite (primary)
    ↓
Electron App (React + SQLite)
    ├── Local Backup (AppData/backups/)
    └── Google Drive Backup (encrypted .smbak to school owner's Drive)
```

### Prerequisites for Build Machine

- Node.js 18+ installed
- `GOOGLE_CLIENT_ID` environment variable set (Google OAuth client ID for installed app)

Example:

```bash
# Create Google OAuth Client ID at https://console.cloud.google.com/apis/credentials
# Type: Desktop App, Name: SchoolManagementSystem
# Copy Client ID

export GOOGLE_CLIENT_ID="123456789-abcdefg.apps.googleusercontent.com"
```

### 1. Test Desktop App locally:
```bash
npm run build
npx electron .
```

### 2. Build Native Windows Installer (`.exe`):
```bash
npm run desktop:win
```
*Output: Generates a standalone Windows setup executable in `/dist_electron/`.*

The EXE is self-contained and includes:
- Electron runtime
- React frontend
- SQLite database
- Backup encryption (AES-256-GCM)
- Google Drive client
- No need for Node.js, SQLite, or any external DB on client PC

### 3. Build macOS App (`.dmg`):
```bash
npm run desktop:mac
```

### 4. Deliver to School

Final UX:

```
INSTALL EXE
     ↓
LOGIN (principal email/password)
     ↓
DASHBOARD
     ↓
SETTINGS → BACKUP
     ↓
CONNECT GOOGLE DRIVE (official Google OAuth)
     ↓
SELECT GOOGLE ACCOUNT
     ↓
ALLOW ACCESS (drive.file only)
     ↓
✓ GOOGLE DRIVE CONNECTED
     ↓
DAILY AUTOMATIC BACKUPS (encrypted)
```

School owner does NOT need Node.js, npm, Python, SQLite, PostgreSQL, MongoDB, Firebase config.

---

## 💾 Database Backup, Restore & Cloud Sync

### Local-First Architecture

Primary data lives in **Local SQLite** at:

```
%APPDATA%/SchoolManagementSystem/
    database/school.sqlite
    backups/local-backup-*.json (rolling 10)
    safety_backups/ (pre-restore safety)
    backup/metadata.json
    secure/gdrive_tokens.enc (OS-encrypted)
    secure/backup_key.enc (OS-encrypted)
```

### Firestore Real-Time Sync (Legacy/Web)

- Every student added, roll-call taken, fee payment collected, or exam mark entered syncs automatically to **Cloud Firestore** (for web version).
- Offline mode: works uninterrupted using local cache and syncs back when reconnected.

### Google Drive Encrypted Backup (New, Production)

- **Location:** School owner's own Google Drive
- **Folder:** `My Drive/SchoolManagementSystem/School_Backup/`
- **Files:** `school-backup-latest.smbak`, `school-backup-2026-09-02-*.smbak`
- **Encryption:** AES-256-GCM, key stored via OS keychain (DPAPI on Windows)
- **Format:** `.smbak` = encrypted archive containing manifest.json, school.sqlite, uploads/, settings/, metadata/
- **Raw SQLite never uploaded**

#### Manual Backup

1. Open **Settings → Backup** (or School Settings → Backup tab)
2. If not connected: click **Connect Google Drive** → select Google account → Allow
3. Click **Backup Now**
4. Success modal shows: Google account, backup time, size, Verified status

#### Automatic Backup

- Runs in Electron main process, not dependent on React being open
- Default: Daily, when data changed
- Options: Daily, Weekly, Manual only
- Handles offline: marks as pending, retries when internet returns
- No excessive Drive API requests

#### Restore

1. **Settings → Backup → Available Google Drive Backups**
2. List shows date, size, Verified badge
3. Click **Restore** on desired backup
4. Warning modal: "Restoring will replace current local data. Safety backup will be created first. Continue?"
5. Safety backup created → Download → Verify checksum → Decrypt → Validate manifest → Validate SQLite → Atomic replacement → Reload app
6. If anything fails, current database remains untouched

#### Retention

- Default: Latest + last 7 daily
- Safe rotation: never deletes only good backup before verifying new one
- Older backups auto-cleaned

#### Account Change

- **Disconnect:** "Your existing cloud backups will remain in your Google Drive. Disconnecting only removes connection." Does NOT delete Drive files.
- **Reconnect:** Connect another Google account

#### Offline Handling

```
Internet disconnected → App works normally, backup pending
Internet returns → Automatic backup to Drive
Upload fails halfway → Not marked as successful, temp file cleaned, retry
```

### Security

- OAuth tokens never in renderer, only main process + OS secure storage
- Encryption keys never in logs, never plaintext
- Raw SQLite never uploaded
- Path traversal protection, archive size limits, checksum verification
- Admin sees only operational metadata (backup enabled, last time, status), never school data

---

## 🔐 Google OAuth Setup for Production

1. Go to https://console.cloud.google.com/apis/credentials
2. Create Project: `SchoolManagementSystem`
3. Enable Google Drive API
4. Create OAuth consent screen: External, add scopes `drive.file` and `userinfo.email`
5. Create Credentials → OAuth Client ID → Application type: **Desktop App**
6. Name: `SchoolManagementSystem Desktop`
7. Copy Client ID (e.g., `123456789-abc...apps.googleusercontent.com`)
8. Set env var `GOOGLE_CLIENT_ID` before building EXE
9. Client ID is public for installed apps, but keep config in env, not hardcoded in renderer

**Never ship:** service account private key, Google server secret, license secret, Supabase service role key inside EXE.

---

## 💬 WhatsApp Integration for Parents

- **Automated Fee Receipts**: When a payment is recorded, click **"WhatsApp Receipt"** to open a pre-formatted message addressed to the parent with invoice number, student name, class, amount paid, and remaining balance.
- **Absence Alerts**: When roll-call is completed, absence notifications with school helpline details can be sent to absent students' parents with one tap.
- **Report Cards**: Term marksheets and performance remarks can be shared directly to parents' WhatsApp.

---

## 🧪 Testing

### Automated Tests

```bash
npm run test:backup   # Backup package, encryption, restore, security
npm run test:gdrive   # Google Drive auth, upload, listing, etc.
npm run test:all      # All tests
```

All tests pass without needing real Google credentials (mocks).

### Manual Windows QA Checklist

```
Fresh install
    ↓
Login
    ↓
Connect Google Drive
    ↓
Create school data
    ↓
Backup Now → Verify file in Google Drive (My Drive/SchoolManagementSystem/School_Backup/)
    ↓
Close application
    ↓
Reopen → Automatic backup check
    ↓
Delete/change local data
    ↓
Restore previous backup → Verify school data
```

Also test:
- Internet disconnected → app works, backup pending banner
- Google account disconnected → can reconnect
- Google token expired → auto refresh
- PC restart during backup → retry on next start
- Application update → encryption key preserved
- Windows restart → scheduler starts
- Low disk space → error handling
- Large database → size limits (500MB max)
- Corrupted backup → rejected with checksum error

---

## 📞 Support & Maintenance

For institutional assistance or custom configuration, contact the system administrator or open the **School Settings** console.

### Backup Documentation

See `BACKUP_SYSTEM.md` for detailed architecture, security audit, and implementation details.
