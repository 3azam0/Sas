# Phase 2 — Opening stock, purchasing and supplier returns

Revision: 10 October 2026. Phase 2A opening stock is delivered locally; 2B purchasing and 2C returns remain planned. This follows inventory setup and precedes transfers/counts and restaurant cost control.

## Scope and delivery order

Use the existing Arabic web application, tenant scoping, development session, FIFO engine, Dexie outboxes and recovery workflow. Work for one restaurant organization with multiple branches; retain a second isolated organization only as a regression fixture. Do not add memberships, billing, onboarding or separate demo infrastructure to this phase. Do not reset existing development data to make a new workflow pass.

Deliver 2A before 2B, and 2B before 2C. Each slice needs its working screen, durable offline capture, server validation, movement history, recovery compatibility and relevant tests. Complete its acceptance scenarios before starting the next slice. Development settings use EGP, Arabic RTL and Africa/Cairo as current defaults; document values retain their captured currency, unit conversion and business date.

## 2A — Opening stock

Delivered: manual multi-line capture and bounded UTF-8 CSV mapping/preview, atomic baseline posting, FIFO layers, offline reload/dependency ordering, immutable review and version-4 recovery. Verification: 53 unit/integration tests and twelve browser/process scenarios pass; type checking and the production build pass. See the [opening stock walkthrough](./runbooks/Opening-Stock.md). Large asynchronous/XLSX imports and posted-opening reversals are not delivered.

The user selects a stock location, opening business date and reference, then enters material quantities and unit costs. Start with manual entry; add a bounded CSV template/import with column mapping, validation and preview after the manual posting path works. XLSX parsing and large asynchronous imports can follow separately.

- An opening entry establishes a baseline for an item/location with no previous stock movement. It is not a stock adjustment or a way to add another purchase. A previously consumed balance of zero is not pristine.
- Existing sample items/locations with seeded opening entries cannot receive another baseline. Use a newly created material/location for the walkthrough; retain existing history.
- Enter positive quantities in the base inventory unit and non-negative cost per base unit. Omit zero-stock rows. Show quantity, unit cost and total value before saving. Record the opening date explicitly; reject future dates.
- A CSV upload never creates catalog records implicitly. Resolve material codes and locations within the current organization; show unknown codes, repeated item/location rows, invalid units/numbers and source row errors before posting. Normalize Arabic numerals and preserve codes as text.
- Saving offline creates a durable pending document. Label projected stock separately from confirmed stock. It cannot claim that the server has accepted the baseline.
- Final posting validates the full document and establishes its FIFO layers, ledger entries, balances, acceptance receipt and audit event in one transaction. Reject the entire bounded document if any line fails; retain it for review. Set a documented row/size limit before adding the import UI.
- Serialize posting within the organization. Concurrent devices cannot establish two baselines for the same item/location. A repeated document operation ID returns the recorded result; changed payload under that ID is a conflict.
- Depend on accepted material/location definitions. Setup synchronizes first. Do not let an opening document that failed dependency validation become confirmed stock.
- A pending baseline blocks locally queued issues that require it until the server accepts it. Sync opening documents before their dependent receipts/issues; preserve unresolved dependency chains for review.
- Keep cutover business date distinct from server acceptance sequence. Do not silently replay earlier dates to reorder accepted FIFO history. Later physical differences belong to the count/adjustment phase.

Acceptance: create a new material and branch; save 10 kg at EGP 20/kg offline; reload; reconnect; verify one opening movement, 10 kg confirmed and EGP 200 value. Retry the same ID and confirm unchanged stock. Reject a second baseline even after all stock was consumed. Reject a document containing one invalid line without posting its valid lines. Verify concurrent duplicate baselines, another organization's references, import preview and archive restore.

## 2B — Purchase documents and receiving

Keep ordering and stock receiving separate. A draft purchase order contains supplier, destination, reference, business date and lines. Saving or changing a draft order does not alter stock or create FIFO layers.

- States: draft, submitted, partially received, fully received and cancelled remainder. Cancellation affects unreceived quantities; it does not erase a posted receipt.
- Each line has a stable ID, material, entered unit/quantity, fixed base-unit conversion and agreed unit cost. Display both purchase quantity and base quantity. Start with the current explicit cost-per-base-unit convention.
- Submitted revisions remain inspectable. Material changes to a submitted document require a new revision and cannot rewrite accepted receipt lines. Capture expected revision for edits from different devices.
- Receive all or part of outstanding quantities against a submitted purchase document. A receiving document identifies the order revision, supplier, destination, date, reference and its lines. An unlinked receipt remains available as the existing simple workflow, but do not double-post it as an order receipt.
- Server posting enforces remaining order quantities, active scoped references and pack conversions. Over-receiving is rejected in this phase. Concurrent partial receipts cannot jointly exceed the ordered quantity.
- One receipt operation ID posts all its bounded lines atomically. Create a distinct immutable movement ID for every posted line, linked to its receipt and order line. Reuse the costing engine; retain supplier, conversion, price and source references in history.
- A posted receipt cannot be edited in place. Corrections use explicit linked reversals/replacement documents, subject to available originating stock. Never cancel a local record to undo confirmed inventory.
- Purchase order drafts and pending receipts survive offline restart and export/restore. Submission and receipt dependencies must synchronize in order; stale revisions or unavailable order lines require review.
- Begin with net inventory cost and the current EGP development convention. Do not label documents as compliant tax invoices. Before live use, choose the client's tax recoverability, discounts and freight/landed-cost rules, implement their allocation and preserve those financial snapshots. Do not silently treat tax or freight as zero.
- Supplier balances, supplier payment settlement and full accounting are deferred. A purchase receipt proves stock/cost acceptance, not that payment was made.

Acceptance: order 20 kg; receive 8 kg and then 12 kg; verify outstanding quantities, two source-linked receipts, layers and total stock/value. Reject another kilogram. Verify offline partial receiving, stale edits, competing devices, same-ID retry, immutable accepted prices, purchase-pack conversion, tenant isolation and recovery. A draft order must leave stock unchanged.

## 2C — Supplier returns

Return accepted quantities against their originating receipt lines. Require supplier, source receipt, location, business date, reason and positive base quantities. A return is a stock movement with a financial reference; it is not a deletion of the original purchase.

- Cap cumulative returns by the original accepted quantity minus earlier accepted returns and reversals. Also require the originating cost layer quantity still available in the source location.
- Return the selected receipt's available layers at their original captured cost. Do not substitute another receipt's FIFO layer. Stock that was consumed or moved cannot be returned through this slice; bring transfers/traceability into scope later with an explicit policy.
- Validate and deduct all lines atomically. Keep quantity, value, source allocations, result receipt and actor audit in the same transaction. Repeated delivery cannot deduct twice.
- Capture a supplier credit-note reference where available, but leave its payment/accounting settlement separate from inventory acceptance.
- Save offline as pending; stale availability becomes review rather than negative stock. Preserve the rejected command for retry/correction/cancellation using the existing immutable-history rules.

Acceptance: receive 10 kg at EGP 20/kg, return 3 kg, and verify 7 kg/EGP 140 remaining. Retry without another deduction. Consume source stock and reject an excessive source-linked return even if another receipt provides enough aggregate stock. Verify partial/repeated returns, multi-line rollback, cross-tenant references, offline review and archive recovery.

## Shared implementation rules

Extend contracts before changing persistence or UI. Define document envelopes, stable line IDs, revisions and source relationships explicitly. Add tenant-qualified constraints and additive schema migrations; do not repurpose old receipt commands or rewrite their historical payload hashes. Preserve existing operation IDs and seeded data.

Documents reuse authoritative posting primitives while keeping one stock ledger and one cost-layer model. Acceptance receipts deduplicate the document envelope; ledger movement IDs identify its lines. Server-generated identity and actor come from the authenticated request, not imported files. Import jobs retain source file fingerprint and row mapping; deduplicate repeated commits of the same job, and report overlapping external references for review.

Add versioned local document storage without replacing current outboxes. Extend recovery formats deliberately: new formats include documents and lines, old stock/setup archives remain readable, and unsupported formats fail with a clear message. Validate restored tenant scope, envelope/line IDs, duplicate payloads, counts and file size before committing local changes atomically. Do not trust exported accepted states without server reconciliation.

Use existing Zustand UI state and React Hook Form/Zod; retain decimal arithmetic. Confirmed totals come from the server; pending previews remain labeled. Surface server rejection reasons in Arabic and preserve keyboard/mobile access. Retain a stable local origin so browser data stays accessible.

## Git, environments and completion

Inventory setup is local on `feat/inventory-setup`; Phase 2A is on `feat/opening-stock`, stacked after planning commit `4c89131`. Neither new feature is claimed published or merged. Submit inventory setup separately and document the stacked relationship when publishing Phase 2A. Keep the three Phase 2 slices as reviewable commits/PRs; run applicable checks before pushing. Publishing uses the selected repository, `3azam0/Sas`, and the developer guide's Git workflow. Do not merge or deploy as part of an implementation checkpoint.

Use isolated test data and ports. Check the compiled production build for the new screens before telling the client they are available. Record exact verified checks and current commit; do not reuse earlier test totals as evidence for new functionality. Do not clear the user's local database or IndexedDB during testing.

This phase ends when all three slices pass their acceptance scenarios and the first client can demonstrate setup → opening stock → partial purchasing/receiving → supplier return → stock/value history, including offline capture/reconnect and recovery. Transfers/counts are the next phase; recipes, production, sales imports and actual-versus-theoretical cost control follow. Real authentication and isolated production data are mandatory before live operations, even though membership administration and dedicated demo infrastructure remain deferred.
