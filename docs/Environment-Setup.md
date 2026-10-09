# Development environment — checked 9 October 2026

The environment is ready to run the first local restaurant inventory slice. Production infrastructure is still a later setup stage.

| Component | Result | Action |
|---|---|---|
| Node.js | 24.19.0 available through Codex bundled runtime | Launcher uses it automatically if Node is absent from PATH |
| pnpm | 11.25.0 available through Codex bundled fallback | Dependencies installed; lockfile saved |
| Git | 2.53.0 available | Repository initialized; `origin` points to `https://github.com/3azam0/Sas.git`; publication branch is `main` |
| Google Chrome | Installed | Browser tests use Chrome channel |
| Microsoft Edge | Installed | Available for manual checks |
| TypeScript / app dependencies | Installed in the project | Exact versions pinned |
| PostgreSQL for local development | PGlite embedded PostgreSQL | No database service installation required |
| Docker / PostgreSQL CLI / Supabase CLI | Not found in the audited command environment | Needed only when the production integration stage requires them |
| Supabase project/Auth and PowerSync | Supabase Auth endpoint verified; application integration and PowerSync pending | Local adapters used; cloud schema has not been applied |

## Verified

- TypeScript check passed.
- Production webpack/Babel build passed and generated 29 offline assets.
- 14 automated tests passed: FIFO costing, precision, concurrent posting, idempotency, transaction rollback, tenant isolation, offline durability/convergence, origin validation, and authorization loss handling.
- Three browser checks passed: branch-specific receiving and organization switching; offline save/reload/reconnect and rejected insufficient-stock waste; and a 390 × 844 mobile viewport.
- Desktop and mobile screenshots inspected; the mobile table uses internal horizontal scrolling.

## Windows sandbox adjustment

Native Node path resolution and asynchronous directory creation returned EPERM in the permitted workspace. The optional `scripts/windows-compat.cjs` preload retries using ordinary synchronous filesystem operations only for that error. Tests also use a project-local temporary directory. These changes are scoped to the launched process; no system settings or global Node installation were changed.

Next uses webpack/Babel for this environment because SWC's native path handling failed. Browser tests launch their own loopback server and stop their own process afterward. In Codex, local network access must be permitted for browser checks.

## Start

From `outputs/restaurant-saas`:

```powershell
./scripts/run.ps1 setup
./scripts/run.ps1 build -SandboxCompat
./scripts/run.ps1 start -SandboxCompat
```

Then open the saved address printed by the launcher, normally http://127.0.0.1:3108. `pnpm start`, the PowerShell start task and the Windows launcher all use `.data-local`; development uses port 3109 and `.data-dev`. For full instructions, current scope, architecture, and remaining stages, see [README](../README.md).

Latest verification, 9 October 2026: 22 unit/integration tests and nine browser/process scenarios passed. TypeScript and the production build passed. Earlier counts in this report describe historical setup checks. The selected Supabase project's Auth endpoint also accepts its locally configured publishable key; cloud schema/Auth integration remains the next stage.
