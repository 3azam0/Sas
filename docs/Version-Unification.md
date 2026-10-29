# Unification against the current hosted application

Reviewed 29 October 2026. The user's latest instruction authorizes deployment first, verification of the live release, and then local/source parity. Release the compatible backend before activating the new frontend. Central Kitchen uses an additive, tenant-scoped migration; no customer data was deleted. Browser fixture postings remain isolated from the hosted organization.

## Authoritative source

The starting hosted baseline was build **413ca955b6fc9feb**, API22, recorded in `docs/releases/print-exports-2026-10-29.md`. Implementation commit was `e2597d08ab908f45ec152891d7ba73f66a617514`; source was checked against the `chore/qibli-trial-stock` head **07c9ded**. The later automatic-forms release used build **bdc27349fb53deba**, Worker102 and API23.

The attached `recipe-forms-compatibility` worktree starts from this advanced application. The old `D:/New folder (3)/Sas` main checkout was not a release source. Its prototype is preserved in stash `85a50e801ccd6f0a694262afc8354cc30c4d1355` and an independent bundle under `.cache/local-parity-backups/` before synchronizing that folder to the hosted release lineage. Do not restore the prototype directly over the hosted application.

The verified Central Kitchen release is build **34f88b834a5f7bc6**, Worker version **104**, compatible API **24**. See [verified release and recovery details](releases/central-kitchen-2026-10-29.md). Live JavaScript/CSS hashes and deployed backend source match the prepared local release. Migration `20261029145734_central_kitchen_batches.sql` was applied additively. No customer-data deletion or live business posting was performed.

## Integrated compatible changes

- Automatic material (`MAT-`), recipe (`REC-`) and production (`PROD-`) codes in the real forms. Existing/imported codes are retained. Number allocation occurs under the existing organization transaction lock, using the record tables; no counter-table migration or data reset is needed.
- Missing codes on new forms are filled by the server after acceptance. Offline UUIDs remain the durable identities, and same-ID retries return their original receipt. Pending codes are presented as pending rather than guessed per device.
- Recipe versions retain their established recipe code; changing components or publishing a version does not renumber the recipe or rewrite old versions.
- Average stock value/quantity remains the primary recipe estimate. Latest accepted receipt price is a separate comparison and does not select actual inventory valuation. Missing component prices remain incomplete, with no fallback that silently prices them as zero.
- Current purchasing, supplier returns, lots, sales, reports, printing, permissions, recovery, unit conversion and immutable recipe versions are retained.

## Structural differences that must remain explicit

The prototype and hosted application both use the table name `production_batches`, but with incompatible schemas and posting lifecycles. The prototype has staged multi-output WIP; the hosted app has immutable recipe-version-based production posts with a single stocked output. Copying prototype tables or posting code would break existing production, stock lineage, supplier returns and reconciliation.

The staged cycle is now implemented additively in `central_batches` and `central_actions`, through the existing `Database` boundary, tenant policies, permissions and generation checks. Legacy `production_batches` are unchanged. Material issues reserve real stock at the configured valuation, returns retain original issue-source value and lot metadata, and physical partial receipts are recorded in a separate holding ledger. The user chose to allow dispatch only after closure: unpriced held receipts never enter the available moving-average pool. Closing capitalizes final product values, allocates multiple outputs explicitly and leaves downstream transfers/consumption on their existing accepted-stock path. Recovery version 25 includes the new queue. See [operator workflow](runbooks/Central-Kitchen.md).

Historical FIFO records remain readable. Actual stock posting follows the organization's configured costing method; a recipe estimate selector does not migrate an organization. New organizations already default to moving average. A live conversion, if needed, must preserve quantity/value, record its effective point and handle outstanding offline work without resetting customer data.

Normal yield loss remains absorbed into produced stock. The existing explicit **abnormal waste** field remains expensed separately; do not relabel or capitalize abnormal waste while merging the prototype's general loss handling.

## Verification and release gate

Run code-generation/concurrency/idempotency, recipe/production/setup and offline tests; verify real forms on desktop/mobile; build the hosted artifact. Deployment must include the compatible backend with the frontend: the old API requires manual codes and cannot accept the new empty-code form payloads. Verify live build and API versions immediately before activation to avoid replacing a newer release, then verify deployed source hashes and retain rollback version IDs.
