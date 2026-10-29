# Central Kitchen manufacturing and preparation — 29 October 2026

Published to https://fodo.am-agent2026.workers.dev with the user's authorization. The existing advanced hosted application is the release baseline.

## Verified release

- Frontend build: `34f88b834a5f7bc6`.
- Cloudflare Worker104: `0997ad82-7bb9-457c-b810-0d4a71627884`.
- Deployment at 100% traffic: `7452b21c-43b9-4baf-aba9-9b01303d9d86`.
- Core implementation: `c36611824537d15b501eca775a350b23012d20af`.
- Complete code source including existing local recipe defaults: `f9d8df02ae1b0fd039641aafa99a23b3bb9c22f6`.
- Supabase `fodo-api`: version24 ACTIVE. Downloaded deployed source matched the prepared source exactly. Backend SHA256: `2a1a7d62c357a180d045404a6852f9ab78f3512287563f35dd21920faabe0dd7`.
- Applied migration: `20261029145734_central_kitchen_batches.sql`, journal name `central_kitchen_batches`.

Worker103 (`08c25a7d-5d66-4fad-8959-15cfb0c1f997`, build `075f3a05a18e9996`) initially delivered the same core workflow. Worker104 also includes the existing local improvement that fills the planned quantity from the selected recipe. That two-file patch was preserved under `.cache/local-parity-backups/` before integration. Backend24 is unchanged between these two frontend releases.

## Behavior

The warehouse employee can create recipe-based butchery, preparation or manufacturing batches, issue multiple ingredients, reopen a batch for further issues, record partial physical receipts, return unused materials at original issue cost, record losses and processing costs, and close with explicit cost allocations. References are automatic. Existing beef/lamb preparation remains available on its own tab.

Stock is deducted once, on acceptance of material issuance. Output receipts do not deduct ingredients again. The user's chosen rule holds received products outside available stock until batch closure fixes their costs. Closing releases priced inventory through the existing valuation and transfer paths. Normal loss is included in output cost; abnormal loss remains an expense. Accepted actions are corrected through linked reversals.

The hosted organization already uses moving average. No costing-method conversion or quantity/value reset was required. New tables have forced tenant RLS, API grants and denied anonymous/authenticated access. Historical production records and existing purchasing, sales, transfers, printing and offline operations are retained.

## Verification

TypeScript, the Next production build and the hosted build passed. Fifty distinct focused server/offline/migration checks passed, covering stock deduction, additional issues, returns, holding receipts, costing, mass balance, reversals, concurrent/idempotent commands, recovery and tenant isolation. Resource-limited setup hooks were rerun successfully after stopping the development compiler; no unresolved assertion failures remain.

The isolated desktop/mobile browser scenario passed: a three-ingredient kofta batch, offline additional issuance and synchronization, partial receipts held outside available stock, unused-material returns, normal loss, processing costs, closure with exact cost conservation, and the transfer entry point. Existing local trial data on port3137 was preserved. Browser fixture transactions were isolated from hosted business data.

`node scripts/verify-forms-release.mjs` verified live build, HTML asset references and exact live/local SHA256 hashes:

- JavaScript: `a692c2dd2b21af2f42cd418f4dd3b865e1049f4aa64bfc9f72ea56c00f93f487`.
- CSS: `3005e9b6e449d4f0292e73b46990106e29543c235af9929c19d35423a4f2c48b`.
- Windows printing helper: `4a3316e7c0efb7dba522f61c0cef0c02634a04db88446b6656e5a6d9c18a17dd`.

Anonymous bootstrap returned401, cross-origin posting403, private paths404, and the deployed backend401 without authentication. This is public deployment verification plus isolated workflow testing, not a claim of authenticated hosted business postings. Generated evidence is in `.cloud-build/live-verification.json` and `test-results/central-*.png`.

## Source parity and recovery

The managed `recipe-forms-compatibility/Sas` checkout is the release source. Synchronize `D:/New folder (3)/Sas` on its hosted-source branch by fast-forward after preserving local edits. Compare all tracked files, normalizing CRLF for text and comparing binaries exactly. Independent databases are not synchronized by copying source. Preserve ignored databases, environments and dependencies.

The incompatible old prototype remains recoverable through stash `85a50e801ccd6f0a694262afc8354cc30c4d1355`, the independent bundle and manifest under `.cache/local-parity-backups/`. Never restore it directly over the deployed source. See [the operator workflow](../runbooks/Central-Kitchen.md).

## Rollback and temporary upload storage

The pre-Central-Kitchen frontend is Worker102 `73ba01b0-c452-46b3-b146-366334621263`, build `bdc27349fb53deba`. Backend24 remains compatible with it. Reactivating the earlier frontend may hide new batch workflows; retain the additive tables and API24 so production history remains intact. Do not delete stock, batch tables or accepted movements to roll back UI.

A temporary KV namespace staged the upload. Its code chunks have a one-hour expiry. Automatic approval review rejected permanent namespace deletion, so the safe expiry path is retained; namespace deletion is not needed for the running application. This staging namespace is not bound to the live Worker.
