# Supplier returns — Phase 2C

Delivered locally on 10 October 2026. Use the existing development organization and stable local address. Production authentication, tax/landed-cost allocation and supplier settlement remain separate work.

## Walkthrough

1. In **المشتريات**, create and submit an order, then accept a receipt at the selected stock location. A draft order creates no stock. This slice supports purchase-document receipts; simple unlinked receipts do not appear as return sources.
2. Open **مرتجعات الموردين** and choose **مرتجع مورد جديد**. Select the original receipt. Supplier, location, source lines and original costs come from that receipt.
3. Enter the return business date, reason and optional supplier credit-note reference. Quantities use the base inventory unit. Review the original quantity, previously accepted returns, remaining source availability and expected return value.
4. Save. Offline capture remains durable after reload and reserves provisional source availability. Confirmed inventory changes only after server acceptance.
5. Synchronize and inspect return history, stock value and movements. Receiving 10 kg at EGP 20/kg and returning 3 kg leaves 7 kg valued at EGP 140. The return document displays EGP 60; its stock movement deducts EGP 60. Gross received order quantities remain unchanged.

## Posting and source availability

Every return references an accepted, non-reversed receipt in the same organization/order. Each source line must match its original supplier and location. Returns cannot exceed the original accepted quantity minus earlier returns, or the quantity still in that original cost layer. Stock from another receipt cannot satisfy a source shortfall, even when aggregate branch stock is sufficient.

All lines validate before posting. The document, source-layer deductions, negative ledger movements, allocations, balance updates, acceptance receipt and actor audit commit together. If one line fails, the entire return rolls back. Same-ID retries do not deduct twice; changed payloads under the same ID are rejected. Posting increments the purchase order revision without reopening received quantities or changing its receiving state.

The optional credit-note reference is evidence metadata. Inventory acceptance does not settle a supplier balance or record a payment. Accepted returns cannot be edited or cancelled locally. Return reversal is deferred. A receipt whose stock has been returned no longer qualifies for the existing untouched-stock full-receipt reversal.

## Offline review and recovery

Connectivity/authentication failures retain pending capture. Another device may consume or return source stock after this device's snapshot. Unavailable stock or a stale order revision enters **تحتاج مراجعة**, without changing confirmed inventory.

- **إعادة محاولة المرتجع** resends the unchanged command using its original ID.
- **تصحيح المرتجع** uses the refreshed source/revision, creates fresh document/movement IDs, and preserves the rejected record as **تم التصحيح** with links between both records.
- **إلغاء المرتجع المرفوض** cancels only a known rejected local record; it never reverses accepted stock.

Recovery format 8 includes counts, transfers, returns and linked corrections together with purchase, opening, setup and stock outboxes. Formats 1–7 remain readable. Preview validates tenant/source references, payloads, IDs and correction links before atomic restore. Identical records are skipped and conflicting records abort restoration. Exported acceptance states require server reconciliation. Older builds cannot read format 8. Preserve the local origin and export device-only work before moving devices or addresses; database backups do not include unsynchronized browser commands.

## Verification and next work

82 unit/integration tests and eighteen Chrome browser/process scenarios pass, along with type checking and the production build. Return checks cover original cost, fractional arithmetic, competing revisions, duplicate IDs, cumulative limits, consumed source stock despite aggregate availability, full rollback, tenant isolation, offline reload, correction history, recovery and Arabic mobile layout. Tests use isolated data/ports, preserving the client's local database.

Transfers, in-transit receiving and explicit transit loss are delivered; see [Transfers](./Transfers.md). Next: stock counts and reconciliation. Returns after transfers need an explicit source-traceability policy. Recipes, production and restaurant cost control follow reliable stock movements.
