# Release Process

Semantic versioning lives in **one authoritative place**: `package.json`
`version` (used by the app About page, installer artifact name, update feed).

## 1. Version bump & tag

```bash
npm version patch|minor|major      # updates package.json + package-lock
git push && git push --tags        # tag format: v1.0.1
```

## 2. Automated build (GitHub Actions)

`ci/release.yml (copy to .github/workflows/release.yml once, then CI owns it)` runs on `v*` tags on **windows-latest**:

1. `npm ci`
2. `node scripts/configure-release.js --license-server-url ${{ secrets.LICENSE_SERVER_URL }}`
   — points the build at the production license server (never a dev server).
3. `npm run build` + `npm run lint`
4. `npx electron-builder --win --publish always`
   — rebuilds `better-sqlite3` for the Electron ABI, packs the NSIS installer
   `SchoolManagementSetup-<version>.exe`, uploads `latest.yml`, and creates a
   GitHub Release.

Required repository secret: `LICENSE_SERVER_URL`.
Optional: `WIN_CSC_LINK` + `WIN_CSC_KEY_PASSWORD` (see §4).

## 3. Code signing (recommended before public launch)

1. Buy an OV/EV code-signing certificate (`.pfx`).
2. Store it as repository secret `WIN_CSC_LINK` (base64) +
   `WIN_CSC_KEY_PASSWORD`. electron-builder signs the app and installer
   automatically; SmartScreen reputation builds up over time.
3. **Never commit certificates or private keys.** EV certificates on cloud
   HSMs can use `sign.dll`/custom hooks if needed (document per vendor).

Unsigned builds still install, but Windows shows a SmartScreen warning —
expected until a signed history exists.

## 4. Website download button

Point the site at the *stable, unchanging* URL:

```
https://github.com/sakshamfit/school_management_system/releases/latest/download/SchoolManagementSetup-<version>.exe
```

or (preferred) your own redirect that reads the license server's release feed:

```
GET https://<LICENSE_SERVER>/api/client/config  →  latestRelease.installerUrl
```

Publish the URL per release in **/admin → Downloads & Versions**; the desktop
app's update checker also uses the GitHub feed (`publish` config).

## 5. Auto-update flow

Startup (+8 s) & every 6 h → `electron-updater` checks GitHub → *Update
available* → background download → **Restart & Install** in *About & Updates*.
Updates replace only application files; AppData (database, backups, uploads,
session) is untouched; schema upgrades run migrations with a pre-backup.

## 6. Release channels

`releases.channel = stable | beta`. Desktop defaults to stable. The website
and auto-updater must always serve **stable** to customers.

## 7. Sandbox / local verification (no Windows machine)

`node scripts/sandbox-build-win.mjs` validates the NSIS packaging pipeline on
Linux by skipping the native rebuild — **its output is not shippable**
(better-sqlite3 must be rebuilt on Windows, which CI does). Treat a sandbox
installer as *pipeline-tested only*; the clean-install/restart/update tests in
the QA matrix require a real Windows 10/11 machine.
