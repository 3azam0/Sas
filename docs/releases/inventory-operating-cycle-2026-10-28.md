# Inventory operating cycle — 28 October 2026

## Delivered behavior

All five requested areas are implemented on `chore/qibli-trial-stock`: purchasing suggestions, transfer follow-up, lot/expiry tracking, consumption explanations, and closing/permissions. See [operating guide](../runbooks/Inventory-Operations.md).

Suggestions aggregate unfinished device preparation needs and subtract accepted stock, firm purchase remainder and inbound transit. Drafts remain separate and creation opens a reviewed purchase editor. Transfer follow-up uses accepted quantities and an explicitly configurable age rule. Optional incoming/output lots trace source layers through transfers and kitchen supply; alerts keep historical missing data unknown and preserve FIFO/average valuation.

The new **الرقابة وإقفال اليوم** workspace provides lot filters/CSV, counted-period consumption reconciliation and checkpointed explanations, manager closing/count approval, owner reopening and existing-account role administration. Server-side guards reject stock, sales, finance, count and transit-loss writes in closed periods. Accepted operations retry without duplication; rejected offline work remains for review. Online governance requests retain a stable operation ID across ambiguous responses.

Roles come from actual active tenant membership, with RLS and fresh actor checks. The sole legacy active account retains owner; new accounts default to operator. Owner self-demotion and removal of the last active owner are blocked. The migration rejects ambiguous legacy owner assignment. No account invitations or automatic activation are added.

## Verification and limits

Focused domain/server/offline regressions passed, covering preparation demand, partial receipts/transfers, lot tracing/cost conservation, date locks, reconciliation checkpoints, role changes, cross-tenant isolation, recovery and existing production/butchery/kitchen/finance/sales behavior. Both hosted migration tests pass, including legacy-owner ambiguity, scoped membership visibility, manager-only closures and append-only events.

The final production-build browser scenario passes purchasing suggestions/draft review, partial overdue transfer CSV, expiry CSV, variance approval, reversible close, closed-date rejection, accepted retry, receiving lot entry and mobile/offline restoration. Desktop/mobile screenshots are saved in ignored `.cache/inventory-operations-evidence/` and visually inspected. All business test transactions are isolated local fixtures; live checks are read-only. A reused test fixture was replaced with unique material identity and a unique directory; mobile navigation uses its actual menu dialog.

Plans remain device-local with a separate backup. Lot expiry is an alert, not FEFO or automatic issuing prevention. Historical missing lot/expiry stays unknown. Kitchen document prices remain independent of actual stock valuation. Day closing cannot prove that disconnected devices have synchronized; it requires operator acknowledgement and preserves rejected old work. Reopening clears the location's closed-through period, with an owner reason and audit trail.

Recovery chooses 24 only when lot metadata exists and retains 22/23 compatibility; Dexie remains 14. No data reset, sample/live business transaction, valuation-policy change or sheep/butchery removal is part of this release.

TypeScript, the production build/offline manifest, hosted build **06ecf041fa85e3df** and isolated Wrangler dry run pass. Backend SHA256 is `8a0518ea7990713a8fba1900a0484a0b1339c7d3da9ffa495eea8ab81d9f0bfe`. An optional whole-suite run was stopped after slow Windows execution and is not counted as passing. Focused suites and the final browser scenario are the release evidence.

## Deployment

Applied the additive migration, deployed `fodo-api`, then activated the matching frontend. Verified previous deployment `b5430d8d-0f47-43ab-b8b8-76f932267a88` immediately before activation; no unrelated release was overwritten.

- Live URL: https://fodo.am-agent2026.workers.dev/?release=06ecf041fa85e3df
- Source implementation: `ab3781d49a4ee62d5566fa6ae25daff05a6943a9`, branch `chore/qibli-trial-stock`.
- Migration: `20261028181354_inventory_operating_cycle.sql`. The migration was created with Supabase CLI, then renamed to the actual managed migration version after application. The first tool attempt expired; read-only verification confirmed no schema/history changes before the successful retry.
- Supabase `fodo-api` **22** active, ID `bda0225d-b269-49d5-8848-da2722659700`, preserving manual Auth/active-membership/tenant checks and the prior verify_jwt=false setting.
- Cloudflare Worker **100**, version ID `eae19ce0-7c71-47a4-bc36-8eebce725692`, build **06ecf041fa85e3df**.
- Deployment `74c99bb4-8e00-4812-b692-6870ff9a652c`, verified **100%** traffic. Workers.dev enabled; preview URLs disabled. Runtime, public bindings and observability settings preserved.
- Live health matches the expected build and JavaScript matches the prepared bytes. Anonymous bootstrap/new controls/butchery, invalid-origin and private-file protections pass. Desktop/mobile login has no page errors or horizontal overflow. Live checks do not post business transactions; authenticated workflows were verified in isolated local fixtures.
- Live SQL confirms one active owner, forced tenant RLS on both new control tables, fixed trigger search paths, no control-event DELETE permission and no membership activation UPDATE permission for the API role. Security advisors show no new findings; the pre-existing [leaked-password-protection setting](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection) remains disabled.
