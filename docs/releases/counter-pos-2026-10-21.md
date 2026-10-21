# Cashier POS and kitchen display — 21 October 2026

Status: implementation and isolated verification complete; frontend publication pending Cloudflare authentication. Prepared hosted build **378fa56fb59ab0e4**. Existing live frontend remains **0d49168fd10bf5f5 / Cloudflare version 80**. This record must not be read as a frontend deployment confirmation.

## Delivered source

- Integrated Arabic counter/takeaway cash POS: configured selling prices/categories, catalog search/filter/order/page controls, durable current/held carts, quantity/notes, mobile cart shortcut, cash coverage/change, history and receipts.
- One transaction queues the paid sale and removes its cart. Checkout shares the existing sales/stock/report engine; native and imported identities are separate. Authoritative menu history validates already paid offline prices.
- Kitchen-specific accepted paid orders follow New → Preparing → Ready → Collected, with notes, elapsed time, visible pending/review states and revision checks. Status changes never post stock.
- Existing selected-ingredient deduction, shortages and financial-correction rules remain. Reports include native sales; financial corrections link to the original line and never automatically restore ingredients.
- A4/80 mm receipts reuse Windows helper **1.0.0**. No physical print job was sent during verification. In-app guide expands to **26** topics.
- Dexie **13**, recovery **20**; tenant/generation/revision scoped carts, same-ID retry, paid-cart recovery protection and kitchen outbox recovery. Printer/auth preferences are not copied into recovery.

## Database rollout

Applied migration **20261021165121_counter_pos_kitchen_display** to the existing project. It adds the append-only kitchen status journal, forces RLS, scopes reads/writes to the tenant and grants the API only SELECT/INSERT. PUBLIC/anon/authenticated have no table access. The active removable-trial baseline now includes an empty kitchen journal and the updated schema signature; cleanup ordering is extended. Existing business rows were not reset, posted or edited for tests. Earlier applied migration generators remain frozen to their original schema stages.

Remote verification: RLS and FORCE RLS true; API SELECT/INSERT true, UPDATE false; anon SELECT false; status journal count zero; active trial baseline includes the table. Post-migration security advisor found no new database issue. Its existing Auth leaked-password-protection warning remains; see [Supabase remediation](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection). No Auth setting or access plan was changed.

Backend **fodo-api version 16** is active, bundle hash **d9c4c6a3baffba67bc9ed3dfd4d6e4340f004f196b52b7562e726b04df81f9d1**, source **a4c1492**. Its existing verify_jwt=false setting is preserved because its body validates Supabase Auth before tenant access. The first deployment attempt retained an obsolete absolute import-map path; explicitly selecting deno.json resolved it. Live unauthenticated bootstrap returns 401 AUTH_REQUIRED; the existing owner signs in through Cloudflare and downloads the workspace with counterPOS/kitchenDisplay capabilities, 99 menu mappings, two active POS and zero kitchen status actions. No client stock/sale was posted. The temporary verification session was signed out.

## Verification

- Full regression: 382 passed and one outdated navigation-route assertion failed. That expected route set was corrected for POS/KDS, then all **15** focused tests passed. Together these establish **383** passing distinct tests; no additional production failure remained.
- TypeScript, production Next build and offline manifest (46 build assets), and hosted build passed. Hosted payload: 2,383,687 JS bytes / 163,740 CSS bytes. Generated build/service-worker output is excluded from the source commit.
- PGlite/Dexie tests cover exact rounding, forged prices/totals/short cash, tenant and generation scope, same-ID acceptance/lost responses, selected-only deduction, accepted shortages, reports/refunds, historical prices, held/reloaded carts, concurrent revisions, recovery without secrets/resurrection, and ordered stock-neutral kitchen actions.
- Browser checks used the real compiled frontend plus the actual domain/server code against an isolated in-memory database and synthetic credentials, never the hosted client's stock. A held two-unit order survived reload; EGP 160.50 with EGP 200 received produced EGP 39.50 change and a single accepted receipt. That paid ticket advanced through every stage. Another kitchen showed only its own ticket. Menu price/category saved and appeared in POS.
- Desktop and 390 × 844 phone layouts were inspected; no horizontal overflow. Mobile cart shortcut and cash confirmation worked. A4/80 mm receipt content and the 80 mm raster preview were checked. Existing Windows helper was not paired to a physical printer. Browser network-offline mode was not separately simulated for this slice; offline queuing/recovery is covered by automated integration checks.

Screenshots are local, synthetic evidence under outputs/POS-UX-20261021, including cashier-mobile-cart.png, cashier-desktop-final.png, kitchen-board-final.png and receipt-roll80-final.png.

## Publication and remaining acceptance

Cloudflare connector tools are absent and Wrangler reports an expired OAuth login. The prepared frontend has not been published. No production traffic shift or new Cloudflare resource was created. Git push of feat/counter-pos failed because Windows Git Credential Manager could not start (NtCreateDirectoryObject access denied). The connector can read the repository but the local commit has not been pushed; no new PR, CI result or merge is claimed. Client/physical printer acceptance remains separate from local checks. Connect-FooDo-Cloudflare.cmd renews the existing CLI login in a normal user window; it neither deploys nor asks for credentials in chat.

Cash only; no shifts, tables, split bills, delivery/payment-provider/fiscal adapters, Android helper or new cashier permission system. Existing client menu selling prices are not guessed or seeded. The client must configure actual prices and approve routing/recipes, shortages, offline service and physical printing before real use. See [operations](../runbooks/Counter-POS.md) and [client acceptance](../runbooks/Cost-Control-Acceptance.md).
