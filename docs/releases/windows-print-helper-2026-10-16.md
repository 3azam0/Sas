# Windows direct-print helper — 16 October 2026

Delivered a Windows-only print helper for FooDo receiving documents, kitchen supply documents and reports. A4 uses an installed Windows printer driver; 80 mm receipts use a configured ESC/POS RAW queue and browser-rendered Arabic/logo raster pages. The application submits directly without invoking the browser print dialog. Android is deferred.

## Release identity

- Helper: 1.0.0, protocol 1, portable unsigned .NET Framework 4.8 executable for Windows 10/11.
- Hosted build: f21015cbfa86cf90; source: 03ca287.
- Cloudflare version: 78 / 3232473d-70fa-4ab4-91ab-69c58b296344.
- Deployment: 03557ae5-b0fb-47a5-a435-512611be4c9e; read back at 100% traffic.
- Supabase API remains 15; no database migration or client transaction changes.
- [Download Windows ZIP](https://fodo.am-agent2026.workers.dev/downloads/foodo-print-windows-1.0.0.zip).
- ZIP: 24,370 bytes; SHA-256: 1712201035226a9dd6efa9d74007054d38b26d0a49574aa26345efd8559ab3dd.
- EXE SHA-256: fcee1f4a0b3a239277d163da8a64066c7aeb15ea8c698eff7342ae64babe15ee.

## Verification completed

- Native build and 18 protocol/security/job checks passed, using an isolated cache directory and fake printer backend. Includes real loopback HTTP, exact-origin CORS, pairing expiry/rate limits, organization-scoped tokens, PNG bounds, duplicate-job idempotency and restart-without-replay behavior.
- 29 focused web/Worker/guide/release tests passed across five files; TypeScript, production web/offline build and hosted bundle build passed.
- Downloaded the deployed ZIP and matched the manifest SHA-256 and byte count.
- Hosted browser checks: readable Arabic/logo in A4 and 576-dot 80 mm raster output; receiving and kitchen supply print screens; long 50-item receiving document with four A4 pages, repeated table headings, correct EGP 7,005 total, signatures and fully visible final footer. A4 heading/metadata overlap and final-footer clipping were repaired and rechecked in the deployed build.
- Printer setup/download/pairing controls are visible; direct submission remains disabled while unpaired. No print button submitted a physical job during this verification.
- [Hosted print-screen evidence](../../../Windows-Print-Helper-20261016/helper-setup.png).

## Operating and acceptance limits

Extract the ZIP, run Start-FooDo-Print.cmd, select installed printer queues and save them. Pair the FooDo print screen using the one-use code shown by the helper, then choose paper and print directly. Keep the helper running. It listens only on 127.0.0.1:17856, permits exact FooDo/local-development origins, and binds credentials to the origin and organization. It does not install drivers, alter the default printer or create automatic startup entries.

Physical A4 and 80 mm tests on the client's actual Windows device/printer/driver remain required, including margins, 512/576/640-dot width selection and optional cutter behavior. No exact Xprinter model has been supplied or certified. Windows may show a warning for the unsigned executable; it is not code-signed. Local-network access approval may be required by the browser. Submitted status means queue acceptance, not proof of paper output. Lost/ambiguous responses require status and printer review; reprinting is explicit and never automatic.

See [printing operations](../runbooks/Printing.md), [developer guide](../Developer-Guide.md) and [master plan](../Master-Plan.md). The branch is committed locally. A noninteractive push to origin feat/windows-print-helper failed because Windows could not run Git Credential Manager (NtCreateDirectoryObject access denied), so publication/remote CI remain pending.
