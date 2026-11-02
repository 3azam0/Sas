# Recipe output, production corrections, stock navigation and material-list scrolling

Deployed with user authorization on 2 November 2026: frontend `da29ad9da58b388a`, `fodo-api` version 29, Cloudflare deployment `0b0e979efdc44ec78181c6c73e772ee7`.

New recipe forms default to an output calculated from all ingredient quantities, converted to the selected compatible mass/volume unit. A 23 kg + 3 kg batch produces 26 kg by default. Editing the output switches to manual mode for actual yield/loss; later ingredient edits preserve that override. The user can resume automatic calculation explicitly. Existing recipes open with their saved output in manual mode. Incompatible dimensions/count units and incomplete ingredient rows require manual output or corrected units; no partial ingredient sum is silently used. Sub-recipes contribute their used output quantity once.

`central.amend` adds a revision-checked, idempotent, audited amendment for an open production batch. Before stock/cost activity starts, the name, notes, process type, selected recipe and planned output can change. A changed recipe plan freezes a fresh cost reference at that point. Once activity exists, only name/notes can change through this action; posted quantities are corrected through the existing latest-action reversal/replacement flow in batch history. This preserves stock valuation and previous documents; older actions require reversing dependent actions in order. The amendment itself is reversible. No SQL schema migration was required.

All stock navigation now lives under **المخزون**: inventory, setup, suppliers, opening stock, purchases, supplier returns, transfers, counts, inventory controls and activity. Existing routes remain available exactly once.

Kitchen issue, receiving, opening and purchase material lists share a focusable two-axis scroll region, a bounded list height, and an outer scrollable form body. Long lists, search/pagination and save controls stay reachable on mobile and short desktop screens. Popup item search continues to use its existing portal behavior.

## Requested data cleanup

The user explicitly requested clearing all production/recipe data and only **لحم بقري للفرم** opening/receiving history. Private exact-decimal operational backups were saved under ignored `backups/` before mutation. The initial guarded cleanup aborted before changing anything because 50 new kitchen transfer movements arrived after the first snapshot. A fresh snapshot was saved, and the cleanup was tested against it before execution.

Successful cleanup removed two open central production batches, their actions/stock issues, one recipe and its versions/revisions, and two target material opening/receiving lines. Other lines in the two shared documents were preserved and their document totals recalculated. The target material remains in the catalog with zero quantity/value; other recipe materials' production issues were undone in the retained ledger and source valuation. Source quantities and moving-average pool values were rebuilt only for affected materials.

Final checks: 0 production batches, 0 recipes/versions, 0 target material stock movements, target balance/value 0, 54 opening documents, 4 receipt documents, 1 kitchen issue document and all 50 new kitchen movements preserved. The retained ledger has 257 stock entries. All balances match both ledger quantities/values and remaining source quantities/values, with 0 mismatches. Unrelated balances were compared inside the atomic cleanup and remained unchanged. The organization generation was rotated to reject stale browser operations; clients must refresh and synchronize.

Validation: 23 targeted recipe-output/central-kitchen/navigation tests, TypeScript checking, recipe editor desktop/mobile scenarios, 35-line scrolling in all four forms at desktop, short desktop and mobile sizes, and a PGlite replay of the exact-decimal saved live snapshot. Live health returns the deployed build, and unauthenticated production access returns 401. No live sample batch was created for testing.
