# Cost-control completion — 16 October 2026

## Delivered

Linked partial sales refunds/full remaining voids, cumulative quantity/amount limits, explicit ingredient disposition, categorized/location-dated operating expenses and single linked expense reversals. Original sales, stock, recipe quantities, allocation values and shortage evidence remain immutable. Journal actions have audit, tenant/generation scope, durable offline capture/review and recovery format 18. The financial report includes corrected revenue, expenses, recipe estimates and a clearly estimated result, with server paging/filtering/sorting, CSV/cache and expense-category chart drill-down. The in-app guide now has 23 topics including finance and client acceptance.

## Source and deployment

- Source checkpoint: `7974998563f2c9fc13314265fba4b8bef7916539`, branch `feat/cost-control-completion`.
- Hosted frontend build: `63ee15b46405aaff`, Cloudflare version **73**, version ID `904c8335-9fef-493b-93b2-7702ea731384`.
- Deployment `4c9a2444-7ff1-4a7b-851d-75f407215128`, verified 100% traffic, created `2026-10-16T06:18:25.216174Z`.
- Supabase `fodo-api` **15**, active, same custom-auth path; the explicit bundled `deno.json` import map is included.
- Additive migration `20261015172714_cost_control_finance.sql`. Original hosted migrations remain unchanged. The existing trial baseline was extended with an empty finance journal only after checking its prior schema signature.

## Verification

- Full regression suite: **346 tests in 66 files passed**. After the hosted UI revealed missing report cards, the final card repair passed **16 targeted tests**, including two additional UI regressions: **348 distinct tests covered across runs**. Type checking, production/offline build and final hosted build passed.
- Server tests cover partial/full corrections, over-refunds, concurrent requests, source date/location/tenant/generation checks, immutable stock and sales, one-time expense reversal, report dates/full-range aggregates/pagination, missing costs and reset dependency order.
- Offline tests cover reload, recovery, linked rejected corrections, duplicate payloads, obsolete generations, expired grants and lost-response reconciliation without a second posting. Historical migration-chain tests also verify trial restore compatibility through the finance upgrade.
- Hosted desktop/mobile checks verified category search and Enter-to-next-field, zero-amount Save prevention, 354px modal fit, accepted-sale search, full-void amount/quantity locking, explicit stock-review choice, all five financial cards and the client acceptance article. Temporary drafts were cancelled. Report content width equalled viewport width on mobile.
- Read-only database comparison: **100 accepted sales details, 177 stock entries, zero finance entries**, unchanged organization generation. No client transactions were posted or reset. API role has SELECT/INSERT on the journal, no UPDATE; public/authenticated table access is revoked and tenant RLS is enabled and forced.
- Supabase security advisor found no new journal/RLS warning. The existing Auth [leaked-password protection warning](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection) remains; this release changes no Auth configuration.
- Local proof images: `outputs/Daily-Workflow-20261015/cost-control-report.png`, `cost-control-report-mobile.png`, `cost-control-refund.png` and `cost-control-workspace.png` outside the repository.

## Remaining boundaries

Client acceptance is **pending human review**, with [walkthrough](../runbooks/Cost-Control-Acceptance.md). Actual POS format/units/recipes/count cutoffs, real-device reconnect and isolated production restore rehearsal remain launch checks. Temporary data cleanup requires explicit authorization. Results based on recipe estimates are not accounting net profit, and recorded refunds do not execute payment-provider transfers.

An isolated local browser-server launch was rejected by automatic approval policy. Hosted read-only/draft browser checks completed instead; stock-writing tests used isolated databases. GitHub push was attempted after the source commit and failed with `Could not resolve host: github.com`; remote publication/PR/CI of this checkpoint is not claimed.
