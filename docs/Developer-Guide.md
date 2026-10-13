# Current scope amendment

Delivered 13 October 2026: kitchens hold inventory within the existing branch/location scope; meals may be available in several kitchens; each POS belongs to one kitchen and prepares the complete meal independently. New sales require explicit POS context and consume checked ingredients only from its kitchen, accepting shortages without fallback. Kitchen supply is a stock transfer. Cashier shifts and split preparation remain deferred. See [delivered scope](./Kitchen-Inventory-POS-Plan.md), [setup and operating guide](./runbooks/Kitchen-Issues.md) and [verified release](./releases/kitchen-inventory-pos-2026-10-13.md). This supersedes historical immediate-consumption kitchen instructions below.

The hosted client release and sales policy in [Hosted release](./Hosted-Release.md) supersede earlier roadmap text about sales stock deduction, demo provisioning and membership/billing administration. Sales calculate all theoretical usage; new imports deduct only ingredients selected in their pinned recipe version. Imports with shortages succeed, deduct available stock and highlight the recorded shortage. Older sales and recipes without selections remain calculation-only. Earlier delivery entries below remain historical checkpoints.

The first client is واحة أولاد سعد. Its name, logo and contact details belong to its tenant profile; clicking المؤسسة الحالية opens the details dialog. The home page keeps the operational overview. See the [organization profile runbook](./runbooks/Organization-Profile.md) and [verified branding release](./releases/client-branding-2026-10-11.md). Keep the hosted bootstrap schema and applied migrations immutable; append later schema changes and save their actual migration version.

Direct stock balance editing and selective sales deduction are documented in [stock balance editing](./runbooks/Stock-Balance-Editing.md), [sales import](./runbooks/Sales-Import.md) and the [client stock behavior release](./releases/client-stock-behavior-2026-10-11.md). Existing tables and JSON documents carry the new metadata; retain applied migrations and the offline database version.

All-screen UI delivery is now hosted: shared pagination, filters and ordering across the 14 main workspace screens and report lists; native dropdown spacing; clearer selected sales deduction and cost-only components; responsive histories and a unified local sync center. Long editors preserve values and validation across pages. See [list controls](./runbooks/UI-Lists.md) and the [verified UI release](./releases/all-screen-ui-2026-10-11.md). This supersedes older local-only UI checkpoint statements below. Operational-screen paging uses downloaded snapshots. The BI reporting endpoint now aggregates full date ranges and pages details on the server.

Button actions keep their click target stable when focus leaves an empty required field. Defer blur feedback when focus moves to a button; submit still validates every field, while moving between fields keeps inline feedback. This prevents the first Add ingredient click from being lost as validation changes the form height.

Shared keyboard behavior is delivered across document/setup forms: Enter moves forward, Shift+Enter moves back, Ctrl/Command+Enter explicitly validates and saves, and Alt+Insert adds a row where available. Native multiline/file/checkbox controls and disabled confirmations remain respected. The **اختصارات** top-bar button opens the user guide, with short hints in editors. See [keyboard and forms runbook](./runbooks/UI-Forms.md) and [verified keyboard release](./releases/form-keyboard-2026-10-12.md). This supersedes earlier entries stating that ordinary Enter saves.

# FooDo SaaS Developer Guide

Version 2.44 — 13 October 2026

Receiving document details and entry headings now use compact typography and spacing, with desktop inputs at 38px minimum height and mobile inputs at 44px/16px text. See [compact receiving release](./releases/receiving-compact-2026-10-13.md).

Direct receiving now mirrors the stock issue receipt flow: one material/quantity entry, explicit receiving unit and cost, Enter-to-add, newest-first read-only lines and edit/remove. Compatible duplicates combine exactly; differing costs, units or conversion factors require an explicit edit. Save protects unfinished entries. The stock issue header and metadata are compact, retaining keyboard hints and mobile touch controls. See [receiving guide](./runbooks/Direct-Receiving.md) and [release](./releases/receiving-entry-2026-10-13.md).

The stock issue editor now has one searchable material and adjacent quantity entry, Enter-to-add, a newest-first receipt list, exact duplicate merging, quantity edits/removal and unfinished-entry protection. Short receipts show lines directly; lists above ten materials retain search/sorting/pagination. Stock posting, server validation and outbox formats are unchanged. See [operating guide](./runbooks/Kitchen-Issues.md) and [verified release](./releases/stock-issue-entry-2026-10-13.md). This replaces its earlier per-line entry/navigation instructions.

**سجل صرف المطابخ** is a separate BI report reached from the kitchen history shortcut or report tabs. Full-period server queries count only kitchen transfer outgoing lines plus legacy direct issues, never transfer incoming allocations or sale deductions. Distinct document/material counts and daily/ranked charts cover all filtered pages. Destination kitchen location selection includes supply received from its source; kitchen-to-kitchen supply is ranked by its recipient. Values retain posted costs, quantities keep individual units, and the report is read-only. See [kitchen supply reporting](./runbooks/Kitchen-Supply-Report.md).

Recharts `3.10.1` and matching `react-is 19.3.0` power the BI summary in **نظرة عامة** and the dedicated **التقارير والتحليلات** view. Reporting uses the new tenant-authenticated `POST /api/v1/reports`, complete date-range aggregates and server pagination, rather than the truncated operational snapshot. Keep current balance valuation, period posted costs, recipe estimates, selected sales deductions, supplier-reference values and shortages distinct. Reports cache up to 24 responses per tenant/generation/exact query in the existing preferences store; pending outboxes never enter accepted totals. CSV exports include all filtered rows up to 10,000 and reject checkpoint changes; printing covers the current detail page. Chart clicks and keyboard alternatives open filtered details. Empty periods, missing prices, units and equal previous periods remain explicit. See [BI runbook](./runbooks/BI-Reports.md) and [verified BI release](./releases/bi-reports-2026-10-12.md). No schema or Dexie/recovery version change is needed.

The material category field uses `CategorySelect.tsx` and the shared searchable selector. Focus shows all tenant categories (including inactive and zero-stock materials); typing filters the full list. **إضافة فئة جديدة**, F2 or unmatched-search Enter opens a separate native dialog. Validate 2–100 characters, normalize whitespace, select an existing normalized name instead of duplicating it, then return focus to the parent field. The new category remains a draft until the material is saved through the existing setup outbox; cancellation writes no category. Keep categories flat and do not introduce a separate empty-category catalog in this milestone. The side menu groups all 15 existing views into daily operations, inventory management, cost/preparation and settings/follow-up. Desktop navigation scrolls independently; mobile retains horizontal navigation. The inventory column **تكلفة الوحدة الفعلية** uses the confirmed balance average (accepted value ÷ accepted quantity), shows EGP per base inventory unit and supports sorting; absent cost stays a dash. This is the existing valuation, displayed clearly, without a new receiving or selling price. See [verified categories/navigation release](./releases/categories-navigation-2026-10-12.md).

Direct receiving supports **إضافة مادة جديدة** inside its material selector. Use the shared setup editor in compact mode: name (prefilled from search), unique SKU, category and explicitly chosen inventory unit. Save into the existing setup outbox with zero stock, select the new material on the same receipt row and focus quantity; retain supplier, date, reference and all other rows. Cancelling the child returns to the selector; cancelling the receipt after creation retains the catalog material. Upload setup before the dependent receipt and put receipts with unconfirmed references into review without posting them. **مرجع الاستلام** is optional; blank, whitespace-only and omitted references normalize to an empty string, supplied references retain 2–200 characters, and existing document hashes remain compatible. Ledger/history use a readable fallback with stable receipt/line IDs. No database or recovery-format migration is needed. See [receiving release](./releases/receiving-quick-create-2026-10-12.md).

Kitchen issue references are optional in the form, shared contract and server acceptance. Blank, whitespace-only and omitted input normalize to an empty string; nonempty references retain their 2–100 character limit. Keep existing document IDs/hashes compatible, retain automatic `KI-` numbers and avoid empty separators in history or ledger descriptions. The local outbox and recovery need no format migration. See [optional issue reference release](./releases/optional-issue-reference-2026-10-12.md).

Operational forms now share the accepted stock-issue layout: compact document details, clear material cards or labeled phone rows, optional explanations, immediate quantity warnings and a persistent summary beside Save/Cancel. Receiving, opening stock, purchase drafts/partial receiving, supplier returns, transfers, counts, recipes, production, menu mapping and sales import use this pattern; setup, balance editing and waste share its labels and footer. Small plain line lists hide paging clutter, while long documents and searchable count/source lists retain filters, sorting, paging and entered values. Incomplete purchase rows preserve completed subtotals and explicitly mark the estimate incomplete. Keep `DocumentForm.tsx` and `document-forms.css` shared by the local and hosted entry points. See [forms controls](./runbooks/UI-Forms.md) and [document forms release](./releases/document-forms-ux-2026-10-12.md) for verification and limits. Business validation, stock posting, tenant scope and offline persistence remain authoritative in their existing layers.

The stock issue editor now uses compact document details, clearer item/quantity rows, projected available/remaining stock, proactive accessible shortage warnings, per-line average cost estimates, optional notes and a persistent total beside Save. Small documents hide paging clutter; longer documents retain pagination and keyboard page reveal. UI projections do not change authoritative issue validation or accepted consumption. See [kitchen issues](./runbooks/Kitchen-Issues.md) and [verified form UX release](./releases/stock-issue-form-ux-2026-10-12.md).

Catalog search and selection now share one visible accessible combobox across receiving, waste, opening stock, purchasing, recipes, production, sales mapping and kitchen issues. Preserve stored IDs/ref integration, required-field focus, disabled duplicates and offline tenant snapshot lookups. See [forms controls](./runbooks/UI-Forms.md) and [unified dropdown release](./releases/unified-searchable-dropdown-2026-10-12.md). This supersedes earlier two-control search/native-selector instructions.

The accepted platform identity is **FooDo**. Shared branding appears in the workspace, welcome/sign-in screens, browser icon and installed-app manifest. Tenant branding stays in the organization profile. Keep technical service/database identifiers and saved local addresses stable. See [brand assets and generation record](./branding/FooDo.md) and the [verified branding release](./releases/foodo-branding-2026-10-12.md).

Kitchen recipients support Add/Edit/Delete/Restore through tenant-scoped, revisioned setup records and multi-material **immediate consumption** through a separate document/ledger type. Deletion removes a recipient from new selection while preserving accepted consumption. Reuse stock valuation and reconciliation; keep sales, production and kitchen consumption distinct so the same goods are not automatically charged twice. The keyboard editor, automatic search-result dropdown, offline outbox and printable documents are documented in [Kitchen issues](./runbooks/Kitchen-Issues.md). IndexedDB is version 11 and recovery format 16. The applied additive migrations are `20261012065508_kitchen_consumption.sql` and `20261012073503_kitchen_directory.sql`; never modify the initial hosted baseline migration. Both retain the private trial backup through guarded compatible schema extensions. See the [kitchen consumption release](./releases/kitchen-consumption-2026-10-12.md).

Companion specification: [Modular SaaS Master Plan](./Master-Plan.md).

The user has approved temporary trial data in the existing hosted client workspace. See [temporary client data](./runbooks/Temporary-Client-Data.md) and the [verified menu trial release](./releases/client-sample-data-2026-10-11.md). The hosted workspace now has 99 menu mappings, 100 published recipes, 338 catalog items (original 328 plus 10 additions), stock and purchasing/production/sales examples. Prepare the private baseline backup and guarded cleanup before posting sample operations. Prices/recipes/yields are assumptions; original catalog/profile/access must survive cleanup. Real activity begins only after the trial is removed. The production UI retains its normal workflows and no development reset is exposed.

This guide defines the development and release workflow. FooDo now has both local development and a hosted first-client workspace. Code snippets and API names below remain proposed contracts unless the implementation-status section states otherwise.

## Implementation status and revised delivery order — 10 October 2026

This version supersedes the original task order where it conflicts. Fodo is a working local inventory application: Arabic RTL web UI, editable items/units/suppliers/stock locations, purchase packs, multi-material opening stock with CSV preview, multi-item direct receiving, purchase orders/partial receiving and linked receipt reversals, source-linked supplier returns, dispatch/partial receiving/transit loss, physical counts/reconciliation, receiving, waste, moving-average/FIFO costing, versioned recipes/sub-recipes and ingredient cost estimates, preparation batches with actual input/output costing and waste, source-specific menu mappings and completed-sales CSV imports, durable local outboxes, recovery archives and reconnect synchronization. Production authentication, sales consumption reports, country adapters and billing remain planned.

Current adapters: Next.js/React for local development; the shared React workspace bundled for Cloudflare hosting; Zustand for UI state; React Hook Form/Zod; custom CSS; Dexie/IndexedDB; PGlite development PostgreSQL; Supabase managed Postgres and Auth for hosting; complete tenant snapshots. Tailwind/shadcn, TanStack Query and PowerSync remain future decisions. Do not rewrite stable UI state merely to match an earlier technology proposal.

### Current priority: working application for the first client

The [UI and forms completion record](./UI-UX-Remaining-Work.md) now records stages 0–5 delivered locally on `feat/ui-form-polish`, stacked from receiving checkpoint `a4fd1dc`. Verification passed: TypeScript, production build/offline manifest, 216 unit/integration tests in 34 files and 43 browser/process scenarios (41 fixture regressions plus two isolated empty-workspace checks). The client catalog remains 328 items, 20 flat categories, six units, one main warehouse and zero movements/balances/recipe definitions.

The Arabic RTL UI now uses grouped setup/receiving dialogs, required/optional guidance, associated inline errors, native searchable item selectors and bounded workflow bodies with separate actions. Inventory editors, recipes, production and sales import share field feedback and keyboard submission. Count search/category/count-state filters retain zero and entered quantities, and reveal a hidden invalid row before focusing it. Operation histories share status labels, prioritize review and link available source/replacement documents. Invalid-field focus scrolls the field containers rather than hiding the save action behind mobile navigation. See [UI forms walkthrough](./runbooks/UI-Forms.md).

Desktop/tablet/phone screenshots were reviewed. The owned launcher verified the current build and unchanged client catalog at the saved 3108 origin, but cross-process localhost access remained blocked in this tool session and the live browser tool could not initialize. The owned verification server was stopped. Use the existing `Start-Fodo.cmd` from the user's desktop environment and refresh to display the built version. This UI checkpoint does not change the launcher, Supabase schema, stock arithmetic or installed UI-state architecture.

Receiving-unit follow-up is delivered locally: **وحدة الاستلام** exposes every organization unit alongside the item's fixed purchase packs, keeping the inventory base unit unchanged. Standard kg/g and litre/ml conversions are automatic; other unit relationships require an explicit positive factor per receipt line, never an assumed factor of one. Base quantity/value previews retain cost entry per base inventory unit. Receipt JSON captures the chosen unit names/factor for history and rejected-document correction; local/server validation enforces tenant references, standard ratios, exact arithmetic and six-place quantity limits. New unit metadata extends the receipt contract without a database/Dexie schema migration. Recovery exports format 14, with formats 1–13 still readable. The client's 328 items, 20 categories, six units and main warehouse were verified unchanged with zero stock movements/balances. No units or client fixtures were seeded. See [Direct receiving](./runbooks/Direct-Receiving.md).

Delivered on `feat/receiving-units`, stacked from composition checkpoint `5d6da5a`. Verification on 11 October 2026: all 216 unit/integration tests in 34 files, TypeScript and production build/offline manifest passed; three targeted browser scenarios passed for all catalog units, multi-item receipts and existing setup/pack receiving/waste. The new scenario covers offline unit creation/reload, automatic conversion, mandatory custom package contents, cleared factors after selection changes, linked rejected-document correction, exact value, one-time posting and desktop/mobile fit. Screenshots were inspected. The local launcher and saved address remain unchanged; restart the existing server and refresh to load the build.

Inventory setup now exposes **مكونات الصنف**. An inventory item may be produced from other items through the existing stocked recipe definition, with component quantities and batch output. An optional action after item save opens composition setup, prefilling the output item and its base unit; an existing linked recipe is reopened rather than duplicated. Composition remains tenant-scoped, offline-capable and versioned. Definitions stay stock-neutral; only accepted production consumes inputs and creates the output. Ingredients can include published sub-recipes under the existing cycle and stocked-boundary rules. This uses the existing BOM model and retains the catalog's single-level categories.

Delivered on `feat/stocked-item-composition`, stacked from local sales-import checkpoint `6360994`. Verification on 11 October 2026: 202 unit/integration tests, TypeScript and production build/offline manifest passed; three targeted browser scenarios passed for item composition, recipe/version costing and inventory setup/receiving. The new scenario verifies new-item/offline setup, existing-recipe reopening without a duplicate, output-unit linkage, self-input exclusion, cost per output unit and unchanged stock; desktop/mobile views were inspected. No client catalog data, local launcher, database schema or offline storage format was changed. Restart the existing Fodo server at its saved address to load this build. See [Recipes walkthrough](./runbooks/Recipes.md).

The current delivery target is a hosted client trial for one organization with tenant-qualified relationships, scoped commands and offline recovery. Real sign-in resolves server-managed owner access. Membership UI, invitations, role administration, subscriptions and platform onboarding remain deferred. The local development session remains available only on the local development adapter; the hosted adapter rejects it.

The first client can use the Cloudflare workspace with Supabase-backed data. Separate client-demo and staging environments remain deferred; their lifecycle specifications below are historical planning. Existing GitHub environment registrations can remain unused. Preserve the local launcher and development data. Follow the hosted release record for deployed identifiers and verified boundaries.

The inventory setup milestone is delivered. Items, units, suppliers and stock locations can be created/edited offline. Receiving can reference a supplier and an item-specific purchase pack; inventory quantities are converted to the base unit, with cost explicitly entered per base unit. Prior pack definitions and an item's base unit are immutable, preserving queued operations and stock history. Records can be deactivated without deletion. Setup uploads precede dependent stock commands; stale revisions and duplicate codes enter review. Recovery version 3 includes setup and stock outboxes while older archives remain supported. See [Inventory setup walkthrough](./runbooks/Inventory-Setup.md).

Phase 2A opening stock is delivered locally: bounded multi-material documents, UTF-8 CSV mapping/preview, base-unit costs, atomic stock/layer/audit posting, baseline uniqueness after consumption, same-ID retries, offline dependency sequencing and version-4 combined recovery. Snapshot and outboxes are read together to preserve the selected branch through setup acceptance. See the [opening stock walkthrough](./runbooks/Opening-Stock.md).

Phase 2B purchase documents/partial receiving is delivered locally: stock-free drafts, submitted revisions, immutable prices, bounded atomic multi-line receipts, cancellation of unreceived quantities, original-stock receipt reversal, offline ordering and purchase-aware recovery (current format 14). See [Purchasing walkthrough](./runbooks/Purchasing.md). Phase 2C supplier returns are delivered locally: original receipt-source quantity tracing, separate supplier reference/inventory amounts, atomic deductions, unchanged gross receiving, offline review and linked corrections. Recovery format 14 includes return actions/correction history and generation validation. See [Supplier returns walkthrough](./runbooks/Supplier-Returns.md). Phase 3A transfers are delivered locally: dispatch under the organization costing policy, original-cost partial receiving, explicit transit loss, revision/duplicate protection, offline dependency ordering and generation-bound recovery format 14. See [Transfers walkthrough](./runbooks/Transfers.md) and [Phase 3 plan](./Phase-3-Plan.md). Phase 3B stock counts are delivered locally: partial physical counts, draft/review/finalize/cancel, exact location-sequence stale checks, shortages under the selected costing policy, explicit-cost surpluses, independent ledger/balance/layer reconciliation, offline ordering and linked recount recovery. See [Stock counts walkthrough](./runbooks/Stock-Counts.md). Moving average is now the default with FIFO selectable; see [Costing methods](./runbooks/Costing-Methods.md). Phase 4A recipes/sub-recipes and transparent cost estimates are delivered locally; see [Recipes and costing](./runbooks/Recipes.md) and [Phase 4 plan](./Phase-4-Plan.md). Phase 4B production/yield is delivered locally; see [Production and yield](./runbooks/Production.md). Phase 4C1 menu mapping and completed-sales imports are delivered locally; see [Sales import](./runbooks/Sales-Import.md). Phase 4C2 now provides calculation-only theoretical sales quantities/cost estimates. The first hosted client release uses real Auth and managed Postgres; see Hosted-Release.md. Actual consumption period reconciliation and financial corrections follow later. Sample development fixtures can be used until the client supplies their setup data. Each milestone must work end to end before adding more SaaS administration. See [Phase 2 implementation plan](./Phase-2-Plan.md) for contracts, scope and acceptance scenarios.

### Verified reliability delivery

Same-organization renewal with queued work, review retry/correction/cancellation, and archive preview/restore are implemented. Verification passed: 202 unit/integration tests across 33 files, 35 browser/process scenarios (33 fixture regressions plus 2 isolated empty-workspace checks), TypeScript, production build and offline manifest. Coverage includes moving-average location pools, exact fractional depletion/transit values, supplier valuation differences, reset generations/stale forms/archives, setup revisions, tenant isolation, pack conversions, inactive records, migrations, combined recovery, opening baseline concurrency/atomic rollback, fractional opening FIFO, CSV validation, offline opening before waste, preserved branch selection, return source availability, return rollback, original-cost deduction, duplicate posting, offline correction/recovery, mixed-cost transfer segments, independent stock-plus-transit reconciliation, explicit transit loss, fractional transfer cost, queued onward dispatch ordering, strict count baselines, atomic count adjustments, explicit surplus cost, read-only reconciliation and linked physical recount recovery. Database restore and tamper rejection remain covered. TypeScript and the production build pass. Browser checks use separate test data and do not modify the client's local database. Remote branch and PR CI passed at `42d8edf` for the earlier workflow work; the newer inventory setup, opening stock and purchase-document, supplier-return, transfer, count, costing, multi-item receiving, recipe, production and sales-import work are local. `feat/opening-stock` is stacked on `feat/inventory-setup` after planning commit `4c89131`; `feat/purchase-documents` is stacked on `feat/opening-stock` at `8de87cc`; `feat/supplier-returns` is stacked on purchase-document commit `581ea72`; `feat/stock-transfers` is stacked on supplier-return commit `b50d7e1`; `feat/stock-counts` is stacked on transfer commit `f427942`; `feat/moving-average-costing` is stacked on count commit `549aa4f`; keep these relationships explicit when publishing/reviewing. The setup-helper fix has 22 local regression checks passing in both PowerShell versions. Squash merging, cleanup, immutable tags and staging/demo/production registrations are verified; main-protection payload correction still needs remote verification.

All production start paths (`pnpm start`, `run.ps1 start`, and the Windows launcher) now share the saved origin and `.data-local`. Development uses port 3109 and `.data-dev`. Build identity is baked into the workspace footer and health response; the launcher refuses an older verified build and instructs a same-origin restart. `run.ps1 backup` runs the manual cold-backup utility. Existing data directories remain preserved.

Git identity is configured locally for the GitHub account `3azam0`, using its no-reply address. Before a checkpoint, stage only source/configuration templates; exclude environment files, database directories, backups, session keys, dependencies and build outputs. Record the checkpoint in the implementation review after creation.

Selected cloud project: `bkkxrptgwbrwredauopq` at `https://bkkxrptgwbrwredauopq.supabase.co`. Ignored `apps/web/.env.local` holds its public URL and publishable key. `run.ps1 cloud-check` verifies the Auth endpoint without signing in or mutating cloud data. The supplied key is accepted. The connected Supabase management account currently lacks project access; production Auth, tenant schema, permissions and migrations remain pending until that connection is corrected. Never substitute the publishable key for management access.

| Order | Delivery | Acceptance gate |
|---|---|---|
| 0A | Same-organization session renewal with pending work | Expire the login, preserve a queued operation, renew, and post it exactly once |
| 0B | Stable local origin and single-instance launch | Repeated launch reuses the verified instance; unrelated port conflicts are explicit; one database owner |
| 0C | Review, retry, cancel, correct and restore | Immutable operation history; changed data gets a new linked ID; restore validates scope and deduplicates |
| 0D | Version control and backup/restore runbook | Git initialized with secrets/data ignored; a restore exercise proves database recovery |
| 1 — delivered locally | Working inventory setup for the first client | Editable items, units, suppliers and locations; tenant-scoped persistence and reload; purchase packs and supplier receiving |
| 2A — delivered locally | Opening stock | Manual/CSV-previewed multi-material baseline posts atomically once to pristine item/locations; offline reload/retry and recovery preserve quantity, value and audit |
| 2B — delivered locally | Purchase documents and receiving | Draft orders have no stock effects; partial receiving posts immutable line quantities, pack conversions and costs exactly once |
| 2C — delivered locally | Supplier returns | Original-layer deductions cannot exceed source quantities/availability; retry and linked offline correction preserve cost/audit; gross receiving stays unchanged |
| 3A — delivered locally | Transfers | Atomic selected-policy dispatch → transit → partial receiving/loss; original cost, offline dependencies and format-9 recovery |
| 3B — delivered locally | Counts and reconciliation | Partial counts, strict accepted location-sequence baseline, selected-policy shortages, explicit-cost surpluses, independent ledger/balance/layer checks and offline recount/recovery |
| 3C — delivered locally | Moving-average/FIFO costing | Organization policy, exact pool/transit values, supplier reference differences, sample reset and generation-bound recovery |
| 4A — delivered locally | Recipes and ingredient estimates | Immutable pinned versions, conversions, output yield, stock-neutral offline publication, missing-price visibility and recovery |
| 4B — delivered locally | Production and yield | Pinned inputs, actual usable output, atomic selected-policy consumption/output, abnormal waste, failed batches and exact allocated value |
| 4C1 — delivered locally | Menu mapping and completed sales | Pinned mapping revisions, CSV preview, external-detail deduplication, stock-neutral offline capture and recovery |
| 4C2 — delivered | Theoretical reporting, selective sales deduction and hosted access | Pinned unique sales; every ingredient remains in estimated cost; selected materials deduct available stock with persisted shortage warnings |
| 4C3 — later | Period reconciliation | Actual/theoretical comparisons, explicit financial corrections and shortage reconciliation |
| Before live use | Production deployment and minimum access | Real authenticated access for the configured organization, permission checks, isolated production data, migrations and verified restore; no public development-session bypass |
| Later | Membership administration and broader SaaS operations | Invitations, role-management screens, additional client onboarding, billing and dedicated demo/staging configuration when needed |
| 5 | Egypt pilot and market adapters | Supported device matrix, regional settings, applicable fiscal integration and operational acceptance |
| Later | Specialist modules, mobile/desktop, native POS | Only after their prerequisite workflows and device tests pass |

### Recovery rules

- Renewal for the current organization must work while commands are pending. Switching to another organization remains a separate operation. Never retag queued commands.
- On successful renewal, verify the returned organization, atomically refresh the local snapshot, then resume same-ID delivery.
- Authentication/network failures preserve queued work. Business rejection enters review and does not affect confirmed balances.
- Retry resends an unchanged rejected command using its original ID. Correction creates a new operation linked to the original; the original becomes superseded and remains inspectable. Cancellation is only for known rejected operations and never reverses a posted transaction.
- Recovery exports use format 11 with generation-bound payloads; formats 1–10 are parseable, but obsolete or missing generations cannot restore into the new ledger. Import requires a valid current grant, matching organization, validated payloads and envelope IDs, bounded file size/count, and a review preview. Identical IDs are skipped; conflicting payloads abort the entire import. Server-accepted IDs reconcile to accepted state. Imports never trust exported acceptance status without the server snapshot.
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

Current scope uses local development for implementation and an isolated Cloudflare/Supabase workspace for the first client trial. Dedicated hosted staging and client demo are deferred. The four-environment model below remains a future expansion policy; it does not require provisioning those environments now.

### 4.1 Environment responsibilities

| Environment | Purpose | Data and access | Release policy |
|---|---|---|---|
| Development | Build features and debug locally | Synthetic fixtures; developer accounts; isolated local database or development cloud project | Task branches; frequent disposable test deployments |
| Staging | Validate release candidates, migrations, roles and offline upgrades | Representative synthetic data; internal testers; payment/fiscal/message sandboxes | Deploy a recorded candidate commit after checks pass |
| Client demo | Let prospective clients explore stable restaurant workflows | Separate demo organizations; seeded restaurants and branches; restricted demo accounts | Promote a tested version; keep demonstrations stable during client sessions |
| Production | Operate paying customers' businesses | Real tenant data; real permissions; monitored backups and controlled integrations | Release an approved, tested commit/tag through the release workflow |

Keep distinct URLs, databases, object storage, auth configuration, signing keys, integration credentials and deployment permissions. For hosted environments, use separate Supabase projects; local development may use an isolated local stack. Tenant separation inside one shared database is not a substitute for separating production from test/demo infrastructure.

Register each environment in the deployment runbook: owner, purpose, app URL, backend project reference, region, configuration-variable names, backup policy, deployed commit/tag and allowed external integrations. Store secret values in environment configuration or a secret store, never in the runbook or repository. Future dedicated demo/staging surfaces should carry their environment label. The agreed first-client trial presents the normal client interface without development notes; health diagnostics retain build identity and hosted mode.

Current setup: local development uses port 3109 and `.data-dev`; the optimized local app uses the saved launcher origin, normally port 3108, and `.data-local`. Automated browser tests use isolated test data. The hosted client trial is https://fodo.am-agent2026.workers.dev, backed by Supabase managed Postgres/Auth. Local and cloud data remain separate. Dedicated staging/demo provisioning is pending.

Supabase project `bkkxrptgwbrwredauopq` is assigned to the first hosted client trial in `eu-west-1`. Its private `fodo` schema and owner access are deployed. See the [release record](./releases/hosted-client-2026-10-11.md). Additional hosted projects require a separate infrastructure decision, including region, access and cost.

### 4.2 Client-demo lifecycle — deferred

- Seed a realistic restaurant organization with branches, stock, suppliers, recipes and sales examples as those workflows become available. Label sample data clearly. Each prospective client gets an isolated demo organization or workspace; never share one writable tenant between unrelated prospects.
- Limit demo accounts to their workspace. Keep platform administration unavailable to them. Configure an expiry/renewal policy and a repeatable seed version. Automated demo resets must be a disclosed part of the demo lifecycle, with active sessions handled explicitly.
- Use sandbox or disabled payment, fiscal, delivery and notification adapters. Demo actions must not produce live charges, tax submissions or messages to real customers.
- Record reset events and show users the workspace's expiry/reset state. Keep exports and retention consistent with the demo policy; do not use real customer exports as fixtures.
- When a prospect becomes a customer, create a production tenant with proper access and onboarding. Transfer only explicitly selected, validated setup data such as an approved catalog. Demo stock movements, balances, users' sessions and offline queues never become production records automatically.

### 4.3 Offline isolation and future demo resets

Use a stable, distinct origin for each environment and namespace local databases, caches and outboxes by environment and tenant. Validate environment/tenant scope at the server; UI labels alone do not prevent cross-environment posting. Recovery files and offline grants must carry matching scope.

For resettable demo workspaces, introduce a server-owned generation/epoch. Include it in grants, snapshots, commands, sync checkpoints and recovery archives. On reset, rotate the generation and revoke old demo sessions/grants. Reject commands or restored archives from a prior generation; never rewrite them to the new generation. Keep stale queued work available for inspection/export and explain that the demo was reset. Refresh the local snapshot only through an explicit reset/re-enrollment flow. This prevents an offline device from repopulating a freshly reset demo.

Required checks: environment A's grants/commands/archives cannot post into B; two demo clients cannot read each other; expired demos cannot enroll/post; a device reconnecting after reset retains old work for review but cannot change the new demo ledger. Environment scoping and demo-generation contracts remain implementation work; today's version-1 commands and version-2 recovery archives do not yet provide them.

### 4.4 Development bootstrap

Bootstrap in this order:

1. Initialize workspace, TypeScript strict mode, linting, formatting, and lockfile.
2. Pin a supported runtime; document setup in README.
3. Configure a local PostgreSQL/Supabase development environment using the installed CLI's help and current documentation.
4. Create migrations for foundation tables and access policies.
5. Use one configured restaurant organization with two branches and a central location for the development walkthrough; additional synthetic organizations may remain in isolation tests. Defer membership administration and client-demo provisioning.
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

Repository: [3azam0/Sas](https://github.com/3azam0/Sas). The owner published main at 8085bdf and chore/github-workflow at 42d8edf. [PR #1](https://github.com/3azam0/Sas/pull/1) exists, and branch and PR CI gates passed. The latest setup report verified squash merging, branch cleanup, immutable release tags, staging and client-demo registrations, and production approval/release-tag policy. Only main protection remains pending: GitHub rejected the helper request with HTTP 422 because it sent both contexts and checks. The helper now sends checks only, preserves existing requirements, and has 22 regression checks passing in both PowerShell versions. Publication and remote verification of this final payload fix remain pending. Codex cannot access the Windows credential store from its restricted process. Use the [GitHub setup and release runbook](./runbooks/GitHub-Setup.md) to publish the fix and verify controls. Verify each push against the remote commit before reporting it complete.

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

Protect the default/release branches when the remote is configured: pull requests, required relevant checks, restricted direct pushes, and no force pushes or deletion. The repository's always-running `CI gate` requires typecheck, unit/integration tests, build, all offline/recovery/launcher browser scenarios and a full-history secret scan. Require the GitHub Actions check on an up-to-date base, resolve review conversations, and apply protection to administrators. Use squash merging and immutable `v*` tags. A solo owner starts with zero independent approving reviews because authors cannot approve their own PRs; increase this to one once a second maintainer is available. Use separate protected deployment environments for live credentials. Routine branch previews receive test credentials and cannot access production secrets.

Resolve a non-fast-forward push by fetching, inspecting the new commits, and merging the actual base into the shared task branch. Rebase only unshared local work, or a branch whose owners explicitly agreed to rewriting it. Re-run checks affected by conflict resolution and inspect the resolved diff before pushing. Use `--force-with-lease` only for an explicitly authorized history rewrite on a task branch; never force-push the protected default/release branch. Never discard unrelated work with a hard reset or blanket checkout.

Prefer `git revert` for a bad commit already shared with others. A source-code revert does not reverse inventory postings or undo database migrations safely; follow the deployment/database recovery plan as well.

### 4.8 Source promotion, releases and hotfixes

Promote a recorded source commit through staging, then to a stable client-demo release and/or production when their acceptance criteria pass. Demo validation supplements internal staging; a client demo is not the sole production release gate. Production and demo may remain on different approved versions without diverging codebases.

Pin the commit and lockfile for each environment build and record the environment, application version, commit SHA, build identifier, migration level and release time. Next.js public configuration is compiled into the browser bundle, so build separately for environments with different public URLs/keys. Promote the same reviewed source revision; do not copy a staging bundle containing staging configuration into production. Verify each deployed build's health, environment configuration and scoped smoke tests.

Create an immutable release tag such as `v0.1.0` only after release validation. Commit release notes at `docs/releases/vX.Y.Z.md` and match the version in `package.json`. Push release tags explicitly when the release is authorized; do not use a blanket push of every local tag. The implemented draft workflow reruns checks, validates reviewed main history/version/notes, and prepares a draft with source SHA and lockfile digest. It does not deploy the application. Future production deployment jobs must reference the approved `production` environment and run scoped smoke tests. Keep release notes and a prior compatible artifact available. Database migrations travel with their source revision and must tolerate previously deployed offline clients.

Use additive schema changes and overlapping command support before migrating data or retiring old contracts. Test a previously shipped client with queued operations against the new server. Retire old support only after the compatibility window. A source rollback requires the previous application to understand the current schema and pending commands; otherwise roll forward. See the [GitHub setup and release runbook](./runbooks/GitHub-Setup.md) for implemented automation, environment policies, local validation and remaining infrastructure work.

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
  Trace source quantities in stable order and value issues under the organization policy
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

Delivered locally: [Phase 4A plan](./Phase-4-Plan.md) and [Recipes walkthrough](./runbooks/Recipes.md). Recipe drafts/publication and transparent location-based ingredient estimates precede stock-consuming production. Definitions can be created without a location; missing cost data remains explicitly incomplete. Use tenant-qualified keys and indexed dependency foreign keys, short tenant-locked publication transactions, pinned child versions and shared pure calculations. Include offline actions, recovery format 11 and stock-neutral acceptance tests in the same working milestone.

Published versions are immutable. Store exact nested-version references; later child revisions must not change an old parent.

Use one definition resolver with two modes:

- Execution mode: stop at stocked components; expand virtual definitions.
- Analytical mode: expand to the chosen raw-material boundary with lineage.

Detect cycles across recipe/BOM references, including proposed changes. Serialize publication within a definition scope or use another mechanism that prevents concurrent publications from jointly introducing a cycle.

Production fixtures must prove that using stocked Kofta Mix consumes only the mix. Normal loss lowers usable output; it is not a second issue. A zero usable output requires a failed-batch/waste workflow, not division by zero or an invented output cost.

Unit conversion and yield calculations use decimal arithmetic and dimension validation. Share pure preview calculations with clients; authoritative allocations stay server-side.

## 16. Counts, transfers, and periods

The delivered Phase 3B captures partial observations against a consistent downloaded stock snapshot: location max acceptance sequence, cutoffAt, per-line expected quantity, actual quantity, reason and actor audit. Blank is uncounted; zero is physically absent. Every accepted location movement after the baseline rejects finalization, even if quantities return to their prior values. Business date is a reference only. Physical operations must pause and all participating devices synchronize before counting; this version does not implement a global period close.

Stock outboxes synchronize before counts. Known pending/rejected stock work blocks approval. A disconnected device can hold unknown work; late uploads after a finalized count remain subsequent stock movements and never rewrite its baseline or historical FIFO. Device acknowledgments, period locking and historical correction/reopening remain future work. A stale count requires fresh physical observation and IDs with linked superseded history; never refresh its expected quantities silently.

Transfer dispatch and receiving are separate commands. Partial receipts leave transit allocations. An offline receipt with no downloaded dispatch is an unmatched observation, not finalized destination stock.

Closed-period late arrivals require authorized correction/reopening policy; never backdate costs silently. Configure positive count valuation before live use.

## 17. Imports and consumption reports

Use server staging tables and asynchronous jobs for large XLSX/CSV files. Parse types, preserve codes as text, normalize units/dates/Arabic numerals, limit file size/rows, and retain source-row errors.

Opening-stock import invokes the posting engine, not direct balance insertion. Product changes and opening entries have separate references. The implemented development slice accepts manual or UTF-8 CSV documents of at most 200 lines and 1 MiB input. Columns map to material code, positive base quantity, non-negative unit cost and optional exact base-unit label. Header/row/quote/number errors block a completed import preview. Final posting validates all lines before atomically creating their ledger entries, layers, balances, document receipt and audit. Any existing movement/balance in an item/location prevents another baseline, including a zero balance after consumption. The server's full history provides this guard independently of the latest-100 display limits. Large/XLSX staging jobs remain planned.

Dexie version 3 adds an opening-document outbox without deleting existing records. Recovery version 4 includes document envelopes and line IDs, setup and stock operations; versions 1–3 remain readable. Validate cross-outbox identity collisions and scope, restore atomically, and reconcile server acceptance. Setup uploads precede opening documents; dependent stock commands wait for accepted baselines or enter review. Document corrections create new document/line IDs and linked immutable history. Accepted opening reversals are not implemented in the opening slice. Count adjustments are delivered separately in Phase 3B. Purchase receipts have their own source-linked full-receipt reversal workflow; see the purchasing runbook.

Purchase commands use revision-checked `purchase.save`, `purchase.submit`, `purchase.cancel`, `purchase.receive` and `purchase.reverse` envelopes. Draft/submit/cancel operations create no inventory movements. Accepted receipts use fixed order conversions and per-base-unit costs, check outstanding quantities under the tenant lock, and post their lines atomically through the incoming-stock engine. Submitted definitions remain in immutable revision records. Definition edits are blocked after receiving starts. Reversals require all original layers untouched and retain linked negative movements; cancellations never undo stock. Dexie version 4 and recovery version 5 add purchase actions while retaining older outboxes/archives. Pending reversal effects are shown after synchronization; synchronize before replacing that receipt. `purchase.return` shares the revision-checked purchase API/outbox. It deducts only the selected accepted order receipt’s original cost layers; it cannot use another receipt or reopen ordered quantities. Document, negative ledger, allocations, balance, deduplication and audit post atomically. Corrections of rejected returns retain linked superseded records with fresh IDs. Recovery format 6 validates those links. Returns from simple unlinked receipts and reversals of accepted returns remain deferred. Tax, freight, discounts and supplier settlement remain unimplemented development boundaries.

Transfer commands use `transfer.dispatch`, `transfer.receive` and `transfer.loss` at `/api/v1/transfers`. Dispatch validates bounded base-unit lines, deducts source quantity/value under the costing policy and stores exact-value transit segments. Partial receipt consumes those segments in order and creates separate incoming ledger/layer sequences at the destination; loss resolves only transit. Tables retain tenant-qualified source, action and allocation relationships. Expected revisions and envelope/line IDs protect concurrent and duplicate posting. Dexie schema 5 adds the transfer outbox; recovery format 7 adds validated correction chains while retaining formats 1–6. Queued dependent receipt waits for accepted dispatch; capture order also preserves an earlier inbound receipt before onward dispatch. Costs are confirmed only after acceptance. Request/approval routing, unknown receipt observations and accepted transfer reversals remain deferred.

Receipt-level sales deduplicate with source identifiers. Daily summaries need a declared append/replace/overlap policy. Report unsupported overlap rather than guessing.

Pin sale recipe versions and preserve refunds/voids. Accounting invoice imports are not interchangeable with POS detail imports.

Theoretical sales usage stops at the selected stocked boundary. Count residual depletion excludes known production input, transfers, supplier returns, and recorded waste. Show incomplete mappings/counts/sync as provisional. Cost basis must be explicit and consistent.

Count commands are `count.save`, `count.finalize` and `count.cancel` at `/api/v1/counts`. Drafts are stock-free. Finalization requires exact revision, matching complete line set, saved location sequence and expected quantities. Negative adjustments use the selected costing policy; positive adjustments require explicitly entered per-base-unit cost, including intentional zero. Zero variance has no ledger effect. Validate all lines and independently reconcile balance, ledger sums and layer quantity/value before and after posting. Rejection rolls back the document. Snapshot reads take the same tenant lock boundary in shared mode so checkpoint and quantities come from one consistent accepted view. Dexie schema 6 adds counts; recovery format 9 preserves current-generation outboxes and validates recount chains; formats 1–8 parse but require a matching generation to restore. Count history uses `stock_counts`, `count_revisions`, `count_finalizations` and linked stock entries/allocations. Accepted count reversals and automatic repair of damaged balances are deferred. See [Stock counts](./runbooks/Stock-Counts.md).

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


## Moving weighted-average costing — development scope

Moving weighted average is the default organization policy; FIFO remains selectable. Valuation pools are per material/location, with exact decimal quantity and value. Inbound transactions add their accepted value; issues use current pool value divided by quantity, with rounding residual consumed on full depletion. Receipt/source quantity tracing stays separate from pooled valuation. Transfers preserve dispatched value; destination receipts blend it into the destination pool. Source-linked returns retain original supplier reference value and separately record inventory deduction and valuation difference. Reconciliation compares ledger, balances and current layer values.

Development starts empty. The authorized one-time baseline reset clears setup/catalog and transactions, retains tenant identities, defaults to moving average and rotates generation. Subsequent method selection clears transactions to zero while retaining user-entered setup. Neither operation reseeds samples. The development_empty_baseline marker prevents erasing entered data on later restarts. Production history conversion remains deferred. Browsers clear the matching organization's old snapshot/outboxes atomically and stale archives/API generations are rejected. The local origin stays unchanged. Method changes with posted stock require explicit development reset acknowledgment; production history conversion remains deferred. Offline quantities remain durable; costs finalize only at acceptance. Costing policy is delivered before recipes/production. See [Costing methods walkthrough](./runbooks/Costing-Methods.md). `feat/start-from-scratch` is stacked on moving-average commit `eb94f37`; commit locally after checks and follow the existing authorized publication/PR workflow.


## Start from scratch — authorized development reset

The user now wants all old development data removed, including catalog/setup. Supersede the previous sample reseed and setup-preservation behavior for this one-time baseline reset: clear all development transaction tables, items/purchase packs, suppliers, units and stock locations; retain tenant identity and default moving-average policy. Rotate the reset generation so existing browser queues and recovery archives cannot restore the deleted data. New normal development workspaces start empty and never automatically seed sample catalog/stock. Fixture seeding is explicit and isolated to automated tests. After the one-time reset, entered data survives restarts. Method selection clears transactions to zero without reseeding, retaining the user-entered setup. Provide an empty-workspace path to create a stock location, unit, item and supplier, then enter opening stock.

Implementation verified: empty accounts show an onboarding path and disable stock posting until an active location and material exist. Empty locations render safely on desktop and mobile. Normal database initialization creates identities only; SAAS_SEED_FIXTURES=1 is reserved for isolated automated checks. A persistence test closes/reopens the database and confirms entered setup and stock survive. The authorized .data-local reset was applied after the user stopped the server, with a verified cold backup first; catalog, stock, transaction and audit counts were verified as zero. Keep the saved local origin and synchronize to receive the new generation before entering data.

## Supplier navigation

Expose **الموردون** as a direct main-menu destination, using the same tenant-scoped supplier records, editor and offline setup outbox as Inventory Setup. The direct page opens suppliers immediately and includes add/edit, contact details, active status, search and rejected-change review. Inventory Setup keeps its existing supplier tab. This navigation change does not add supplier accounting or duplicate data. Verify direct access, offline supplier creation, shared visibility and mobile layout using the existing setup/empty-workspace browser scenarios.

## Direct multi-item receiving

Replace new single-item direct receiving with one receipt document containing 1–200 distinct items, one active stock location, business date, reference and optional supplier. Each line records its base unit, positive base quantity, non-negative cost per base unit and optional immutable purchase-pack conversion. Show line values and the document total before saving. Retain legacy single-item commands for existing queues/corrections. Waste remains a separate operation.

Post all lines, ledger, cost layers, balances, document, audit and deduplication records in one tenant-locked transaction. Validate every item/unit/pack and supplier before posting; reject the entire document on any error. Use the existing organization costing policy. Add an additive receipt table and tenant-qualified ledger link, a dedicated Dexie outbox and generation-bound recovery format 10 (older formats remain readable). Synchronize setup/opening dependencies first and interleave receipts with legacy stock movements by capture time before transfer dispatch. Rejected documents support retry, cancellation and linked correction with fresh IDs; accepted documents cannot be edited or cancelled. No reset, catalog import, default supplier, taxes or supplier-payment accounting is part of this change.

Verify atomic rollback, same-ID retry/conflict, scope and generation, pack conversion, offline reload/recovery, failed dependency review, shared setup and mobile receiving. Document the UI workflow after validation.

The direct receiving workflow is described in [Direct receiving](./runbooks/Direct-Receiving.md). The sync center shows documents from all locations; activity history filters by the selected location. `feat/multi-item-receiving` is stacked on supplier-navigation commit `25efb87`.

Validation for direct receiving: 150 unit/integration tests passed; production build/TypeScript passed; 28 fixture browser/process checks and 2 isolated empty-workspace browser checks passed. The new browser scenario verifies two-item totals, remove/re-add, Arabic input, optional supplier, offline reload, all-location sync visibility, mobile overflow and repeated sync without duplicate stock. The existing setup browser scenario verifies pack conversion and saved suppliers. Test servers use isolated databases and stop after checks. The client local database was not reset or populated.


## Recipe cost control — Phase 4A delivery

The main menu now exposes **الوصفات والتكاليف**. Recipe drafts contain a batch output quantity/unit, effective date, optional net selling price per output unit and up to 200 distinct material or exact-version sub-recipe inputs. Non-stocked recipes represent meals; stocked preparations link an existing material/unit. Use validated g/kg and ml/l conversions, preserving entered and normalized quantities. A recipe definition needs catalog items/units but does not require a branch or supplier.

Draft saves and publication are revision checked, tenant scoped, generation bound and idempotent. Publication records an immutable version, dependencies, revision and audit together under the organization lock. Code uniqueness, cycles, dates, active material references, unit mismatches and excessive expansion are rejected. Parent definitions pin exact child versions; editing a child does not silently update a parent. Saving/publishing a recipe has no inventory effects.

The shared pure resolver stops at stocked sub-recipes for operational estimates; optional raw-material expansion is analytical. Cost estimates use the selected location's accepted remaining-stock average or latest accepted receiving price, without fallback between sources. Distinguish unavailable cost from valid zero and distinguish shortage from cost completeness. Show batch cost, cost per output unit, food-cost percentage and gross contribution when their inputs are complete. Net selling price is per output unit; gross contribution excludes expenses. Stored definitions do not freeze historical ingredient prices or represent finalized production cost.

Dexie schema 8 adds a recipe outbox. Setup uploads before recipes; exact child publications upload before dependent parents. Local publication is provisional until accepted. Queued actions participate in pending counts, tenant-switch guards, cross-outbox identity checks and recovery format 11. Rejected actions can be retried unchanged or cancelled; reopen the latest draft and save a new action to correct data. Cancelled history remains recoverable without projection or retry. Development costing-method reset preserves recipe definitions/versions and rotates generation; catalog-clearing reset removes dependencies/versions/recipes before catalog records. No client data was reset or sample data added by this implementation.

`feat/recipe-cost-control` is stacked on the multi-item receiving checkpoint `f3eab23`. Keep the relationship explicit when publishing; local completion does not imply a GitHub push or production deployment. Phase 4B production/yield is next, with stock consumption, output allocation and failed-batch handling to be implemented as one verified workflow.

Validation for Phase 4A: 169 unit/integration tests in 27 files passed; TypeScript and production build/offline manifest passed; 29 fixture browser/process scenarios and 2 isolated empty-workspace scenarios passed. Coverage includes cost completeness/zero/shortage, conversion/yield, pinned versions, stocked boundaries, tenant/generation/revision/identity protection, unchanged stock, full-history price lookup, reset retention, offline child ordering/reload/recovery and cancelled-history restoration. The recipe browser workflow confirms that a parent keeps its old child version after child revision, and the empty mobile workflow opens the new page safely. All browser servers used isolated data and stopped after checks.


## Production and yield — Phase 4B delivered locally

Follow [Phase 4B](./Phase-4-Plan.md): immutable pinned-version production documents for stocked preparations, actual base input quantities, planned/actual usable output, explicit abnormal loss and failed batches. Post input issues and exact-cost output together under the organization lock; reconcile before/after and preserve exact FIFO output value with adjacent cost layers when division does not fit six decimals. Offline documents use Dexie schema 9/recovery 12, capture-order stock sequencing, review/correction and count guards. Recipe definitions survive transaction resets. No client reset, membership, demo provisioning or production deployment is part of this slice. `feat/production-yield` starts from recipe checkpoint `9baa335`.


The delivered **الإنتاج والتحضير** workspace captures immutable final batches for a pinned stocked-preparation version, separate input/output locations, planned and actual usable output, all resolved actual base inputs and abnormal waste within those inputs. Failed batches require a reason, issue the actual materials and create no output stock. Normal yield loss is included in usable-output cost. Rejected batches support retry, cancellation and linked correction; accepted reversal and durable server drafts remain deferred. FIFO and average postings conserve exact allocated value and pass independent reconciliation. Pending production participates in projected quantities, all-location synchronization and count approval guards. The mobile navigation now accommodates the added module.

Validation: 186 unit/integration tests across 30 files, TypeScript and production build/offline manifest passed. 33 browser/process scenarios passed (31 fixture regressions plus 2 isolated empty-workspace checks). Checks cover exact fractional FIFO output, moving-average pools, stocked-child boundaries, zero-cost and failed batches, abnormal waste, all-line rollback, stale counts, scope/generation/identity protection, offline dependencies, reload, retry, correction and recovery. Tests use isolated databases; no client data was reset or seeded. Follow [Production walkthrough](./runbooks/Production.md). Phase 4C sales imports and consumption reconciliation is next. Commit on `feat/production-yield` after final checks; this checkpoint does not authorize deployment.


## Phase 4C1 — menu mapping and sales capture delivered locally

Follow [Phase 4C1](./Phase-4-Plan.md) on `feat/sales-import-mapping`, based on production commit `3addd0e`. Build source-specific menu codes linked to pinned recipe versions/output-per-sale, immutable completed-sales imports with explicit CSV preview/confirmation, external-detail duplicate protection, atomic stock-neutral acceptance, offline dependency ordering, review/correction and recovery. Dexie schema 10/recovery 13 add both outboxes without clearing device data. Menu references survive transaction-only resets and are removed before recipes on catalog reset. Actual consumption posting, refunds/voids and cost/variance reports follow after this verified capture slice. Preserve tenant architecture and existing launcher/client data; do not provision memberships, billing, demos or cloud deployment.


The **المبيعات** workspace includes menu-code mapping, explicit CSV column selection/file or text preview, completed-sales confirmation and per-location history/net totals. Stable external identity is source + location + business day + transaction/detail IDs within the tenant. Previously accepted CSV details retain their historical mapping after menu edits or deactivation; new details use the current mapping. Identical repeats add zero, partial overlap adds only new rows and changed repeats reject the whole import. Accepted sales are immutable and stock-neutral. No food-cost, stock-consumption or refund/void posting is claimed by this slice. Rejected imports use current mapping in a linked fresh-ID correction.

Verification passed: 202 unit/integration tests across 33 files, 35 browser/process scenarios (33 fixture regressions plus 2 isolated empty-workspace checks), TypeScript, production build and offline manifest. Tests cover scope/generation/revision/effective-date and ID checks, zero-price sales, exact net totals, duplicate/overlap/conflict rollback, unchanged stock and count checkpoints, mapping retention/reset order, Arabic CSV validation, historical re-imports, offline publication/mapping/import ordering, reload/lost response/recovery/correction and mobile/empty accounts. See [Sales import walkthrough](./runbooks/Sales-Import.md). Client data and launcher are preserved; commit locally on `feat/sales-import-mapping` after verification.


## UI/forms completion — version 2.22

`FormControls.tsx` supplies controlled field feedback, decimal/date/required checks, a native select with Arabic/SKU filtering, and a document form that separates its scroll body from its actions. The feedback registry reveals/focuses the first invalid input, including rows hidden by count/transfer filters. Field checks do not replace existing schemas or authoritative acceptance. Enter submits the main action; add/remove/close buttons are explicit non-submit actions. Busy forms disable both body controls and footer actions. Setup/receiving/waste retain their existing schema or React Hook Form validation.

Opening, purchasing, supplier returns, transfers, counts, recipes, production and sales editors share this presentation. Required costs remain explicit; optional return/partial-receipt rows may be blank or zero and are omitted according to existing rules. Count drafts may omit a surplus cost, while approval still requires it. Zero is a valid physical count and failed-batch output. Receipt costs remain per inventory base unit even for pack/catalog-unit input.

`OperationStatus.tsx` distinguishes pending, acknowledged-but-unconfirmed, accepted, review, cancellation and correction states. Source/replacement links expand and focus locally available histories with their location; unavailable references yield a notice. Business document states remain separate. Sales import now exposes source/file/mapping/preview steps and the reason confirmation is disabled. Sales inventory consumption remains Phase 4C2 work.

Acceptance coverage includes a 328-item offline catalog, Arabic name/SKU matching, selection retention after an unmatched query, count filters preserving zero, a hidden invalid count, Enter-only purchase draft save without stock posting, source-document navigation, invalid recovery, renewed sessions and existing atomicity/correction/reload scenarios. Primary mobile controls meet 44px sizing; checks cover 390×844, 390×640 and 820×1180 alongside desktop. Browser viewport automation does not certify every physical device or OS keyboard. See the [completion record](./UI-UX-Remaining-Work.md) for evidence and local-launch limitations.


## Hosted client release — version 2.23

Follow [Hosted release](./Hosted-Release.md). Cloudflare serves the same React workspace as a bundled SPA and same-origin cookie-authenticated API. Supabase Edge verifies each JWT through Auth, resolves `fodo.user_access`, then switches each posting/snapshot transaction to the non-owner `fodo_api` role with a trusted tenant setting. All business tables enforce RLS as well as explicit tenant filters. This deployment uses Supabase-provided server environment secrets; the Worker holds only the public project URL/key. Browser code never receives access or refresh tokens.

Shared database interfaces in `packages/server/database.ts` and filesystem-free services preserve the PGlite development engine and add a managed Postgres adapter. Keep local schema initialization and backups separate from cloud migrations. Apply numbered SQL files under `supabase/migrations` once, in order, and add migrations rather than editing applied files. One-time initial provisioning used Auth Admin and is removed from the deployed function. The approved catalog has 328 items with zero stock.

`pnpm build:cloud` bundles the hosted frontend, Worker and Edge backend. `pnpm types:cloud` generates Worker binding types. `pnpm test:cloud` runs read-only sign-in, operational-page, mobile, offline reload and logout checks in an isolated Chrome session; supply a private credential JSON through `FODO_OWNER_CREDENTIALS`. Cloud build/credential/session/screenshot files stay ignored. The hosted PWA caches only the application shell/assets; API responses are never service-worker cached. Dexie stores tenant snapshots and outboxes.

Develop on a feature branch, commit only source/config/migrations/documentation, run the required checks, push the feature branch and open a PR against main. Existing local inventory milestones are included in the release branch history. Do not force-push or merge main as part of publishing this client trial. Cloud changes remain explicit operations; pushing a branch does not automatically deploy it. Record the actual deployment in `docs/releases/hosted-client-2026-10-11.md`.

Verification: all 224 unit/integration tests in 36 files, TypeScript, production/offline build and hosted browser checks passed. The release record contains the API isolation checks and deployed identifiers. Windows Credential Manager is unavailable inside the Codex command process; use `Publish-Fodo-Release.cmd` from the normal Windows session to publish the committed feature branch and create/reuse its draft PR. The launcher records publication and never merges or deploys.

The current sales report estimates current prices, not historical booked COGS. Refund/void workflows, billing, membership UI, tax/fiscal adapters and client account self-service remain later work. Supabase’s [leaked-password-protection setting](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection) remains disabled; the initial password is generated randomly and kept in a private local file. Before broader production onboarding, review that account setting and add password-change/recovery using a real email address.
