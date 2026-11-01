# Butchery yield and cost report

Open **المبيعات والتقارير → التقارير والتحليلات → مردود وتكلفة الجزارة**, or **المطابخ والتحضير → الجزارة → تقرير المردود والتكلفة**. The shortcut retains the current stock location and date range and starts with all processing modes. Select beef, sheep or all modes; optionally filter the raw material/category or search a batch reference, identifier or input/output material name/code.

The report reads every accepted `butchery.process` batch in the inclusive date range. Product definitions/classifications and pending local documents are excluded. Paging is on batches; totals and rankings cover all matching batches. A search matching one output includes the complete batch and all its allocated outputs. Raw-material/category filters refer to the input, not a selected product's share of a batch.

## Weight and yield definitions

- Beef: usable output divided by purchased beef input weight.
- Sheep: usable output divided by live weight; carcass/live and usable-output/carcass percentages are shown separately.
- Slaughter and cutting losses remain separate. Output weights and losses follow the accepted batch's mass-balance rules.
- Summaries keep beef and sheep separate and divide summed weights. They never average batch percentages or compare beef input with live sheep as one yield.
- No batches means zero counts/weights/costs and unknown yield/unit cost, never division by zero. Empty modes start collapsed.

## Costs

Input cost, processing charges, total cost, product cost shares, allocated amounts and product unit costs come from accepted batch records. Later receipts, catalog renaming or current stock averages do not reprice them. Zero-share by-products retain a known zero cost. The summary's average output cost divides total accepted batch cost by all usable output kilograms; each product retains its own allocated cost/kg. Neither figure is a selling price or profit.

The preceding equal-length period uses the same filters for cost/count comparison. Rankings use total accepted batch cost by raw material. Selecting a raw-material ranking retains the selected processing mode. The mode filter is confined to this report; overview, sales and other report shortcuts never inherit it.

## Exports and offline use

CSV separates batch rows from allocated-product rows so repeated batch costs cannot be confused with additional expenses. It preserves exact decimals, escapes spreadsheet formula text, checks the accepted checkpoint across pages, and limits the combined batch/product export to 10,000 rows. Print preview shows complete filtered summaries and every product on the current batch page, even if screen details were collapsed; it states the page-only detail limit.

Loaded report queries/pages use the existing tenant/generation cache. New periods/pages require a connection. The report is read-only, uses existing tenant-protected tables and does not change stock valuation, posting order, schema, Dexie or recovery 23.
