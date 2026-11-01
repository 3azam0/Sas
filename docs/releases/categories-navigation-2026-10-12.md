# Categories, navigation and actual inventory unit cost — 12 October 2026

Material categories previously used a native datalist that could hide unrelated entries while showing the selected text. Add/Edit material and the receiving material child form now use the shared searchable combobox. Focus shows all categories from the full tenant item snapshot; search filters Arabic names, and **إضافة فئة جديدة** supports click, arrows/Enter, F2 and unmatched-search Enter. The child dialog validates 2–100 characters, normalizes whitespace, reuses an existing normalized category instead of duplicating it, and restores focus to the parent field. Its value remains a parent draft until the material is saved through the existing setup outbox. Cancelling either draft writes no category. Categories remain flat strings on material records; this release does not introduce a standalone empty-category directory.

The desktop side menu groups every existing view exactly once: daily operations (overview, inventory, kitchen issues, sales); inventory management (purchasing, suppliers, returns, transfers, counts, opening stock, movement history); costs/preparation (recipes, production); settings/follow-up (inventory setup, synchronization). It scrolls independently and preserves current-view highlighting and sync badges. Phone navigation retains its horizontal layout and the same view IDs.

The inventory column is renamed **تكلفة الوحدة الفعلية** and shows confirmed inventory value ÷ confirmed quantity, in EGP per base inventory unit, up to four decimal places. Its sorting and explanatory formula use the existing confirmed balance average. Unknown cost remains a dash; entered zero cost remains zero. No selling price, receipt price or posting calculation is added.

## Verified delivery

- Branch: `feat/categories-navigation-unit-cost`, based on receiving checkpoint `46f6e8f`.
- TypeScript, Next production build and 42-asset offline manifest passed.
- Full suite: **283 tests in 51 files passed**; three added checks cover category list completeness/normalization and all 15 navigation views exactly once.
- Cloud bundle: `79473d8ade88d6b2`.
- Cloudflare Worker version: `148d0b61-f804-444b-a2cd-6e79d48f57c7`.
- Cloudflare deployment: `4c8f786f-639e-499e-97a4-9820b6026501`, confirmed at 100% traffic.
- Supabase `fodo-api` remains version 9; no backend or schema deployment was required.
- Live: https://fodo.am-agent2026.workers.dev/

Hosted browser checks confirmed all 23 existing categories plus the creation action; search/unmatched Enter, F2, one-character validation, existing-category reuse, new draft selection, Escape and parent-dialog preservation. Both regular setup and receiving child editors use the field. The keyboard guide includes the category F2 action. At 390 × 844 the child actions stay inside the viewport and the document has no horizontal overflow; navigation still reaches inventory. Desktop checks confirmed all grouped views and unit costs: rice 1,341.20 EGP ÷ 47.9 kg = 28 EGP/kg, oil 3,720 EGP ÷ 49.6 L = 75 EGP/L, and zero-stock items show no known cost.

Browser verification created and cancelled form drafts only. The client retains 338 materials, 23 categories, stock value 196,820.65 EGP and zero pending operations. Actual material save/offline capture remains covered by existing setup integration tests; no test material, category or receipt was committed to the client workspace.

Screenshots: `outputs/Category-Navigation-20261012/category-picker-desktop.png`, `category-mobile.png`, `inventory-unit-cost-menu.png` (beside the repository). The local server launch/browser fixture limitation recorded in the preceding receiving release still applies. GitHub publication is pending the existing credential-helper repair; a Cloudflare deployment is not a main-branch merge.
