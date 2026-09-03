# RELEASE GUIDE — From `git clone` to Published Desktop EXE + Android APK

Complete, exact, ordered checklist. Follow top to bottom the first time;
after initial setup, a new release is only **Phase 7**.

---

## Phase 0 — One-time prerequisites (your build machine)

| Tool | Windows build machine | Notes |
|---|---|---|
| Node.js 20 or 22 LTS | ✅ https://nodejs.org | `node -v` shows v20/v22 |
| Git | ✅ https://git-scm.com | |
| **Android Studio (for APK)** | ✅ https://developer.android.com/studio | installs JDK 17 + Android SDK + Gradle |
| Authenticode certificate (optional, for signed EXE) | 🔶 optional | DigiCert/Sectigo EV cert; unsigned EXE still works but shows SmartScreen |
| Android signing keystore | ✅ required for APK distribution | created in Phase 5 (free, self-generated) |
| Code signing cert | not needed for APK | keystore replaces it |

> Build on **Windows 10/11** — the EXE is a Windows NSIS installer and the
> Windows build must run on Windows. The same machine builds the APK fine.

---

## Phase 1 — Pull the repository & install

```bash
git clone https://github.com/sakshamfit/school_management_system.git
cd school_management_system
npm install          # takes ~2-5 min on first run (compiles better-sqlite3)
```

Verify the project is healthy **before** continuing:

```bash
npm run test:all     # tsc type-check + 36 server tests → must be 36/36 PASS
npm run audit:prod   # secret scanner → must print "audit:prod PASSED"
```

Create your env file (never committed):

```bash
cp .env.example .env
# edit .env — for build-only purposes nothing must be filled; the server
# deployment (.env on the SERVER) is the one that needs real secrets.
```

---

## Phase 2 — (One-time) Deploy the control-plane server

The EXE/APK login screens call your control plane over HTTPS. You need one
VPS (Ubuntu 22.04+, e.g. DigitalOcean/Hostinger/AWS Lightsail). Full detail
is in **CONTROL_PLANE.md §5**, summary:

```bash
# ON THE SERVER:
git clone https://github.com/sakshamfit/school_management_system.git /opt/sms
cd /opt/sms && npm install && npm run build:admin && cd server && npx tsc -p tsconfig.json || true
cp .env.example /opt/sms/.env && nano /opt/sms/.env
#  Set: NODE_ENV=production, PORT=8080, LICENSE_TOKEN_SECRET=<openssl rand -hex 32>,
#       CORS_ORIGINS=https://your-admin-domain (or leave empty for same-origin),
#       DATABASE_PATH=/opt/sms/server/data/control-plane.db
DATABASE_PATH=/opt/sms/server/data/control-plane.db node server/scripts/bootstrap.js \
  --email admin@yourcompany.com --name "Owner"
#   → prints a ONE-TIME temporary admin password. Save it; it is shown once.
sudo systemctl enable --now schoolmgmt-controlplane   # unit file: CONTROL_PLANE.md §5.3
# Point Nginx/TLS: api.yourcompany.com → 127.0.0.1:8080, HTTPS only (certbot --nginx)
```

Sanity check:

```bash
curl https://api.yourcompany.com/health     # {"status":"ok",...}
```

Then log in to **https://api.yourcompany.com/admin** with the bootstrap
credentials, change the password (System page), and stop.

---

## Phase 3 — (One-time) Firebase console for the school app

The school data layer uses Firebase Auth + Firestore (`DEPLOYMENT.md`):

1. Firebase console → your project → **Authentication → Sign-in method**
   - enable **Email/Password** AND **Anonymous**
2. Firestore → publish the hardened rules from the repo:
   ```bash
   npm i -g firebase-tools && firebase deploy --only firestore:rules
   # or paste firestore.rules into the console editor manually
   ```
3. Authentication → Users → **Add user**: the principal's real email + a
   temporary password (they log in from the desktop app and must change it).

---

## Phase 4 — Build the Windows EXE (desktop installer)

Back on the **Windows build machine**, repo root:

```powershell
# 1. Point the EXE at your production control plane (HTTPS!) — required:
$env:SMS_API_URL = "https://api.yourcompany.com"
$env:SMS_UPDATE_CHANNEL = "stable"
$env:SMS_SUPPORT_CONTACT = "support@yourcompany.com"   # shown in About/Support

# 2. Code signing (optional; skip vars → unsigned but functional):
$env:CSC_LINK = "C:\certs\yourcode.pfx"
$env:CSC_KEY_PASSWORD = "<pfx password>"

# 3. Build! This does everything: build-config → web bundle → admin bundle → NSIS
npm run dist:win

# 4. Verify the packaging gate:
npm run release:check    # must print "release:check PASS"
```

Output:

```
release/SchoolManagementSetup-1.0.0.exe     ← the installer to ship
release/latest.yml                          ← auto-update metadata (ship too)
release/SchoolManagementSetup-1.0.0.exe.blockmap
```

**Smoke-test before publishing:** install the EXE on a clean Windows VM with
no Node, log in with a real school credential, unplug network → offline-grace
screen appears, data still opens read-only (§32 QA matrix in PRODUCTION_REPORT.md).

> ⚠️ Per the final production report: the EXE pipeline is code-complete, but
> Windows-machine QA is mandatory before customers get it (SmartScreen,
> AV false positives, explorer integration can only be tested on Windows).

---

## Phase 5 — Build the Android APK

Same Windows machine, repo root. The native project under `android/` is
already committed — you only create the keystore once.

### 5.1 (One-time) Create your Android signing keystore

```powershell
keytool -genkey -v -keystore schoolmgmt-release.keystore -alias schoolmgmt ^
  -keyalg RSA -keysize 2048 -validity 10000 -dname "CN=Your Company, O=Your Company, C=IN"
```

🔒 **Back this file up securely + remember both passwords.** Lose it and you
can never update an installed APK again (users would have to reinstall).

### 5.2 Build the signed APK

```powershell
$env:SMS_API_URL = "https://api.yourcompany.com"   # same server as the EXE

$env:SMS_ANDROID_KEYSTORE_FILE     = "C:\keys\schoolmgmt-release.keystore"
$env:SMS_ANDROID_KEYSTORE_PASSWORD = "<keystore password>"
$env:SMS_ANDROID_KEY_ALIAS         = "schoolmgmt"
$env:SMS_ANDROID_KEY_PASSWORD      = "<key password>"

npm run android:apk            # build web → cap sync → gradle assembleRelease
```

Output:

```
SchoolManagement-Android.apk          ← signed, installable APK
```

(Quick test without signing ceremony: `cd android && gradlew assembleDebug`
→ `app\build\outputs\apk\debug\app-debug.apk`, debug-signed automatically.
**Debug APKs are for testing only**, never ship to customers.)

### 5.3 Verify on a real device

```powershell
adb install SchoolManagement-Android.apk
# App opens → school login screen → sign in with Firebase principal account.
# (Android uses Firebase Auth / web flow — no device-activation slot is
#  consumed; device limits apply to desktop EXE installations only.)
```

Bump `versionCode`/`versionName` in `android/app/build.gradle` for every
subsequent APK (Google's tooling requires monotonically increasing codes).

---

## Phase 6 — Publish the GitHub Release

```powershell
git tag v1.0.0 && git push origin v1.0.0     # optional: tag the commit

gh release create v1.0.0 ^
  "release/SchoolManagementSetup-1.0.0.exe" ^
  "release/latest.yml" ^
  "SchoolManagement-Android.apk" ^
  --title "School Management System v1.0.0" ^
  --notes-file RELEASE_NOTES.md ^
  --repo sakshamfit/school_management_system
```

→ Release is live at
`https://github.com/sakshamfit/school_management_system/releases`.
The `latest.yml` URL pattern there is also what the desktop auto-updater feed
reads (wire it into the control plane Releases page next).

### Then register it in the control plane (so EXEs see the update)

Admin panel → **Releases** → *Create release*:
- version `1.0.0`, channel `stable`
- download URL: the GitHub release's `.exe` asset URL (or your CDN URL)

New/updated EXEs now self-discover the update via `GET /releases/latest`.

---

## Phase 7 — After the first time: cutting release N+1

```powershell
git pull origin main
npm install                                # only if package-lock changed
npm run test:all && npm run audit:prod     # gates — must PASS
# bump version in package.json AND android/app/build.gradle (code & name)
$env:SMS_API_URL = "https://api.yourcompany.com"
npm run dist:win                            # EXE
npm run android:apk                         # APK (keystore env vars set)
npm run release:check                       # final gate
git tag v1.0.1 && git push origin v1.0.1
gh release create v1.0.1 release/SchoolManagementSetup-1.0.1.exe release/latest.yml SchoolManagement-Android.apk --title "v1.0.1" --notes "..."
# Admin panel → Releases → register v1.0.1 (update feed)
```

---

## Troubleshooting quick-reference

| Symptom | Fix |
|---|---|
| `npm install` fails compiling better-sqlite3 | install VS Build Tools (C++) or `choco install visualstudio2022buildtools` then retry |
| `dist:win` fails at electron-builder download | needs internet; corporate proxy → set `ELECTRON_MIRROR` |
| EXE runs but login shows "server unavailable" | `SMS_API_URL` was empty at build time → rebuild with it set; check `/health` |
| Gradle can't find SDK | Android Studio → SDK Manager → install SDK 34; set `ANDROID_HOME` |
| APK installs then crashes on open | `adb logcat` — usually a cleartext-HTTP URL; use HTTPS api URL (Android blocks cleartext) |
| `release:check` FAILs | it prints the exact fix for each failed item |
