# Stock card and butchery reporting — 28 October 2026

## Behavior

**بطاقة صنف** shows opening, incoming, outgoing and closing quantities separately for each location, with business-date running balances and accepted ledger references/costs. It reads complete history before pagination and search. Search hides detail rows without recalculating period balances. Partially received transfers affect each location only on its own posted leg; the remaining transit quantity is outside location balances. Historical FIFO is not reconstructed or repriced.

**مردود وتكلفة الجزارة** reads accepted processing batches, with separate beef and sheep summaries, weighted yields, slaughter/cutting losses, input/processing costs and allocated product costs. Raw-material filters and output-name searches retain whole batches. Later receipts do not change historical costs; zero-share products keep zero cost. The beef/sheep mode filter applies only to this report.

Both reports support filters, sorting, pagination, checkpoint-guarded CSV and print preview. CSV includes all matching rows within the export limit; printing includes full summaries and the current detail page. Product details print even when collapsed on screen. Existing tenant/generation-scoped caches retain loaded queries/pages; offline stock cards can restore the last material card. Inventory report names and the butchery screen link directly to the reports.

See [stock card](../runbooks/Stock-Card.md) and [butchery reporting](../runbooks/Butchery-Report.md) for calculation definitions and limits.

## Verification

- Production build, TypeScript and offline manifest pass.
- Hosted build **08a3ce03557371e6** and isolated Worker dry run pass.
- 35 focused checks covered across seven files and isolated retries: complete accepted history, backdating, numeric sequences, partial transfers, unchanged stock/layers, weighted beef/sheep yields, pagination, zero allocated cost, search/filter/tenant/generation boundaries, exact CSV decimals and cache compatibility. An existing large-history kitchen scenario timed out while a build was running; all four checks in that file passed when rerun alone.
- Three browser scenarios pass: stock-card/butchery shortcuts, accepted values, CSV, print, mode isolation, phone fullscreen and offline card restoration; existing compact kitchen prices/fullscreen/offline behavior; arranged desktop/mobile navigation. The new scenario also passed a final screenshot run. Its first run waited for an unmounted collapsed home-analytics section; the test now explicitly expands that section before checking its request.
- Desktop and phone screenshots were inspected and saved in ignored `.cache/operational-reports-evidence/`. No test transactions were created in live client data.

## Release integrity

This adds read-only report kinds to the existing authorized API. No database migration, stock writes, schema/Dexie upgrade or recovery-format change is needed. Kitchen document-only pricing, actual stock valuation, sheep receiving, butchery posting and recovery 23 remain intact. The backend must support the new kinds before activating the frontend. Previous live release: build **41a7e92847c13ef2**, Worker **97**, Supabase API **20**.
