# Kitchen consumption documents

Open **صرف المطابخ → إدارة المطابخ** to add kitchens such as مطبخ ١ and مطبخ ٢. Edit names, delete a kitchen from future selection, or restore it. Deletion is reversible archival: past documents and their accepted recipient names/costs remain intact. Active names must be unique within the organization. Concurrent edits use revision checks; rejected changes can be retried or cancelled in the manager and sync center.

Open **صرف مخزون**, beside **استلام مواد** in the workspace header, to open the same issue form directly for the selected source warehouse. The shortcut requires an active saved kitchen, an active warehouse and an active material with a base unit; it respects session expiry. Cancelling returns focus to the shortcut and leaves the current workspace screen unchanged. You can also open **إنشاء مستند صرف** from the kitchen screen and select an active saved kitchen. A kitchen recipient does not need a stock location, separate branch or customer account. Creating/editing kitchens works offline under the existing grant; their setup commands synchronize before issues. An archived recipient rejects new issues at acceptance. Exact redelivery of an already accepted issue still returns its original result. Previously captured documents without a kitchen ID remain compatible; new forms require a saved recipient.

Select the source warehouse, recipient and business date. **مرجع الصرف** is optional: leave it blank or enter 2–100 characters. The automatic `KI-` document number remains the stable identity for history, printing and retries. Blank/omitted references normalize to an empty string; existing nonempty references remain intact. Add 1–200 distinct active materials in their base inventory units, with positive quantities. Notes are optional. The preview shows available projected quantities and an estimate based on the current warehouse average. Actual accepted value follows the organization's FIFO or moving-average policy and remains pinned in the document, together with item names, units, actor and movement IDs.

The editor keeps document details compact and identifies the source warehouse in its header. Each item row shows its base unit, expected available quantity, remaining quantity after this draft line and an average-cost estimate. An excessive quantity immediately highlights its row and field, describes the shortfall and flags the document total. Remaining quantity stays unavailable for invalid/shortage input; this preview never permits negative stock. Average-cost estimates can differ from final FIFO valuation. The total/save/cancel area stays visible while editing long documents. Expand **إضافة ملاحظات** when needed; collapsing notes retains their text in the draft. Pagination controls appear above ten rows, and larger documents retain values on hidden pages. Removing the final row leaves a fresh empty selector and restores focus there.

On server acceptance, every issued quantity immediately becomes that kitchen's consumption and reduces source stock. No destination stock, sales revenue, payment or customer receivable is created. A shortage rejects the whole issue before any line is consumed; this differs from the previously agreed sales-import shortage policy. The form highlights an excessive quantity and retains entered values. A stale stock change may still require review at synchronization.

Use one actual-consumption route for the same physical materials: issuing them here and also selecting them for a subsequent sale from the same source warehouse would consume twice. This feature does not silently change existing recipe selections or earlier sales. The form explains this choice.

## Keyboard entry

The workspace **اختصارات** button opens the full Arabic guide; the editor also displays a short hint. Shared navigation is described in [UI forms](./UI-Forms.md).

- The editor opens on the kitchen field.
- Tab and Shift+Tab use normal forward/backward navigation. Shift+Enter moves to the previous data field; Alt+Insert adds a material row.
- Enter moves through kitchen, date and reference to material entry, skipping pagination controls.
- Search and selection share one visible combobox. Focus opens the catalog and typing filters names/codes. Arrows and Enter choose and move to quantity; clicking chooses while retaining focus in the selector. Enter on the unchanged selection advances. Escape closes results first. The popup fits the viewport and scrolls independently of the form body. The stored ID remains separate from uncommitted search text.
- Enter after a valid quantity focuses the next material or adds a new row. Focus reveals the row's page when necessary.
- Ctrl+Enter (or Command+Enter) runs full validation and saves only when the primary action is enabled. An entirely blank trailing row is ignored; a partially completed row must be completed or removed.
- Errors focus the affected field without losing values. Escape closes the unsaved editor and restores focus to its trigger.

## History, printing and offline work

History includes search, kitchen/status/date filters, sorting, pagination and actual accepted cost. The snapshot currently includes the latest 100 server issue documents; totals are explicitly scoped to downloaded data. Print the internal issue document using the restaurant identity and signatures, or save PDF through browser printing. Before acceptance, the copy clearly states that quantities and cost are provisional. Document identity uses `KI-` plus the complete UUID; it stays stable across offline capture and retries.

Capture survives offline reload under the existing grant. Confirmed balances change only after acceptance; pending issues appear in projected stock and the common synchronization center. Previous unresolved receiving, production, transfers, sales or kitchen issues block dependent consumption. Exact redelivery never consumes twice. Failed issues support unchanged retry, linked correction with new IDs, or local cancellation; accepted history stays immutable.

IndexedDB version 11 adds the kitchen outbox without replacing existing stores. Recovery format 16 carries kitchen setup and linked issues; format 15 still supports previous name-only issues. Older formats remain readable but cannot claim later document types. Tenant, generation, reference and identity checks remain enforced. Restoring an archive does not trust exported acceptance flags.

The additive hosted migrations enable forced tenant RLS on the private issue and kitchen directory tables and preserve the existing guarded trial backup. Trial cleanup includes issues and kitchen configuration in dependency order; it runs only under the existing explicit cleanup authorization, not during this release.
