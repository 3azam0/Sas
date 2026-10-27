# Butchery dummy examples — 27 October 2026

The user explicitly requested dummy examples after the hosted butchery release. The existing removable trial remains active; generation and original data are preserved. All six new item names begin with **تجريبي -**. These are fictional quantities and prices, not actual purchases or supplier quotations.

## Completed example flows

| Flow | Received in main inventory | Processing | Returned to main inventory |
| --- | --- | --- | --- |
| Purchased beef | 10 kg at EGP 300/kg | EGP 100 processing; 1 kg cutting loss | 6 kg cubes (70% cost, EGP 2,170) and 3 kg mince (30%, EGP 930) |
| Live ضاني | One sheep, 60 kg live weight at EGP 150/kg | 36 kg usable carcass, 24 kg slaughter loss, 4 kg cutting loss, EGP 300 processing | 26 kg lamb cuts (90% cost, EGP 8,370) and 6 kg cooking fat (10%, EGP 930) |

The existing **جزارة** location received both inputs from **المخزن الرئيسي**. Both completed output batches were dispatched and fully received back in main inventory. No quantities remain in transit or in butchery stock for these example items. Total incoming purchase value is EGP 12,000, processing is EGP 400, and finished inventory is **41 kg / EGP 12,400**.

## Posting and verification

`scripts/butchery-sample-data.mjs` prepares the thirteen saved catalog/receipt/transfer/processing commands using the application's shared posting services. The engine was independently replayed against a second embedded database with different stock-entry serials to validate destination sequence mapping. Replaying the same transaction is idempotent.

The reviewed, guarded SQL was applied atomically through the authorized administrative database connector. It verifies the active trial, generation, costing method/revision, main/butchery locations, kilogram unit and absence of the example item IDs/names before appending records. It performs no cleanup or generation rotation. New records carry the administrative audit actor `sample-data-admin:butchery-examples`.

The manifest is registered under `butcheryExamples` in the existing private `fodo.sample_data_runs` row. The existing guarded full-trial cleanup includes these records when explicitly authorized later. Generated commands, manifest, SQL and local verification stay ignored under `.cache/butchery-examples/`.

Live verification confirmed zero discrepancies between sample balances, stock-entry totals and cost layers. Hashes of sixteen collections confirmed that existing items, stock balances/layers/entries, locations, units, suppliers, kitchens, POS routing, recipes, menu mappings, sales, kitchen actions and finance records were unchanged. No sale or payment was posted.

In the app, sync or refresh and search **تجريبي** in main inventory. Open **الجزارة → السجل والأرصدة** with the **جزارة** location selected to inspect the two batches; use receiving/transfer history for the incoming receipt and both transfer documents.
