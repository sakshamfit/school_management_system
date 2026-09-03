# 🏫 M.S. PUBLIC SCHOOL — Deployment & Client Handover Guide

Comprehensive guide for deploying the school portal as a web app and packaging
the desktop application.

> 🔐 **Commercial licensing, the admin control panel, releases and the
> production API server are documented separately — see
> [CONTROL_PLANE.md](./CONTROL_PLANE.md).**

---

## 🔐 Authentication Model (hardened — September 2026)

Credentials are **no longer shipped in this repository or in this document**.

| Role | Mechanism | Where it's managed |
| :-- | :-- | :-- |
| **Principal / Super Admin** | Firebase Authentication — email + password (verified by Google; never stored in the app, Firestore, or any file) | Firebase Console → Authentication → Users |
| **Faculty / Class Teachers** | 6-digit teacher code (app establishes an anonymous Firebase session first) | Principal adds teachers in-app; codes shown in the app |

### One-time Firebase setup (REQUIRED after upgrading to the hardened build)

The app will not authenticate until these steps are done:

1. Open the [Firebase Console](https://console.firebase.google.com) → project `mspublicschool-ddfaf`.
2. **Authentication → Sign-in method**:
   - Enable **Email/Password**.
   - Enable **Anonymous** (used behind teacher-code sign-in).
3. **Authentication → Users → Add user**: create the principal account with the
   school's principal email and a strong password (deliver it through a secure
   channel — never commit it anywhere).
4. **Firestore Database → Rules**: publish the hardened rules from
   [`firestore.rules`](./firestore.rules) (`request.auth != null` required).

> ⚠️ **Action required now:** the previous principal password is retired.
> It existed in source history — treat it as compromised and do not reuse it.

**Current rule limitation (tracked):** any *authenticated* session can still
read/write all Firestore documents. Per-user least-privilege rules arrive with
the phase-2 local-SQLite architecture. See `PRODUCTION_REPORT.md`.

---

## 🚀 Option 1: Live Web & Cloud Deployment

```bash
npm install
npm run build        # outputs dist/ (CSP meta injected automatically)
```

### A. Vercel
1. Push this project to GitHub and import it at [vercel.com](https://vercel.com).
2. Framework preset: **Vite** • Build: `npm run build` • Output: `dist`.

### B. Firebase Hosting
```bash
npm install -g firebase-tools
firebase login
firebase deploy --only hosting
```

### C. Custom domain
Add the school's sub-domain in the hosting dashboard with a standard CNAME record.

---

## 🖥️ Option 2: Desktop App (Electron)

### Development
```bash
npm run build
npx electron .
```

### Windows installer (on a Windows machine)
```bash
# 1. Inject the production licensing API URL into the build
SMS_API_URL="https://api.YOURDOMAIN" node scripts/write-build-config.mjs

# 2. Full release pipeline
npm run test:all          # typecheck + control-plane test suite
npm run audit:prod        # secret-scan of everything that ships
npm run release:check     # packaging gate
npm run dist:win          # builds web + admin + SchoolManagementSetup-<version>.exe
```

Output: `release/SchoolManagementSetup-<version>.exe` (NSIS; updates never
delete `%LOCALAPPDATA%\SchoolManagementSystem`).

> 📦 Windows builds produce correctly signed installers only when a
> code-signing certificate is configured on the build machine — see
> [CONTROL_PLANE.md](./CONTROL_PLANE.md) § Code signing.

---

## 💾 Database Backup, Restore & Cloud Sync

- **Real-Time Cloud Sync**: every student, attendance entry, fee payment, and
  mark syncs to Cloud Firestore in real time (authenticated sessions only).
- **Offline (current model)**: Firestore's client cache keeps recently-active
  data available; the full offline-first local SQLite architecture with
  customer-owned encrypted Google Drive backups is the roadmap phase
  documented in `PRODUCTION_REPORT.md` and `CONTROL_PLANE.md`.
- **Manual backup (Export JSON)**:
  1. Open **School Settings** → *Desktop App & Client Handover Hub*.
  2. Click **Download JSON Backup** for a timestamped snapshot.
- **Restore / Import**: upload the `.json` backup via **Restore Database**.

---

## 💬 WhatsApp Integration for Parents

- **Fee receipts** — pre-formatted receipt message to the parent.
- **Absence alerts** — one-tap notification to absent students' parents.
- **Report cards** — term marksheets shared directly.

---

## 📞 Support

For institutional assistance contact the system administrator. Inside the
desktop app, **Settings → About & Support** shows the installation's
support-safe diagnostics (never any credentials or tokens).
