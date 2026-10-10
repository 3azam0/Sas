# Stock transfers — Phase 3A

Use **التحويلات** for movements between branches, warehouses and preparation kitchens in the current development organization. All quantities use the base inventory unit. Source and destination must be different locations; production transformations belong to a later module.

## Dispatch and partial receipt

1. Select the source location and open **تحويل جديد**. Choose source/destination, business date and reason/reference. Enter quantities for the materials being sent, then **حفظ مستند التحويل**.
2. Saving is durable locally. Server acceptance validates all lines and allocates source FIFO stock atomically. Accepted dispatch reduces source stock and creates transit quantities/value. It does not immediately increase destination stock.
3. Select the destination. Synchronize to download another device's dispatch, then open **استلام التحويل**. Enter actual quantities received and save. An already known dispatch can be received offline; missing dispatches require synchronization first. Unknown receipt observations are not implemented in this slice.
4. The destination receives the original dispatched cost segments in FIFO order. Partial receiving leaves the remainder in transit. Inspect received/lost/outstanding quantities and confirmed transit value. Local quantities remain explicitly provisional until accepted.
5. Receive the remainder later, or explicitly record a shortage/damage using **تسجيل فقد التحويل** with a date and reason. A short receipt alone does not write off the remainder.

Example: source has 2 kg at EGP 20/kg plus 8 kg at EGP 30/kg, total EGP 280. Dispatch 5 kg at EGP 130: source retains 5 kg/EGP 150 and transit holds 5 kg/EGP 130. Receiving 3 kg adds EGP 70 at the destination (2 kg at 20 plus 1 kg at 30); transit retains 2 kg/EGP 60. Source + destination + transit still totals EGP 280. Recording the remaining 2 kg as lost reduces transit by EGP 60, with source unchanged. Do not count transit twice in consolidated reporting.

## Inventory integrity

Tenant-qualified relationships retain dispatch, source layers, destination ledger entries, action allocations and audit. Posting is serialized with revision checks. A command and its bounded lines post together or roll back entirely. Same-ID retries return the recorded result; changed payloads or reused movement IDs are conflicts. Receiving or loss cannot exceed the remaining dispatched quantity. Dispatch requires active items/locations; a physical shipment already accepted can still be received after a catalog record is deactivated.

Transit loss consumes original transit segments and records an auditable loss action; it creates no second source deduction or destination stock. It does not settle carrier claims or financial accounts. Accepted documents cannot be edited, locally cancelled or reversed in this slice. Returns to sender and accepted-posting reversals need explicit later workflows. Request/approval routing and branch-restricted production permissions remain deferred.

## Offline, review and recovery

Dexie schema 5 adds a transfer outbox without deleting old tables. Synchronize setup, opening and purchasing first, then eligible transfer revisions in capture order, then dependent simple stock commands. A receipt cannot finalize before its dispatch. Another device's accepted dispatch must first be downloaded. Failed dependencies become review records; no destination stock is fabricated.

Network/authentication failures retain capture. If acknowledgment download fails after acceptance, retry the same ID safely. Over-receiving, unavailable source stock and stale revisions enter **تحتاج مراجعة**. Retry keeps the original payload/IDs. Correction creates fresh operation/movement IDs and linked superseded history. Corrected dispatch also uses a fresh transfer ID; resolve its rejected dependent actions first. Cancellation applies only to known rejected local records and never reverses accepted stock.

Current recovery format 8 includes counts, transfers, previous outboxes and correction links. Formats 1–7 remain readable. Validate tenant/source references, duplicate/conflicting IDs and correction chains before atomic restoration. Reject self/cyclic links. Exported acceptance states reconcile against server evidence. Older builds cannot read format 8. Keep the same local origin and retain current build compatibility when restoring. A server database backup excludes unsynchronized browser work.

## Verification and next work

100 unit/integration tests and twenty-one Chrome browser/process scenarios pass. Type checking and the production build pass. The schema-4 upgrade test preserves an older pending stock command, snapshot and preference while adding the transfer outbox. Desktop navigation scrolls on short windows; mobile navigation and table scrolling remain accessible.

The transfer checks exercise mixed-cost partial receiving, independent stock + transit reconciliation, destination FIFO, fractional precision, explicit loss, competing revisions, duplicate delivery, atomic rollback, tenant isolation, inactive records, offline reload, chained transfers, rejected dependencies, correction and archive recovery. Browser tests use isolated ports/data and check Arabic desktop/mobile layouts.

Phase 3B stock counts and traceable adjustments are now delivered; see [Stock counts](./Stock-Counts.md). Current exports use format 8 including counts and read formats 1–7. Next is recipes/BOMs. Production authentication/access and separate production data remain required before live use.
