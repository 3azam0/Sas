# Unification against the current hosted application

Reviewed 29 October 2026. The user's latest instruction authorizes deployment first, verification of the live release, and then local/source parity. Release the compatible backend before activating the new frontend. This release needs no database migration or data deletion; browser fixture postings remain isolated from the hosted organization.

## Authoritative source

Read-only live health at `https://fodo.am-agent2026.workers.dev/api/v1/health` reports build **413ca955b6fc9feb**. The source release `docs/releases/print-exports-2026-10-29.md` records that same build and API22. Implementation commit is `e2597d08ab908f45ec152891d7ba73f66a617514`; source was checked against the `chore/qibli-trial-stock` head **07c9ded**. No differences in apps/packages/cloud/scripts occur between that implementation and the starting checkout.

The attached `recipe-forms-compatibility` worktree starts from this advanced application. The old `D:/New folder (3)/Sas` main checkout is not a release source. Its local prototype work remains preserved at that path; do not overwrite the hosted app with that checkout.

## Integrated compatible changes

- Automatic material (`MAT-`), recipe (`REC-`) and production (`PROD-`) codes in the real forms. Existing/imported codes are retained. Number allocation occurs under the existing organization transaction lock, using the record tables; no counter-table migration or data reset is needed.
- Missing codes on new forms are filled by the server after acceptance. Offline UUIDs remain the durable identities, and same-ID retries return their original receipt. Pending codes are presented as pending rather than guessed per device.
- Recipe versions retain their established recipe code; changing components or publishing a version does not renumber the recipe or rewrite old versions.
- Average stock value/quantity remains the primary recipe estimate. Latest accepted receipt price is a separate comparison and does not select actual inventory valuation. Missing component prices remain incomplete, with no fallback that silently prices them as zero.
- Current purchasing, supplier returns, lots, sales, reports, printing, permissions, recovery, unit conversion and immutable recipe versions are retained.

## Structural differences that must remain explicit

The prototype and hosted application both use the table name `production_batches`, but with incompatible schemas and posting lifecycles. The prototype has staged multi-output WIP; the hosted app has immutable recipe-version-based production posts with a single stocked output. Copying prototype tables or posting code would break existing production, stock lineage, supplier returns and reconciliation.

Porting the staged cycle requires an additive migration, tenant policies, the existing `Database` boundary, permissions/generation checks, value tracing across the hosted transfer/consumption modules, recovery format evolution, and compatibility with posted historical batches. It is not delivered merely by copying the prototype files. Preserve it as a separate integration stage and do not mark partial receipts, original-issue-cost unused returns or downstream WIP cost reconciliation as present in the hosted app yet.

Historical FIFO records remain readable. Actual stock posting follows the organization's configured costing method; a recipe estimate selector does not migrate an organization. New organizations already default to moving average. A live conversion, if needed, must preserve quantity/value, record its effective point and handle outstanding offline work without resetting customer data.

Normal yield loss remains absorbed into produced stock. The existing explicit **abnormal waste** field remains expensed separately; do not relabel or capitalize abnormal waste while merging the prototype's general loss handling.

## Verification and release gate

Run code-generation/concurrency/idempotency, recipe/production/setup and offline tests; verify real forms on desktop/mobile; build the hosted artifact. Deployment must include the compatible backend with the frontend: the old API requires manual codes and cannot accept the new empty-code form payloads. Verify live build and API versions immediately before activation to avoid replacing a newer release, then verify deployed source hashes and retain rollback version IDs.
