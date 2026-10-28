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

Pending final artifact checks and activation. Apply the additive `inventory_operating_cycle` migration, deploy `fodo-api`, then activate the tested Cloudflare frontend. The previous live release is build `d7dfdf1d9c4d7d5a`, Worker99 (`bdc56445-e502-4847-a754-eb0ea77f3172`), deployment `b5430d8d-0f47-43ab-b8b8-76f932267a88`, API21. Verify this checkpoint before activation and record actual identifiers below.
