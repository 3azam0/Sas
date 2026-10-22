# Recharts BI reports — 12 October 2026

**نظرة عامة** now presents current inventory value, period kitchen consumption, waste and net sales, with equal previous-period comparisons, daily trends and category/kitchen rankings. **التقارير والتحليلات** provides inventory, kitchens, purchasing/returns, waste/count adjustments, sales/recipe costs and production reports. Chart, KPI and named ranking actions open filtered details. Date presets/custom dates, location scope, relevant entity/search filters, server sorting/pagination, complete CSV export and current-page print/PDF are included. Arabic RTL, keyboard alternatives and responsive layouts are retained.

The authenticated `POST /api/v1/reports` reads complete accepted history independently of the operational snapshot limit. It binds tenant/filter parameters, validates organization generation and reads within a transaction using existing RLS authorization. Current stock value is distinct from period flows. Posted stock costs, supplier-reference return values, current-price recipe estimates, actual selected-material deductions and shortages have separate definitions. Missing recipe prices remain explicit, and quantities with different units are never combined.

Sales shortage reporting uses immutable accepted import results, showing required/deducted/missing quantities by material. Later receipts do not backfill those shortages. Sales still follow the agreed selective partial-deduction behavior. Production details show input cost, preparation waste, output quantity/unit cost and attainment. Reports are read-only and do not alter posting rules or client stock.

Up to 24 exact-query responses per tenant/generation are saved in the existing IndexedDB preferences store. Cached results show their generation time; pending outbox operations remain excluded. Unvisited ranges/pages need a connection. Full CSV export supports up to 10,000 filtered rows, preserves decimal strings, escapes spreadsheet formula-like text and rejects changes to the accepted checkpoint while paging. Offline export requires all relevant pages cached. Printing explicitly covers the currently visible detail page.

Hosted public shell installation now fetches versioned assets before activating, so an older controlling service worker cannot seed the new cache with stale root HTML. Navigation reloads the network when connected and falls back to only the current shell cache when offline. Authenticated APIs stay outside the shell cache; business IndexedDB data is preserved.

## Verified delivery

- Branch: `feat/bi-reports-recharts`, based on category/navigation checkpoint `0dfccaf`.
- Dependencies: Recharts `3.10.1`, matching `react-is 19.3.0`.
- TypeScript, Next production build, 43-asset local offline manifest and Cloudflare bundle passed.
- Full suite: **297 tests in 53 files passed**. Two subsequently added hosted-shell tests and the three report-cache tests also passed in a targeted run: **299 distinct tests covered across 54 files**.
- Cloud build: `dbd3909fa7cb0e9c`.
- Cloudflare Worker version: `33eb97d0-f6a0-4f99-9901-11f3b55b8046`.
- Cloudflare deployment: `f4f41882-e1fa-49ce-b4bd-a7852109116e`, verified at 100% traffic, published `2026-10-12T16:19:45.807763Z`.
- Supabase `fodo-api`: version **11**, active; bundle SHA-256 `05c0469f334b99acdcd8ffb7dae7f561aa7257fd6dfcc830f5aa53886197c897`.
- Live: https://fodo.am-agent2026.workers.dev/
- No database schema, Dexie version or recovery-format migration.

Automated checks cover history beyond 100 records, complete totals independent of pagination, tenant/generation/session isolation, equal previous periods, parameterized filters, accepted sales deduplication, missing prices, exact CSV values/formula escaping, posted production costs, signed return/reversal valuation, immutable shortages, read-only empty periods, cache reopen and invalidation, same-origin API forwarding and versioned public-shell installation/offline fallback. No shared report cache or new stock posting path was introduced.

Read-only hosted SQL and browser checks matched the first client's current stock value **196,820.65 EGP**, kitchen consumption **48 EGP**, waste **30 EGP** and net sales **112,960 EGP** for 1–12 October. Purchasing showed 58 detail rows, received stock value 10,545 EGP, returns 75 EGP and net receiving 10,470 EGP. The accepted sales shortage showed 126 kg required, 66.65 kg deducted and 59.35 kg missing. Production displayed both trial sauce batches, including 8 kg at 100% attainment and 7.6 kg at 95%, with their output unit costs.

Hosted browser checks covered chart drilldown, category/supplier filters, inventory page 2, six report tabs, Enter/Shift+Enter filter navigation and complete CSV download. The CSV contained all **338 inventory rows**, with exact value sum **196,820.650000000000 EGP**, rather than just the visible page. At 390 × 844 the document had no horizontal overflow; wide detail tables scrolled within their container. The canonical URL loaded the final `dbd3909fa7cb0e9c` JavaScript after the shell correction, with no captured browser console errors in the final check.

The browser connector cannot emulate network-offline mode. Cached report reopen/generation/session behavior and shell offline fallback were verified by automated tests; this release does not claim a manual browser offline-network toggle test. Printing is current-page browser printing, not a full-history PDF exporter. The existing local-server launch limitation remains separate from the successful build and hosted checks.

The temporary client trial data and normal workflows remain available. Verification performed report reads, navigation and exports only; no material, receipt, sale, issue or balance was posted. Screenshots are beside the repository in `outputs/BI-Reports-20261012/`: `overview-desktop.png`, `overview-mobile.png` and `sales-shortage-desktop.png`.

Developer Guide **2.38**, Hosted Release, Master Plan and the [BI operating guide](../runbooks/BI-Reports.md) record the delivered scope and metric definitions. GitHub publication remains pending the existing credential-helper repair; this hosted deployment is not a main-branch merge.
