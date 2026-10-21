# Counter POS — approved scope, 21 October 2026

Implement a web cashier module in the existing tenant application. Each POS uses its assigned kitchen; the same meal may be prepared independently by several kitchens. First delivery supports counter/takeaway, cash checkout, durable current/held carts, item search/categories, selling prices, notes, sale history, linked financial corrections and A4/80 mm Windows-helper receipts. Cashier shifts, tables, split bills, delivery, external payment processing, Android direct printing and fiscal adapters remain deferred. Existing organization access rules apply; new permissions/discount administration are not introduced in this slice.

## Implementation rules

- Catalog prices and categories are optional additions to menu mappings; existing items stay unpriced until configured. Zero is an explicit valid price. Never infer a selling price from ingredient cost.
- Direct checkout carries immutable cash/line-price/notes metadata through the existing sales journal and stock engine. Server validates price, totals, routing and cash coverage before accepting revenue and stock atomically. Direct and imported identities remain distinct; repeat submission uses the same operation ID and never posts twice.
- Only configured ingredients deduct, from the selling kitchen, on acceptance. Shortages accept available selected stock and retain required/deducted/missing evidence without negative balances or warehouse fallback. All ingredients still contribute to estimated recipe cost. Held/current carts never post.
- Save paid sales durably before showing success or printing. Distinguish locally saved, review, pending and accepted states. Rejected paid sales stay immutable for review; do not silently discard them or create a second payment. No automatic retries with a new ID.
- Current/held carts are tenant/generation scoped and revision-checked across tabs; checkout removes a cart atomically with queuing its sale. Recovery must preserve carts without copying printer/auth secrets. Session expiry prevents new checkout while retaining existing drafts and queues.
- Receipts use a unique stable sale reference and show cash, change, kitchen/POS, item quantities/prices/notes and acceptance status. Printing/reprinting never posts sales; this receipt template does not introduce a country fiscal adapter.
- Reports reuse accepted sales and financial corrections. Cash collection shown in checkout is distinct from accounting profit; imports must not be mistaken for a second copy of a native sale.

## Delivery and verification

1. Amend contracts/domain and backend validation; reuse existing JSON payload tables without rewriting migrations.
2. Add durable cart/recovery and checkout queue integration; preserve current offline formats and legacy journal replay.
3. Build responsive Arabic cashier, menu-price editor, receipt/history and guide/navigation links using shared components.
4. Verify tenant/generation/routing, exact cash arithmetic, stale prices, idempotency, shortage policy, refund integration, cart concurrency/reload/recovery and no duplicate import/native identities.
5. Type check, focused and full regression tests, production/offline/hosted builds, isolated browser checkout/hold/printing checks and source commits. Deployment is recorded only after backend and frontend versions are verified. Human printer/client acceptance remains separate.

## Kitchen screen amendment

User approved paid-order kitchen display: New → Preparing → Ready → Collected. Orders are scoped to the resolved kitchen, update through append-only revision-checked commands and never deduct stock again. Only server-accepted sales are shared across devices; unsynced cash sales remain visible in cashier history. Keep local status pending explicit and reuse the existing connected-workspace refresh loop; do not add a second always-running poller. Recovery, generation reset and trial cleanup include fulfillment actions.

## Verified release

Delivered 21 October 2026: hosted build 378fa56fb59ab0e4, Cloudflare 83, API 16, migration 20261021165121. See the release record and operating guide for verification, configuration and remaining acceptance. Git publication and real-use approval remain pending.
