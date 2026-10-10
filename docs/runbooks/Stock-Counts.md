# Stock counts and reconciliation — Phase 3B

Open **الجرد والتسوية** for the selected branch, warehouse or preparation kitchen in the current development organization. Counts use each material's base inventory unit. Transit belongs to transfer documents and is excluded from the physical stock at a location.

## Prepare and capture

1. Pause physical stock movements at the location. Synchronize every participating device and resolve rejected or pending receipts, returns, transfers, opening stock and waste. A disconnected device can hold unknown work; this version cannot certify a global period close.
2. Synchronize Fodo, choose the location and press **جرد جديد**. The count captures the downloaded location movement sequence, snapshot time and confirmed expected quantities. Its business date is a reference, not authority to backdate costs.
3. Enter a reason/reference and the actual quantities counted. Leave an uncounted material blank. Enter **0** when that material is physically absent. Only entered materials belong to this partial count.
4. For every surplus enter an explicit unit cost in EGP per base unit; an intentional zero cost must be entered as **0**. Fodo does not silently use an average or latest price. A shortage consumes FIFO layers on acceptance.
5. **حفظ مسودة الجرد** saves a durable draft, including offline. It changes no stock. Draft edits retain the original baseline. Switching locations closes the editor so quantities cannot accidentally carry to another site.

Example: accepted stock is 2 kg at EGP 20 plus 8 kg at EGP 30. Physical 7 kg produces a shortage of 3 kg valued at EGP 70 using FIFO; accepted stock becomes 7 kg/EGP 210. Physical 12 kg with an explicit surplus cost of EGP 25 produces a new 2 kg layer/EGP 50; total stock becomes 12 kg/EGP 330. Original incoming costs remain intact.

## Review and finalize

Use **مراجعة واعتماد الجرد** to inspect each difference and its cost policy, check the explicit review acknowledgment, then **تأكيد اعتماد الجرد**. This can queue offline; stock changes only after online server acceptance. A pending approval never contributes provisional inventory adjustments.

The server serializes posting for the organization, checks the exact saved location sequence and expected quantities, then validates every line before changing stock. Any accepted movement at that location since the baseline invalidates the count, even a movement of a different material or a consumption/receipt pair that restores the same quantity. Movements at other locations do not invalidate it. Known unresolved local stock movements also block finalization; stock outboxes synchronize first.

Negative differences consume original FIFO layers. Positive differences add a layer at the entered cost. Zero differences create no ledger movement but retain a finalization result and deduplication receipt. The complete adjustment, allocations, balances, count result, revisions and audit either commit together or roll back together. Accepted counts are immutable; this slice has no reversal of an accepted count.

## Stale counts and recovery

A stale or rejected approval remains in **سجل إجراءات الجرد** with its reason. Retry sends the unchanged payload and IDs; it cannot refresh a stale baseline. Use **إعادة العد بعد الرفض** after stock operations have settled and the latest snapshot has downloaded. The new form starts with blank physical quantities and a fresh accepted baseline: physically recount, rather than copying the old observed values automatically. A fresh document/operation/movement identity links to the superseded rejected action. The prior server draft and history remain visible. Resolve any other rejected actions for that draft separately.

If a saved draft is already visibly stale before approval, cancel the obsolete draft and create a new count after a physical recount. Cancelling a draft has no stock effect. Cancelling a known rejected local action is separate and never reverses posted inventory. Network/authentication failures retain commands. A lost response reconciles against accepted server operation IDs, and same-ID retries cannot duplicate adjustments.

Unknown late uploads after finalization are accepted as subsequent movements under the existing posting rules; they do not revise the count or historical FIFO ordering. Device acknowledgments, automatic period locking and historical late-arrival correction workflows remain future work. Pause/synchronize/recount discipline is required for the development walkthrough.

Dexie schema 6 adds a dedicated count outbox and preserves older queues/preferences. Recovery **format 8** includes count commands, line/movement IDs and recount links; formats **1–7** remain readable. Export before clearing browser storage or changing origin. Import checks scope, source definitions, IDs, payload conflicts and replacement chains before atomic restoration. Exported acceptance is reconciled against server evidence. Server database backup does not include unsynchronized browser operations.

## Independent reconciliation

**مطابقة الرصيد والحركات والطبقات** shows accepted quantity/value from three independently aggregated sources: stock balances, the complete location ledger and remaining cost layers. Amounts use exact decimals. A mismatch blocks finalization for the affected counted material; the count does not silently repair a damaged ledger. Stop and investigate source records/allocations with a developer. Do not edit balances directly. Transit is inspected separately in **التحويلات**.

## Verification and next work

The suite includes FIFO shortage, explicit-cost surplus, physical zero, zero variance, line rollback, stale sequence despite restored quantity, cross-location independence, competing counts, duplicate IDs, tenant/base-unit validation, mismatch rejection, additive migration, offline reload, ordering, dependency review, linked recount and recovery compatibility. Browser checks cover Arabic desktop/mobile, offline approval/reconnect and fresh physical recount after rejection. Exact current validation totals are recorded in the developer guide.

Next: versioned recipes/BOMs and sub-recipes, followed by production/yield and sales-based cost control. Production authentication/access remains a separate prerequisite before live use; billing, memberships and dedicated demo infrastructure remain deferred.
