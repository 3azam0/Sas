# Inventory operating cycle — implementation record

Authorized scope: purchasing suggestions, transfer follow-up, lots/expiry, consumption/waste explanations, and day closing/permissions. Continue until all five are implemented, verified and released. Work on `chore/qibli-trial-stock`; preserve previous features and user data.

- [x] Purchasing suggestions: accepted stock, minimum reserve, aggregate unfinished preparation needs, submitted purchase remainder and inbound transfers; distinguish draft coverage and unknown prices; reviewed purchase draft only.
- [x] Transfer follow-up: accepted dispatched/received/lost/remaining quantities/value, location/search/status filters, configurable overdue-age rule, CSV and links to existing receiving/loss workflows.
- [x] Lots/expiry: optional batch/expiry metadata on incoming inventory, trace through source cost layers/transfers, expiry/unknown alerts. Retain FIFO/average valuation and mark historical unknown metadata honestly.
- [x] Consumption/waste: reuse complete counted-period reconciliation, add immutable variance explanations and reviewer identity; missing baseline remains unknown.
- [x] Day closing/permissions: server-enforced closed-through dates for stock/sales/finance; manager count approval/closing, owner reopening and role administration, idempotent retries, audit and no silent loss of offline operations.
- [x] Migrate/test safely; deploy backend before frontend, verify current live release before activation, record release evidence.

Plans remain device drafts with separate backup. Purchasing suggestions must not reserve/post stock or count drafts as confirmed supplies. Transfer aging is an explicitly labelled configurable rule, not an invented contractual delivery date. No invented historical lots/expiry; no changing stock valuation policy as part of tracking.

Verified membership source: `fodo.user_access` has UUID user_id, text organization_id and active. One existing active account retains owner access; new memberships default to operator. Migration rejects ambiguous multi-account legacy owner assignment. Tenant RLS, manager-only closing writes and append-only control events pass isolated migration tests. No membership IDs are hardcoded.

The desktop/mobile/offline browser scenario passes reviewed suggestions, partial/overdue transfers and CSV, expiry alerts/CSV, variance approval, closed-date rejection, accepted retry, owner reopening, receiving lot capture and cached offline review. Evidence lives in ignored `.cache/inventory-operations-evidence/`. See the [operating guide](./runbooks/Inventory-Operations.md) and release record for deployment evidence.

Released build `06ecf041fa85e3df`, Worker100 at 100%, API22, migration `20261028181354_inventory_operating_cycle.sql`. Live health, exact bundle bytes, access/origin/private-file protections and desktop/mobile login checks pass. The optional whole-suite attempt was stopped and is not counted as passing.
