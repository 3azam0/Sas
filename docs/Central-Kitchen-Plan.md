# Central Kitchen — manufacturing and preparation

Authorized 29 October 2026. This supersedes FIFO requirements in earlier plans. Warehouse employees operate main warehouse → production WIP → main warehouse → kitchens; no separate Central Kitchen account is required.

Deployment is explicitly on hold at the user's request. Implementation and verification remain local until the user separately requests deployment.

## Data policy

Data is dummy and a reset is authorized if needed. Prefer preserving catalogue, locations, quantities, values and accepted history. No automatic database deletion or browser queue clearing. Convert remaining valuation into weighted-average pools without repricing historical movements. A future explicit reset must identify its database, preserve a verified backup, and reconcile pending offline work before changing its dataset identity.

## Delivery sequence

1. Perpetual weighted average per item/location; decimal arithmetic, no negative stock, posting-order valuation, historical FIFO retention and exact full depletion. Catalogue roles and explicit kg/g, litre/ml and piece conversions.
2. Draft/in-progress/partially-received/closed/cancelled batches; multiple inputs/outputs, additional issues, operator, recipient, dates and notes. Atomic stock deduction and batch WIP on issue.
3. Partial actual output receipts, original-issue-cost unused returns, reasoned losses, processing costs and explicit output cost allocation. Provisional receipt values, final settlement and linked stock/in-transit/consumed-cost adjustments. Compatible-unit balances only; every input must be accounted for before closure.
4. Arabic Central Kitchen interface: batches, issues, settlement, WIP, history, catalogue. Preserve existing beef/sheep fields and old documents/balances. No rewriting accepted transactions.
5. General warehouse-to-kitchen dispatch/partial receipt with carried value, in-transit balances and branch average costing. Reports for batches, WIP, stock, transit and cost adjustments.
6. Physical counts with cutoff/concurrency protection, variance reasons and audited adjustments. Linked corrections and cancellation; protect dependent movements. Individual accounts, warehouse/kitchen permissions and production deployment remain release prerequisites.
7. Later: versioned recipes/sub-recipes, cycle checks, expected/actual consumption, duplicate-safe sales imports, suppliers/purchase orders/returns, lot/expiry/FEFO and recalls.

Offline capture, stable command IDs, atomic posting, tenant validation, rejected-command review, recovery export/import and tests accompany every stage. Pending local stock and cost estimates are not authoritative. Server posting order determines actual issue cost; business dates do not retroactively revalue transactions.

## Valuation

Receipt average = (existing value + receipt value) / (existing quantity + receipt quantity). Issues use current location average. Returns use the related original issue cost. Transfers carry source value; destination receipts recalculate average. Output cost = issued value − unused returns + processing costs; processing losses are absorbed once. Provisional receipts consume WIP value; final differences must reach remaining stock, transit, downstream WIP and consumed costs through linked adjustments.

## Acceptance

Issue several kofta ingredients, reopen and add ingredients, partially receive products, physically return unused materials, record loss, reconcile and close at zero unexplained WIP. Dispatch to a kitchen and partially receive. Closing cost adjustments must reconcile products already transferred or consumed. Verify beef/sheep continuity, unit conversions, fractional precision, rollback, duplicate/concurrent submissions, offline reload/reconnect/recovery and responsive Arabic screens. Quantities and total value must reconcile before/after the costing transition.

## Delivery record

Implementation and verification results are recorded below as work completes. Later stages must not be described as delivered merely because this plan includes them.

### Delivered local workflow

- Weighted-average stock movements and a non-destructive transition marker; historical accepted movement values are retained.
- General catalogue creation and kg/g, litre/ml and piece-unit validation.
- Staged multi-input batches, additional issues, WIP, partial receipts, original-cost returns, separately recorded losses, processing costs, final output allocation and close checks.
- Cost-flow adjustments for stock, transit, open downstream WIP and consumed quantities. Close source batches first; revaluation affecting an already closed downstream batch is explicitly rejected rather than silently rewriting it.
- Beef/sheep fields in staged butchery closure and continued access to the previous butchery documents, balances and operations.
- Main-warehouse kitchen dispatch/partial receipt, basic revision-protected physical counts, Arabic batch/WIP/history screens and existing offline/recovery queues extended to all new commands.
- Linked reversal for an untouched isolated output receipt and processing costs still covered by WIP. Full dependent reversal/period-control workflows remain pending.

### How to operate

1. Open **المطبخ المركزي → دليل الأصناف** to create any missing raw/intermediate/finished items. Use the previous butchery catalogue to classify sheep/beef inputs and outputs.
2. Receive purchased materials through the existing warehouse receipt screen, then synchronize.
3. Create a batch with planned outputs and cost shares totaling 100%; synchronize before selecting it for later actions.
4. Issue one or more materials, selecting compatible entered units. The warehouse loses availability immediately after server acceptance; batch WIP gains their average-cost value.
5. Reopen the batch under **استلام وتسوية**. Record unused returns against a particular issue, processing losses with reasons, processing costs, and actual product receipts. A provisional receipt value is the total value of that receipt, not its unit cost; it cannot exceed available WIP.
6. Close after every issue is reconciled: consumed + returned + lost = issued. Weight mode also reconciles all usable input weight to actual output weight. Mixed-unit mode requires an explanatory settlement note and does not invent density conversions.
7. Final cost is divided between output items by the saved shares, then between an item's partial receipts by their actual quantities. Linked value-only adjustments follow those receipts into remaining stock, transfers and consumption. Close source batches before dependent production batches.
8. Dispatch finished stock through **تحويلات المطابخ**, then record actual kitchen receipts. Partial quantities and their value remain in transit.

### Remaining release work

Production identities and warehouse/kitchen roles, managed cloud deployment, catalogue editing/pack-factor administration, full count approvals/cutoffs, arbitrary dependent corrections, transfer discrepancies/returns and the later recipe/sales/purchasing/expiry modules are not yet delivered. Existing demo organization-wide access remains explicit. Do not mistake the local workflow for a production SaaS release.

### Automatic identifiers

New item codes, batch references, transfer numbers and operation references are assigned by tenant-scoped transactional counters. Examples: `MAT-000001`, `PROD-000001`, `TRF-000001`, `RCV-000001`. Internal UUIDs still identify offline commands; the readable code is assigned on authoritative sync, remains stable on retry and is displayed in history. Imported/existing item codes are preserved. Existing batches receive references without changing stock or accepted movement amounts.

Creation/receipt/issue notes are optional; batch names are optional and default to the generated reference. Waste, stock-count, cancellation and correction reasons remain required. Future recipe forms must also generate `REC-` codes automatically; this workspace does not yet implement recipe forms or recipe records. Adding a reserved prefix is not delivery of the recipe module.

Automatic-reference verification: TypeScript and local build passed; 45 unit/integration tests and all 12 browser/process checks passed, including form submission without manual codes/notes, replay stability, concurrent allocation and existing-code collision avoidance. No deployment was performed.

### Verification, 29 October 2026

- TypeScript and optimized production build passed; offline asset manifest generated.
- All 41 unit/integration tests verified. The backup/restore integration passed in isolation after a resource-contention timeout during a concurrent build.
- All 11 browser/process scenarios passed against the final production build, including the new warehouse production cycle, unused returns, recorded losses, closure, partial kitchen transfer receipt and offline batch reopening/sync.
- Desktop and 390px mobile screenshots inspected; horizontal viewport fit checked.
- Tests used isolated databases under `.cache`; no existing operational dataset or browser queue was cleared.
