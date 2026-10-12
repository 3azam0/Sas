# Kitchen inventory and POS routing — agreed scope

Agreed 12 October 2026. **Planned, not implemented or deployed.** This amendment follows the delivered Recharts BI release. The current hosted kitchen-issue workflow still consumes materials immediately from the source warehouse; this plan defines its next stock-holding kitchen workflow.

## Business structure

- Each kitchen is a stock-holding location within a branch, with its own quantities, valuation, counts, waste and movement history. It shares the organization's material catalog and costing policy.
- Kitchens are inventory locations, not additional subscription branches.
- Each POS is linked to one kitchen. Capture the POS and resolved kitchen on accepted sales; imports must carry an explicit POS context.
- One menu item may be available in multiple kitchens. Each allowed kitchen can prepare the complete meal independently.
- A sale uses the kitchen linked to its selling POS. Availability in multiple kitchens never fans one sale out into several deductions.
- Cashier shifts are deferred. No ingredient-level routing across kitchens or split preparation of one meal is included in this increment.

Example: a grilled chicken meal is available in Kitchen 1 and Kitchen 2. A sale through Kitchen 1 POS consumes selected ingredients only from Kitchen 1; the same meal sold through Kitchen 2 POS consumes only from Kitchen 2.

## Stock and costing behavior

Main warehouse → kitchen is a transfer, retaining organization stock quantity and value across source, destination and any transit stage. Kitchen-to-kitchen transfers and returns to the main warehouse use the same stock-transfer foundation. Transfer completion must never also post an immediate kitchen-consumption issue for the same goods.

Only ingredients checked for stock deduction in the pinned recipe version are consumed by new sales, from the resolved kitchen. Unchecked ingredients still contribute to estimated recipe cost. Sales imports retain the agreed shortage policy: accept the sale, deduct available selected stock and record required/deducted/missing quantities without creating negative stock. Shortages do not authorize fallback deduction from the main warehouse or another kitchen. Missing POS/kitchen routing must remain distinguishable from a physical stock shortage; resolve it before applying kitchen deductions rather than guessing a source.

Resolve recipe estimates against the relevant kitchen's inventory costs and keep unknown costs explicit. Accepted deduction costs remain pinned under FIFO or moving weighted average. Accepted sales record their resolved kitchen and recipe version, so later menu availability or POS assignment edits do not reroute past consumption. Preserve source stock value when transferring; destination costs follow the existing location costing policy.

## Product changes

- Kitchen management: link kitchens to inventory locations and branch scope; retain add/edit/archive and historical identity.
- Menu setup: searchable multi-kitchen availability selection, retaining one shared menu item identity and recipe unless a later requirement introduces recipe variants.
- POS setup: name and kitchen assignment; visible POS/kitchen context for sale entry and sales import. No cashier-shift workflow in this increment.
- Inventory: selectable kitchen balances, actual unit costs, receiving/transfers, physical counts, waste and traceable balance adjustments using shared forms and stock permissions.
- Reporting: kitchen stock on hand, incoming/outgoing transfers, actual consumption, waste and shortages, with POS sales filters and organization-wide totals. Transfers must be distinguished from consumption and excluded from consumption totals.
- Offline work: cache the allowed kitchens/POS mapping, retain pending operations, synchronize setup and prerequisite transfers before dependent deductions, and validate routing and quantities authoritatively on acceptance.

## Implementation and verification

1. Inspect the existing kitchen directory, stock locations, transfers, sales identities, pinned recipe versions and reports; reuse the stock ledger and transfer valuation rather than introducing a second stock engine.
2. Add tenant/branch-qualified kitchen-location, menu availability and POS-kitchen relationships with additive migrations and explicit local/offline compatibility where required.
3. Build the kitchen/POS/menu editors and kitchen stock views with existing searchable selectors, keyboard forms, list filters, sorting and pagination.
4. Implement POS-resolved sales consumption and immutable routing context. Sales deduplication must distinguish identical external sale identifiers coming from different POS sources while retaining compatibility with earlier imports.
5. Update BI and document labels to distinguish transfer, consumption and remaining kitchen stock; preserve the meaning of historical immediate-consumption issues and accepted sales.
6. Verify transfer quantity/value conservation, per-POS routing of a shared meal, selective deduction, accepted shortages, no cross-kitchen fallback, duplicate retry safety, source-specific sales identities, tenant isolation, offline dependencies and report reconciliation before hosted delivery.

This agreement changes the planned behavior only. Existing client stock and historical documents have not been reset, moved or reposted.
