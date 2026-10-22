# POS workflow and device context — 22 October 2026

## Hosted configuration

The user explicitly chose separate routing: بحري → المطبخ البحري; قبلي → المطبخ القبلي. Updated only the existing قبلي terminal through the normal generation/revision-checked setup API: revision 1 → 2, operation d83a2772-9bc0-456d-8b0c-bcf6e030c05d. Before/after hashes confirm unchanged balances, ledger entries, sales, finance, kitchen tickets, menu mappings, recipes, kitchens and locations. The other terminal remains revision 1. Prepared command and before/after evidence are retained in ignored .cache/pos-acceptance/routing-run.json.

All 12 SAMPLE-WS mappings have prices and published recipes available to both kitchens. Ten have explicit selected deduction materials; potatoes and green salad have none, so their costs remain theoretical without automatic material deduction. These are existing fictional trial settings; real prices, portions and selections require client acceptance. The Qibli kitchen currently has no positive stock; supply it through صرف للمطبخ before service. Do not invent quantities or transfer stock as part of a UI test.

## Isolated acceptance result

Using the actual web components and server engine with a separate in-memory fixture, an order at كاشير القبلي posted once: EGP 80.25 sale, EGP 100 cash and EGP 19.75 change. Insufficient cash was blocked. Selected rice deducted from k2 (9 → 8 kg); unselected pepper stayed 10 kg and the other kitchen was unaffected. The ticket appeared only in the matching queue, retained the order note and completed New → Preparing → Ready → Collected (revision 3). All kitchen steps left stock unchanged.

A full EGP 80.25 linked refund was accepted once; financial totals changed from gross/net 160.50 to gross 160.50, corrections 80.25 and net 80.25. Stock remained unchanged and the collected ticket remained. Both 80 mm and A4 receipt previews showed the correct POS/kitchen, line price, cash/change and note. No physical printer was paired, so paper/driver/cutter output remains a client-device check. These transactions exist only in the isolated fixture, not the hosted client records. Screenshots: outputs/POS-Acceptance-20261022.

## Findings fixed

Returning to POS/KDS previously selected the first counter/kitchen. Device preferences now remember the explicit selection across navigation and refresh, keyed by screen, organization and generation. Removed/inactive saved selections require a new choice rather than silently switching. Preferences contain IDs only and are excluded from recovery.

After a POS routing/configuration change, only an empty draft can align its routing, using the existing revision-checked cart save. Filled unpaid drafts retain their original routing and require review/clear or a compatible price refresh; checkout/addition are blocked while configuration differs. Paid outbox records are unaffected. A concurrent edit from another tab cannot be overwritten by empty-cart alignment.

## Verification

390 distinct tests passed across 75 files: the main run passed 382 tests/74 files but hit a worker startup timeout for count-offline.test.ts; its isolated rerun passed all 8 remaining tests. The 25 relevant POS/context/offline/finance tests include five new regressions. Hosted verification is pending. Production/offline and hosted builds pass. Isolated browser checks confirmed remembered Qibli POS and kitchen across navigation and page reload. Physical printer and human client acceptance remain pending.
