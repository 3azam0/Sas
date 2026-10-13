# Arabic forms and offline workflow walkthrough

Use an isolated local test database for these checks. Never import fixtures, reset costing or create test movements in the client's warehouse.

## Shared document layout

`DocumentForm.tsx` provides compact metadata fields, line sections, optional explanations and a summary reused beside the existing Save/Cancel buttons. `DocumentEditor` wraps opening stock, purchase drafts/partial receiving, supplier returns, transfers, counts, recipes, production and sales mapping/import in native dialogs. Headers and action footers remain fixed; the body scrolls. Receiving and setup retain their existing dialogs and share the same visual pattern. The stylesheet is imported by both Next.js and the hosted frontend. Preserve busy-state disabling, existing close/cancel behavior and required-field feedback when adding forms.

Plain short line lists hide collection controls; longer documents retain paging. Searchable stock-count/source lists keep their filters. Do not discard hidden rows: values and validation remain mounted across filters/pages, and keyboard navigation reveals a retained row before focusing it. Phone editing tables use `data-label` cells as cards with explicit field names, while keeping their accessible control labels and hidden rows.

Receiving shows base quantity, line value and estimated balance after acceptance. Purchase drafts show the completed subtotal and an explicit incomplete label if a row is empty or invalid; blank cost is different from an explicitly entered zero. Supplier returns show source-availability warnings, transfers show available-quantity warnings, and production shows its existing ingredient shortages beside actual inputs. These warnings and totals are display-only. Preserve atomic supplier/kitchen/production rules and the separate accepted partial-deduction policy for sales. Recipe summaries include all known component costs and separately count the ingredients selected for sales deduction.

Opening CSV and detailed cost explanations expand within the scrolling body. Opening an explanation or adding a row must not move Save below the viewport. Sales import keeps completed-sale confirmation unchecked until the user explicitly agrees; Ctrl/Command+Enter cannot bypass the disabled action. See [document forms release](../releases/document-forms-ux-2026-10-12.md) for the exact verified flows and remaining fixture checks.

## Find and select a material

Receiving, waste, opening stock, purchasing, recipe ingredients/outputs, production versions, sales recipe mapping and kitchen issues use one visible searchable combobox. Focus/click opens the tenant's offline catalog; typing filters Arabic names and codes, ignoring diacritics, common alef variants and repeated spaces. The field displays the selected label, while an inaccessible hidden select retains the stored ID, form name and forwarded ref. It is excluded from Tab and Enter navigation. Never save a search string as an item ID.

Use arrows and Enter to select and move to the next field; clicking a result selects it without jumping. Enter on an unchanged selection advances. Tab, Shift+Enter or Escape discard an uncommitted query and retain the selection; Enter with no matches stays in the field unless a creation action is available. Receiving adds **إضافة مادة جديدة** as the last option: choose it with arrows/Enter, click it or press F2. An unmatched-search Enter opens the compact creation form, prefilling its name. Save selects the material on the same receipt row and focuses quantity; cancel/Escape returns to its original selector without losing the receipt. Other selectors retain their existing behavior. Escape closes the list before cancelling the editor. Disabled duplicate items remain visible and cannot be chosen. Required/document errors are associated with and focus the visible combobox. Results render outside scrolling form/table bodies, inside a dialog's top layer when applicable, and reposition during scrolling/resizing. All lookup data is already in the tenant snapshot; no network search is introduced.

## Select or add a category

Material creation/editing (including the receiving child editor) uses the shared searchable selector with every tenant category. Focus shows the entire list independently of material pagination; type to filter. **إضافة فئة جديدة**, F2 or unmatched-search Enter opens a separate native dialog. New names are trimmed/normalized and validated at 2–100 characters; duplicate normalized names select the existing value. **إضافة واختيار** returns the value to the parent draft and restores its combobox focus. The category is saved with the material through the existing offline setup outbox. Escape/cancel closes only the category dialog, and cancelling the material writes nothing. Parent material/receipt submission must not be triggered by category submission.

## Validate a document

Required fields have visible guidance. Quantities identify their unit and costs identify their price basis. Invalid input produces a message associated with the field and moves focus to the first error after submission. Enter moves to the next data field without saving; Shift+Enter moves back. Ctrl+Enter (Command+Enter on macOS) explicitly submits through the available main button and the existing validation. Add, remove and close buttons do not submit the form. The scroll body and action footer are separate. Saving disables the form and actions until the operation finishes. Closing an editor returns keyboard focus to its trigger when the trigger still exists.

Setup, direct receiving and waste retain their existing schema/React Hook Form validation. Opening stock, purchase drafts/receipts, supplier returns, transfers, counts, recipes, production, menu mappings and sales imports share `FormControls.tsx`. Field checks improve feedback; existing domain schemas, local capture and server acceptance remain authoritative. Unsubmitted text lives in the open editor; a saved local document survives reload through Dexie.

## Show keyboard help

Open **اختصارات** (the keyboard icon) in the workspace top bar for the Arabic guide. It is available on every workspace screen; phone layouts keep an accessible icon. Every document/setup editor also shows a compact shortcut hint. The guide closes with Escape and returns focus to its button.

- Tab / Shift+Tab retain normal control navigation, including buttons.
- Enter / Shift+Enter move between data fields. On a focused button, Enter still activates that button. Ordinary Enter never saves from a data field.
- Ctrl+Enter / Command+Enter validate and submit only when the primary action is enabled. Disabled confirmations, previews and busy forms cannot be bypassed.
- Alt+Insert adds a material, recipe component or purchase-pack row where an Add button is available, then focuses the new row and reveals its page.
- Arrows choose search results/native options; Space toggles checkboxes.
- F2 opens material creation during receiving, or category creation from the category field.
- Enter in a multiline note or CSV preserves line breaks. File inputs keep native file-picker behavior; composition input is not intercepted.
- Escape closes search results first, then an idle dialog or inline editor. Closing returns focus to its available trigger.

Data-row navigation skips collection pagination controls and excluded rows, and reveals retained rows when crossing pages inside the current filters. The kitchen issue editor uses one item/quantity entry row: Enter after quantity adds or updates a newest-first receipt line, then returns to item search. Repeated items combine quantities; unfinished entries and edits block document save. See [Kitchen issues](./Kitchen-Issues.md). These controls do not change draft persistence or server acceptance rules.

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

Sales import separates source/location, file or pasted CSV, column mapping and preview. Resolve invalid/unmapped/conflicting rows, then confirm completed sales before saving. Repeated accepted details still follow existing deduplication rules. New accepted sales deduct available quantities of ingredients selected in the pinned recipe version; all recipe components still contribute to estimated cost. Shortages are accepted and highlighted under the existing hosted policy. This UI release does not change that policy. See [list controls](./UI-Lists.md) for pagination, ordering and hidden-row validation.

Recovery requires a Fodo JSON archive. Invalid files show an Arabic error associated with the file control and keep confirmation disabled. Preview valid archives and their new/duplicate/accepted counts before confirming. Escape closes idle dialogs; actions are disabled during processing. Session renewal retains queued documents.

## Responsive regression checks

Check desktop, tablet and 390px phone widths, including a 640px-tall phone. Dialog headers/actions stay inside the viewport while the body scrolls. Inline editors leave room for mobile navigation; table scrolling stays within the table. Verify keyboard focus, associated error messages, visible active navigation, Arabic decimals, offline save/reload/sync and source links. Browser viewport checks do not emulate every physical device or operating-system keyboard.

Regression entry points: `tests/browser/forms-ux.spec.ts`, `workflow-ux.spec.ts`, `keyboard.spec.ts` and the existing workflow suites. Run the browser runner with a fresh `TEST_DATA_DIR` and a free `TEST_PORT`; run empty-workspace scenarios separately with `TEST_EMPTY_WORKSPACE=1` and the matching grep. The catalog performance fixture contains 328 items and records query-to-render elapsed time including browser automation, without posting invented materials to the client's database.

Direct receiving uses one item picker beside quantity. Item selection focuses quantity; Enter there focuses cost, and Enter after cost adds the entry to the newest-first receipt list. Add/Alt+Insert use the same validation. Edit replaces the existing line; unfinished entry/edit blocks Save. Cost stays per base stock unit, including pack conversions. Stock issue header, shortcut hints and kitchen/date/reference details have compact spacing; mobile inputs retain 44px height.

Receiving document details and entry headings also use compact typography and spacing. Optional/required indicators remain visible, and mobile document inputs retain 44px height and 16px text.


Long groups and page panels now share **طي / توسيع** buttons with `aria-expanded` and `aria-controls`. Required-field validation opens a collapsed group before focusing; linked documents and report drill-down also open their destination. Collapse retains mounted form controls, collection filters, sorting and pages. Read-only chart drawings remount when expanded to avoid measuring a hidden canvas. See [section behavior](./Collapsible-Sections.md). Receiving shortcut hints are in its fixed header; metadata, entry and added-item list can each collapse independently.
