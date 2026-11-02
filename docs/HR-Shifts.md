# Flexible shifts and daily attendance

Deployed with user approval on 2 November 2026: migration 20261102181825, fodo-api version 28, hosted build 3251c732b442d5e4. Live health and unauthorized-access checks pass. Both new tables enforce tenant RLS and deny UPDATE/DELETE to fodo_api. No real shifts or employee schedules were seeded. It adds the **الشيفتات والملخص اليومي** tab in HR.

## Matching and calculations

Managers define named shift templates with start/end times, an effective start date, a fixed unpaid break deduction, lateness grace, and early/late matching windows. There are no seeded real shift times. Default windows are 120 minutes before and 240 after start, adjustable when creating a template; grace and breaks default to zero. End before start means overnight. Shifts must be shorter than or equal to 16 hours, with a shorter break.

The first eligible punch chooses the nearest shift start among templates effective for that date. A 16:30 arrival matches a 16:00 shift and records 30 late minutes with zero grace. Candidates within 15 minutes of equal distance require review. A dated assigned shift overrides automatic detection. Arrivals outside all configured windows remain unscheduled; assigning the correct shift resolves that day. Existing templates remain immutable; changed hours use a new template, and dated assignments resolve any resulting ambiguity. New templates can change automatically detected historical results if deliberately backdated; these are derived previews, not finalized payroll records.

The first and last distinct local timestamps within the matched shift window provide an estimate of worked minutes, minus the configured break. Internal exit/return breaks are not inferred. Checkout collection ends at shift end plus the configured late window or before the next assigned shift. Thus overtime beyond that cutoff needs review and a suitable window. Midnight checkout belongs to the preceding overnight shift, and punches are not reused. Closely repeated stamps less than five minutes apart require review instead of proving checkout. One punch produces a missing-punch status after the window closes.

Early departure measures minutes before planned end; candidate overtime measures minutes after it. These are informational and do not approve payroll or payments. Grace minutes are deducted from arrival lateness; e.g. 30 late minus 10 grace displays 20 chargeable late minutes. Work spanning a Cairo DST offset change requires review, with duration/overtime withheld because the device supplies wall times without UTC offsets.

## Schedules, days off and absence

For each employee/date a manager can assign a shift, return to automatic detection, schedule a regular monthly day off, or record approved leave. Work assignments may change on any date; every change stores its actor, reason and increasing revision in an append-only history. Overlapping assigned shifts are rejected, including overnight overlap. The UI shows the latest 200 schedule changes within the report period. Raw device logs are never rewritten.

Each calendar month allows four regular days off per employee. The display separates scheduled dates, dates already passed and slots left to schedule. A fifth regular day is rejected. Changing a day off to another type releases that month's slot. Approved leave is separate; no automatic rollover is assumed. Days off and leave are planned explicitly: missing punches do not consume the allowance. A punch on either kind of nonworking day requires review.

Absence is calculated only for an explicitly assigned work day, after its entire collection window closes, and only when that employee's device has successfully synced beyond that point. Otherwise the day is upcoming, in progress or awaiting sync. Unscheduled employees without punches are not automatically absent. Hire dates exclude earlier dates; historical explicit schedules remain visible for inactive employees. Reports cover at most 31 days and reject over 50,000 source punches instead of silently truncating them.

## Persistence and release

`hr_shifts` stores immutable templates. `hr_roster_events` stores append-only daily schedule revisions. Existing command receipts make retries idempotent; organization locking serializes quota and revision checks. Existing owner/manager permissions apply. The additive migration `20261102181825_hr_shifts_roster.sql` enables and forces tenant RLS, revokes browser database access and grants only SELECT/INSERT to the internal API role. No device-agent changes are required.

Apply the migration before deploying the matching `fodo-api` and frontend. The earlier employee/device migration must already exist. No shift, employee, schedule or attendance data is seeded during release. Shift hours and rules are entered by the owner/manager.

Validation: TypeScript, attendance/domain and HR integration tests, actual migration RLS checks, cloud bundle build and synthetic desktop/mobile browser checks. Physical K14 acceptance remains a separate step; payroll approval, paid-leave balances, multi-shift days, split shifts and finalized payroll periods are outside this slice.
