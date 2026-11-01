# Daily-workflow usability — 15 October 2026

The home page now leads with receiving, kitchen supply and inventory search. Daily desktop navigation stays visible; other workflows expand in groups. Mobile has four frequent destinations and an all-sections dialog. Receiving and kitchen supply keep essential fields visible, group optional details, preserve keyboard entry/receipt lists and reveal hidden errors. The latest document notice follows its actual outbox/confirmed snapshot state. Analytics remain available on demand.

## Published release

- URL: https://fodo.am-agent2026.workers.dev/
- Build: `1a84a8b7f338a9cf`.
- Cloudflare Worker version: **67**, ID `b746274d-ffc6-4735-a2dc-6cd8273c92a6`.
- Deployment: `b512d0ac-3be3-42ee-8b29-aaed076bd178`, 100% traffic, created `2026-10-15T15:27:36.639496Z`.
- Supabase API remains **14**; no backend/schema/offline-format changes.
- Existing public bindings, compatibility date and observability were retained and read back after deployment.

## Verification

All **29 targeted tests across eight files** passed: document feedback/home attention, navigation, client guide, form keyboard behavior, report cache, receiving entry, kitchen entry and kitchen stock preview. Next production build and TypeScript passed, with 44 precached offline assets. The Cloudflare frontend build completed. Existing Babel/Vite configuration warnings remain unrelated to this slice.

Hosted checks covered desktop 1280×900 and mobile 390×844. All three daily cards fit on the mobile screen without horizontal page overflow. The mobile menu includes all 17 destinations; Escape returns focus. The reports shortcut opens its active desktop group and resets content scroll. Expanded home analytics render existing metrics/charts; collapsed home avoids their mount/fetch/focus.

Receiving checks retained an unsaved reference and added line across help; Save revealed an invalid hidden optional reference. Kitchen selection moved to quantity; Enter added a rice line, returned to material search with results closed, and allowed opening optional details directly. Kitchen hidden-reference validation retained the line and focused the error. Checks cancelled all drafts and posted/reset no client transactions. Save-state transitions were verified by tests and source wiring, not by submitting client stock transactions.

The offline shell initially served the prior cached frontend. A normal reload loaded the final fingerprinted bundle without clearing storage, credentials or queues. The tab then reported no application console warnings/errors in the inspected log sample. Browser automation telemetry reported unrelated Statsig failures outside the application origin.

Visual evidence is saved outside the repository in `outputs/Daily-Workflow-20261015/`: final `home-desktop.png`, `home-mobile.png` and `kitchen-desktop.png`; the earlier receiving screenshot records the unchanged entry-list flow. Client-guide content, master plan, developer guide and operating runbooks were updated. GitHub publication remains separately pending; hosted deployment is not evidence of a push or merge.

The next functional milestone remains accepted-sale financial corrections, then restaurant expenses/profitability. Stock supply/consumption policies and the temporary-data cleanup approval boundary are unchanged.
