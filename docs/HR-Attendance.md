# Employees and K14 attendance — 2 November 2026

## Implemented scope

The new **الموظفون والحضور** workspace provides employee profiles, raw attendance history, device pairing, token renewal/revocation and a Windows helper download. Profiles include name, phone, department, job title, hire date, active status and notes. A profile has an immutable device/badge binding; repeated roster imports update only its device name. Staff can keep an Arabic profile name even if the device uses English names.

The K14 is the source for employee badge numbers and punches. The local Windows agent uses the existing registered 32-bit ZKTeco COM SDK on the branch LAN. It imports names and badge numbers, queues unseen punches, retries the same pending batch after network failures, and sends a heartbeat after an empty scan. It neither reads biometric templates nor modifies device data. Shifts, payroll, absence and lateness calculations remain deferred.

Punch timestamps preserve the device's local wall time. The current device is operated in Cairo. Do not infer UTC, shifts or worked hours from these readings, especially around daylight-saving transitions or if the device clock was wrong. Missing profiles remain visible as unmatched punches until a roster/profile arrives. Identical same-second events with the same badge and device codes collapse because this SDK does not expose a unique log-record ID.

## Access and persistence

The existing owner/manager roles can use the HR workspace; operators/viewers cannot. HR has its own online API and tables and does not enter the inventory snapshot, offline outboxes, stock journal or recovery format. There is no local optimistic save: the UI reports a failed/uncertain request and retries with the same operation ID while the component remains mounted. Refresh after losing that state to inspect the actual server result before creating new records.

Device tokens contain 32 random bytes, are stored only as SHA-256 hashes, and are returned once at pairing/renewal. They authorize only the dedicated upload endpoint and one registered device. They cannot use browser HR or inventory APIs. Revocation and ingestion lock the same device row. Renewal preserves device identity and historical links; use renewal instead of registering the same physical device twice.

The four new tables are `hr_devices`, `hr_employees`, `hr_punches` and `hr_upload_receipts`. The migration enables and forces tenant RLS, revokes anon/authenticated access and allows only the internal API role. Punches and upload receipts are append-only for that role. Device credentials are checked by the backend before establishing a tenant transaction. No migration changes existing inventory tables or data.

## Deployment order

1. Review and apply `supabase/migrations/20261102172224_hr_employees_attendance.sql` to the existing `sas` project. Preserve the existing live database and auth configuration.
2. Deploy the updated `fodo-api` bundle. Preserve gateway `verify_jwt=false`: this entry point verifies browser JWTs through Auth itself and verifies machine tokens separately. Enabling gateway JWT verification blocks non-JWT device tokens before the handler can authenticate them.
3. Build the existing printing helper if missing, then run `node scripts/build-cloud.mjs` with the existing public Supabase key. The cloud build automatically packages the attendance helper and includes its ZIP in the build identity and published assets. Publish only `.cloud-build/publish/wrangler.json`.
4. Sign in as owner/manager, create ONE connection for this physical K14, download/extract the helper and follow its README. Run once on the LAN computer before enabling continuous startup. Check roster count and known physical punches against the K14; do not post sample punches to production.
5. Complete employee profiles and confirm device contact time and date-filtered attendance. Renew the same device token if pairing credentials are lost, then update the stopped Windows agent with `-UpdatePairing`.

Deployed on 2 November 2026 with user approval: migration 20261102172224, fodo-api version 27 and hosted build b225f85c68209967. All four HR tables have enforced RLS. Health and download checks pass; unauthenticated HR and invalid device credentials return 401. The live ZIP SHA-256 is 20db766c31c8ef21f57141b5bb12e501daa1ec567f76e5b520097df501aae07d. No employee/device/sample records were created during deployment. The actual K14 connection, its SDK availability and physical punch acceptance require the branch computer.

## Validation commands

```powershell
pnpm typecheck
pnpm exec vitest run tests/hr.test.ts tests/hr-worker.test.ts tests/hosted-worker.test.ts tests/client-guide.test.ts tests/categories-navigation.test.ts
powershell -NoProfile -ExecutionPolicy Bypass -File helpers/attendance-sync/Test-AttendanceSync.ps1
node scripts/check-hr-ui.mjs
pnpm build:cloud
```

`check-hr-ui.mjs` uses synthetic employee data and a mocked API. Set `PLAYWRIGHT_CHROMIUM_EXECUTABLE` if using an installed Chrome instead of Playwright's browser. It verifies desktop/mobile layouts, profile editing, same-ID retry after an uncertain response, attendance display, download access and device-token renewal. Screenshots and its result are under ignored `.cache/hr-ui/`.

The backend suite exercises the actual additive migration in PGlite, including RLS across organizations, denied authenticated-role access and immutable punches. Physical SDK/device testing remains required before continuous use. The Windows agent self-test uses DPAPI and a mocked HTTP response; it never connects to a device.
