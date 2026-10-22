# Windows direct printing — A4 and 80 mm

Current scope: Windows helper 1.0.0 and the FooDo browser integration. Android remains deferred. Exact printer models and physical output still require acceptance on the client's equipment.

## First setup

1. Open a receiving/kitchen document's print preview, or choose **طباعة التقرير** in Reports.
2. Expand **إعداد الطابعة · ويندوز** and download the Windows helper. Extract the ZIP and open **Start-FooDo-Print.cmd**. Windows 10/11 with .NET Framework 4.8 is required. Install the printer's official Windows driver first.
3. In the helper window, choose the A4 and/or 80 mm printer queues and save. A4 uses an installed driver that advertises A4. The roll uses ESC/POS raster through an installed queue; confirm the usable width (512/576/640 dots) for the exact model. Cutting is opt-in for printers supporting the command. PDF/XPS/Fax/OneNote virtual queues are excluded because they can open their own save dialogs.
4. Enter the helper's one-use pairing code in FooDo and connect. The code expires after 10 minutes. Allow the browser's local-device connection permission if asked. That initial connection permission is separate from printing.
5. Choose A4 portrait/landscape or 80 mm roll. **معاينة نسخة الطابعة** shows the actual raster pages. **طباعة مباشرة** sends the job without calling the browser print dialog.

Keep the helper running; minimizing sends it to the tray. Its window/tray menu can close it. It does not install drivers, change the default printer, register a URL scheme, add startup tasks, change certificates or add firewall rules. The package is unsigned; ZIP/executable SHA-256 hashes are provided in the download manifest. The initial download requires connectivity.

## Documents and reports

Receiving/kitchen documents include every line, independent of screen pagination. Receiving retains base quantity, pack conversion, inventory-unit cost and total. Unaccepted documents carry a provisional warning; pending kitchen costs remain unknown. Printing never posts inventory or changes stock.

Reports preserve filters, scope, update/cached state, full filtered totals and explicit current-detail-page scope. A4 includes charts; roll output uses labelled stacked rows. A4 raster pagination repeats table headings and prefers complete rows/charts. Long rolls are emitted as consecutive image strips with one final optional cut. Arabic/logo rendering occurs in the browser, avoiding reliance on a printer's text code page.

## Job status and reprints

The helper accepts one job ID once, rejects changed data under the same ID and stores scoped receipts. The browser stores the job reference before submission. A lost response is **unknown**, not proof of failure; the UI never automatically resends. Use **تحقق من حالة الطلب** and inspect the printer before explicitly confirming another copy. **submitted** means handed to the queue, not proof that paper printed. Restarting the helper marks queued/sending receipts unknown without replay. A failure confirmed before sending is shown separately.

## Local security and offline operation

The helper binds only to **127.0.0.1:17856**. Allowed website origins are exactly the hosted FooDo origin and **http://127.0.0.1:3108** for the existing local environment. The Host header is checked; CORS/PNA responses are restricted to allowed origins. Pairings bind a random token to origin and organization; only token hashes are retained by the helper. Pair attempts are limited and pairings can be revoked from its window. Browser credentials are scoped by organization and are never sent to Cloudflare/Supabase. The helper exposes no file, shell, network-target or remote-settings API.

Settings and job receipts live under **%LOCALAPPDATA%/FooDo/PrintHelper/settings.json**. Raster pages are kept in bounded memory only. Requests are capped at 16 MB, 40 pages and 32 million image pixels; PNG headers/decoded dimensions are checked. Pending work is bounded and only one worker submits jobs. The app's hosted CSP permits only the fixed helper address in addition to its existing same-origin connections.

Already-authorized cached documents can print locally without Internet signing. This does not extend the app's offline authorization or document availability. User/device access to Windows and the paired browser remains necessary.

## Build, tests and release

Run **helpers/windows/Build.ps1 -Test** to compile, execute native checks without a printer, and create the portable ZIP plus manifest under **apps/web/public/downloads/**. Generated binaries are ignored by Git. GitHub CI builds/checks the helper on Windows and passes the artifact to the hosted build on Linux. Hosted builds verify the ZIP manifest hash and include the helper bytes in the build identity. The user guide remains in-app and is not downloadable.

Before real use, test Arabic/logo legibility, long names, all lines/totals, A4 page breaks/margins, roll width, optional cutting, paper-out/offline behavior, interrupted submission and explicit reprints on each actual printer. Generic ESC/POS compatibility does not certify every Xprinter variant.
