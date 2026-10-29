# Automatic forms and average recipe estimates — 29 October 2026

Published to https://fodo.am-agent2026.workers.dev after the user explicitly prioritized deployment and source unification.

## Active release

- Frontend build: `bdc27349fb53deba`.
- Cloudflare Worker version 102: `73ba01b0-c452-46b3-b146-366334621263`.
- Deployment, 100% traffic: `05134937-7da4-4eac-bb15-40b8d44f6ec1`.
- Implementation and passing browser verification: `44c11c51f07df0d46aa1e9b6f18b925f43352215`.
- Supabase `fodo-api`: version 23, ACTIVE, retaining existing authentication configuration.
- Backend source SHA256: `db1bb720d5be3987e7b3f9d848f77bf8413ae0d2b9fe40fba28616c75e80d667`. Downloaded deployed `index.ts` matches the prepared backend source exactly.

New material, recipe and production reference fields are automatic. Existing identifiers and recipe-version identifiers are preserved. Allocation occurs inside the existing organization transaction, without a schema migration. Weighted average remains the primary recipe estimate, with last receipt offered only as an independent comparison. Missing component prices remain incomplete. A read-only database check confirmed the hosted organization already uses `moving_average`; no costing conversion or balance reset was performed.

## Verification

TypeScript, the Next production build and the Cloudflare build passed. Seven focused test files passed 42 tests covering numbering, concurrency, retries, recipe versions, setup, production, costing and offline behavior. The isolated desktop/mobile browser scenario passed: automatic recipe/material codes, changing receipt comparison without changing the primary average, layout, and no stock movement from definition changes.

`node scripts/verify-forms-release.mjs` verified the live health/build, HTML asset references and exact live/local SHA256 hashes for JavaScript, CSS and the Windows printing helper. Anonymous bootstrap returned 401; cross-origin posting returned 403; private file paths returned 404. The deployed backend starts and rejects unauthenticated access with 401. Evidence: `.cloud-build/live-verification.json` and `test-results/recipe-forms-unified-*.png` (local generated files).

The authenticated existing Chrome session could not be inspected: Computer Use stopped because it could not confidently determine the current browser URL. No further UI actions were attempted. Public verification and isolated browser verification are separate checks; this release does not claim an authenticated live stock-posting test.

## Local source and recovery

The managed `recipe-forms-compatibility/Sas` checkout is the release source. The original `D:/New folder (3)/Sas` checkout is synchronized from the same release lineage, retaining its ignored databases, environment files and dependencies. These are source-code parity checks, not a promise that independent local and hosted databases contain identical transactions. Rebuild/install from the synchronized lockfile before running that old checkout; do not open the incompatible prototype database with the current posting code.

All old tracked and untracked prototype changes were preserved before switching source:

- Recovery stash commit: `85a50e801ccd6f0a694262afc8354cc30c4d1355`.
- Independent Git bundle: `.cache/local-parity-backups/prototype-before-parity.bundle` in the managed checkout.
- Backup manifest: `.cache/local-parity-backups/backup-record.json`.
- Original `main` branch remains available. Recover prototype work on a separate branch using `git stash branch codex/recover-production-prototype 85a50e801ccd6f0a694262afc8354cc30c4d1355`; do not apply it over the hosted-source branch.

The staged, multi-output work-in-progress prototype is preserved for a later additive integration. Partial production receipts, unused-material returns at original issue cost and WIP reconciliation are not delivered in this release. See `docs/Version-Unification.md` for the schema/lifecycle differences. Existing hosted purchasing, production, lots, sales, exports and printing remain part of the deployed application.

## Rollback

Previous Worker version: `c7421acf-1cd1-40e1-9410-78954e9d5edf`, build `413ca955b6fc9feb`. The previous API22 sources were retained during release. The new backend is backward compatible with old manual-code forms, so the previous frontend can be reactivated without resetting data. Do not roll the backend back while the new automatic-code frontend is active.
