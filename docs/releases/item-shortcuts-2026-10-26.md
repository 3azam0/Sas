# Item creation shortcuts — 26 October 2026

Based on `chore/qibli-trial-stock` (098f472).

The stock materials panel now opens the shared item editor with **إضافة مادة**. Saving keeps the current stock location, clears list filters so the material is discoverable, and restores focus to the opener. The existing setup outbox, tenant/generation checks and synchronization remain authoritative. Creating an item creates no stock movement or value.

Receiving retains its existing searchable-selector/F2 creation flow and now exposes **إضافة مادة جديدة** in the material entry heading. Kitchen supply exposes the same button and selector shortcut. Both reuse the shared item editor, preserve document fields and lines, select the saved item and focus quantity; cancelling returns to item search without saving a material. Focus handoff runs after child-dialog cleanup so the opener cannot steal focus from quantity. Buttons sit outside field labels and have explicit accessible names. Creation is disabled while editing an existing line. Receiving also passes locally created items to duplicate-code validation before synchronization.

Kitchen supply explains that a new item starts at zero stock and needs receiving before issue. Existing quantity/shortage checks and transfer posting are unchanged. No database migrations or client stock operations are needed.

Next.js is pinned to the security-patched **16.4.1**, with the matching lockfile update. The workspace explicitly permits the installation scripts for its two pinned build tools, esbuild and workerd. The Windows printing helper was rebuilt and all 18 native checks passed without using a printer. Cloudflare publication uses only the isolated worker module and its two existing public connection bindings; administrative build files are excluded.

## Verification

- All 390 unit/integration tests passed across 75 files. The full run used `--hookTimeout 120000 --testTimeout 60000` after an initial database-startup timeout during concurrent compilation.
- TypeScript, production build and the 46-asset offline manifest passed.
- All three new browser scenarios passed: inventory creation/offline reload/sync with no stock effect; receiving save/cancel with quantity and cost preserved; kitchen save/cancel/F2 with existing lines/reference preserved, quantity focus, zero-stock rejection and phone overflow checks. Initial browser runs identified navigation, accessible-name and focus-handoff issues; final runs use the corrected controls and all pass.
- Hosted build and isolated Wrangler deployment dry run passed. All 18 native helper checks passed without printing.

## Cloudflare release

Live at [FooDo](https://fodo.am-agent2026.workers.dev/?release=f3bc9d66a9b189b0), build **f3bc9d66a9b189b0**, Worker version **87** (`a1ff4dac-5f36-45d8-9b35-178f7a2b0f08`), deployment **499ecd96-9e42-4331-8c3c-071a9c2dbe89**, at **100%**. The Cloudflare connector uploaded the isolated worker module and promoted the verified version on the existing account/worker. Preview URLs remain disabled. Existing public bindings, backend API and client stock policies are unchanged; no database migration or live client stock/sales/setup command was posted.

Live verification confirmed matching health/build identity, a byte-for-byte JavaScript bundle match, anonymous/origin/private-file protections and desktop/390px mobile login rendering without page errors or overflow. Authenticated item creation was exercised only against isolated local test data. Read-only live evidence and screenshots are retained under ignored `.cloud-build/` outputs.
