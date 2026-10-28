# Stock card

Open **المبيعات والتقارير → التقارير والتحليلات → بطاقة صنف**, or click a material name in the inventory-value report. Select a material in **مادة بطاقة الصنف**, then the business-date range and current/all-location scope. The default detail order is oldest first.

The report reads the complete accepted stock ledger, independently of the latest operational snapshot. Per-location opening quantity is the sum of accepted movements dated before the start. Incoming/outgoing quantities cover the inclusive range; closing is opening plus incoming minus outgoing. Each detail row retains its numeric ledger sequence, quantity before/after the movement, reference, signed posted value and actual unit cost. Balances are partitioned by location and material. Quantities in transit remain outside location stock until receipt.

Running quantities are computed over complete material/location history through the end date, ordered by business date then numeric ledger sequence. Search is applied afterward to detail references, identifiers, names/codes and location names. Searching, sorting or changing pages never recalculates a balance from the visible subset. The opening/closing table continues to describe the entire selected period, including movements hidden by search.

This is a quantity card, not a reconstruction of historical FIFO layers or a repricing of old transactions. Backdated accepted movements can change a business-date balance when the report is refreshed; posting sequence still governs actual FIFO costs. Display names and unit labels use current catalog metadata. A zero-activity period can still have opening/closing stock. No selected material produces a selection prompt, not a combined balance across different units.

CSV contains complete per-location balances and all matching movement rows up to the existing export limit, preserving exact decimal strings and numeric sequence identifiers. It checks an unchanged accepted checkpoint between pages. Printing includes complete period balances and only the visible movement page, with that limit stated. Loaded queries/pages remain available in the tenant/generation-scoped report cache; an offline empty card can use **آخر بطاقة محفوظة** or **آخر فترة محفوظة** to restore the last loaded card for the location scope.

The report is read-only and retains existing authorization, tenant/generation validation, date limits and bound SQL filters. It creates no stock operations, schema changes, outbox entries or recovery-format changes.
