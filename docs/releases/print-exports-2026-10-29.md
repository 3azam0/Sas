# Printing and PDF/Excel exports — 29 October 2026

## Delivered behavior

All existing print previews now offer real PDF and `.xlsx` downloads plus browser printing without the Windows helper: material receiving, kitchen supply, cash-sale receipts and reports. Direct printing keeps the existing pairing, job identity, lost-response and explicit reprint controls. Printer setup starts collapsed so document/export controls remain accessible.

Receipt layouts include organization contact details when available, clear document references, compact A4 metadata, roll formatting, dedicated cash totals/provisional notices and receiving lot/expiry details. All document lines remain included. Original decimal data feeds receipt Excel exports; kitchen document prices stay separate from actual stock costs. Missing values remain unknown, and unaccepted documents remain provisional.

Report export and printing gather the complete filtered result, checking page checkpoints, total counts and unique row IDs before delivery. All formats retain filter/update context and full-range summaries; cached export requires every matching page. Wide tables print in labelled column groups with repeated row identity. Preparation requirements, purchasing suggestions, transfer tracking and lot/expiry views now offer Excel/PDF alongside CSV through shared controls.

Excel uses actual OOXML, RTL, typed numbers/dates, preserved identifiers/leading zeroes, literal text rather than formulas, and exact text for values beyond Excel precision. The main data heading stays at row one; preceding context/summary moves to **ملخص المستند**. PDF preserves Arabic shaping through the existing raster capture. It is a visual PDF rather than searchable text. Existing PDF/raster size and 40-page limits produce an explicit error rather than silent truncation; browser printing offers the normal browser workflow. Opening import templates remain compatible CSV; recovery/plan backups remain restorable JSON.

See [output inventory](../Print-Export-Audit.md) and [operating guide](../runbooks/Printing.md).

## Verification

- 42 focused checks across seven files pass, covering real PDF dimensions, OOXML types, precision/leading zeroes/formula safety, unknown versus zero, report summary separation, cash receipt values, lot printing, existing print bridge/idempotency, navigation, guide and preparation behavior. The final export-file suite adds the summary-sheet/readability cases to the previously passing focused set.
- Five distinct browser scenarios pass: stock cards/butchery, existing report layout/CSV/printing/offline, preparation workflow, Excel/PDF follow-up/expiry tables, and receipt/kitchen/full-report downloads. The final acceptance run covers the changed workbook layout. It verifies A4 and roll dimensions, data across more than one screen page, five-page PDF, browser print action without a helper, mobile overflow, offline PDF and unchanged inventory.
- Generated PDFs are independently reopened/rasterized with PDFium; workbooks reopen with openpyxl. Arabic A4/roll receipt pages and the final report page were visually inspected. Evidence stays in ignored `.cache/print-export-evidence/`.
- TypeScript, production build/offline manifest, hosted build and isolated Wrangler dry run pass. Browser fixtures use unique local directories; no live business test transactions.
- Earlier browser attempts caught a test locator that incorrectly scoped a collapsed menu and missing lot metadata in the print sheet. Both were fixed and the complete scenario passed afterward.

## Deployment integrity

Hosted build **413ca955b6fc9feb**. Backend SHA256 **8a0518ea7990713a8fba1900a0484a0b1339c7d3da9ffa495eea8ab81d9f0bfe**, identical to live API22. No Supabase function replacement, database migration, recovery-format change or device-data reset. Existing inventory controls/roles, actual stock valuation, sheep receiving/butchery and kitchen document-only prices remain intact. Windows print helper 1.0.0 binaries/protocol are unchanged; physical printer acceptance remains outside browser verification.

Developed on `chore/qibli-trial-stock`. Live identifiers and read-only verification are recorded after activation below.
