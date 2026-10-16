# A4 and 80 mm roll printing

## Scope amendment — direct printing requested

The client now requires Windows and Android printing without the browser print dialog. Xprinter is an example brand; the exact printer model/interface has not been chosen. The hosted A4/80 mm layouts below are delivered, but their current transport is still `window.print()`. Direct printing is pending and must not be described as already supported.

For the current web-first release, the proposed setup is a local print connector at the branch: save separate A4/80 mm printer mappings, pair authorized devices once, and send explicit Print actions to the configured printer without invoking `window.print()`. A Windows print station can provide the installed A4 driver and USB/network receipt-printer access for both its own browser and Android browsers on the same LAN. That arrangement requires the station to remain running. If Android must print independently when the station is off, add an Android companion/native adapter; a web/PWA installation alone does not implement that native connector.

Keep document rendering and print-job contracts shared across these adapters. Use printer-width-aware raster output for Arabic/logo consistency on thermal printers; confirm usable dots/width and cut capability for each chosen model. Do not claim every Xprinter or Bluetooth variant is compatible. Network-capable receipt printers are the proposed shared-station target; USB can be served by the Windows station.

Required implementation: paired device authentication, explicit allowed app origins and printers, authenticated local transport, device-specific printer mappings, bounded job size/queue, stable job IDs, submission status, explicit reprint handling and actionable unavailable-printer errors. Do not put signing secrets in the web bundle, expose arbitrary local file/command access, silently fall back to the browser dialog or automatically replay a job after an ambiguous printer submission. Spool acceptance is not proof that paper printed. The LAN/connector route must work without Internet access for already-authorized cached documents; a cloud-only signing dependency would not meet that requirement.

The remaining setup decision is whether Android needs independent printing or may use the running branch print station. Hardware acceptance must cover both devices, Arabic, logo, long receipts, A4 pagination, paper-out/offline conditions and an interrupted submission. Xprinter publishes [Android and Windows SDKs](https://www.xprintertech.com/sdk.html). QZ Tray is a possible Windows bridge, but suppressing its own dialogs requires [trusted message signing](https://qz.io/docs/signing); do not treat installing it alone as silent printing or assume Android runs the desktop connector.

## Current hosted behavior

Open a saved receiving document and choose **عرض وطباعة مستند الاستلام**. Kitchen supply uses **عرض وطباعة المستند**. Reports use **طباعة / PDF**. Each opens the same preview with A4 or **رول 80 مم (8 سم)**; A4 supports portrait/landscape, and the browser remembers the paper choice on that device.

Receiving and kitchen documents print every document line, independent of screen pagination. Receiving shows base-stock quantity, entered-pack conversion where recorded, unit cost per inventory unit and total. An unaccepted document carries a provisional warning; pending kitchen costs remain unknown. Printing never posts a document or changes stock.

Reports preserve the selected period, scope, filters, update timestamp and cached-copy status. Totals and charts cover the full filtered range; the details explicitly cover the current page only. Print each required detail page or use the existing complete CSV export. Inventory reports remain current balances rather than historical balances. Missing estimates/reconciliation values remain incomplete; financial results remain estimated. Sales shortages retain their full location/period scope.

A4 includes charts. The roll uses compact summaries and labelled item rows without charts. Long names and document IDs wrap. Long roll output may span multiple pages/cuts; the app does not issue ESC/POS cut or cash-drawer commands.

## Printer setup and client check

1. Choose the paper in FooDo, then **طباعة / حفظ PDF**.
2. Select the printer (or PDF) in the browser dialog. Match A4 or the installed 80 mm roll driver paper, use 100% scaling and disable browser headers/footers. A4 direction must also match the preview.
3. Check a sample on the actual printer for Arabic shaping, logo, long material names, conversions, all document lines and final totals. Check a long document for page breaks/cuts.

The preview uses 210/297 mm A4 and an 80 mm roll with 3 mm inner side padding. The custom roll height is measured after fonts/images/layout are ready and capped at 1000 mm per CSS page; longer content paginates. Driver support and printable margins require the physical-device check. Silent printing, automatic printer selection, tax invoices, kitchen order tickets and raw thermal commands are outside this change.

## Implementation

`apps/web/src/PrintPreview.tsx` owns the body-portal modal, paper preference, orientation, font/image readiness, focus restoration and explicit print action. `printing.ts` builds valid `@page` sizes. `PrintTable` supplies roll labels; document sheets render without list pagination. `ReportPrint.tsx` pins the report response selected when the preview opened. `app/printing.css` is imported last in both Next and hosted entrypoints and isolates the preview during print.

The user guide includes **الطباعة على A4 ورول 80 مم**. The guide itself remains an in-app resource without a download action. Application/offline bundles include the print components; document availability still follows existing cached/synchronized data.
