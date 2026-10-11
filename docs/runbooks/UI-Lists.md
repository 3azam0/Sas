# List controls and responsive workflows

Delivered 11 October 2026. The shared `Collection` component filters and sorts before pagination. Pages contain 10, 25, 50 or 100 rows; changing search, filters, ordering or page size starts at page one. Arabic search tolerates common alef variants and diacritics. Empty results show a way to clear filters. Each list has named controls, a result count and previous/next/page buttons when needed.

| Screen | Search and filters | Ordering |
|---|---|---|
| Overview | Inventory category and positive/zero value | Category name, stock value |
| Inventory | Material name/SKU, category, stock level | Name, confirmed quantity, value, average cost |
| Inventory setup | Material/unit/supplier/location name, activity/sync state; item category/unit and location kind | Name |
| Suppliers | Supplier name and activity/sync state | Name |
| Opening stock | Reference/material, sync state, business date | Alphabetical reference, business date |
| Purchasing | Reference/material/supplier, order state, supplier, business date; local procedure status | Alphabetical reference, date |
| Supplier returns | Reference/supplier/credit note, supplier, sync state, business date | Alphabetical reference, date |
| Transfers | Reference/location/material, state, direction, business date | Alphabetical reference, date |
| Counts/reconciliation | Reference, document type/state/date; material and match result | Alphabetical reference/material, date |
| Recipes and cost control | Recipe name/code, state, output type, sales deduction; component price/shortage state | Name, effective date; component quantity, cost and value |
| Production | Batch reference/recipe, state, result and business date | Alphabetical reference, date |
| Sales | Menu name/code, activity, source, deduction; import reference/status/shortage/date; preview shortages | Menu name/output per sale; import reference/capture date; component name/date/shortage |
| Theoretical sales consumption | Material, price availability and report period/basis | Name, theoretical quantity, unit cost, estimated value |
| Movement ledger | Material/SKU/reference/supplier, movement type and business date | Alphabetical reference/material, business date |
| Sync center | Reference, module, location, operation state, captured date | Alphabetical reference, captured date |

The default order retains the caller's existing sequence, including review-first priority where applicable. Explicit ordering is stable. Monetary ordering compares decimal values without conversion to floating point; unavailable prices remain last in either direction. Report totals use the complete reporting period and do not depend on the displayed table page.

Long read-only document detail lists also have paging/search. Editable receiving, opening, purchase, return, transfer, count, production, recipe and import rows remain mounted across pages. Input values and native validation remain available for the entire document. These editors preserve row order; sorting is for reading lists. Adding a row opens its page, and submitting an invalid hidden row reveals its page before focusing the input. Unsaved changes exist only in the open editor; paging is not automatic durable draft saving.

A source-document link clears local list filters/order, selects the containing page, expands the document and focuses it. Navigation does not post an operation. The sync center combines the local outboxes while retaining each module's existing retry/correction rules.

Dropdowns preserve native select behavior and reserve 14px for text and 40px on the arrow side. The arrow moves for RTL/LTR and native appearance returns in forced-color mode. Responsive layouts were inspected at desktop, tablet and phone viewport sizes. Tables scroll within their own container.

## Snapshot boundary

These controls operate on the downloaded tenant snapshot and local outboxes, so they remain usable offline. They do not fetch additional server history. The movement ledger currently pages the latest 100 entries supplied by the existing snapshot contract. A future full-history API must implement server pagination separately. Sync rows are specific to this browser/device; an empty queue does not mean that every other device has synchronized.

## Verification

Check inventory page two, choose value descending and verify page one with the highest values. Filter a category and verify alphabetical order. In a cost report, change page/order and confirm that its totals do not change. Enter quantities in an unsaved multi-page document, navigate away and back, and confirm values survive. Exercise invalid input on another page and cancel after validation; do not post browser test documents to the client workspace. Check source links from returns into purchasing and review the phone layout.

See [release evidence](../releases/all-screen-ui-2026-10-11.md) and [forms walkthrough](./UI-Forms.md).
