# Financial reporting — 16 October 2026

The **المصروفات والنتيجة التقديرية** report includes full-range dated sales corrections, net operating expenses, full recipe estimates and a clearly estimated operating result. Its details have server sorting/pagination/CSV/cache and expense-category chart drill-down. Corrections are booked on their own date and may relate to earlier sales; original consumption remains. Missing recipe prices are incomplete, not zero. See [expense rules](./Expenses.md) and [sales corrections](./Financial-Corrections.md).

# BI dashboard and reports

The home page now opens with daily actions. Expand **ملخص أداء الأعمال** to load its analytics, or use **التقارير والرسوم** for the dedicated report screen. Reports remain read-only and retain their existing date filters, scopes and definitions.

**مطابقة الاستهلاك** compares pinned-sales requirements with independently verified physical-count consumption per material/location, with signed variance charts and explicit incomplete reasons. Unlike the current inventory report, it reconstructs its comparative cost at the closing count. See [period reconciliation](./Consumption-Reconciliation.md).

**سجل صرف المطابخ** provides complete accepted supply documents with daily/ranked charts and allocated unit costs, separately from consumption. See [kitchen supply report](./Kitchen-Supply-Report.md).

Open **نظرة عامة** for current inventory value and period kitchen consumption, waste and net sales, with daily trends and category/kitchen rankings. Open **التقارير والتحليلات** for inventory, kitchens, purchasing/returns, waste/count adjustments, sales/recipe estimates and production. The current warehouse selector applies by default; **كل مواقع المؤسسة** expands the report to the tenant's locations.

Use Today, Last 7 days, This month, Last 30 days or a custom inclusive business-date range, up to 366 days. Period metrics compare with the preceding equal-length period. Inventory balances remain current at report generation; selecting an old date does not reconstruct historical stock. Catalog names/categories/unit display names are current metadata. Accepted transaction amounts remain their posted costs.

Filter by category, material/menu item, supplier, kitchen, sales POS or search where relevant. Supplier-free receipts have a separate option. Sorting and paging are on the server; totals and charts use the complete filtered range, independently of the visible page. Rankings show the top ten. Click a bar, its named button, a KPI or a date to open filtered details. Enter/Shift+Enter move through report fields; Tab retains normal navigation, and Ctrl/Command+Enter refreshes the filters. Chart lists and detail/daily tables provide keyboard-accessible alternatives.

## Metric definitions

- Current inventory value sums accepted balance values at the selected locations; unit cost is value divided by positive quantity. Unknown cost is a dash; known zero remains zero.
- Kitchen consumption sums historical immediate-consumption issues and selected sales issues from kitchen stock locations. New kitchen supply transfers are excluded; incoming/outgoing supply cards show them separately.
- Purchasing shows received inventory value, reversed receiving, supplier returns and net receiving (received minus reversals minus returns). Supplier-reference return value is shown separately from stock valuation. These are not payments or supplier debt.
- Waste sums waste postings. Positive/negative physical-count adjustments remain separate. Preparation waste belongs to its production batches.
- Net sales uses accepted, uniquely keyed sales details, after discounts and without tax. Repeated import files add no revenue twice.
- Recipe cost and margin are estimates using the pinned recipe quantities and **current** stock averages, respecting stocked preparations. Missing required versions or prices make the estimate incomplete; an empty period has zero sales/cost and no food-cost percentage. Estimated margin is revenue minus estimated recipe cost, not net profit.
- Actual selected-material sales deduction is separately labelled for the selected location, POS (where selected) and period; it is not allocated to an individually filtered dish. Never add kitchen issues and recipe estimates as two expenses for the same goods.
- Accepted sales shortages show required, deducted and missing base quantities by material for the selected location/period/POS. Charts separate units; never sum kg, litres and counts. Later receiving does not backfill accepted shortages. Clicking a shortage material opens its current inventory report.
- Production reports follow the **output** location, with input cost, preparation waste, actual output quantity/unit cost and output attainment. Input conversion to prepared stock is not automatically a sales expense; attainment is not a mass-yield percentage.

## Offline and exports

The app caches the last 24 report responses per tenant in the existing IndexedDB preferences store, keyed by tenant, generation, report kind, dates, filters, sort and page. Cached results show their actual generation time. Unloaded periods/pages need a connection; use **آخر فترة محفوظة** where available. Local pending operations remain excluded until server acceptance. A data-generation change invalidates earlier report responses; the reporting cache uses the v2 prefix following kitchen consumption semantics; operational recovery is format 17 and IndexedDB remains version 11. Caches are read-only reports, not a backup of the stock ledger.

CSV export fetches every matching page (up to 10,000 rows), preserves exact decimal strings and rejects an export if the underlying accepted checkpoint changes mid-download. Narrow filters for larger exports. Offline export requires every relevant page already cached. Sales exports include the period/location shortage section. Spreadsheet formula-like text is escaped. **طباعة / PDF** uses browser printing: summaries/charts and the currently visible detail page, with that limit stated on the printout. It is not a full-history PDF export.

Server reporting reads accepted records within tenant authorization and the existing RLS role. The API is same-origin authenticated POST with generation validation and no shared response cache. Dates cannot be in the future. SQL parameters bind user filters; sort expressions/table validation come from fixed allowlists. Report reads do not post or change stock.

Hosted shell updates fetch versioned public assets before activating and store the new root under the canonical address. This prevents an older service worker from seeding a new cache with old HTML. Navigation requests reload the network when connected; offline fallback reads only the current shell cache. Authenticated API responses remain excluded. Business IndexedDB data is not cleared.
