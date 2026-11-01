# Central kitchen butchery implementation

Agreed scope: live sheep (ضاني) are slaughtered and cut internally; purchased beef is cut internally. No birds, goats or live cattle in this workflow. Users name all input and output items. Stock quantities use kilograms; sheep batches additionally record head count. Whole carcasses are intermediate measurements, not automatically stocked outputs.

## Delivery plan

1. Add a distinct butchery stock area within the central kitchen, preserving the existing main inventory location and balances. User-created catalog items distinguish live sheep, purchased beef, lamb products and beef products.
2. Receive purchases using the existing inventory receipt screen. Dispatch inputs from inventory to butchery, then confirm receipt. Processing consumes confirmed butchery stock only.
3. Process one input item per batch, with actual finished-product weights, slaughter/cutting loss, optional processing cost, and user-assigned output cost percentages totaling exactly 100. Lamb records head count and carcass weight. Validate both slaughter and cutting mass balances. Usable by-products can be user-created outputs with zero or positive cost share.
4. Atomically consume input stock at its location weighted average and create output stock and cost layers. Store immutable batch facts and actual allocated costs. Allocate rounding remainder deterministically, preserving total value through later depletion.
5. Dispatch finished products to main inventory or any branch kitchen. Partial receipt keeps undistributed quantity/value in transit; prevent excess receipt and duplicate posting. Value-flow references preserve costing lineage through stock-entry references.
6. Capture commands in a durable offline outbox. Server acceptance is authoritative. Provide retry/cancel for rejected commands, recovery export/import, and batch history. Keep unsupported dependencies pending for explicit review rather than inventing available stock.
7. Verify tenant isolation, expired access, atomic rollback, duplicate delivery, stock sufficiency, weight/cost validation, precision, transit reconciliation, offline replay and the Arabic responsive UI.

## First-version boundaries

Cost shares are entered for each batch; prior batches remain visible for reference. No automatic pricing by sales value, animal identification register, sales of non-kitchen by-products, batch reversal, or saved cutting-template administration in this delivery. Wrong accepted batches require a future audited correction workflow; never edit accepted documents in place. Existing demo sessions are organization-wide; branch-specific receiving permissions belong to production authentication work.


The 29 October Central Kitchen plan extends this legacy workflow with staged warehouse issues, WIP and receipts. All new legacy butchery postings also use weighted average. See Central-Kitchen-Plan.md.
