# Filter clarity — 19 October 2026

Inventory and shared operational collections now use one compact filter toolbar with named controls, searchable category/supplier/kitchen choices, removable active selections and a single reset including sorting. Mobile secondary controls collapse while active selections and scope remain visible. Filtering/sorting still happens before pagination; inventory preserves the original material denominator even when its parent filters rows. Empty results reset the entire list consistently.

Inventory distinguishes zero, inactive, below-minimum and positive balances. Zero quantity never appears as available. Whole-location KPI cards are explicitly separate from the filtered material list. No inventory posting, decimal costing or shortage policies changed.

Operational dated lists and reports share inclusive Cairo-date presets. Reports still apply filters automatically, retain complete-range/server-backed totals, and offer an explicit fresh-data refresh. Reset restores the current month/current location/default sort while keeping the report kind/page size. Searchable filters include All without altering transactional selectors. Existing Enter/Shift+Enter navigation and Ctrl/Cmd+Enter refresh are retained. The 24-topic in-app guide and developer plan are updated.

## Release

- Branch: feat/filter-clarity; source checkpoint pending.
- Hosted build: 0d49168fd10bf5f5; deployment pending.
- Supabase API remains 15; Windows printing helper remains 1.0.0. No schema, authorization, data-generation or offline storage-format changes.

## Verification

TypeScript and production/offline/hosted builds passed; the offline manifest contains 45 build assets. All 373 tests in 71 files passed. Six new tests cover exact stock classification, inclusive cross-year/leap-year periods, accessible named filter chips/reset, the upstream-filtered original denominator and filter-only empty options.

Browser verification used the actual compiled hosted frontend against an isolated synthetic local API (75 materials, 32 receipts), with fake local credentials. Verified desktop and 390×844 phone layouts, no horizontal page overflow, dropdown bounds, type/arrows/Enter selection, choosing All, page-two filtering returning to page one, nondefault sorting/reset, combined category/zero filters, empty results/reset, invalid date feedback, receipt supplier/date combinations (6 of 32), automatic report filtering (19 of 75), report reset and Enter/Ctrl+Enter. No browser console warnings/errors were observed in the final bundle. Synthetic API data does not establish backend report calculations, which remain covered by the regression suite. No client transaction was posted or reset. Physical offline-network simulation was not repeated.

[Inventory desktop](../../../Filter-UX-20261019/inventory-desktop.png) · [Inventory phone](../../../Filter-UX-20261019/inventory-mobile.png) · [Reports phone](../../../Filter-UX-20261019/reports-mobile.png).

GitHub publication/remote CI remain pending after the earlier Windows Credential Manager restriction. Human client acceptance remains pending.
