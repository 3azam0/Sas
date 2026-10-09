# Fodo implementation review

Updated 9 October 2026 after implementing and verifying the local reliability findings. This report supersedes the earlier review that described 14 tests, export-only recovery and no Git repository.

## Current assessment

Fodo is a local restaurant inventory prototype with an Arabic RTL web interface, receiving, waste, FIFO costing, branch balances, a durable offline outbox and tested recovery. It is not yet the complete first restaurant release or a production SaaS deployment.

## Findings addressed

| Finding | Delivered fix | Evidence |
|---|---|---|
| Pending work blocked session renewal | Same-organization renewal preserves queued work and resumes same-ID posting | Browser expiry/renewal scenario verifies one stock effect |
| Startup paths used different origins/databases | Windows launcher, pnpm start and PowerShell start share saved origin and .data-local | Process scenario verifies reuse of the exact instance/state |
| Old builds were hard to identify | Baked build version in workspace footer and health response; stale verified instances refuse reuse | Browser matches UI/health; process scenario checks old-build rejection |
| Rejected operations had no resolution | Retry unchanged commands, create linked corrections, cancel known rejected work | Browser and unit tests verify history and accepted stock effects |
| Recovery was export-only | Validated, bounded preview/import with tenant and duplicate checks | Browser export/loss/restore scenario; unit conflict/validation checks |
| Backups lacked restore verification | Cold database copy with SHA-256 manifest, empty directories and single-owner protection | Integration restore compares balances and rejects tampering |
| PowerShell backup option did nothing | Backup task invokes the manual backup utility | Corrected task dispatch; underlying backup/restore integration coverage |
| Git had no history | First local checkpoint a62857c created under GitHub account 3azam0 with its no-reply address | git log confirms the commit and author; environment/data files are excluded |
| Documentation reported obsolete status | Master plan, developer guide, README and environment report updated | Current counts and implemented/planned boundary documented |

The launcher never silently changes port or kills an unrelated listener. Development is explicitly separate at port 3109 with .data-dev. Earlier data directories and earlier browser origins are preserved. An old running server requires its console to be stopped and the launcher restarted at the saved address.

## Verification

- TypeScript: passed.
- Production build and offline asset manifest: passed.
- Unit/integration tests: 22 passed across five files.
- Browser/process tests: nine passed across three files, including startup reuse/conflicts, tenant/branch isolation, offline reload/reconnect, Arabic input/mobile layout, expired-grant renewal, review resolution, and recovery restore.
- Browser tests used isolated data directories and stopped only their own server processes. They do not prove production multi-user PostgreSQL security or hardware compatibility.

## Selected Supabase project

The user selected bkkxrptgwbrwredauopq at https://bkkxrptgwbrwredauopq.supabase.co. The public URL and publishable key are stored in ignored apps/web/.env.local. A read-only Auth settings request succeeds with that key. A repeatable cloud-check script is provided.

The connected Supabase management account cannot inspect this project's details/tables. No remote schema, accounts or permissions were changed. Production Auth, memberships, branch permissions, migrations and cloud inventory posting remain pending; the local demo still uses PGlite. Reconnect the Supabase connector to an account authorized for this project before performing the cloud foundation work. The publishable key alone is not management authorization.

## Remaining first-release work

1. Production accounts, tenant memberships, branch permissions, managed PostgreSQL, versioned migrations, staging and tenant security checks.
2. Real item/unit/branch administration, supplier management, opening imports, purchase documents, receiving and returns.
3. Counts and transfers with dispatch/receipt reconciliation and two-branch operational acceptance.
4. Recipe versions, sub-recipes, batch production, yield, waste reasons, POS sales imports, actual/theoretical consumption, food-cost percentage and profitability.
5. Egypt pilot, configurable regional/business-day settings, applicable fiscal adapters, operational monitoring and off-machine backup policy.

Keep Zustand for UI state and durable local storage for business records. Future business modules, mobile/desktop clients and native POS follow their prerequisite workflows. No visual redesign or state-management rewrite is needed to close these reliability findings.
