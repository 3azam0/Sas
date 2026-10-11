# Arabic forms and offline workflow walkthrough

Use an isolated local test database for these checks. Never import fixtures, reset costing or create test movements in the client's warehouse.

## Find and select a material

Receiving, opening stock, purchasing and recipe ingredients expose a search field above the native item selector. Search by Arabic name or SKU; Arabic diacritics and common alef variants are ignored. The selected item remains available when the query changes or returns no matches. Clear the query to show the full active catalog. The selector retains normal keyboard and native mobile behavior, and reads the tenant's offline snapshot.

## Validate a document

Required fields have visible guidance. Quantities identify their unit and costs identify their price basis. Invalid input produces a message associated with the field and moves focus to the first error after submission. Enter submits the main form; add, remove and close buttons do not submit it. The scroll body and action footer are separate. Saving disables the form and actions until the operation finishes. Closing an editor returns keyboard focus to its trigger when the trigger still exists.

Setup, direct receiving and waste retain their existing schema/React Hook Form validation. Opening stock, purchase drafts/receipts, supplier returns, transfers, counts, recipes, production, menu mappings and sales imports share `FormControls.tsx`. Field checks improve feedback; existing domain schemas, local capture and server acceptance remain authoritative. Unsubmitted text lives in the open editor; a saved local document survives reload through Dexie.

## Count part of the stock

Start a count from a synchronized location baseline. Search by name/SKU, filter by category or select counted/uncounted items. Filtering keeps all entered quantities and costs. Blank quantity means uncounted; zero means the material is absent and is included in the count. Submitting invalid data reveals the hidden invalid row and focuses it. Surplus cost may be entered during draft editing; approval requires an explicit valid cost for every surplus, including a deliberately entered zero. Review and agreement remain separate from saving a draft.

## Read operation states and references

| Label | Meaning |
|---|---|
| محفوظ محلياً | Captured on this device, waiting for acceptance |
| انتظار تأكيد الخادم | Submission was acknowledged; the accepted snapshot has not confirmed it yet |
| مقبول | Confirmed in accepted server data |
| تحتاج مراجعة | Rejected with the reason retained; available retry/correction/cancellation actions follow the document's rules |
| ملغى محلياً | Local rejected/pending work was cancelled |
| تم التصحيح | Earlier local operation remains linked to its replacement |

Review rows appear first. A source/replacement reference opens its workspace, selects its location when relevant, expands the containing history and focuses/highlights the available document. A missing local reference gives an explanatory notice; synchronize to retrieve available history. Expected values and provisional quantities stay separate from accepted stock.

## Import sales and recover work

Sales import separates source/location, file or pasted CSV, column mapping and preview. Resolve invalid/unmapped/conflicting rows, then confirm completed sales before saving. Repeated accepted details still follow existing deduplication rules. This UI change does not post inventory consumption from sales.

Recovery requires a Fodo JSON archive. Invalid files show an Arabic error associated with the file control and keep confirmation disabled. Preview valid archives and their new/duplicate/accepted counts before confirming. Escape closes idle dialogs; actions are disabled during processing. Session renewal retains queued documents.

## Responsive regression checks

Check desktop, tablet and 390px phone widths, including a 640px-tall phone. Dialog headers/actions stay inside the viewport while the body scrolls. Inline editors leave room for mobile navigation; table scrolling stays within the table. Verify keyboard focus, associated error messages, visible active navigation, Arabic decimals, offline save/reload/sync and source links. Browser viewport checks do not emulate every physical device or operating-system keyboard.

Regression entry points: `tests/browser/forms-ux.spec.ts`, `workflow-ux.spec.ts` and the existing workflow suites. Run the browser runner with a fresh `TEST_DATA_DIR` and a free `TEST_PORT`; run empty-workspace scenarios separately with `TEST_EMPTY_WORKSPACE=1` and the matching grep. The catalog performance fixture contains 328 items and records query-to-render elapsed time including browser automation, without posting invented materials to the client's database.
