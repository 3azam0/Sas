# Opening stock — first-client development walkthrough

This slice establishes starting quantity and cost for materials that have never moved in a stock location. It is not a stock adjustment, purchase order, tax invoice or supplier return.

## Open and enter a baseline

Start the project's `Start-Fodo.cmd` in your Windows session, keep its window open, and use the saved address, normally `http://127.0.0.1:3108/`. After a rebuild, stop the old console with Ctrl+C and launch again at the same address. Refresh the browser to load the new build; do not clear IndexedDB or reset the database.

1. Connect once to download the application shell and current catalog.
2. Choose a branch/warehouse/preparation location. Existing sample stock cannot receive another opening baseline. Create a new material or location through **إعداد المخزون** for a walkthrough; the seeded history stays intact.
3. Open **الرصيد الافتتاحي**, then **إضافة رصيد افتتاحي**.
4. Enter the opening business date and reference. Future dates are rejected. Add material lines with positive base-unit quantities and non-negative cost per base unit. Omit materials with zero starting stock. Materials cannot repeat within a document.
5. Check the per-line values and document total, then select **حفظ الرصيد الافتتاحي**. Saving creates an immutable local pending document; confirmed quantities and values change only after server acceptance.
6. Inspect the document status and line details. **سجل الحركات** shows each accepted line as **رصيد افتتاحي**. Inventory quantity previews include pending baselines separately from confirmed balances.

Example: 10 kg at EGP 20/kg produces EGP 200 opening value. After acceptance, wasting 2 kg consumes the opening FIFO layer and leaves 8 kg valued at EGP 160. Zero cost is supported explicitly and creates a zero-value layer.

## CSV preview

Use **تنزيل قالب CSV** or a UTF-8 comma-delimited file with a header row. Map material code, quantity and unit-cost columns to different fields. A unit column is optional; if supplied, its value must exactly match the catalog's base-unit label. Codes stay text, including leading zeros. Arabic and Persian numerals and Arabic decimal separators normalize to decimal strings.

The file limit is 1 MiB and 200 data rows. Quoted commas/newlines and escaped quotes are supported. Unknown/inactive codes, duplicated materials, incorrect units, malformed numbers, repeated/empty headers and inconsistent columns produce visible errors. Preview replaces the editor's lines only when all imported rows are valid; it does not create catalog records or post stock. Editing imported lines clears their file-source claim. A saved unmodified import retains the file name and SHA-256 fingerprint.

## Offline, review and recovery

Saved documents survive browser restart. Setup synchronizes before opening stock; opening documents are accepted before their dependent receipt/waste commands. A rejected opening puts dependent commands into review instead of posting them against another baseline. After resolving the baseline, retry dependent commands explicitly.

A document is posted as one transaction, including its lines, FIFO layers, balances, acceptance receipts and actor audit. A failed line rejects the full document. Tenant locking prevents competing devices from establishing two baselines; retrying an accepted document ID returns its original result. Item/location history and balance rows remain a guard even when current quantity reaches zero.

Use the opening document's review controls to retry unchanged data, cancel a known rejection, or create a corrected document with fresh document/line IDs. The old rejected document remains linked and inspectable. Accepted documents cannot be edited or cancelled in place. A physical correction to accepted stock belongs to the upcoming count/adjustment workflow.

Recovery version 8 contains count/transfer/purchase/return actions and linked return corrections, opening documents, setup changes and stock commands. Import previews and validates all records/IDs together, deduplicates known records and commits local restoration atomically. Exported acceptance is never trusted without server reconciliation. Versions 1–7 remain readable by this build; older builds cannot read version 8. Keep the origin unchanged to retain the browser's existing offline records.

## Current boundaries

Only EGP development costing and the current local session are supported here. The document date uses Africa/Cairo; FIFO ordering follows server acceptance sequence rather than silently reordering history by date. Accepted document history in the snapshot shows the latest 100 organization documents; stock movement history shows the latest 100 movements. Baseline eligibility uses all server history, not these display limits.

Large/XLSX import jobs, production access and posted-opening reversals remain separate work. Stock counts and reconciliation are delivered in Phase 3B; see [Stock counts](./Stock-Counts.md). Purchase documents, partial receiving and source-linked supplier returns are delivered; see [Purchasing](./Purchasing.md). Do not treat this development build as a live fiscal/accounting system.
