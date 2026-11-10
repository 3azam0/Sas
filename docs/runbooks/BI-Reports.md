# Compact report workspace — 28 October 2026

**بطاقة صنف** reconstructs per-location opening/incoming/outgoing/closing quantities and full-ledger running balances. **مردود وتكلفة الجزارة** reports accepted beef/sheep batches, weighted yields and historical cost allocations, with a mode filter, CSV and printing. See [stock-card rules](./Stock-Card.md) and [butchery report rules](./Butchery-Report.md).

Choose a report from the grouped **التقرير** selector. The dedicated workspace starts with details; **إظهار الرسوم** adds charts, and **عرض التفاصيل** returns focus to the table. **ملء الشاشة** expands the same report without resetting its filters, page or loaded data; Escape restores the previous size and opener focus. While expanded, the surrounding workspace is inert and keyboard focus stays in the report. The home analytics remain unchanged.

The side menu now groups daily shortcuts, stock operations, kitchens/preparation, sales/reports, settings and help. Open **المبيعات والتقارير → التقارير والتحليلات**. Butchery, recipes and production are under **المطابخ والتحضير**. The active desktop group opens automatically; the mobile menu uses the same groups and still returns focus to its opener on dismissal. Collapsing the sidebar preserves the current report and filters.

Kitchen supply includes document-only prices separately from actual transferred stock cost. Its priced-line total excludes lines whose historical payload has no price; **سطور غير مسعّرة** makes this limit explicit. Zero is a known price. The difference compares document value with actual cost of the same priced lines, not all stock costs and not profit. CSV and print preview retain separate columns. Older cached responses can still be read; refresh online to load their new price fields.

# Financial reporting — 16 October 2026

The **المصروفات والنتيجة التقديرية** report includes full-range dated sales corrections, net operating expenses, full recipe estimates and a clearly estimated operating result. Its details have server sorting/pagination/CSV/cache and expense-category chart drill-down. Corrections are booked on their own date and may relate to earlier sales; original consumption remains. Missing recipe prices are incomplete, not zero. See [expense rules](./Expenses.md) and [sales corrections](./Financial-Corrections.md).

# BI dashboard and reports

The home page now opens with daily actions. Expand **ملخص أداء الأعمال** to load its analytics, or use **التقارير والرسوم** for the dedicated report screen. Reports remain read-only and retain their existing date filters, scopes and definitions.

**مطابقة الاستهلاك** compares pinned-sales requirements with independently verified physical-count consumption per material/location, with signed variance charts and explicit incomplete reasons. It uses comparative cost at the closing count. See [period reconciliation](./Consumption-Reconciliation.md).

**سجل صرف المطابخ** provides complete accepted supply documents with daily/ranked charts and allocated unit costs, separately from consumption. See [kitchen supply report](./Kitchen-Supply-Report.md).

Open **نظرة عامة** for current inventory value and period kitchen consumption, waste and net sales, with daily trends and category/kitchen rankings. Open **التقارير والتحليلات** for inventory, kitchens, purchasing/returns, waste/count adjustments, sales/recipe estimates and production. The current warehouse selector applies by default; **كل مواقع المؤسسة** expands the report to the tenant's locations.

Use Today, Last 7 days, This month, Last 30 days or a custom inclusive business-date range, up to 366 days. Period metrics compare with the preceding equal-length period. The dedicated inventory report uses all posted stock movements through the selected end date. Overview analytics show current inventory balances. Catalog names/categories/unit display names are current metadata. Accepted transaction amounts remain their posted costs.

Filter by category, material/menu item, supplier, kitchen, sales POS or search where relevant. Supplier-free receipts have a separate option. Sorting and paging are on the server; totals and charts use the complete filtered range, independently of the visible page. Rankings show the top ten. Click a bar, its named button, a KPI or a date to open filtered details. Filters apply automatically; «تحديث التقرير» retrieves fresh data. Active chips remove one criterion; «مسح الكل» restores this month/current location/default sort and keeps the report kind/page size. Dates and secondary fields expand under «الفلاتر» on phones; applied chips and scope remain visible. Category/material/supplier/kitchen/POS selectors support typing and arrows/Enter, including All. Enter/Shift+Enter move through report fields; Tab retains normal navigation, and Ctrl/Command+Enter refreshes the filters. Chart lists and detail/daily tables provide keyboard-accessible alternatives.

## Metric definitions

- The inventory report sums signed posted quantities and values through the end date for each selected location and material. A positive quantity with nonnegative value has a unit cost of value divided by quantity. The overview uses current balances.
- Kitchen consumption sums historical immediate-consumption issues and selected sales issues from kitchen stock locations. New kitchen supply transfers are excluded; incoming/outgoing supply cards show them separately.
- Purchasing shows received inventory value, reversed receiving, supplier returns and net receiving (received minus reversals minus returns). Supplier-reference return value is shown separately from stock valuation. These are not payments or supplier debt.
- Waste sums waste postings. Positive/negative physical-count adjustments remain separate. Preparation waste belongs to its production batches.
- Net sales uses accepted, uniquely keyed sales details, after discounts and without tax. Repeated import files add no revenue twice.
- Recipe cost and margin are estimates using the pinned recipe quantities and **current** stock averages, respecting stocked preparations. Missing required versions or prices make the estimate incomplete; an empty period has zero sales/cost and no food-cost percentage. Estimated margin is revenue minus estimated recipe cost, not net profit.
- Actual selected-material sales deduction is separately labelled for the selected location, POS (where selected) and period; it is not allocated to an individually filtered dish. Never add kitchen issues and recipe estimates as two expenses for the same goods.
- Accepted sales shortages show required, deducted and missing base quantities by material for the selected location/period/POS. Charts separate units; never sum kg, litres and counts. Later receiving does not backfill accepted shortages. Clicking a shortage material opens its inventory report. Menu-item selection and sales search filter the sales rows; shortages stay scoped to the location, period and POS because they are recorded by material.
- Production reports follow the **output** location, with input cost, preparation waste, actual output quantity/unit cost and output attainment. Input conversion to prepared stock is not automatically a sales expense; attainment is not a mass-yield percentage.

## Offline and exports

The app caches the last 24 report responses per tenant in the existing IndexedDB preferences store, keyed by tenant, generation, report kind, dates, filters, sort and page. Cached results show their actual generation time. Unloaded periods/pages need a connection; use **آخر فترة محفوظة** where available. Local pending operations remain excluded until server acceptance. A data-generation change invalidates earlier report responses; the reporting cache uses the v2 prefix following kitchen consumption semantics; operational recovery is format 17 and IndexedDB remains version 11. Caches are read-only reports, not a backup of the stock ledger.

CSV export fetches every matching page (up to 10,000 rows), preserves exact decimal strings and rejects an export if the underlying accepted checkpoint changes mid-download. Narrow filters for larger exports. Offline export requires every relevant page already cached. Sales exports include the period/location shortage section. Spreadsheet formula-like text is escaped. **طباعة / PDF** uses browser printing: summaries/charts and the currently visible detail page, with that limit stated on the printout. It is not a full-history PDF export.

Server reporting reads accepted records within tenant authorization and the existing RLS role. The API is same-origin authenticated POST with generation validation and no shared response cache. Dates cannot be in the future. SQL parameters bind user filters; sort expressions/table validation come from fixed allowlists. Report reads do not post or change stock.

Hosted shell updates fetch versioned public assets before activating and store the new root under the canonical address. This prevents an older service worker from seeding a new cache with old HTML. Navigation requests reload the network when connected; offline fallback reads only the current shell cache. Authenticated API responses remain excluded. Business IndexedDB data is not cleared.
