# Phase 3 — Transfers, counts and reconciliation

Revision: 10 October 2026. Builds on locally delivered setup and Phase 2 opening, purchasing and supplier returns. Use the existing development organization, tenant isolation, Arabic RTL, EGP, Africa/Cairo, decimal arithmetic and stable local origin. The user-authorized costing development reset supersedes the earlier sample-preservation assumption; preserve setup/catalog; no memberships, billing or separate demo infrastructure in this phase.

## 3A — Stock transfers

Delivered locally: Arabic dispatch, original-cost partial receiving, explicit transit loss, durable offline actions, linked rejected corrections and recovery format 7. At transfer completion, verification covered 100 unit/integration tests and twenty-one Chrome browser/process scenarios, type checking and production build pass. See [Transfers walkthrough](./runbooks/Transfers.md). Phase 3B counts are also delivered locally; recipes/BOMs are next.

Implement a complete dispatch → in transit → partial receiving → resolution slice before counts. Transfer requests/approval routing, unmatched receipt observations, accepted-document reversals and returns to sender remain later extensions; this slice requires a known dispatch and the existing organization-owner development session.

- Dispatch contains separate document/transfer/line IDs, source, destination, date, reason and positive base-unit quantities. Source and destination must be distinct active locations of the same organization; items/units must match accepted or synchronized setup.
- A bounded dispatch validates all lines and traces available source quantities and uses the selected costing method atomically. Deduct source quantity/value once. Preserve each allocated source layer's quantity and cost as transit segments. Destination stock remains unchanged until receiving.
- Receiving references the known dispatch and its lines, with expected revision. Accept some or all outstanding quantities; preserve original cost segments and their FIFO order in destination stock. Deactivated records may still receive an already dispatched physical shipment. Never invent a dispatch or blend source costs into a new approximate layer.
- Remaining quantity/value stays in transit. Consolidated quantity/value equals stock at locations plus transit, with transit counted once. A short receipt leaves the remainder unresolved.
- Transit loss is an explicit document with a date, reason and original segment cost. It consumes only the remaining transit quantity/value and records allocations/audit. It does not deduct source stock a second time or add destination stock. This is inventory evidence, not a financial settlement or carrier claim.
- Serialize tenant/transfer posting. Each action increments its transfer revision. Duplicate delivery returns the recorded result; changed payloads or reused movement IDs are conflicts. Over-receiving/loss and invalid source lines reject the entire document.
- Durable offline dispatch/receiving/loss reuse a dedicated Dexie outbox. Local previews are provisional. Synchronize setup/opening/purchasing before transfers, dispatch before its receiving/loss, then dependent simple stock commands. Failed dependencies enter review rather than creating confirmed destination stock.
- Unchanged retry retains IDs. Correcting a rejected action creates fresh IDs with inspectable superseded history; correcting rejected dispatch creates a fresh transfer. Cancel only known rejected local actions. Accepted posting is immutable in this slice.
- Recovery format 7 includes transfer commands, movement IDs and correction links. Formats 1–6 remain readable. Validate tenant scope, source relationships, IDs and links before atomic restoration; reconcile exported acceptance against server evidence.

Acceptance: receive 2 kg at EGP 20 and 8 kg at EGP 30 at source. Dispatch 5 kg for EGP 130; source retains 5 kg/EGP 150 and transit holds 5 kg/EGP 130. Receive 3 kg for EGP 70 as 2 kg at 20 plus 1 kg at 30; transit retains 2 kg/EGP 60. Source + destination + transit still equals EGP 280. Receive the final 2 kg or explicitly record their EGP 60 loss. Verify original destination FIFO, fractions, duplicate/concurrent posting, multi-line rollback, cross-tenant references, offline reload, rejected dependencies, correction history, archive restore and Arabic mobile layout.

## 3B — Stock counts (delivered locally)

Capture physical counts at an explicit location/cutoff; display expected quantity, counted quantity and variance. A draft count has no stock effects. Use a defined treatment for concurrent/late/offline movements before finalization; do not silently overwrite balances from a stale snapshot.

Post justified adjustments through the shared ledger/layer engine. Negative differences use the selected costing method; positive differences need an explicit approved cost policy. Preserve count lines, evidence, actor, revisions, expected/actual snapshots and linked adjustment movements. Reconcile ledger, balances and layer values after posting. Counts do not erase original purchases, waste, transfers or in-transit stock.

Delivered: count.save/finalize/cancel API, partial physical entry, explicit acknowledgment, tenant/revision/ID validation, atomic FIFO shortage and explicit-cost surplus, durable Dexie schema 6 outbox, stock-before-count sync, linked rejected recount, recovery format 8 (reads 1–7), Arabic responsive UI and independent ledger/balance/layer checks. Current suite: 120 unit/integration tests and twenty-four browser/process scenarios; type checking/build pass. See [Stock counts walkthrough](./runbooks/Stock-Counts.md).

Policy: capture the exact accepted location max stock sequence and expected quantities. Any later accepted movement at that location requires a fresh physical recount; quantity restoration does not make an old baseline valid. Count drafts have no stock effects; pending approval has no inventory projection. Blank means uncounted, 0 means physically absent. Surplus unit cost is explicit, including 0; transit is excluded. Ledger inconsistencies reject rather than auto-repair. Operational pause and device synchronization are required. Unknown late uploads remain subsequent movements; automatic closed periods/device acknowledgments/historical correction remain pending. Accepted counts are immutable.

Acceptance: 2 kg at 20 plus 8 kg at 30, physical 7 => adjustment -3 kg/-70, remainder 7 kg/210. Physical 12 with surplus cost 25 => +2 kg/+50, remainder 12 kg/330. Verify zero quantities/variance/cost, stale sequence, all-line rollback, competing counts, cross-tenant/unit/ID validation, corrupted ledger rejection, offline reload/reconnect, linked recount, archive conflicts and schema preservation.

Next Phase 4A: immutable recipes/BOM versions, base-unit ingredient conversions, sub-recipe cycle protection, stocked versus non-stocked boundaries and transparent current-cost preview. Follow with production/yield, sales imports and actual-versus-theoretical cost control. No billing/membership/demo provisioning is added to the first-client development scope.

## Git and completion

`feat/stock-transfers` is stacked on supplier-return commit `b50d7e1`; `feat/stock-counts` is stacked on transfer commit `f427942`. Keep feature commits reviewable and record verified checks; publication follows the developer guide's authorized remote/PR workflow. No merge or production deployment is implied. Test on isolated ports/data and retain the client's `.data-local` and IndexedDB. Real authentication and isolated production configuration remain required before live operations.


Moving-average costing is now delivered before Phase 4A, with FIFO selectable. The authorized development-only sample reset keeps setup, rotates generation and invalidates old queues/archives. See [Costing methods](./runbooks/Costing-Methods.md).
