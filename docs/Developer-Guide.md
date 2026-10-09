# Fodo SaaS Developer Guide

Version 2.2 — 9 October 2026

Companion specification: [Modular SaaS Master Plan](./Master-Plan.md).

This guide defines the implementation workflow and distinguishes the delivered local prototype from pending production features. Code snippets and API names below remain proposed contracts unless the implementation-status section states otherwise.

## Implementation status and revised delivery order — 9 October 2026

This version supersedes the original task order where it conflicts. Fodo is a working local inventory prototype: Arabic RTL web UI, seeded organizations/locations, receiving, waste, FIFO, durable local outbox, and reconnect synchronization. Production authentication, real master-data administration, transfers, recipes, production, country adapters and billing remain planned.

Current adapters: Next.js/React; Zustand for UI state; React Hook Form/Zod; custom CSS; Dexie/IndexedDB; PGlite development PostgreSQL; complete tenant snapshots. Tailwind/shadcn, TanStack Query, PowerSync, managed PostgreSQL and production Auth are future decisions/integrations, not installed capabilities. Do not rewrite stable UI state merely to match an earlier technology proposal.

### Verified reliability delivery

Same-organization renewal with queued work, review retry/correction/cancellation, and archive preview/restore are implemented. The completed verification run passed 22 unit/integration tests and nine browser/process scenarios, including expired offline grants, exactly-once reconnect posting, repeated launch, stale builds, occupied ports, and recovery import. Database restore and tamper rejection are covered by the integration tests. TypeScript and the production build also pass.

All production start paths (`pnpm start`, `run.ps1 start`, and the Windows launcher) now share the saved origin and `.data-local`. Development uses port 3109 and `.data-dev`. Build identity is baked into the workspace footer and health response; the launcher refuses an older verified build and instructs a same-origin restart. `run.ps1 backup` runs the manual cold-backup utility. Existing data directories remain preserved.

Git identity is configured locally for the GitHub account `3azam0`, using its no-reply address. Before a checkpoint, stage only source/configuration templates; exclude environment files, database directories, backups, session keys, dependencies and build outputs. Record the checkpoint in the implementation review after creation.

Selected cloud project: `bkkxrptgwbrwredauopq` at `https://bkkxrptgwbrwredauopq.supabase.co`. Ignored `apps/web/.env.local` holds its public URL and publishable key. `run.ps1 cloud-check` verifies the Auth endpoint without signing in or mutating cloud data. The supplied key is accepted. The connected Supabase management account currently lacks project access; production Auth, tenant schema, permissions and migrations remain pending until that connection is corrected. Never substitute the publishable key for management access.

| Order | Delivery | Acceptance gate |
|---|---|---|
| 0A | Same-organization session renewal with pending work | Expire the login, preserve a queued operation, renew, and post it exactly once |
| 0B | Stable local origin and single-instance launch | Repeated launch reuses the verified instance; unrelated port conflicts are explicit; one database owner |
| 0C | Review, retry, cancel, correct and restore | Immutable operation history; changed data gets a new linked ID; restore validates scope and deduplicates |
| 0D | Version control and backup/restore runbook | Git initialized with secrets/data ignored; a restore exercise proves database recovery |
| 1 | Production tenant/access foundation | Real accounts, memberships, branch permissions, migrations, staging and tenant security tests |
| 2 | Real inventory administration | Item/unit/supplier/branch setup, opening imports, purchasing, receiving and returns |
| 3 | Two-branch inventory pilot | Counts, dispatch/receipt transfers, variance handling, offline recovery and backups |
| 4 | Restaurant cost control | Immutable recipes, production, yield, sales imports, actual/theoretical consumption and profitability |
| 5 | Egypt pilot and market adapters | Supported device matrix, regional settings, applicable fiscal integration and operational acceptance |
| Later | Specialist modules, mobile/desktop, native POS | Only after their prerequisite workflows and device tests pass |

### Recovery rules

- Renewal for the current organization must work while commands are pending. Switching to another organization remains a separate operation. Never retag queued commands.
- On successful renewal, verify the returned organization, atomically refresh the local snapshot, then resume same-ID delivery.
- Authentication/network failures preserve queued work. Business rejection enters review and does not affect confirmed balances.
- Retry resends an unchanged rejected command using its original ID. Correction creates a new operation linked to the original; the original becomes superseded and remains inspectable. Cancellation is only for known rejected operations and never reverses a posted transaction.
- Recovery exports are versioned. Import requires a valid current grant, matching organization, validated payloads and envelope IDs, bounded file size/count, and a review preview. Identical IDs are skipped; conflicting payloads abort the entire import. Server-accepted IDs reconcile to accepted state. Imports never trust exported acceptance status without the server snapshot.
- Device identity is recorded as source metadata. Recovered records retain their source identity where available; the current authenticated device/user remains accountable for uploading. Legacy exports without source identity must be labeled rather than fabricated.
- Server database backups and device command exports are separate. A database backup does not contain unsynchronized browser operations.

### Local startup and persistence

Use a stable loopback origin, normally port 3108. Persist the selected origin in local configuration; never silently choose a new random port. Detect and reopen a verified Fodo instance. A different process on the port produces an actionable error without terminating that process. Protect the development database with an exclusive process lock; stale-lock handling checks whether the owning process still exists before cleanup. Store logs and launch state outside version control.

Preserve earlier demo data: do not clear IndexedDB or remove old data directories. Users with pending work on an earlier random-port URL must reopen that origin and export/reconcile before migrating to the stable origin. Do not claim cross-origin browser storage can be read automatically.

### Required regression coverage

Session expiry with pending capture; unchanged retry after insufficient stock; corrected operations using a new ID; cancellation preserving audit history; wrong-tenant and malformed imports; duplicate and conflicting IDs; acceptance reconciliation; repeated launcher startup; occupied port; backup restore; offline reload/reconnect after an app update. Production stages add real PostgreSQL concurrent sessions, RLS/permissions and scoped replication tests.

## 1. What to build first

Build an Arabic-first, offline-first restaurant inventory and cost-control web application for multiple branches. Support central storage, central preparation, combined central locations, and local branch preparation.

Retain an extensible SaaS foundation for independent customers, future mobile/desktop clients, specialist businesses, and validated country packages.

Do not build native POS, payroll, full accounting, or IMEI workflows in the first release. Provide extension contracts rather than empty unfinished product screens.

Client files and branch details are deferred. Use labeled demonstration fixtures and record configurable assumptions. A missing client spreadsheet must not block the inventory engine.

## 2. Architecture decisions

| Area | Baseline decision |
|---|---|
| Repository | TypeScript monorepo, one package manager and committed lockfile |
| Web | Next.js App Router, responsive Arabic RTL PWA |
| API | Versioned authenticated HTTP contracts usable by every client |
| Server | Modular monolith; API adapters and workers call shared use cases |
| Database | PostgreSQL; Supabase for managed database/auth where suitable |
| Posting | One atomic database transaction per business command |
| Offline | Persistent local database, durable command outbox, provisional projections |
| Synchronization | PowerSync candidate, gated by an early prototype |
| State | Local reactive queries, Zustand, React Hook Form/Zod, URL state |
| Online services | TanStack Query for non-replicated APIs and job status |
| UI | Tailwind/shadcn, accessible forms, localization resources |
| Mobile later | React Native/Expo using shared contracts |
| Desktop later | Provisionally Electron; verify hardware compatibility |

Pin supported dependency versions during setup. Record Node, package manager, PostgreSQL, and sync SDK versions. Verify vendor documentation before using exact CLI flags or APIs.

PowerSync documents PostgreSQL-backed local SQLite synchronization with web and React Native clients. It is a replication component, not the inventory authorization or conflict-resolution engine. [PowerSync overview](https://docs.powersync.com/intro/powersync-overview)

Next.js provides PWA guidance. Offline operational screens must still be designed to load their shell and local data without server rendering or network-only navigation. [Next.js PWA guide](https://nextjs.org/docs/app/guides/progressive-web-apps)

## 3. Repository organization

```text
apps/
  web/
    app/                   # routes and thin HTTP adapters
    src/features/          # domain-facing screens
    src/offline/           # local DB, outbox, reactive reads
    src/ui/                # web components
  worker/                  # background jobs
  mobile/                  # create when mobile development starts
  desktop/                 # create when desktop development starts
packages/
  contracts/               # commands, DTOs, errors, schemas
  api-client/              # transport without framework dependencies
  domain/                  # pure calculations and rules
  server/                  # use cases, authorization, repositories
  sync/                    # client-neutral protocol and adapters
  localization/            # translation keys and formatting rules
  design-tokens/           # colors, spacing, typography tokens
  test-fixtures/           # deterministic example organizations/data
supabase/
  migrations/
  tests/
docs/
  adr/                     # architecture decision records
  runbooks/
  api/
```

Future app folders need not contain scaffolding now. Package boundaries matter more than the exact names.

Dependency direction:

```text
UI → local/application adapter → contracts
API → authorization → use case → domain + repository
Worker → use case
Database repository → PostgreSQL
```

Pure domain packages cannot import Next.js, browser APIs, Supabase clients, or UI components. Credentials and privileged database access exist only in server packages.

## 4. Local development and environments

Use one codebase with four separately configured environments: development, staging, client demo, and production. This is the target deployment policy; the current local prototype does not provision all four environments.

### 4.1 Environment responsibilities

| Environment | Purpose | Data and access | Release policy |
|---|---|---|---|
| Development | Build features and debug locally | Synthetic fixtures; developer accounts; isolated local database or development cloud project | Task branches; frequent disposable test deployments |
| Staging | Validate release candidates, migrations, roles and offline upgrades | Representative synthetic data; internal testers; payment/fiscal/message sandboxes | Deploy a recorded candidate commit after checks pass |
| Client demo | Let prospective clients explore stable restaurant workflows | Separate demo organizations; seeded restaurants and branches; restricted demo accounts | Promote a tested version; keep demonstrations stable during client sessions |
| Production | Operate paying customers' businesses | Real tenant data; real permissions; monitored backups and controlled integrations | Release an approved, tested commit/tag through the release workflow |

Keep distinct URLs, databases, object storage, auth configuration, signing keys, integration credentials and deployment permissions. For hosted environments, use separate Supabase projects; local development may use an isolated local stack. Tenant separation inside one shared database is not a substitute for separating production from test/demo infrastructure.

Register each environment in the deployment runbook: owner, purpose, app URL, backend project reference, region, configuration-variable names, backup policy, deployed commit/tag and allowed external integrations. Store secret values in environment configuration or a secret store, never in the runbook or repository. Display an obvious Demo/Staging label in non-production user interfaces and include environment plus build identity in diagnostics.

Current setup: local development uses port 3109 and `.data-dev`; the optimized local demo uses the saved launcher origin, normally port 3108, and `.data-local`. Automated browser tests use isolated test data. A production build on a laptop remains a local demo. Hosted staging, client demo and production deployment are pending.

The selected Supabase project `bkkxrptgwbrwredauopq` has a verified public connection configuration, but its environment role is unassigned. Assign its role before creating application tables or deploying users there. Provisioning additional hosted projects needs a separate infrastructure decision, including region, access and cost; this guide does not create them.

### 4.2 Client-demo lifecycle

- Seed a realistic restaurant organization with branches, stock, suppliers, recipes and sales examples as those workflows become available. Label sample data clearly. Each prospective client gets an isolated demo organization or workspace; never share one writable tenant between unrelated prospects.
- Limit demo accounts to their workspace. Keep platform administration unavailable to them. Configure an expiry/renewal policy and a repeatable seed version. Automated demo resets must be a disclosed part of the demo lifecycle, with active sessions handled explicitly.
- Use sandbox or disabled payment, fiscal, delivery and notification adapters. Demo actions must not produce live charges, tax submissions or messages to real customers.
- Record reset events and show users the workspace's expiry/reset state. Keep exports and retention consistent with the demo policy; do not use real customer exports as fixtures.
- When a prospect becomes a customer, create a production tenant with proper access and onboarding. Transfer only explicitly selected, validated setup data such as an approved catalog. Demo stock movements, balances, users' sessions and offline queues never become production records automatically.

### 4.3 Offline isolation and demo resets

Use a stable, distinct origin for each environment and namespace local databases, caches and outboxes by environment and tenant. Validate environment/tenant scope at the server; UI labels alone do not prevent cross-environment posting. Recovery files and offline grants must carry matching scope.

For resettable demo workspaces, introduce a server-owned generation/epoch. Include it in grants, snapshots, commands, sync checkpoints and recovery archives. On reset, rotate the generation and revoke old demo sessions/grants. Reject commands or restored archives from a prior generation; never rewrite them to the new generation. Keep stale queued work available for inspection/export and explain that the demo was reset. Refresh the local snapshot only through an explicit reset/re-enrollment flow. This prevents an offline device from repopulating a freshly reset demo.

Required checks: environment A's grants/commands/archives cannot post into B; two demo clients cannot read each other; expired demos cannot enroll/post; a device reconnecting after reset retains old work for review but cannot change the new demo ledger. Environment scoping and demo-generation contracts remain implementation work; today's version-1 commands and version-2 recovery archives do not yet provide them.

### 4.4 Development bootstrap

Bootstrap in this order:

1. Initialize workspace, TypeScript strict mode, linting, formatting, and lockfile.
2. Pin a supported runtime; document setup in README.
3. Configure a local PostgreSQL/Supabase development environment using the installed CLI's help and current documentation.
4. Create migrations for foundation tables and access policies.
5. Seed two tenants, two restaurant branches, a central location, and demo users.
6. Add a working health endpoint and authenticated organization bootstrap endpoint.
7. Add local database and sync prototype configuration.
8. Run the first acceptance scenario before building broad CRUD screens.

Provide `.env.example` with placeholders. Typical configuration categories: public auth configuration, server database connection, sync endpoint/credentials, private object storage, job runner, application origin, and integration secrets. Exact variable names depend on the implementation.

Commit migrations and fixture seeds. Never commit keys, customer exports, signing material, or production credentials.

Define project scripts such as `dev`, `lint`, `typecheck`, `test`, `test:integration`, `test:e2e`, and `build`. These names are the proposed project convention; implement them before documenting them as runnable commands.

### 4.5 Git branches and repository ownership

Use one repository for Fodo's shared core and modules. Git branches organize code changes; environment configuration determines deployment. Do not maintain independent product code forks for development, demos or individual clients.

| Branch/ref | Purpose and lifetime |
|---|---|
| `main` | Target protected default branch; keep it releasable |
| `feat/<topic>` | One feature or vertical slice; branch from the current default branch and remove after merge |
| `fix/<topic>` | One defect and relevant regression checks |
| `docs/<topic>` / `chore/<topic>` | Documentation or maintenance with focused validation |
| `release/<version>` | Optional short-lived stabilization branch when parallel work requires it |
| `hotfix/<topic>` | Urgent production repair based on the deployed release tag |
| `vX.Y.Z` | Immutable release tag identifying a verified source commit |

`main` is the integration branch selected for the initial GitHub publication. Earlier local checkpoints remain reachable through `master`; new work branches from `main`. A permanent `develop`, `demo` or `production` branch is not required. Staging and demo deploy selected source commits, and production deploys approved release tags.

Repository: [3azam0/Sas](https://github.com/3azam0/Sas), with `origin` set to `https://github.com/3azam0/Sas.git` at the user's request. Author identity is configured for `3azam0` with its GitHub no-reply address. This publication uses the existing repository visibility; branch protections and deployment automation have not been configured. A browser login or local commit author does not by itself authenticate Git pushes. Verify each push against the remote commit before reporting it complete.

### 4.6 Daily branch, commit and push workflow

1. Inspect `git status`, the current branch and configured remotes. Preserve unrelated/uncommitted work. Fetch the intended remote, then create a focused task branch from the actual default branch. Reuse an existing task branch when continuing that task.
2. Implement one coherent change. Include related tests, migrations and documentation; keep unrelated refactoring separate. Write commits at useful, working checkpoints rather than after every small edit.
3. Run checks appropriate to the change. For code, use the implemented typecheck/unit checks and build/browser scenarios where affected; documentation-only changes need link/content and diff checks. Record actual results and any remaining limitation.
4. Review the diff, then stage explicit task files. Inspect `git diff --cached` and `git diff --cached --check`. Exclude environment files, credentials, customer exports, device archives, databases, backups, dependency directories and generated build files. Commit migrations and the package lockfile when applicable.
5. Commit using an outcome-oriented message: `feat(inventory): add branch transfer receipts`, `fix(sync): preserve queued work during renewal`, or `docs(workflow): define environments and Git releases`. A larger commit body should explain the reason and material compatibility limits.
6. Push the task branch to the confirmed remote when pushing is within the user's authorized task or agreed project workflow. Reuse that authorization for subsequent task updates; ask only when the destination, visibility or scope materially changes. Verify the remote branch points to the intended commit. Local commits and remote pushes are separate completion states.
7. Open/update the pull request with the problem, resulting behavior, validation, migration/offline implications and deployment target. Complete required checks and review, then merge using the repository policy. Default to squash merging focused task branches, with a useful final commit message. Remove the merged task branch only after verifying merge and preserving any remaining work.

Example only: after `origin` and `main` exist, with a clean checkout and an authorized branch push. Replace the topic and staged paths with the actual task; do not run this block blindly against a different base or existing work.

```powershell
git fetch origin
git switch main
git pull --ff-only origin main
git switch -c feat/branch-transfers
# Implement the task and run its relevant checks before staging.
git add packages/domain/index.ts tests/posting.test.ts
git diff --cached
git diff --cached --check
git commit -m "feat(inventory): add branch transfer receipts"
git push -u origin feat/branch-transfers
git fetch origin
git rev-parse HEAD
git rev-parse origin/feat/branch-transfers
```

Before remote setup, local branches and commits are valid checkpoints. Report a push as pending instead of inventing a repository URL or claiming the code is backed up on GitHub. For automation, record the final branch, commit SHA, remote URL/push result and pull-request link when one exists. Hosted demo or production deployment is a separate authorized release step; pushing a branch must not silently deploy production.

### 4.7 Reviews, conflicts and shared history

Protect the default/release branches when the remote is configured: pull-request review, required relevant checks, restricted direct pushes, and no force pushes or deletion. Use separate protected deployment environments for live credentials. Routine branch previews receive test credentials and cannot access production secrets.

Resolve a non-fast-forward push by fetching, inspecting the new commits, and merging the actual base into the shared task branch. Rebase only unshared local work, or a branch whose owners explicitly agreed to rewriting it. Re-run checks affected by conflict resolution and inspect the resolved diff before pushing. Use `--force-with-lease` only for an explicitly authorized history rewrite on a task branch; never force-push the protected default/release branch. Never discard unrelated work with a hard reset or blanket checkout.

Prefer `git revert` for a bad commit already shared with others. A source-code revert does not reverse inventory postings or undo database migrations safely; follow the deployment/database recovery plan as well.

### 4.8 Source promotion, releases and hotfixes

Promote a recorded source commit through staging, then to a stable client-demo release and/or production when their acceptance criteria pass. Demo validation supplements internal staging; a client demo is not the sole production release gate. Production and demo may remain on different approved versions without diverging codebases.

Pin the commit and lockfile for each environment build and record the environment, application version, commit SHA, build identifier, migration level and release time. Next.js public configuration is compiled into the browser bundle, so build separately for environments with different public URLs/keys. Promote the same reviewed source revision; do not copy a staging bundle containing staging configuration into production. Verify each deployed build's health, environment configuration and scoped smoke tests.

Create an immutable release tag such as `v0.1.0` only after release validation. Push release tags explicitly when the release is authorized; do not use a blanket push of every local tag. Keep release notes and a prior compatible artifact available. Database migrations travel with their source revision and must tolerate previously deployed offline clients.

For a production hotfix: branch from the deployed tag, reproduce the defect, make the smallest supported repair, run relevant checks, validate in staging, and release a new patch tag. Apply the repair back to the default branch through review, resolving any divergence. Never move the old tag to the new commit. Roll back to a compatible artifact or roll forward with a repair; preserve accepted stock operations and pending client commands.

## 5. Foundation schema

Use UUIDs generated before offline capture where needed. Use tenant-qualified relationships and unique constraints.

| Group | Initial tables |
|---|---|
| Tenancy | organizations, legal_entities, branches, stock_locations |
| Access | organization_memberships, roles, permissions, role_permissions, user_scope_assignments |
| Entitlements | modules, organization_modules, branch_modules, subscription_records |
| Configuration | entity_settings, branch_settings, tax_categories, tax_versions |
| Device/offline | registered_devices, offline_grants, command_receipts, device_sync_checkpoints |
| Audit | audit_events, support_access_sessions |

Enforce an entity's organization, a branch's entity, and a location's branch/entity through foreign keys. Central locations do not need to pretend to be customer-facing restaurants.

Scope grants must allow central-location access, not just restaurant branches. Validate client-provided organization/entity/location IDs against authenticated membership; never trust them as authorization.

## 6. Business schema map

| Domain | Initial tables |
|---|---|
| Catalog | item_categories, items, units, item_unit_conversions, item_location_settings |
| Suppliers/purchasing | suppliers, supplier_items, purchases, purchase_lines, receipts, receipt_lines, supplier_returns, return_lines |
| Inventory | stock_documents, stock_entries, stock_balances, cost_layers, layer_allocations, posting_scope_counters |
| Transfers | transfers, transfer_lines, dispatches, dispatch_lines, transfer_receipts, transfer_receipt_lines, transit_allocations |
| Definitions | recipes, recipe_versions, recipe_components, boms, bom_versions, bom_components, definition_dependencies |
| Production | production_orders, production_inputs, production_outputs |
| Waste/counts | waste_documents, waste_lines, stock_counts, count_observations, count_adjustments |
| Imports/sales | import_batches, import_rows, import_templates, pos_sources, pos_mappings, sales, sale_lines |
| Control | reconciliation_periods, theoretical_runs, theoretical_lines, cost_snapshots |
| Expenses/files | expenses, expense_categories, attachments, attachment_uploads |
| Reporting/jobs | report_snapshots, background_jobs, server_outbox_events |

Do not create specialist serial, scale, or co-product tables until their module is implemented. Published dependencies and historical source links must not cascade-delete.

Recommended starting numeric bounds: quantities and unit costs as PostgreSQL numeric(18,6); allocation amounts at sufficient precision such as numeric(24,8), with documented rounding. Validate permitted ranges and overflow before posting. Currency rounding is applied at defined document boundaries, not after every intermediate multiplication.

Transport decimal quantities and money as strings. SQLite storage must not coerce them into binary floating-point values: use canonical decimal text and decimal arithmetic, or validated scaled integers. Cost projections remain estimates.

Retain UUID, tenant/entity/location, revision, source document/line, actor, business date, client capture time, server posting time, and reversal reference where applicable.

## 7. Tenant security and database access

- Enable RLS and appropriate grants on exposed tables; test both permitted and forbidden actions.
- Use membership and scope assignments for authorization, not user-editable profile metadata.
- Keep privileged keys out of clients and bundles.
- Prefer invoker privileges; privileged routines require explicit caller validation, restricted execution, and fixed object resolution.
- Protected views, file storage, workers, and sync streams require separate review.
- Expose command APIs for posting; prohibit direct client updates of balances, allocations, posted entries, and accepted receipts.
- Replication readers may bypass ordinary RLS. Sync filtering must independently restrict tenant, location, permission, and field exposure.

Supabase documents that grants control allowed operations and RLS controls accessible rows. Both must match the access model. [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security)

Users who cannot view cost must not receive cost fields in local replication. Hiding columns in the UI does not protect downloaded values.

## 8. Shared command contract

Proposed HTTP surface:

```text
POST /api/v1/commands
GET  /api/v1/commands/{operationId}
GET  /api/v1/bootstrap
GET  /api/v1/jobs/{jobId}
POST /api/v1/imports
```

Initial command types: `opening.post`, `receipt.post`, `supplier-return.post`, `transfer.dispatch`, `transfer.receive`, `production.post`, `waste.post`, `count.finalize`, `document.reverse`, and revision-checked master-data updates.

Example envelope:

```json
{
  "operationId": "client-generated-uuid",
  "deviceId": "registered-device-uuid",
  "organizationId": "organization-uuid",
  "legalEntityId": "entity-uuid",
  "locationId": "location-uuid",
  "type": "production.post",
  "schemaVersion": 1,
  "expectedRevision": 3,
  "dependsOn": ["receipt-operation-uuid"],
  "businessDate": "2026-10-09",
  "capturedAt": "2026-10-09T09:20:00Z",
  "payload": {
    "documentId": "production-uuid",
    "recipeVersionId": "published-version-uuid",
    "actualOutputQuantity": "9.200000"
  }
}
```

This illustrates the envelope only; the production schema must include complete input/output lines and units. Resolve actor from authentication, not the request body. Validate device registration and command membership.

Return operation ID, outcome, source document, server revision, posting references, safe error code, retryability, and replication acknowledgment marker. A transport 2xx is insufficient to describe final stock acceptance if work was merely queued.

## 9. Idempotency and response semantics

Unique key: organization plus operation ID. Retain a canonical payload hash. The same ID and same payload returns its prior result; a different payload with that ID is rejected.

Check current caller authority before exposing an earlier response. Allocate the receipt and apply posting effects in one database transaction. Rollback cannot leave an accepted receipt without effects. Concurrent duplicate requests serialize on the same receipt key.

| Outcome | Client behavior |
|---|---|
| Accepted | Retain acknowledgment; reconcile projection with replicated records |
| Retryable infrastructure failure | Backoff with jitter, same operation ID |
| Authentication expired | Pause sending, preserve pending work, reauthenticate |
| Dependency pending | Defer this operation; send independent work |
| Revision conflict | Show server revision and require repair |
| Insufficient stock / closed period | Needs Review, preserve captured facts |
| Permission revoked | Do not post; retain controlled recovery record |
| Unsupported schema | Pause affected command, explain upgrade/recovery path |

If a user changes rejected payload data, create a new linked operation ID. Lost response after commit is resolved by replay or receipt lookup, not a fresh unrelated ID.

## 10. Atomic posting implementation

Use one actual PostgreSQL transaction, through a server connection or a correctly scoped database routine. A series of separate REST writes is not an atomic transaction.

```text
Authenticate and resolve scope
BEGIN
  Lock/claim idempotency record
  Validate document revision, approval, period, and dependencies
  Lock posting scope and affected item/location balances in stable order
  Normalize quantities and verify availability
  Allocate FIFO input layers in stable order
  Write stock entries and allocation links
  Create output/transit layers where required
  Update quantity and value projections
  Update document and insert audit/server-outbox events
  Store accepted command receipt
COMMIT
```

Lock ordering must be consistent across receipt, transfer, waste, and production handlers. Retry deadlocks/serialization failures safely under the same operation ID.

Assign a committed posting ordinal within the locked stock scope. FIFO uses layer creation order plus a deterministic tie-breaker, not client clocks. Business dates remain report attributes. Multiple independent scopes need not be globally serialized.

Cost allocations for an issue must equal its issued quantity and amount. Transfers carry allocation fragments; destination layers preserve origin lineage. Production allocates input cost to actual usable output under the V1 single-output policy.

Reversals are new documents with compensating effects. Check remaining output, downstream allocations, and periods; do not restore consumed inputs while keeping their outputs in stock.

## 11. Local database layout

Separate server-derived tables from local-only records:

```text
Replicated: catalog, published definitions, authorized balances,
            cost views if permitted, documents, command receipts
Local-only: draft_documents, local_commands, provisional_effects,
            attachment_tasks, device_preferences
```

Confirm the candidate SDK's supported local-only table and transaction APIs before implementing. Business commands may be represented through its upload queue, but the application retains explicit domain command semantics. Do not blindly upload row edits into authoritative stock tables.

When saving offline, persist the draft, immutable command payload, and provisional effects atomically. If persistence fails, the UI must not report successful local saving.

Display confirmed quantities separately from provisional quantities. Estimate availability using a defined pending projection; do not call that an authoritative balance.

## 12. Avoiding synchronization double-counting

An API acknowledgment and replicated balance update arrive through separate channels. Removing a projection immediately on acknowledgment can briefly understate quantity; leaving it after replication can double-count it.

Use a convergence protocol:

1. Server commits effects, document, and accepted receipt atomically.
2. Response includes a marker identifying those accepted effects.
3. Client retains pending projection until a consistent replicated view includes the accepted effects/receipt.
4. Remove/suppress the provisional projection in a local transaction.
5. Rejected commands remove provisional effects but retain their captured document for review.

Do not assume a receipt streamed into one table proves all balance tables have converged. Validate the sync product's transactional checkpoint guarantees. If it cannot expose a suitable barrier, derive the displayed stock from synchronized entries plus unmatched local operations using unique operation IDs, or implement another tested projection protocol.

Test acknowledgment-first, replication-first, duplicate responses, reconnect, and interrupted local acknowledgment handling.

## 13. Offline authentication and devices

First login and enrollment require connectivity. Issue a scoped offline grant containing user, device, tenant, allowed locations/actions, issue/expiry time, and policy version. This is a proposed application feature, not an automatic Supabase Auth capability.

The local grant permits capture during a bounded disconnected session; it does not authorize server posting after rights are revoked. Server validates current permission when uploading. Treat device clocks as untrusted and address clock rollback in the offline policy.

Expired authority stops new protected capture but retains pending work. Define lock, reauthentication, sign-out, data purge, and recovery separately.

Multi-user browsers need isolated databases or access scopes. Switching tenants must never retag queued commands. Online support administrators cannot inspect local unsynced records unless an explicit recovery/support flow supplies them.

## 14. PWA implementation

- Cache a versioned shell, assets, fonts, and offline navigation fallback.
- Implement critical operational routes as local-data-capable client screens.
- Do not rely exclusively on network-fetched Server Components for offline navigation.
- Avoid service-worker caching of arbitrary authenticated API responses; use the scoped local database.
- Test offline hard reload and direct navigation to supported routes.
- Show bootstrap/sync progress before claiming offline readiness.
- Monitor storage capacity and request persistence where supported.
- Keep the app usable without assuming background sync will run.
- Coordinate updates across tabs and local schema versions; avoid simultaneous outbox drain duplication.
- Retain compatible cached assets until pending work can safely migrate.

The first supported browser/device matrix is an explicit release artifact. Start with tested desktop Chromium and Android browser environments; validate other browsers before advertising equal offline support.

## 15. Recipes, BOMs, and production

Published versions are immutable. Store exact nested-version references; later child revisions must not change an old parent.

Use one definition resolver with two modes:

- Execution mode: stop at stocked components; expand virtual definitions.
- Analytical mode: expand to the chosen raw-material boundary with lineage.

Detect cycles across recipe/BOM references, including proposed changes. Serialize publication within a definition scope or use another mechanism that prevents concurrent publications from jointly introducing a cycle.

Production fixtures must prove that using stocked Kofta Mix consumes only the mix. Normal loss lowers usable output; it is not a second issue. A zero usable output requires a failed-batch/waste workflow, not division by zero or an invented output cost.

Unit conversion and yield calculations use decimal arithmetic and dimension validation. Share pure preview calculations with clients; authoritative allocations stay server-side.

## 16. Counts, transfers, and periods

Capture counts as observations with time, location, item, and observer. Finalization online establishes the cutoff and reconciles movements between observation and cutoff. Freeze affected posting briefly if using the V1 freeze model.

Known pending commands must be resolved before finalization. A disconnected device cannot prove it has no late activity: record device acknowledgments where possible, and provide an explicit late-arrival review path rather than pretending closure is globally complete.

Transfer dispatch and receiving are separate commands. Partial receipts leave transit allocations. An offline receipt with no downloaded dispatch is an unmatched observation, not finalized destination stock.

Closed-period late arrivals require authorized correction/reopening policy; never backdate costs silently. Configure positive count valuation before live use.

## 17. Imports and consumption reports

Use server staging tables and asynchronous jobs for large XLSX/CSV files. Parse types, preserve codes as text, normalize units/dates/Arabic numerals, limit file size/rows, and retain source-row errors.

Opening-stock import invokes the posting engine, not direct balance insertion. Product changes and opening entries have separate references.

Receipt-level sales deduplicate with source identifiers. Daily summaries need a declared append/replace/overlap policy. Report unsupported overlap rather than guessing.

Pin sale recipe versions and preserve refunds/voids. Accounting invoice imports are not interchangeable with POS detail imports.

Theoretical sales usage stops at the selected stocked boundary. Count residual depletion excludes known production input, transfers, supplier returns, and recorded waste. Show incomplete mappings/counts/sync as provisional. Cost basis must be explicit and consistent.

## 18. Arabic and country adapters

Use translation keys, logical CSS properties, correct mixed-direction isolation, and Arabic-friendly error text. Preserve official identifiers without search normalization. Validate keyboard navigation and number entry on mobile.

Entity settings own country/currency/tax registration; branch settings own timezone/cutoff where applicable. Store financial snapshots on documents.

Country adapters receive a canonical fiscal DTO and return validation/submission results. They own formatting, signing, credentials, identifiers, and response mapping. Keep fiscal, payment, sale, and stock statuses separate.

Initial fiscal responsibility stays with the external POS. Do not present management PDFs as compliant electronic invoices. Native POS rollout requires applicable validation and taxpayer setup.

Sources to recheck at country implementation:

- [Egypt ETA SDK](https://sdk.sit.invoicing.eta.gov.eg/)
- [Saudi ZATCA](https://www.zatca.gov.sa/en/E-Invoicing/Pages/default.aspx)
- [UAE FTA](https://www.tax.gov.ae/en/taxes/Vat/uae.einvoicing.aspx)

## 19. Development phases and exit gates

| Phase | Implement | Exit evidence |
|---|---|---|
| 0: Setup | Workspace, strict checks, environments, ADRs, fixtures | Clean setup and build documented |
| 1: Foundation | Tenants/entities/locations, auth, roles, module access, Arabic shell | Two-tenant allow/deny tests pass |
| 2: Offline prototype | Local DB, PWA, commands, retry, acknowledgment convergence | Offline restart, replay, migration and conflict demos pass |
| 3: Inventory engine | Units, FIFO, balances, atomic posting, reversals | Ledger/layers reconcile under concurrent issues |
| 4: Operations | Opening imports, suppliers, receipts, transfers, waste, counts | Receive → dispatch → partial receive → count scenario passes |
| 5: Definitions/production | Versions, resolver, costing, local/central preparation | Nested recipe and yield scenario passes without double consumption |
| 6: Cost control | POS imports, mappings, periods, theoretical/actual reports, expenses | Seeded reconciled period matches independent expected results |
| 7: Pilot | Reports, recovery, monitoring, onboarding, packaging | Release checklist and restore exercise pass |

Build complete vertical slices in each phase: contract, database, handler, offline behavior, Arabic UI, and verification. Avoid finishing all screens before the posting engine exists.

## 20. Verification scenarios

| Scenario | Expected outcome |
|---|---|
| Receipt 10 kg at 100, then 20 kg at 130; issue 6 kg | FIFO issue 600; 24 kg remains valued 3,000; average 125 |
| Production input cost 1,840; output 9.2 kg | Output layer unit cost 200; no duplicate loss issue |
| Transfer 5 kg; receive 3 kg | 2 kg remains in transit, cost conserved |
| Two online issues of 8 and 7 against 10 | At most one can post; no negative accepted stock |
| Two offline issues against shared stock | Capture retained; server conflict visible; no silent merge |
| Commit succeeds but response is lost | Same-ID replay yields one posted document |
| Tenant B guesses tenant A IDs | Read/write/sync download denied |
| Non-cost user downloads data | Cost fields absent from local replication |
| Recipe cycle via concurrent changes | Publication rejects invalid graph |
| Hard reload offline after bootstrap | Supported routes load and local drafts remain |
| Outbox acknowledgment races replication | No double-counting or untracked projection loss |
| App upgrade with pending old command | Compatible migration or explicit safe pause |
| Closing count with late device operation | Review path preserves counted-period integrity |

Use pure unit tests for calculations, PostgreSQL integration tests for transactions/access, and browser end-to-end tests for operational/offline flows. Use an independent expected ledger for fixture assertions; do not simply repeat the implementation in tests.

## 21. Performance and observability

Scope replication to authorized operational records; paginate/download older history on demand. Maintain selective recipe recalculation and cost caches with visible freshness.

Define measured performance targets after fixture volumes and pilot hardware are established. Record local save latency, bootstrap duration, posting latency, sync lag, rejection count, and reconciliation discrepancies.

Use server outbox events for jobs created alongside posted transactions. External API calls must not hold the inventory transaction open. Workers are idempotent and observable.

Logs include safe correlation IDs and operation IDs, not credentials or full customer financial payloads. Monitor backups, restore tests, failed jobs, sync queue age, and storage errors.

## 22. Deployment and release checklist

Before release:

- Record the source commit/tag, destination environment and backend project; verify configuration belongs to that environment.
- Confirm reviewed changes and required checks passed; identify the prior compatible artifact and rollback/roll-forward owner.
- Review migrations and apply to staging; test previous-client compatibility.
- Run type/lint/build and the relevant domain/integration/offline checks.
- Run access checks for tables, views, routines, files, sync streams, and costs.
- Reconcile stock/layers/transit against independent fixtures.
- Verify pending-command migration and cached-shell update behavior.
- Validate supported Arabic browser/printing layouts.
- Verify backup restore and document device-only recovery limits.
- Verify permission expiry, device revocation, and tenant switching.
- Confirm fiscal responsibility and market hosting/privacy requirements.
- Record known provisional/offline constraints and support procedure.
- For client-demo releases, verify isolated client workspaces, disabled/sandbox integrations, expiry and stale-generation rejection after a reset.
- After deployment, verify the served build identity and scoped smoke tests; record the migration level and deployment result.

Deploy additive schema changes before clients require them. Keep compatible command handlers during rollout. Rollback must preserve accepted operations and queued older clients; avoid destructive database rollback as the default recovery mechanism.

## 23. Task and review template

```text
Task:
User outcome:
Master-plan requirement:
Branch and base revision:
Target environment and backend project:
Domain owner and dependencies:
Database constraints/migration:
API/command contract:
Permission and tenant scope:
Offline capture and convergence behavior:
Decimal/unit/cost rules:
Arabic UI states:
Failure and recovery behavior:
Acceptance scenarios:
Validation evidence:
Commit SHA and push/PR status:
Rollout/compatibility notes:
Rollback or roll-forward approach:
```

A task is done when its behavior, error recovery, access scope, offline effects, and evidence are reviewable. Mock screens alone are not completed business workflows.

## 24. First implementation task

Start with a thin vertical slice: two tenants, one permitted stock location each, an item, an opening receipt command, and an offline waste command.

Prove online enrollment, offline reload/capture, durable restart, same-ID retry, transactional FIFO posting, tenant isolation, and projection convergence. Then freeze the initial command and local-storage contracts and expand to receiving and transfers.

No customer-specific file is required for this slice. Use deterministic demonstration data and keep tax, cutoff, count, and browser policy assumptions recorded for later pilot configuration.
