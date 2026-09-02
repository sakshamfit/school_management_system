# Deployment & Customer Workflow

> Credentials are **never** documented in this repository. School accounts are
> created in the admin panel and shared with each school through your own
> secure channel.

---

## A. Deploy the license server (one-time)

The service is a single Node process with SQLite — any small VPS works.

```bash
# on the server
git clone https://github.com/sakshamfit/school_management_system
cd school_management_system/license-server
npm install

LICENSE_PORT=8787 \
LICENSE_DATA_DIR=/var/lib/sms-license \
LICENSE_ADMIN_EMAIL=you@yourcompany.com \
LICENSE_ADMIN_PASSWORD=<strong-random-password> \
npm start
```

Put it behind HTTPS (nginx/Caddy reverse proxy with TLS). Set
`LICENSE_SUPPORT_URL/EMAIL/PHONE` or edit them later in **/admin → Settings**
(these values appear inside customer desktop apps on the "Contact
Administrator" buttons).

Admin panel: `https://license.yourcompany.com/admin`.

### Environment variables (server)

| Variable | Purpose |
| :--- | :--- |
| `LICENSE_PORT`, `LICENSE_HOST` | Bind address (default 8787 / 0.0.0.0) |
| `LICENSE_DATA_DIR` | SQLite + backup location |
| `LICENSE_ADMIN_EMAIL` / `LICENSE_ADMIN_PASSWORD` | Bootstrap admin (first run only) |
| `LICENSE_TOKEN_SECRET` | Optional extra secret for token derivation |
| `LICENSE_ACCESS_TTL_SEC` / `LICENSE_REFRESH_TTL_SEC` / `LICENSE_ADMIN_TTL_SEC` | Session lifetimes |
| `LICENSE_SUPPORT_URL/EMAIL/PHONE` | Support contact served to clients |

## B. Publish the app

1. Configure the build: `node scripts/configure-release.js --license-server-url https://license.yourcompany.com`
2. Tag `v<version>` → CI builds + publishes `SchoolManagementSetup-<version>.exe`
   (see `RELEASE.md`, including code signing).
3. Website: `[ DOWNLOAD FOR WINDOWS ]` → the release URL or your redirect to
   `/api/client/config → latestRelease.installerUrl`.

## C. Onboard a school (per customer)

1. **/admin → Add School**: name, School ID (e.g. `DPS-2026-001`), contact,
   license duration, max devices (default 3).
2. The panel shows the generated sign-in email + temporary password **once** —
   send them to the school owner securely.
3. School owner: download installer → install → launch → sign in → the first
   computer activates automatically; the local database is seeded with their
   school profile, classes and academic year.
4. Teachers receive 6-digit codes from the school's principal inside the app
   (Faculty Roster) — no server involvement.
5. Manage the account from **/admin**: extend licenses, reset credentials,
   deactivate devices for hardware swaps, suspend/archive leavers.

## D. Customer experience summary

```
Install → launch → LOGIN (credentials from administrator) → license verified
→ dashboard → manage school offline-first → automatic daily backups →
occasional update offer → data survives everything.
```

## E. Legacy web edition

The browser/Firestore build remains for development and existing web users:
`npm run dev` / `npm run build` and deploy `dist/` to any static host (Vercel/
Netlify). It is **not** the commercial distribution channel; the desktop
edition is. Production web sign-in requires a stored principal account — there
are no bundled credentials and no public registration.
