# Kitchen consumption release — 12 October 2026

Internal recipients such as مطبخ ١ and مطبخ ٢ can now be added, renamed, deleted from new selection and restored in **إدارة المطابخ**. They receive multi-material issue documents from an existing source warehouse. Every accepted quantity counts immediately as consumption and reduces source stock, without creating destination stock, sales revenue or customer balances. Accepted recipient names, costs and units remain pinned after edits or deletion. See [the kitchen workflow](../runbooks/Kitchen-Issues.md).

The editor supports Tab/Shift+Tab, Enter between header fields, automatic matching-result dropdowns, arrow-key/Enter selection, Enter to advance/add a material, Ctrl/Command+Enter to validate/save, and Escape with trigger-focus restoration. Results fit the form's available space and scroll when needed. Validation preserves values and focuses the affected row, including another page. History has search, filters, ordering, pagination and a printable internal voucher. Totals cover downloaded documents; the server snapshot currently includes the latest 100 issues.

An issue with insufficient stock is rejected atomically, with no partial consumption. This policy is separate from sales imports, which still accept available stock and highlight shortages. Existing recipe deduction selections were not changed. The form explains that issuing materials and deducting the same goods on sale from the same warehouse would consume them twice.

## Publication

- Live application: https://fodo.am-agent2026.workers.dev/
- Hosted build: `bbc92fb8eaa8ef12`.
- Cloudflare deployment: `4c6c9308f76646a6bf4a2b000297dfaa`; upload succeeded with HTTP 200. Existing bindings and observability settings were retained.
- The health endpoint and loaded browser asset confirmed that build. Sales policies remain `selected_available_stock` and `accept_and_highlight`.
- Supabase migrations: `20261012065508_kitchen_consumption` and `20261012073503_kitchen_directory` on the existing hosted project. Both private tables use forced tenant RLS and are inaccessible directly to `anon`/`authenticated`.
- Edge Function `fodo-api`: version 7, deployed bundle SHA-256 `77c6394a63bbab119a9f9377129d4518ec81c4b91d08e4bacb15ff3ed98fec76`. The existing manual authentication/tenant checks and JWT gateway configuration were retained. The redeployment explicitly supplied its relative `deno.json` path because the first attempt inherited a stale temporary import-map path and was rejected.
- IndexedDB version 11 adds the issue outbox; recovery format 16 includes kitchen setup and linked issues. Format 15 name-only issues and previous recovery formats remain readable. Old acceptance flags do not become trusted on restore.
- Task branch: `feat/kitchen-consumption`, stacked from the previously delivered branding checkpoint `bc5c476` to retain shipped features. Local commit and remote publication are separate states; verify the remote SHA before reporting a push complete.

The additive migrations extended the guarded active trial backup with empty baseline issue/kitchen data and the reviewed schema signatures. They did not reset the client or remove trial data. Future authorized trial cleanup includes issue documents and kitchen configuration; regenerate the cleanup SQL with the current helper. The original consumption migration remains unchanged.

## Validation

- All 261 unit/integration tests in 46 files passed. New coverage checks whole-document posting, source-only consumption, pinned costs, fractional FIFO/average depletion, duplicate retries/collisions, scope/generation/date/unit checks, reconciliation, offline ordering/blockers, correction, recovery and the trial-backup migrations. Registry tests verify revisions, duplicate active names, deletion/restoration, accepted history after renaming and setup-before-issue sync.
- Local Next production build and TypeScript passed; the offline manifest contains 42 assets. Hosted bundling passed.
- Initial hosted draft-only issue checks confirmed kitchen focus, Tab/Shift+Tab, Enter across headers without entering pagination controls, SKU search selection, Arabic quantity entry, next-row creation, multiple-result arrow selection and Escape restoring the creation button. The subsequent registry form was checked without saving: Add opens on its name field, and Escape cancels the editor.
- Ctrl+Enter with an empty reference focused the reference and kept the quantity. An excessive quantity focused its field and displayed the shortage without posting the draft.
- The issue form, registry editor and shared search results were inspected at the default desktop viewport and 390×844; no document horizontal overflow appeared on the phone viewport. Shared search was checked in an unsaved receiving form: typing opened five rice matches, arrows/Enter and clicking the last result changed the selected material, an unmatched query showed explicit feedback, and the final popup fitted the available form height with its own scroll. Screenshots are in the workspace's `outputs/Kitchen-Consumption-20261012` folder beside this repository.
- The hosted verification did not save any issue or invoke printing. Posting/idempotency/offline effects were verified against isolated test databases and IndexedDB fixtures. Starting an isolated local verification server was rejected by automatic shell approval; hosted draft checks provided the UI verification instead.
- A final read-only database check confirmed 338 items, 170 stock movements, stock value `196868.650000000000` EGP, zero kitchen issues and zero kitchen directory records, matching the pre-release client totals. All verification drafts were discarded. No new console errors were observed.

The saved local address and launcher are unchanged. Restart an existing local server normally to load the rebuilt version. Membership/billing, customer sales invoices and complete server-history pagination remain outside this release.
