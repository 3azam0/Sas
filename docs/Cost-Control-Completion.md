# Cost-control completion

Agreed 15 October 2026. Scope: sales financial corrections, basic expenses and first-client acceptance. Existing inventory, kitchen routing, selective deductions and shortage policy remain.

## Financial rules

- Accepted sales stay immutable. Partial refunds reference the accepted sale line; a void reverses all remaining quantity and revenue. Cumulative corrections cannot exceed the original quantity or amount. The final corrected quantity must settle the remaining revenue, including zero-price sales. Corrections use their own business date, never before the source sale.
- Every sales correction declares consumed ingredients or a need for separate stock review. Both are financial-only: no ingredient recreation, shortage backfill or change to original theoretical usage. A physical correction requires an independently reviewed stock document.
- Expenses record category, location, business date, EGP amount, reference, payment method and optional notes. Electricity, phone credit and knife sharpening belong here. Stock purchases and transfers must not be entered again as operating expenses.
- Accepted expenses are immutable. A full linked reversal uses the original amount and can post once. Re-enter the correct expense separately. This journal records amounts; it does not issue payment-provider refunds or establish bank settlement.
- All commands use tenant/generation checks, tenant serialization, idempotency receipts and actor audit. Rejected offline actions retain linked replacements.

## Reports and recovery

Net sales = original accepted sales in the period − financial corrections dated in the period. Corrections can relate to earlier sales. Net expenses = dated expenses − dated linked reversals. Estimated operating result = net sales − full recipe-cost estimates − net operating expenses. Missing ingredient prices keep the result incomplete. This is not accounting net profit or proof of actual consumption. Purchases, transfers, production inputs and waste are not subtracted again from a recipe-based estimate. Use physical-count reconciliation to establish actual consumption.

Dexie finance outbox version 12 and recovery format 18 retain tenant-bound records, pending/rejected states and correction links; older archives remain readable. No client data reset or seed is part of delivery.

## Acceptance

Automated checks must cover partial/full and zero-price corrections, over-refund/concurrency rejection, immutable stock/history, reversal dates, duplicate delivery/lost response, tenant and generation isolation, financial report paging/full totals, missing costs, offline persistence/recovery, rejected corrections, keyboard forms and mobile fit.

Client acceptance remains a human review: confirm real receiving units, recipe portions and selected deductions; validate the real POS export; agree stock-count cutoffs; verify printer/device needs and offline reconnect; review expenses and correction handling. Keep trial data until explicitly authorized cleanup. Record actual evidence and unresolved items rather than marking client approval automatically.
