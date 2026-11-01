# K14 Pro maintenance handoff — 1 November 2026

This operation is complete. It is not a startup procedure and must not be replayed.

## Verified outcome

- Before replacement: 145 users and 250 fingerprint templates. A full local JSON backup of users, templates and attendance records was saved before deletion; the original MDB was preserved.
- After explicit user approval, old users, fingerprints, attendance and operation logs were cleared. Uploaded 65 users with badges 101–165 and 101 templates belonging to 51 employees. Fourteen employees need fresh fingerprint enrollment.
- Read-back verified every expected badge and fingerprint slot, with no unexpected templates. 95 templates are byte-identical; six have exactly six appended zero bytes and unchanged original bytes. Do not describe all 101 as byte-identical.
- Names on the device use English because this SDK path returned Arabic as question marks. Arabic names remain in the private mapping/workbook/MDB.
- Device was re-enabled successfully. Physical fingerprint recognition still needs the user's on-device test.
- Attendance history was empty at verification. New punches after that are valid new records and must be preserved.
- The pre-reset backup has 50 records dated 2026-11-01 according to the device clock: 45 map to 28 retained employees; five records across three old IDs need human matching. They were displayed in chat only, not restored to the device or Fodo. Do not infer work shifts from calendar-date grouping.

## Technical lessons and pending work

K14 Pro firmware is Ver 6.60 Apr 13 2022, platform ZLM60_TFT. Official COM SDK is registered in 32-bit Windows PowerShell. On this laptop, direct Ethernet required a temporary address in the device subnet; the temporary address was removed after each operation. No router or public port forwarding is needed.

SSR_SetUserTmpStr failed on the first template; SetUserTmpExStr with flag 1 succeeded for the version-10 templates. The source MDB reported Flag=1 and DivisionFP=10. The private one-time script supports resume without repeating deletion. It is historical recovery tooling, not a tested general deployment utility.

Current safe work: validate physical matching, enroll the fourteen users, then take a new full backup. HR employee files and attendance sync inside Fodo are not implemented. Shifts, payroll and HR permissions are postponed.

## Private records

All names, old-to-new mappings, original documents, MDBs, template JSON, full backup, execution report and one-time scripts belong in the private transfer archive, never GitHub. Repository docs intentionally contain no individual identity mapping or communication key.

The transfer archive README lists filenames and their purpose. Neither a USB-native device import format nor a tested direct-device restoration of attendance logs has been established. The prepared MDB is for the attendance software; the actual device upload was performed through the SDK.
