# Live sheep receiving — 27 October 2026

Published to https://fodo.am-agent2026.workers.dev/?release=bdb497fc7930bd9b.

Selecting an item classified as live sheep in **استلام مواد** now requires head count and total live weight. The form calculates average live kilograms per head and retains cost per base kilogram. Compatible entries add both counts and weight; explicit edits replace them. Beef remains ordinary weight receiving. Mixed sheep/beef receipts, local capture, correction editing, accepted history and printing retain the head count. Inventory, transfers and butchery valuation continue to use kilograms; this does not introduce an animal register or a head-count stock ledger.

Counts are retained in the existing immutable receipt JSON, with no database migration or historical data rewrite. Count-bearing receipts use payload version 2 so older backends reject rather than discard new fields. Legacy version-1 receipts remain accepted without invented counts. Recovery containing version-2 receipts uses format 23, with a downgrade guard; other recovery exports remain format 22. Existing recovery formats retain their feature checks.

Before activation, the newer live purchase release (`49300fc`, build `611d1909728d0ef5`) was merged into the release branch. Its compact purchase editor, quick-create and existing butchery workflows are preserved. The shared entry validator's new failure case is handled in the purchase editor. Application source is recorded in `09bb7f3`, merge `02b2678`, and integration fix `6a4d5e3`.

## Deployment

- Supabase `bkkxrptgwbrwredauopq`, `fodo-api` **19**, ACTIVE. Explicit body authentication, membership checks, existing `verify_jwt=false`, and the Deno import map were retained. Retrieved deployed source matches the prepared backend exactly. Backend SHA-256: `becd3871a65c3457949eec61234e7486dcb98a53e180c485421ce13afffec062`.
- Cloudflare `fodo`, build **bdb497fc7930bd9b**, Worker **96**, version **3c06f6f1-9931-4cb7-b15c-8d88133c2f53**. Deployment **b6ca554d-2c35-46d1-90bc-d57ca2ed6823** assigns 100% traffic. Activation checked that the previous live purchase deployment was still current before replacing it. The workers.dev hostname remains enabled and preview URLs disabled.
- The live health endpoint and both assets were verified at **2026-10-27T18:15:57Z**. JavaScript and CSS match the prepared hosted files byte for byte. Live JavaScript SHA-256: `f4333179c773c172b4e8005089c012327cc7b77aeaa1e4ef8c3e48498accceb6`.

## Verification

All **66 focused integration tests across nine files** passed on the integrated source. These cover receipt validation, scope/units, atomic rejection, idempotency, exact kilogram costing, count merging/editing, printing, offline reload/recovery/sync, purchasing, butchery and kitchen outboxes. Production TypeScript/build, 47-asset offline preparation and guarded hosted build passed.

Browser verification passed for the preserved compact purchase editor and the full sheep workflow: required count, Arabic number input, calculated average, editing, mixed beef receipt, 390px layout without horizontal overflow, offline capture/reload, one-time sync, review-link navigation, history and print content. The browser scenario was corrected to use the current home action label and sync-center review link before its passing run. Screenshots and evidence are in ignored `test-results/` and `.cloud-build/sheep-receiving-live-verification.json`.

Live anonymous bootstrap/receiving access returns 401, foreign-origin receiving returns 403, and private source/config paths return 404. No client stock operation was posted for release testing. Before deployment, the live database had 246 movements, six receipts, eight butchery batches and 344 items; receipt signature `c60ac5a444fc4f7c4906918e5da75d67`. A later optional read-only database/deployment recheck could not execute because automatic approval review timed out. The successful deployment, live asset verification and retrieved backend source checks above preceded that timeout.
