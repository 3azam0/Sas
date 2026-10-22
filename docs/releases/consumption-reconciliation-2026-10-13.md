# Phase 4C3 — period consumption reconciliation

Delivered **التقارير والتحليلات → مطابقة الاستهلاك**. Unique accepted sales and pinned recipe versions provide theoretical quantities for every ingredient, stopping at stocked preparations. Finalized physical counts at the exact period boundaries provide actual consumption, independently checked against ledger consumption and physical count differences. Transfers, purchasing/returns, recorded waste and preparation conversion are excluded from sales consumption. Selective required/deducted/missing quantities remain separate and historical shortages are never backfilled.

Missing/mis-timed physical counts, late/backdated stock, manual balance edits, unknown movements, missing recipes and ledger/balance/layer discrepancies leave actual/variance unavailable with reasons. Comparative values use a common remaining-stock average at the closing count; zero cost is valid and zero remaining stock is unpriced. Summary coverage excludes incomplete/unpriced comparisons and quantities with different units are never summed. Signed top-ten variance values, kitchen/location/category/material/search filters, sorting, server pagination, full CSV, current-page printing and existing report cache are included. Guidance, charts and sections are collapsible.

Report switching now hides an old response synchronously when its query differs from the selected tab/filters. Live verification caught an initial table-schema mismatch; a regression was added and the final release passes tab-switch checks. Worker versions 61/62 were intermediate and are superseded by version 63.

## Verification

- Full unit/integration suite: **329 tests across 62 files passed** with two workers. An earlier unrestricted full run alongside the production build timed out in setup and was stopped; the bounded run completed.
- Subsequent report-cache/reconciliation run: **18 tests passed**, including the additional stale-table regression; **330 distinct tests** covered across these runs.
- Final TypeScript, Next production build (44 offline assets) and hosted bundle passed.
- Isolated posting tests prove 20 theoretical versus 23 actual, unchecked ingredients, multiple units, zero/missing costs, more than 100 historical receipts, repeated-import deduplication, missing/late counts, independent mass balance, tenant/generation checks, filtering, sorting/paging and unchanged stock on reads.
- Live: monthly main-warehouse report contains **51 material/location comparisons**, all incomplete because the trial has no finalized physical counts. Actual and variance stay blank; cards show incomplete instead of zero. A chicken search shows 149.35 kg theoretical, 90 kg recorded consumption and 59.35 kg immutable sales shortage. Recorded consumption may include historical direct issues; the selected-material required total is separate.
- Complete CSV contains all **51 data rows**, comparison headers, exact shortage quantity and count explanations. Kitchen filter with all-location scope correctly returns the empty kitchen stock period. Tab switching, search, name sorting, page-size controls and expanding/collapsing guidance work. Desktop 1280px and mobile 390×844 show no page horizontal overflow; the wide table scrolls internally. No new runtime warnings/errors were captured after the final deployment.
- Browser checks performed reads, navigation and local exports only. No client count, sale, receipt, issue, balance, recipe or catalog record was posted, reset or edited.

## Deployment

- Branch: `feat/period-consumption-reconciliation`, based on kitchen/POS checkpoint `b032421`.
- Hosted build: **a118debb99abcb76**.
- Supabase `fodo-api`: active version **14**, bundle hash `d25cd5293e40ef18aa1844985411d472f98461173b547176bbfbc628e8db1efd`.
- Cloudflare version **63**: `2d8954cc-92d6-4139-96c4-d53c16d4f2da`.
- Deployment `a45e7f30-0712-4d73-981e-53b1144718a9`, verified at 100% traffic, `2026-10-13T14:10:02.994495Z` (17:10 Cairo).
- Live: https://fodo.am-agent2026.workers.dev/
- Existing custom Auth, RLS, bindings, compatibility settings and observability retained. No migration, new credentials or offline/recovery format changes.
- Screenshots outside the repository: `outputs/Consumption-Reconciliation-20261013/desktop.png` and `mobile.png`.

This is consumption reconciliation, not financial corrections, automatic shortage settlement, period locking or net-profit accounting. Financial corrections and expenses remain next slices. GitHub publication remains pending the previously recorded Windows credential-helper issue; hosted deployment does not imply a main-branch merge.
