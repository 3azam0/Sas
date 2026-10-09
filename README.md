# Fodo — modular restaurant SaaS foundation

This is a working local development slice of the master plan, with Arabic RTL screens and Egyptian demo data. It is not the complete restaurant release or a production deployment.

## What works

- Separate organizations, shared item catalog, and stock per location: Cairo, Alexandria, and a combined central warehouse/preparation kitchen.
- Material receipts and waste capture, movement history, stock quantity/value, and inspectable FIFO layers.
- IndexedDB outbox, provisional local quantities, automatic reconnect sync, and server acceptance without duplicate stock effects.
- Offline reopening after the application shell and initial data have downloaded.
- Atomic PostgreSQL posting: command receipt, stock movement, FIFO allocation, balance, and audit record commit together. Insufficient stock rolls back and remains visible for review.
- Responsive web interface and a downloadable JSON recovery archive with preview, validation, and idempotent import.
- Review queue for rejected offline operations, including retry, correction, and cancellation with linked history.
- Stable local origin, single-process database ownership, startup health checks, and verified local backup/restore helpers.

## Run on this Windows machine

For the already-built version, double-click **Start-Fodo.cmd** in File Explorer. Keep its window open and wait for “READY”. It stores the local port in `.cache/local-config.json` (3108 by default), verifies whether that Fodo instance is already healthy, and reuses the same origin so browser offline data stays attached to the right server. If the saved port is occupied by an older or unknown process, stop that process window and start Fodo again; the launcher never silently moves data to a new origin. This launches in your Windows session; the in-app browser may not reach a preview started from Codex's restricted command environment. The command uses `.data-local` for its local data and binds only to loopback.

Open PowerShell in this directory. Dependencies are already installed in this workspace. The launcher finds Node on PATH or uses the Codex bundled Node runtime.

```powershell
./scripts/run.ps1 setup
./scripts/run.ps1 build -SandboxCompat
./scripts/run.ps1 start -SandboxCompat
```

Open the `READY` address printed by the launcher (normally **http://127.0.0.1:3108**) and select “فتح مجموعة المشاوي”. Keep this hostname and port: the server validates the configured origin and browser offline data is scoped to it. Stop the server with Ctrl+C.

`pnpm start`, `run.ps1 start`, and `Start-Fodo.cmd` all use this launcher and `.data-local`. `pnpm dev` uses port 3109 and `.data-dev` to keep development fixtures separate. Older `.data` directories are retained. The workspace footer and `/api/v1/health` show the build version. A verified instance serving an older build is refused with instructions to stop its console and restart at the same URL.

`-SandboxCompat` enables a narrowly scoped filesystem fallback needed by this Codex Windows sandbox. On a normal workstation, try the same commands without that switch. It handles EPERM from native asynchronous path resolution by retrying standard synchronous filesystem calls; access errors still propagate. The build uses webpack and Babel because the native SWC path resolver failed in this sandbox.

Use a production build for offline checks; the development server does not generate the offline precache manifest.

```powershell
./scripts/run.ps1 typecheck -SandboxCompat
./scripts/run.ps1 test -SandboxCompat
./scripts/run.ps1 browser -SandboxCompat
```

The browser check starts and stops its own server on port 3101 and uses installed Google Chrome. If that port is busy, set `$env:TEST_PORT='3105'` before running it. Never run two server processes against the same database directory.

On a fresh workstation: install Node.js 24 and pnpm 11.25.0, then run `pnpm install --frozen-lockfile`. Standard `pnpm dev`, `pnpm build`, `pnpm start`, and `pnpm test` scripts are also available outside the sandbox. Docker and a separate PostgreSQL service are unnecessary for this local slice.

## Try offline behavior

1. Enter the demo online and wait for “التطبيق جاهز للفتح دون اتصال”.
2. Disconnect the browser using DevTools Network → Offline. Record one unit of waste.
3. The confirmed quantity stays unchanged; the provisional quantity decreases. Reload while offline: the operation remains in the sync center.
4. Reconnect. Sync accepts the movement and updates confirmed quantity/value once.
5. Submit waste larger than available stock. It remains “تحتاج مراجعة”; stock is unchanged by that rejected operation.

Initial enrollment and session renewal require internet. The demo offline grant lasts 24 hours. Browser data belongs to that browser profile and origin; clearing site data removes unsynchronized operations. Export the recovery archive before clearing it. The sync center can preview an archive, skip already accepted commands, reject foreign/conflicting data, and restore pending work without duplicating stock effects. Remote permission revocation cannot be checked while disconnected.

At launcher startup, Fodo creates at most one daily cold backup under `backups/auto-*` when `.data-local` already contains a database. The backup is verified with a manifest and SHA-256 hashes; it never overwrites an existing destination. Stop the server before a manual backup, then use `./scripts/run.ps1 backup` or `node scripts/backup.mjs create`. Use `node scripts/backup.mjs restore <backup-directory> <new-directory>` to restore into a new directory for inspection. These local backups are not an off-machine disaster-recovery policy and do not replace encrypted storage, retention, or tested restore procedures in production.

## Architecture and state

| Responsibility | Implementation in this slice |
|---|---|
| Web application and API | Next.js, React, TypeScript |
| Navigation/filter/dialog state | Zustand and component state |
| Forms | React Hook Form, Zod command validation |
| Durable browser business data | Dexie / IndexedDB, live queries |
| Offline application shell | Service worker and generated asset manifest |
| Local server database | PGlite embedded PostgreSQL, one process |
| Money and costing | Decimal.js; six-place quantities/costs, twelve-place extended amounts |
| Synchronization | Command outbox and atomic full snapshots |

`packages/contracts` defines versioned commands. `packages/domain` contains pure FIFO/projection calculations. `packages/server` owns authoritative posting and tenant scope. `apps/web/src/offline.ts` owns local persistence and synchronization. UI state is never the authoritative inventory balance.

The contracts/domain separation supports future mobile and desktop clients. This slice has not implemented those clients or selected their local database drivers.

Server data and the demo signing key live under `.data-local` for production preview and `.data-dev` for development. Browser tests use `.data-browser-test` (or an explicit `TEST_DATA_DIR`). Do not commit these directories or share their session keys. The launcher configures the allowed origin and enables `SAAS_DEMO_MODE=1` on loopback. `SAAS_DATA_DIR` can select an explicit isolated data directory for checks.

The selected Supabase project is `bkkxrptgwbrwredauopq`. Its public URL and publishable key are configured in ignored `apps/web/.env.local`; `.env.example` contains placeholders only. `./scripts/run.ps1 cloud-check` verifies Auth connectivity without signing anyone in or changing cloud data. This configuration prepares the next SaaS stage; existing inventory sessions and posting remain local until production Auth, tenant permissions, and migrations are implemented. The connected Supabase management account currently lacks access to this project.

## Next implementation stages

1. Production Supabase authentication, memberships, permissions, RLS, managed PostgreSQL migrations, and integration checks.
2. Production sync adapter (PowerSync as planned), incremental data distribution, schema upgrades, and permission changes.
3. Suppliers, purchase orders, receiving documents, unit conversions, stock counts, and transfers with shipment/receipt reconciliation.
4. Separate location capabilities for warehouse and preparation kitchen; recipes, batch production, yield/waste, ingredient costing, and actual versus theoretical consumption.
5. Sales integration/POS, profitability, subscription/module entitlements, and country-specific fiscal adapters.

Egyptian e-invoicing/e-receipts, other Arab country tax integrations, multi-currency accounting, production authorization, and SaaS billing are not implemented here. Tax settings must remain country adapters in the master plan. This local demo does not establish compliance.

See [the environment report](docs/Environment-Setup.md), [the master plan](docs/Master-Plan.md), and [the developer guide](docs/Developer-Guide.md).
