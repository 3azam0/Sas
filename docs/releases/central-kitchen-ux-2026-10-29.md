# Central Kitchen interface and material shortages — 29 October 2026

Published with the user's authorization to https://fodo.am-agent2026.workers.dev.

## Release

- Build: `6d7cf712aef7e03a`.
- Worker105: `bcc0ec65-840b-4a21-a555-62b5d2537de4`.
- Deployment at 100% traffic: `3ce71525-d2de-4895-8010-7bdd2ff8bbf5`.
- Implementation: `4288ddef8850a30bcbf6a2047016104f7577ff45`.
- Backend24 is unchanged. Its source SHA256 remains `2a1a7d62c357a180d045404a6852f9ab78f3512287563f35dd21920faabe0dd7`.
- This follow-up requires no migration, costing change, stock reset or data deletion.

## Changes

The batch screen now separates batch selection from details, prioritizes open batches, shows progress and the next action, distinguishes issue/settlement/history views, and hides editing controls for closed batches. Filters have an explicit empty state. Keyboard navigation is supported across tabs. On small screens, detailed tables use labeled cards.

Both New Production Batch and Issue Ingredients show confirmed warehouse stock, spendable stock after local pending issues, requested quantities and shortages in each ingredient's stock unit. Recipe demand scales with planned output. Repeated lines for one ingredient share a single stock pool. Six-decimal quantities remain visible, including very small shortages. Pending receipts never increase spendable stock before acceptance.

Draft planning remains available with a shortage. Actual issuance is blocked until the displayed shortage is resolved. Server stock validation still determines acceptance and protects concurrent posting. The existing issue/receipt/closure costing rules are unchanged.

Action metadata is collapsible. Confirmation buttons now use the shared form footer outside the scrolling fields. An open action retains its batch identity across refreshes; if the batch closes or disappears, submission stops with an explanation. The existing beef/lamb preparation view remains accessible.

## Verification and visual review

Six focused availability tests passed: pending deductions without incoming credits, duplicate ingredients, accepted/foreign/stale/duplicate command identities, Arabic input and micro quantities, absent/incomplete stock, and previously over-claimed stock. TypeScript, the Next production build and the hosted build passed.

Public deployment verification passed: expected live build, correct HTML asset references, exact JavaScript/CSS/printing-helper hashes, unauthenticated401 responses, cross-origin403 and private-path404. Evidence is saved in `.cloud-build/live-verification.json`.

- JavaScript SHA256: `526fbdb2e5c743ab0ccb9f462b24f1355f2a8c27f6ee3c13d239024c7a10f6dd`.
- CSS SHA256: `c26b0e49d995af85b40cf3a491d9c89511cfc9b8f5a44ac51b8457fe7e862527`.
- Printing helper is unchanged: `4a3316e7c0efb7dba522f61c0cef0c02634a04db88446b6656e5a6d9c18a17dd`.

The initial interface review captured three steps: (1) desktop batch overview, with crowded actions and weak hierarchy; (2) issuance, with no stock/shortage guidance; (3) mobile issuance, where metadata and confirmation controls displaced ingredients. Accepted before-change images are in `.cache/central-ux-audit/01-batches-before.png`, `02-issue-before.png` and `03-issue-mobile-before.png`.

Post-change browser inspection was interrupted by an automatic approval-review usage limit. The user explicitly chose to perform visual checking themselves. This release therefore claims build, calculation and public-asset verification; it does not claim completed post-change desktop/mobile interaction or accessibility verification.

The preserved local preview uses port3137 and `.data-central-preview`. Its health returned200 after restarting it as a hidden background process. Source parity includes the original local recipe-default edits already integrated in Worker104; independent local and hosted databases remain separate.

## Rollback

The previous frontend is Worker104 `0997ad82-7bb9-457c-b810-0d4a71627884`, build `34f88b834a5f7bc6`. It uses the same backend24 and staged production data. Frontend rollback requires no database changes.
