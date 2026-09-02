# School Management System — Windows Desktop Edition

A professional, commercially distributable school administration product:

> Website → download `SchoolManagementSetup.exe` → install → launch →
> sign in with credentials issued by the software administrator →
> license verification → manage students, faculty, attendance, fees, exams,
> reports. Operational data is stored **locally** (SQLite). **No signup.**

The repository contains three cooperating parts:

| Part | Path | Purpose |
| :--- | :--- | :--- |
| **Desktop app** | `desktop/` + `src/` | Electron + React renderer. Local SQLite storage, secure IPC, license client, auto-updates, NSIS installer. |
| **License server** | `license-server/` | Central HTTPS auth + licensing service (Express + SQLite) and the **administrator control panel** at `/admin`. |
| **Web edition (legacy)** | `src/` (non-desktop path) | The original browser/Firestore build, preserved for development & existing deployments. |

---

## Quick start (developer)

```bash
npm install                 # renderer + desktop shell deps
cd license-server && npm install && cd ..

# Terminal 1 — central license service + admin panel
npm run license-server      # http://localhost:8787  (admin panel at /admin)

# Terminal 2 — desktop app in development
SMS_LICENSE_SERVER_URL=http://127.0.0.1:8787 SMS_ENV=development npm run desktop:dev

# Tests (39 assertions across both suites)
npm test
```

First-run admin credentials are printed once on the license server console
(override with `LICENSE_ADMIN_EMAIL` / `LICENSE_ADMIN_PASSWORD`).

Create a school in **/admin** → *Add School* → the panel issues a login
credential shown **once** → sign in on the desktop app with it.

## Build commands

| Command | Purpose |
| :--- | :--- |
| `npm run dev` | Web dev server (legacy edition) |
| `npm run build` | Production renderer bundle (`dist/`) |
| `npm run desktop:dev` | Electron + Vite dev loop |
| `npm run desktop:win` | **Windows installer** → `release/SchoolManagementSetup-<version>.exe` |
| `npm run dist` | Same as `desktop:win` |
| `node scripts/configure-release.js --license-server-url https://…` | Point a release build at the production license server (run **before** `dist`) |
| `npm run lint` / `npm test` | Typecheck / test suites |

Production installers are built by CI on `windows-latest`
(see `ci/release.yml (copy to .github/workflows/release.yml once, then CI owns it)` and `RELEASE.md`).

## Where things live on a customer PC

```
C:\Program Files\School Management System\        ← application only
C:\Users\<USER>\AppData\Local\SchoolManagementSystem\
    ├── database\school.sqlite                    ← all school data
    ├── backups\school-YYYY-MM-DD-….sqlite        ← daily + manual backups
    ├── uploads\{students,teachers,documents,photos,reports}\
    ├── logs\app-YYYY-MM-DD.log
    └── config\  (session, license cache, device id — OS-encrypted)
```

Data survives updates, reinstalls and restarts. Uninstall never deletes it.

## Documentation

- `DESKTOP_DISTRIBUTION.md` — architecture, auth/license/device flows, migrations, backups, QA matrix.
- `SECURITY.md` — security model and production checklist.
- `RELEASE.md` — versioning, release process, code signing, website download, auto-update.
- `DEPLOYMENT.md` — deploying the license server + customer/website workflow.
- `license-server/README.md` — server environment variables & API summary.

## License

Proprietary — School Management System commercial product.
