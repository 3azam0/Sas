# Employee profiles, salary details and salary advances — 2 November 2026

HR implementation is ready for the coordinated application release. This chat did not build or deploy the backend or Cloudflare Worker; the other release chat is handling the combined release, and the user requested deployment after HR finishes. Do not report these UI changes as live until that release completes.

## Included

- Separate navigation entries for **ملفات الموظفين** and **الحضور وجهاز البصمة**. Opening a profile replaces the employee directory with a dedicated employee screen.
- Employees sort numerically by code, starting with the imported 101–165. Employee code and device badge show the same saved binding. New profiles suggest the next numeric code (166 for the imported roster). No physical device write or renumbering occurs.
- Job dropdown seeded from existing profile titles. **إضافة مسمى وظيفي** adds a shared persistent option directly from the dropdown. The user explicitly excluded a full job manager.
- Profile tabs: personal details, monthly salary in EGP, and **السلف**. The user clarified salary advances, not equipment/cash custodies.
- Salary fields: base pay, monthly allowances, fixed deductions, effective date and notes. Calculated monthly net is before attendance and advance repayments. No payroll payment or automatic deduction is posted.
- Advances record amount, date, reference and notes. Partial repayments record amount, date and notes; totals show issued, repaid and outstanding. The server checks exact decimal balances, rejects overpayment and repayments before the advance date, and deduplicates same-operation retries. Advance and repayment records are append-only for the API role.

## Deployment

Published in the coordinated release on 2 November 2026: frontend `81c70837fc46bee1`, `fodo-api` version 30, Cloudflare deployment `da18212e0e8a4bfdbf742f0731c5c21d`. Live health confirmed the build; all 65 employee records remain present. See [combined release evidence](releases/stock-document-corrections-units-2026-11-02.md).

## Database and release order

Migration **20261102191916_hr_profiles_salary_advances** is already applied to the existing `sas` project (`bkkxrptgwbrwredauopq`), and its matching SQL is saved under `supabase/migrations/`. It adds four tenant-scoped tables with forced RLS: `hr_job_titles`, `hr_salaries`, `hr_advances`, `hr_advance_repayments`. Owner/manager authorization remains required through the HR API. Public and authenticated direct table access is denied.

Verified live after migration: **65 employees preserved**, **38 existing job options seeded**, **0 salary records**, **0 advances**, **0 repayments**. No salary amounts or advance transactions were invented. Physical K14 pairing remains a separate branch-computer action.

For the coordinated release, build the current sources, deploy `fodo-api` before the frontend, and preserve the existing `verify_jwt=false` configuration because the backend authenticates browser and device requests itself. This release needs the already-applied migration above. No further live data seeding is required.

## Verification

- TypeScript passed.
- 27 targeted tests passed across HR services, worker authorization, navigation and help; the earlier attendance/roster suite also passed.
- Additional actual-migration checks cover title seeding, tenant isolation and append-only financial records.
- `scripts/check-hr-ui.mjs` passed on desktop and phone: numeric order, matching codes, next-code suggestion, separate profile/attendance screens, job option persistence, same-operation retries, salary save, partial advance repayment (1000.30 − 400.10 = 600.20), attendance, pairing and shift planning. Screenshots and results are under `.cache/hr-ui/`.
- Security advisors reported no new table/RLS findings. The existing Auth leaked-password-protection warning is unrelated to this change.

Useful commands: `pnpm typecheck`, `pnpm exec vitest run tests/hr.test.ts tests/hr-worker.test.ts tests/categories-navigation.test.ts tests/client-guide.test.ts`, and `node scripts/check-hr-ui.mjs` (set `PLAYWRIGHT_CHROMIUM_EXECUTABLE` when using installed Chrome).
