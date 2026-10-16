# A4 and 80 mm roll printing

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
