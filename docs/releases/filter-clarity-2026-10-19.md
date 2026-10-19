# Filter clarity — 19 October 2026

Inventory and shared operational collections now use one compact filter toolbar with named controls, searchable category/supplier/kitchen choices, removable active selections and a single reset including sorting. Mobile secondary controls collapse while active selections and scope remain visible. Filtering/sorting still happens before pagination; inventory preserves the original material denominator even when its parent filters rows. Empty results reset the entire list consistently.

Inventory distinguishes zero, inactive, below-minimum and positive balances. Zero quantity never appears as available. Whole-location KPI cards are explicitly separate from the filtered material list. No inventory posting, decimal costing or shortage policies changed.

Operational dated lists and reports share inclusive Cairo-date presets. Reports still apply filters automatically, retain complete-range/server-backed totals, and offer an explicit fresh-data refresh. Reset restores the current month/current location/default sort while keeping the report kind/page size. Searchable filters include All without altering transactional selectors. Existing Enter/Shift+Enter navigation and Ctrl/Cmd+Enter refresh are retained. The 24-topic in-app guide and developer plan are updated.

## Release

- Branch: feat/filter-clarity; source checkpoint 9835f65664a39ef2108bf7beaa5598055551be24.
- Hosted build: 0d49168fd10bf5f5; Cloudflare version 80: e37ef7df-017c-4112-9976-f00c18819a89.
- Deployment 404f1f3f-20d0-4b51-8837-5ef8c6dbbc19 routes 100% to version 80, confirmed by API readback and the public health response. Existing bindings and sales stock/shortage policies remain unchanged.
- Supabase API remains 15; Windows printing helper remains 1.0.0. No schema, authorization, data-generation or offline storage-format changes.

## Verification

TypeScript and production/offline/hosted builds passed; the offline manifest contains 45 build assets. All 373 tests in 71 files passed. Six new tests cover exact stock classification, inclusive cross-year/leap-year periods, accessible named filter chips/reset, the upstream-filtered original denominator and filter-only empty options.

Browser verification used the actual compiled hosted frontend against an isolated synthetic local API (75 materials, 32 receipts), with fake local credentials. Verified desktop and 390×844 phone layouts, no horizontal page overflow, dropdown bounds, type/arrows/Enter selection, choosing All, page-two filtering returning to page one, nondefault sorting/reset, combined category/zero filters, empty results/reset, invalid date feedback, receipt supplier/date combinations (6 of 32), automatic report filtering (19 of 75), report reset and Enter/Ctrl+Enter. No browser console warnings/errors were observed in the final bundle. Synthetic API data does not establish backend report calculations, which remain covered by the regression suite. No client transaction was posted or reset. Physical offline-network simulation was not repeated.

[Inventory desktop](../../../Filter-UX-20261019/inventory-desktop.png) · [Inventory phone](../../../Filter-UX-20261019/inventory-mobile.png) · [Reports phone](../../../Filter-UX-20261019/reports-mobile.png).

The live page loaded the matching versioned JS asset. Its cached client catalog showed 287 zero-balance materials out of 338 with the new filter controls, count denominator and zero badges. The existing client session had expired and bootstrap could not refresh; hosted checks were read-only against its preserved cache, without credential entry or session reset. This does not claim a fresh authenticated backend report check. [Hosted inventory](../../../Filter-UX-20261019/hosted-inventory.png).

GitHub publication/remote CI remain pending. The initial sandbox DNS restriction was resolved by granting network access; the retry then failed because Windows could not run Git Credential Manager (NtCreateDirectoryObject access denied), leaving terminal authentication unavailable. Human client acceptance remains pending.
