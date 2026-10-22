# All-screen UI release — 11 October 2026

Long catalogs and histories previously rendered all their rows, report controls were difficult to use on phones, and sales stock selection was buried inside recipe editing. Lists now share result counts, filters, ordering and pagination. The recipe and menu screens show which ingredients are deducted, the quantity per sale and which components count only toward cost. Sales history separates actual deduction from recorded shortage; the import policy stays unchanged.

The unified sync list retains the existing waste/single-item receipt retry, correction, cancellation, quantity and replacement links; final source review caught and repaired an omission of these actions. These handlers were preserved and type-checked; no rejected client transaction was created to exercise them live.

The release covers all 14 main workspace screens and their relevant lists, plus the theoretical consumption report. It also improves form feedback, mobile layouts, source-document navigation and dropdown horizontal spacing. Long document editors retain hidden rows and entered values across pages, including validation and focus recovery. See [list behavior](../runbooks/UI-Lists.md).

## Publication

- Branch: `feat/deduction-ux`, based on client sample-data checkpoint `186f4da`.
- Live application: https://fodo.am-agent2026.workers.dev/
- Hosted build: `fb6bc4d544733047`.
- Cloudflare Worker deployment: `cc8aa10c9ed947e6a059f2ce6c81964e`, upload succeeded with HTTP 200.
- Health endpoint confirmed that build and the existing `selected_available_stock` / `accept_and_highlight` policies.
- This release changes the frontend only. No Supabase migrations or Edge Function deployments were performed. No client documents, balances or recipe definitions were created, edited or reset by verification.

The hosted service worker can display the previous cached shell for the first refresh while installing the update. Refresh again once the update has loaded. The local production build is ready; the existing running local process must be restarted through the normal launcher to use it. The saved local address and launcher were not changed.

## Validation evidence

- 244 existing unit/integration tests in 41 files passed during this UI work; two additional financial sorting tests passed after sorting was added (large precise decimals and unavailable prices).
- TypeScript passed. Hosted bundle build and local Next production build passed; the offline manifest contains 41 build assets.
- All 14 main screens inspected at 1440×1000 and 390×844; six representative screens at 1024×768. No document-level horizontal overflow was found. This is viewport simulation, not validation of every physical device or assistive technology.
- Setup paging, category filtering, empty search results, recipe search and menu filters checked against the existing 338-item/100-recipe/99-menu workspace.
- A 338-item unsaved count retained quantities across pages and revealed an invalid row on another page before focusing it. The test was cancelled.
- A 26-item unsaved receipt automatically opened its last page; returning to page one preserved quantity 7. The test was cancelled.
- Value-descending inventory ordering reset page two to page one; alphabetical ordering worked with the six-item legumes category. Dropdown computed padding was 14px/40px in the inventory and receiving form, and the 390px phone view was inspected.
- Report paging/value ordering retained net sales 112,960 EGP, estimated cost 46,320.63 EGP and food cost 41.01%. Date-range feedback and clear actions worked.
- A return source link cleared the previously chosen purchase order sorting, opened the correct order and expanded its receipt.
- Recorded shortage remained 59.35kg for the existing chicken shortage file. Stock value remained 196,868.65 EGP. No new console errors were observed in the inspected session.

The local proof folder is `outputs/Fodo-UX-20261011` beside the repository. `Review.md` records the numbered walkthrough. Use `15-final-sorting-desktop.png` and `16-final-dropdown-phone.png` for the latest sorting/padding evidence; the `before` and `after` folders retain the broader screen comparison.

## Boundaries

Pagination operates within the existing downloaded snapshot; it does not turn the latest-100 movement feed into a complete server-history query. Sales file date controls use captured date, while sales detail/report controls use business date. Editable row order stays fixed to protect input identity. Membership/billing, independent demo provisioning, POS and native mobile/desktop apps remain outside this release.
