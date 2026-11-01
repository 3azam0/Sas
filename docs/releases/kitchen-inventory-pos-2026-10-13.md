# Kitchen inventory and POS routing — 13 October 2026

Kitchens now retain stock. Warehouse supply transfers materials and value into kitchen inventory; completed sales consume selected recipe ingredients only from the selling POS's kitchen. Shared meals can be assigned to several kitchens, each preparing the whole meal independently. Cashier shifts and split preparation remain deferred.

## Delivery
- Branch: `feat/kitchen-inventory-pos`, from agreed-scope checkpoint `00ef47f`.
- Hosted build: `11a85380a337ca2e`.
- Cloudflare Worker version: `a224ff9e-eefc-487b-9b59-c71b22dc67a8`.
- Deployment: `770627b4-53b5-4489-a55f-3162519adc88`, verified at 100% traffic, `2026-10-13T06:37:42.809121Z`. Existing bindings and observability were retained.
- Supabase `fodo-api`: version **12**, active; server bundle checksum `9f9928aa91216e1840bbb10b8ca2767b93128f851d160ad7ab35bb1130389dbd`.
- Applied migration: `20261013062806_kitchen_inventory_pos`. The first packaging attempt was rejected before applying; the SQL-body build guard now rejects missing migration exports. Applied SQL is recorded under its actual remote migration version.
- Live: https://fodo.am-agent2026.workers.dev/

## Data and isolation
The migration added kitchen location/parent associations, tenant-qualified POS relationships and terminal-scoped sale uniqueness. Existing recipients gained deterministic empty stock locations. No stock was moved and no accepted document was reposted. Verification before/after matched **338 materials**, **171 ledger rows**, **100 sales-detail rows** and **196,820.65 EGP** total stock value.

New POS rows have forced RLS, tenant policies, composite tenant/kitchen foreign keys and no authenticated/public table access. Client access remains through the authenticated API role. The active temporary trial's guarded baseline/signature was extended with the new table; isolated migration tests proved cleanup can restore a baseline containing an existing kitchen, preserve another tenant and deny cross-tenant POS writes.

The existing client kitchen's parent warehouse remains unconfigured and no POS was created automatically. Its current trial menu source is **FODO**. Configure parent warehouse, POS and allowed meal kitchens before new routed imports. Formal branch/subscription management remains deferred; kitchens are additional stock locations under the existing organization/warehouse scope.

## Verification
**303 tests in 57 files passed**, including FIFO and moving-average transfer value conservation, exact retries, atomic transfer shortage rejection, two terminals sharing a ticket number, per-kitchen shared-meal deductions, unchecked materials retained, accepted partial shortages, no warehouse fallback, POS reassignment deduplication, tenant routing, report filters, archival guards, private migration and trial restore.

Offline tests verified pending kitchen/POS setup projection and delivery order, both projected transfer sides, routing round-trip in recovery format **17**, rejection of older formats carrying new context, and dependent sales retained for review after a rejected incoming transfer. The full existing suite covered previous receipts, counts, recipes, transfers, sales and auth boundaries. TypeScript and the final Next production build passed; the local offline manifest contains 43 build assets. Hosted bundle passed and final JavaScript asset was verified in the browser.

Browser verification used the actual client account for read-only navigation and unsaved form drafts: main warehouse default, kitchen list search/category filter/sorting/page 2, kitchen parent selection, POS editor Enter navigation, menu kitchen dropdown arrows/Enter and selected chips, POS-required import state, transfer form wording and report POS filter. New supplies/actual kitchen consumption are separate report cards; the historical 48 EGP consumption stayed visible.

Responsive check at 390 × 844 showed no document horizontal overflow (375px content width/scroll width plus browser scrollbar). Browser console errors/alerts were absent in the final check. Screenshots: `outputs/Kitchen-Inventory-POS-20261013/kitchens-desktop.png` and `kitchens-mobile.png`.

No client item, POS, menu binding, supply or sale was posted during browser checks. True network-offline browser emulation was unavailable; durable offline behavior was verified by tests. The security advisor reports only the existing Auth leaked-password-protection warning; no new table-access/RLS warning. Reference: https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection.

## Operating and Git notes
See [kitchen setup/runbook](../runbooks/Kitchen-Issues.md). Developer Guide **2.40**, Master Plan, Hosted Release and BI/sales guides record this delivery. Existing accepted legacy issues preserve immediate-consumption meaning; pending legacy issues to stock kitchens need a new transfer, with their old record retained.

Work is committed on the feature branch, without merging main. GitHub publication remains pending the previously identified credential-helper repair; no authentication workaround or publication claim is made. Deployment does not imply a merge.
