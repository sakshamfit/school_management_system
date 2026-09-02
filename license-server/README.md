# SMS License Server

Central authentication, licensing, device-activation and administration
service for the School Management System desktop editions. Express + SQLite,
no other runtime dependencies. Serves the administrator control panel at `/admin`.

## Run

```bash
npm install
npm start            # production
npm run dev          # auto-restart
npm test             # integration suite (25 tests)
```

On first start an administrator account is created (credentials printed once,
or supplied via `LICENSE_ADMIN_EMAIL`/`LICENSE_ADMIN_PASSWORD`).

## API surface

### School-facing (desktop client)
| Endpoint | Purpose |
| :--- | :--- |
| `POST /api/auth/login` | Verify school credentials + license + device; issue tokens |
| `POST /api/auth/refresh` | Rotate tokens |
| `POST /api/auth/logout` | Destroy session |
| `POST /api/license/validate` | Periodic revalidation (returns explicit license state) |
| `POST /api/devices/deactivate` | School frees one of its own device slots |
| `GET /api/client/config` | Public: support contact + latest stable release |
| `GET /api/health` | Health probe |

### Administrator (bearer admin token)
`/api/admin/login|logout|change-password`, `/api/admin/dashboard`,
`/api/admin/schools` (+`/:id`, `/:id/reset-credentials`),
`/api/admin/licenses/:schoolId` (+`/extend`), `/api/admin/devices`
(+`/:id/deactivate|reactivate`), `/api/admin/users/:id/reset-password|status`,
`/api/admin/releases`, `/api/admin/client-settings`, `/api/admin/audit`.

Error codes consumed by the desktop app: `INVALID_CREDENTIALS`,
`ACCOUNT_LOCKED`, `SCHOOL_SUSPENDED`, `SCHOOL_ARCHIVED`, `LICENSE_EXPIRED`,
`LICENSE_SUSPENDED`, `LICENSE_REVOKED`, `DEVICE_LIMIT_REACHED`,
`DEVICE_DEACTIVATED`, `INVALID_TOKEN`, `TOO_MANY_REQUESTS`.

## Security notes

- scrypt password hashing; opaque tokens stored as SHA-256 hashes.
- Rate limiting on login endpoints; admin sessions expire (default 8 h).
- Every admin mutation is audit-logged; secrets are never logged.
- Data file: `<LICENSE_DATA_DIR>/license.sqlite` (WAL); migrations back up
  automatically before running.
- Deploy behind TLS; keep `LICENSE_DATA_DIR` outside the web root.
