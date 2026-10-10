# Fodo implementation review

## Current checkpoint — all receiving units, 11 October 2026

**وحدة الاستلام** now includes all registered organization units and the item's fixed purchase packs. The base unit remains fixed. kg/g and litre/ml conversions are automatic; another unit requires explicit package contents/conversion for that receipt. Base quantity and line/document value preview before capture, with cost still per base inventory unit. Captured unit/base names and factor survive offline reload, accepted history, linked rejected-document correction and recovery. The server enforces scoped unit references, current names at posting, standard ratios, exact six-place arithmetic and whole-document atomicity. Historical recovery preserves captured names after later label edits; a stale pending document enters review at server posting. Existing pack and legacy stock queues retain their behavior.

Local branch `feat/receiving-units` starts from composition checkpoint `5d6da5a`. Developer guide is version 2.20. The receipt JSON contract is additive; no database or Dexie schema migration is needed. Recovery export is version 14; versions 1–13 remain readable, while files containing catalog-unit receipt metadata require version 14. Verification passed: 216 unit/integration tests in 34 files, TypeScript, production build/offline manifest and three targeted browser scenarios. Coverage includes automatic/manual factors, foreign units, invalid arithmetic/precision, duplicate delivery, atomic rollback, offline recovery, linked correction, prior packs, receiving/waste and desktop/mobile fit. Screenshots are in the workspace outputs. The client catalog was verified unchanged: 328 items, 20 categories, six units, one main warehouse and zero movements/balances. The launcher and cloud project were preserved. Restart the existing local server at its saved address to load the build. See [Direct receiving walkthrough](./runbooks/Direct-Receiving.md).

Code checkpoint: `4360db3` (`feat(receiving): support all catalog units with explicit conversions`). This change is local; it has not been pushed or deployed. Phase 4C2 sales consumption/refund and void rules remains next, followed by consumption variance reports.

## Earlier checkpoint — inventory item composition, 11 October 2026

Inventory setup now exposes **مكونات الصنف** and optional **فتح إعداد المكونات بعد الحفظ**. These open an existing stocked recipe for the item, or prefill a new definition with its name, proposed unique BOM code, output item and locked base unit. Users enter batch inputs/output and explicitly save/publish. Linked definitions are identified in the catalog as **صنف مركّب**. The route is organization/generation-scoped and handles an item saved offline before its recipe. Existing recipe versioning, nested components, costing and production provide the underlying behavior; definition changes remain stock-neutral. No new item schema, duplicate BOM engine or offline storage migration is introduced.

Local branch `feat/stocked-item-composition` starts from `6360994`. Developer guide is version 2.19. Verification passed: 202 unit/integration tests in 33 files, TypeScript, production build/offline manifest and three targeted browser scenarios. The new test checks offline create/reload/acceptance, output unit, self-input exclusion, output cost, existing-definition reopening without duplication and unchanged stock. Desktop/mobile screenshots are saved in the output directory. Client inventory data, the launcher and cloud project were preserved; the isolated browser database contains test fixtures only. Restart the current local server at its saved address to load the new build. See [Recipe composition walkthrough](./runbooks/Recipes.md).

The next functional phase remains 4C2 sales consumption/refund and void rules, followed by consumption variance reports. This usability change does not enable sales stock posting, membership, billing or production hosting.

## Earlier checkpoint — menu mapping and sales import, 10 October 2026

Phase 4C1 is delivered on local branch `feat/sales-import-mapping`, starting from production checkpoint `3addd0e`. **المبيعات** separates source-specific menu codes from inventory materials, pins exact recipe versions/output-per-sale, and accepts completed-sales CSV imports with explicit column mapping/confirmation. Invalid or unmapped rows and refund/void statuses block capture. Sale details use tenant/source/location/business-date/transaction/line identity: identical repeats add zero, overlaps add only new details, and changed repeats roll back the whole import. CSV re-imports retain accepted mappings after later menu edits/deactivation. Names, versions, ratios and revisions are preserved in accepted history.

Acceptance writes immutable imports, new details, reserved IDs and audit atomically under the tenant lock. It leaves stock, cost layers and count checkpoints unchanged. Dexie schema 10/recovery 13 include mapping actions/imports in identity checks, pending/review counts, tenant switching, reset generation and atomic restore. Setup/recipe publication precede mappings and imports. Network/auth failures preserve work; rejected imports support retry/cancellation and fresh-ID linked correction using current mapping. Transaction-only resets retain menu/recipe definitions; catalog-clearing resets remove references in foreign-key order. No client reset, seed, cloud schema change, launcher change, push, merge or deployment occurred.

Verification passed: 202 unit/integration tests across 33 files, 35 browser/process scenarios (33 fixture regressions plus 2 isolated empty-workspace checks), TypeScript, production build and offline manifest. The first browser scenario covers offline menu/import reload, Arabic values, repeated files and unchanged stock. The mobile scenario covers invalid/refunded rows and stale mapping correction. Desktop/mobile screenshots are saved in the output directory. Developer guide is version 2.18; see [Sales import](./runbooks/Sales-Import.md).

Next: Phase 4C2 inventory consumption from pinned sales with explicit refund/void handling; Phase 4C3 actual-versus-theoretical consumption, food cost and variance reports. Memberships, billing, separate demo infrastructure and production Auth/deployment remain deferred. Restart Fodo at its saved address after the build to load the new module.

## Earlier production and yield checkpoint — 10 October 2026

Phase 4B is delivered on local branch `feat/production-yield`, starting from recipe checkpoint `9baa335`. **الإنتاج والتحضير** captures pinned stocked-preparation versions, input/output locations, planned versus actual usable output, actual base-material consumption, abnormal waste and explicit zero-output failed batches. Server acceptance posts document, ingredient issues, exact-cost output layers, allocated values, deduplication and audit together. FIFO fractional output uses adjacent six-decimal prices to conserve twelve-decimal value; moving average blends the output into its destination pool. Stocked children are consumed without also issuing their raw ingredients. Independent stock reconciliation runs before/after posting; shortages roll back the full batch.

Dexie schema 9/recovery format 12 include production in generation checks, global identities, tenant switching, all-location review, projections and atomic archive restore. Setup and pinned recipe publication precede production. Stock operations settle in capture order; pending/rejected production blocks affected count approval, while accepted production invalidates an older count baseline. Failed batches consume actual materials and create no output. Rejected batches support unchanged retry/cancellation and linked fresh-ID correction. Accepted production reversal, server draft lifecycle, substitutions, coproducts and overhead allocation remain deferred.

Validation: 186 unit/integration tests across 30 files, TypeScript and production build/offline manifest passed. 33 browser/process scenarios passed (31 fixture regressions plus 2 isolated empty-workspace checks). Production desktop/mobile screenshots are saved in the output directory; responsive navigation accommodates the added module. The recipe browser regression selects its own created recipe explicitly and waits for offline publication to finish before reload.

Developer guide is version 2.17. Next: Phase 4C external POS sales imports, refunds/voids and actual-versus-theoretical consumption. Memberships, billing, dedicated demo infrastructure and production access remain deferred. No client data was reset, seeded or migrated to the cloud. Local completion does not imply a push, merge or deployment. Restart the existing Fodo server at its saved origin after the local build to see the new module.

## Earlier recipe cost-control checkpoint — 10 October 2026

Phase 4A is delivered on local branch `feat/recipe-cost-control`, stacked on multi-item receiving commit `f3eab23`. Main-menu **الوصفات والتكاليف** supports stock-neutral drafts, immutable publication, exact child-version pinning, compatible unit conversions, positive batch output, optional net selling price and stocked/non-stocked preparations. Cost estimates expose batch/output-unit cost, food-cost percentage and gross contribution using accepted location stock average or latest receiving price. Missing prices and shortages are separate; valid zero costs remain valid.

Shared resolution rejects cycles and excessive nesting. Tenant/revision/generation checks, code uniqueness, audit records and global operation/version identity reservation accompany atomic publication. Dexie schema 8 and recovery format 11 preserve existing queues; child publications precede parents. Rejected actions support unchanged retry/cancellation and correction through a fresh draft action. Cancelled recipe history can be restored without being projected or uploaded. Transaction-only development reset preserves definitions/versions; catalog-clearing reset removes their dependencies first.

Validation: 169 unit/integration tests across 27 files, 29 fixture browser/process scenarios and 2 isolated empty-workspace browser scenarios, TypeScript and production build/offline manifest passed. Desktop/mobile recipe images are saved in the output directory. A browser scenario proves parent pinning after a child update and unchanged inventory. The receipt-recovery test now selects its original correction record by ID rather than relying on random UUID ordering.

Developer guide is version 2.16. Next: Phase 4B production/yield with actual inputs, usable output, single stock consumption and allocated output value; then external POS sales and actual/theoretical consumption. Cost previews do not freeze historical prices or post production inventory. Memberships, billing, dedicated demo infrastructure and production access remain deferred under the first-client development scope. No client database reset or fixture insertion occurred. Local completion does not imply a push, merge or deployment.

## Earlier stock-count checkpoint — 10 October 2026

Phase 3B stock counts and reconciliation are delivered locally on `feat/stock-counts`, stacked on transfer commit `f427942`. Use **الجرد والتسوية** for partial physical quantities, stock-free drafts, explicit difference review and atomic FIFO shortage/explicit-cost surplus. Finalization rejects any later accepted location movement or changed expected quantities. Draft edits cannot refresh the saved baseline. A stale rejected approval supports a fresh blank physical recount with linked IDs/history.

Independent balance, full ledger and remaining-layer quantity/value checks block posting on disagreement. Transit is excluded. Dexie schema 6 preserves older queues; recovery format 8 reads 1–7 and validates recount chains. Stock work uploads before counts. Unknown late uploads remain subsequent movements: device acknowledgments, global period closing, historical corrections and accepted count reversals remain deferred.

Validation: 120 unit/integration tests, 24 Chrome browser/process scenarios, TypeScript and production build/offline manifest. Tests use isolated data/ports. Arabic desktop/mobile screenshots are available in test results and copied to the output directory. No client data reset, launcher change, push, merge or deployment is part of this checkpoint. The commit is recorded in local Git history and the standalone output review after creation.

Developer guide is version 2.11. Next: versioned recipes/BOMs and sub-recipes, then production/yield and external sales cost control. Keep the current tenant structure and first-client development walkthrough; memberships, billing and dedicated demo infrastructure remain deferred. Minimum real authentication and isolated production configuration are still required before live use.

## Earlier reliability review — 9 October 2026

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
