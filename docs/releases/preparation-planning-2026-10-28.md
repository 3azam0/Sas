# Preparation planning — 28 October 2026

## Delivered behavior

**خطة التحضير** is available from the home shortcut and kitchens/preparation menu. A dated plan pins published recipe versions and planned quantities for a kitchen/source pair. It aggregates remaining ingredient requirements, expands non-stocked recipes, stops at stocked preparations and compares requirements with accepted kitchen balances. Suggestions cover shortages only, capped by accepted source stock and local projected availability. Other plans do not reserve stock.

The supply shortcut opens the existing reviewable kitchen form, prefilled with material quantities and source-stock average document prices. Document prices remain editable and independent of actual stock valuation. The production shortcut opens the existing editor with a stable linked operation ID, pinned version, kitchen input/output and remaining target; actual output starts blank. Saving a plan or opening either editor does not post stock. Existing confirmed save/sync flows do.

Only accepted linked production contributes completed output. Pending/rejected batches are visible separately, failed output remains zero, corrections are followed without double counting, and unavailable accepted history blocks recalculation. Non-stocked meal completions/discards are planning observations without inventory effects; sales consumption remains unchanged. Production history retains actual ingredient/waste quantities and costs.

Plans are **device drafts**, not shared server documents. Namespaced IndexedDB preferences retain them by organization/generation. JSON backup/import validates scope and protects conflicting saved copies; CSV exports exact quantities. Unsaved edits, optimistic revisions, grant expiry, closed/read-only plans and execution scope/target locks are explicit. Plan backup does not include stock outboxes; existing recovery 23 covers those separately. See [operating guide and limits](../runbooks/Preparation-Planning.md).

## Verification

- 52 focused checks across ten files pass: planning requirements/execution/persistence/backup, production posting/costs/offline, kitchen form entry/preview/offline, navigation, daily shortcuts and guide coverage.
- Production build, TypeScript and offline manifest pass. Hosted build **d7dfdf1d9c4d7d5a** and isolated Worker dry run pass.
- The planning browser scenario covers zero stock writes on draft creation, reviewed supply, accepted production/waste, meal observations without stock effects, CSV/JSON, offline restoration, phone overflow and closing the plan.
- Existing production browser scenarios cover offline yield/cost conservation and failed/rejected/corrected batches. Their navigation now opens the arranged menu group; screenshot paths stay inside `test-results` instead of the workspace parent.
- All three final browser scenarios pass on the final production build, including the prefilled document price. Earlier runs stopped at the old collapsed-menu assumption and an out-of-workspace screenshot path; correcting the test harness resolved both without weakening assertions.
- Desktop/mobile screenshots are saved in ignored `.cache/preparation-evidence/` and visually inspected. All fixture transactions are local, with no live business-data test posts.

## Deployment integrity

The reporting backend bundle is byte-for-byte identical to the previously deployed API21 (SHA256 `94e034933dc4681a50af01c11d0d1847f2673fe3878262fdd771126114540f76`). This is a frontend release: no Supabase function replacement, database migration, Dexie version change or recovery-format change. Existing reports, butchery, sheep receiving, document-only kitchen prices, authorization and stock posting remain intact.

Live identifiers and final browser results are recorded after activation below.
