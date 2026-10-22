# Shared document forms — 12 October 2026

Operational forms now use the accepted stock-issue pattern: compact document details, clear material cards, labeled phone rows, optional explanations and a persistent summary beside Save/Cancel. The body scrolls inside a native dialog while its title and actions remain visible. Receiving keeps its existing dialog and shows converted quantity, line value and estimated stock after acceptance. Purchase drafts and opening stock use material cards; count/source/production/sales tables retain desktop columns and become labeled rows on phones. Recipes show the estimated complete batch cost and the separate number of selected sales-deduction ingredients. Production and supplier returns show quantity warnings beside the affected input. Setup, balance editing and waste use consistent labels and summary/action footers.

The pattern covers receiving, opening stock, purchase drafts/partial receiving, supplier returns, transfer dispatch/receiving/loss, count editing, recipes, production, sales menu mapping/import and supporting editors. Search, filters, ordering and paging remain available where needed. Plain short line lists hide unnecessary collection controls. Enter/Shift+Enter, Ctrl/Command+Enter, Alt+Insert and disabled confirmations retain their existing behavior. Optional CSV/cost help scrolls inside the body instead of pushing Save below the viewport.

Purchase totals now sum usable rows with exact decimals. Adding an empty row preserves completed amounts and labels the estimate incomplete; an explicitly entered zero cost is valid and differs from blank cost. This display helper does not alter purchase validation or posting. Stock posting, supplier/production/kitchen shortages, sales partial deduction, tenant scope, authentication, database schema, offline grants/outboxes/recovery and the local launcher remain unchanged.

## Release and validation

- Hosted URL: https://fodo.am-agent2026.workers.dev/.
- Loaded hosted build: `3d3d4f4a6a6b8b37`; Cloudflare deployment `908496e7c3234bbb9d008876ae6113fc`. Upload returned HTTP 200; existing Worker settings/bindings were retained. Supabase API was not redeployed.
- Next production build, TypeScript and hosted bundle passed; local offline manifest has 42 assets.
- Full unit/integration suite passed: 270 tests in 49 files. After the modal and subtotal follow-ups, the focused suite passed 12 tests in four files, including three new exact-decimal subtotal tests. The 12 include existing keyboard/search/stock-preview tests and must not be counted as 12 additional unique tests.
- Receiving draft: two kg at 20 EGP shows 40 EGP, adds two kg and estimates 49.9 kg from accepted 47.9 kg. Desktop and phone footer/overflow checks passed; the final desktop capture was reviewed.
- Purchase draft: Enter advances quantity to cost; adding/removing an empty row retains/restores the 40 EGP subtotal and completeness label. Desktop and 390×844 phone save actions fit inside the viewport. Closing returns focus to the New purchase trigger.
- Supplier return: 100 kg against source availability 21.9 kg shows the 78.1 kg excess, row warning, `aria-invalid` and associated description. Phone cards and footer were inspected.
- Recipe: two kg rice estimates 56 EGP; selecting rice for sales deduction changes the selected count while preserving estimated cost. Ctrl+Enter with empty required identity focuses the name and produces associated errors. The unsaved draft was cancelled.
- Production: existing sauce definition previews 22.88 EGP output cost; an excessive actual input shows its existing shortage warning. Restored quantities show normal estimates; unchecked review keeps Save disabled. Phone footer fits.
- Count: an entered rice quantity remains across search/category/count-state filters and page changes. Phone cards preserve explicit labels and retain the counted/total summary.
- Opening stock: quantity two at cost 20 previews 40 EGP; optional CSV expands inside the body. A 26-row unsaved draft verifies Alt+Insert and cross-page Shift+Enter reveal/focus without losing row-one values.
- Sales: menu mapping fits on phones; a pasted unsaved completed-sale preview shows 100 EGP, one new detail, zero repeats/conflicts and selected stock requirements. Unchecked completion confirmation keeps Save disabled.
- Setup: optional purchase-pack fields and Ctrl+Enter invalid-field focus were checked; the 390×844 save action fits at approximately 817 px. Waste and the original stock-issue editor also fit a 390×640 phone with no document horizontal overflow.
- Every verification draft was cancelled; no valid receipt, issue, count, purchase, recipe, production or sales document was submitted by these checks. Final synchronized overview showed 338 materials, 196,820.65 EGP inventory value and zero pending operations. The current ledger includes a separate accepted one-kg beans issue with reference `المطبخ الرئيسي · فاتورة`, explaining the 48 EGP difference from the earlier recorded overview; that reference was not used in these drafts. Do not describe the refreshed value as unchanged.
- No new browser console errors were observed. Temporary viewport overrides were reset and all dialogs were closed.

## Verification limits and source record

The client has one active stock location and no eligible submitted purchase order with remaining quantities. Transfer and partial-purchase-receiving dialogs were type-checked and share the verified layout, but those flows were not opened or posted against this client's data. Balance editing was disabled in the current client view and was not opened. Use isolated fixtures for those browser regressions. Stock-writing CLI browser scenarios were not run against hosted client data. These checks do not certify every physical device, screen reader or operating-system keyboard.

Developer guide: v2.34. Branch: `feat/document-forms-ux`, stacked from `3a7af5c`. Source changes are committed locally; remote publication remains pending the previously verified Windows Git credential-helper restriction. Hosted publication is independently confirmed and does not merge `main`.

Reviewed screenshots live in sibling `outputs/Forms-UX-20261012`: `04-purchase-desktop.png`, `05-purchase-mobile.png`, `06-return-shortage-mobile.png`, `07-recipe-mobile.png`, `08-count-mobile.png`, `09-sales-preview-mobile.png`, `10-setup-validation-mobile.png`, `11-waste-short-phone.png` and `12-final-receiving-desktop.png`. Earlier receiving captures record the intermediate shared layout; use the final receiving capture for this release.
