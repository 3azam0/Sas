# HR daily attendance and interface — 3 November 2026

Deployed frontend `85d29ca38ab97a27`, Supabase `fodo-api` version 32, and Cloudflare deployment `072b1c1823f549008c948a4a9217938c`. No database migration was required. This supersedes the time-column-only frontend `9a17f9ffb1de85e9` (API version 31).

## Attendance behavior

- The raw **التوقيت** column shows hours and minutes in 12-hour AM/PM format. Original wall-clock dates and timestamps remain available in the date, tooltip and `dateTime` attribute; browser timezone conversion does not shift the punch.
- The default daily view has separate **وقت الدخول** and **وقت الخروج** columns. It groups by employee badge, device and calendar date, using the first timestamp and last distinct timestamp. A single distinct timestamp leaves exit blank.
- These are first/last estimates, not confirmed punch classifications or payroll approval. Overnight shifts must be reviewed in the existing shift summary.
- The server aggregates all matching punches before pagination, returns full daily totals, preserves unmatched badges and enforces tenant, role and data-generation checks. Filters cover dates, device and badge.
- Imported unknown punch metadata (`-1`) displays as **غير محدد**.

## Employee workflows

The employee directory now has search, department/status filters, summary cards and responsive mobile cards. Profiles group personal and employment fields, retain directory filters on return, restore trigger focus and warn before discarding unsaved personal details. Salary and advance screens show clearer totals, responsive entries and focused repayment forms. Existing financial calculations and write APIs remain unchanged.

## Verification

- TypeScript and the hosted production build passed.
- All 22 tests in `tests/hr.test.ts` and `tests/hr-worker.test.ts` passed. Daily tests cover pagination after aggregation, multiple/single punches, midnight calendar boundaries, unmatched badges, filters and access isolation.
- In-app-browser checks used synthetic local data: directory filters, personal save/discard flow, salary calculation, partial advance repayment, retained filters, daily first/last columns and a blank exit, raw AM/PM timestamps, and mobile layout at 390 pixels without horizontal body overflow.
- Formatter boundary checks covered midnight, noon, afternoon and late evening without altering wall-clock hours.
- Live health returned frontend `85d29ca38ab97a27`; unauthenticated HR requests returned 401 `AUTH_REQUIRED`.
- Read-only production checks found 65 employees and 45 punches for 1 November 2026: 28 daily rows, 17 with distinct first/last timestamps and 11 with a single timestamp. Salary and advance record counts remained zero. UI checks did not write production records.

Authenticated live-browser workflows were not exercised. Synthetic browser checks are not full accessibility or physical-device certification. Preview captures and verification notes are in the ignored `.cache/hr-review/2026-11-03/` folder.

## Source and data handling

The 45 confirmed attendance punches had already been imported; do not replay the import. Uncertain legacy codes 7, 39 and 73 remain excluded. No production data was modified by this interface release.

Source is saved locally on `codex/recipe-forms-compatibility`. GitHub push remains blocked by unavailable Git credentials; the connected GitHub integration also returned 403. Push authorization is already granted and does not need to be requested again.
