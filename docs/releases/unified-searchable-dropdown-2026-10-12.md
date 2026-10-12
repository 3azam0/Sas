# Unified searchable dropdown — 12 October 2026

FooDo now uses a single visible catalog combobox in receiving, waste, opening stock, purchase drafts, recipe materials/outputs/subrecipes, production versions, sale recipe mapping and kitchen issues. The selected label and editable query share one field. The stored ID, form name, controlled value and forwarded native-select ref remain separate from search text.

Click/focus opens the catalog and typing filters by Arabic name or code. Arrows skip disabled choices; Enter selects and advances, while clicking selects without jumping. Enter on the unchanged item advances. Tab, Shift+Enter, Escape and unmatched searches retain the selected ID. Duplicate options stay disabled. Required/document errors describe and focus the visible field; hidden selects cannot add a keyboard stop. Kitchen Enter-after-quantity still advances/adds a row. The Arabic keyboard guide and developer guide v2.32 document these behaviors.

Results use a fixed popup outside scrolling table/form bodies, inside the dialog top layer when necessary. Popup position follows scrolling, resize and visual viewport changes. Lookups use the already downloaded tenant snapshot; no remote search, database, backend, authorization or stock-posting changes were introduced.

- Hosted URL: https://fodo.am-agent2026.workers.dev/.
- Final hosted build: `aa956274629ee406`, confirmed in the loaded browser asset.
- Cloudflare deployment: `df4b47f4b9aa43e09d73d6a54869018f`; upload succeeded with HTTP 200 and retained existing settings/bindings.
- Local Next production build, TypeScript and hosted build passed; offline manifest contains 42 assets.
- Existing unit/integration suite: 264 tests in 47 files passed. New control markup/search tests plus keyboard policy checks: 6 tests in 2 files passed after the final control changes. An initial direct test invocation hit the Windows temporary-directory restriction; using the repository's compatibility/temp configuration resolved it.
- Browser fixture selectors now choose through the visible combobox. Added a regression for uncommitted queries, disabled duplicates, keyboard movement and no implicit stock posting, and updated the 328-item offline/phone fixture. These Playwright fixture specs were not run here: the browser could not reach the isolated localhost preview. Hosted verification below covers draft interactions; a fresh full offline fixture run remains a separate verification limit.
- Hosted draft checks passed for all eight affected workflows: focus-open 338-item catalog, Arabic/alef search, code and full-label search, mouse selection, arrows/Enter, preserved no-match searches, Tab/Shift+Enter, Escape, disabled duplicates, Alt+Insert, visible required-item focus, React Hook Form waste item/unit changes and kitchen row advancement. Purchase results render outside the scroll table. No valid document/setup action was submitted.
- Desktop and 390×844 phone screenshots were visually inspected. The phone popup fits its field and viewport with no document horizontal overflow. Viewport override was reset and every draft closed. No new console errors were observed.
- Client overview remained 338 materials, 196,868.65 EGP inventory value and zero pending operations. Screenshots are in the sibling `outputs/Unified-Dropdown-20261012` directory.
- Local branch: `feat/unified-searchable-dropdown`, stacked from `8a9fad3`. Remote source publication remains pending the previously verified Windows Git credential-helper restriction; hosted deployment is verified independently. Use the existing normal Windows publishing workflow when that helper can authenticate.

See [form controls and keyboard walkthrough](../runbooks/UI-Forms.md).
