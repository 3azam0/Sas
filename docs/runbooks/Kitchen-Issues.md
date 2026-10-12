# Kitchen consumption documents

Open **صرف المطابخ → إدارة المطابخ** to add kitchens such as مطبخ ١ and مطبخ ٢. Edit names, delete a kitchen from future selection, or restore it. Deletion is reversible archival: past documents and their accepted recipient names/costs remain intact. Active names must be unique within the organization. Concurrent edits use revision checks; rejected changes can be retried or cancelled in the manager and sync center.

Then open **إنشاء مستند صرف** and select an active saved kitchen. A kitchen recipient does not need a stock location, separate branch or customer account. Creating/editing kitchens works offline under the existing grant; their setup commands synchronize before issues. An archived recipient rejects new issues at acceptance. Exact redelivery of an already accepted issue still returns its original result. Previously captured documents without a kitchen ID remain compatible; new forms require a saved recipient.

Select the source warehouse, recipient, business date and reference. Add 1–200 distinct active materials in their base inventory units, with positive quantities. Notes are optional. The preview shows available projected quantities and an estimate based on the current warehouse average. Actual accepted value follows the organization's FIFO or moving-average policy and remains pinned in the document, together with item names, units, actor and movement IDs.

On server acceptance, every issued quantity immediately becomes that kitchen's consumption and reduces source stock. No destination stock, sales revenue, payment or customer receivable is created. A shortage rejects the whole issue before any line is consumed; this differs from the previously agreed sales-import shortage policy. The form highlights an excessive quantity and retains entered values. A stale stock change may still require review at synchronization.

Use one actual-consumption route for the same physical materials: issuing them here and also selecting them for a subsequent sale from the same source warehouse would consume twice. This feature does not silently change existing recipe selections or earlier sales. The form explains this choice.

## Keyboard entry

The workspace **اختصارات** button opens the full Arabic guide; the editor also displays a short hint. Shared navigation is described in [UI forms](./UI-Forms.md).

- The editor opens on the kitchen field.
- Tab and Shift+Tab use normal forward/backward navigation. Shift+Enter moves to the previous data field; Alt+Insert adds a material row.
- Enter moves through kitchen, date and reference to material entry, skipping pagination controls.
- Search by name or SKU. Typing opens matching results. Use arrow keys and Enter, or click a result, to choose it and move to quantity. Escape first closes an open results popup. The popup fits the available form space and scrolls for longer results; the native selector remains available.
- Enter after a valid quantity focuses the next material or adds a new row. Focus reveals the row's page when necessary.
- Ctrl+Enter (or Command+Enter) runs full validation and saves only when the primary action is enabled. An entirely blank trailing row is ignored; a partially completed row must be completed or removed.
- Errors focus the affected field without losing values. Escape closes the unsaved editor and restores focus to its trigger.

## History, printing and offline work

History includes search, kitchen/status/date filters, sorting, pagination and actual accepted cost. The snapshot currently includes the latest 100 server issue documents; totals are explicitly scoped to downloaded data. Print the internal issue document using the restaurant identity and signatures, or save PDF through browser printing. Before acceptance, the copy clearly states that quantities and cost are provisional. Document identity uses `KI-` plus the complete UUID; it stays stable across offline capture and retries.

Capture survives offline reload under the existing grant. Confirmed balances change only after acceptance; pending issues appear in projected stock and the common synchronization center. Previous unresolved receiving, production, transfers, sales or kitchen issues block dependent consumption. Exact redelivery never consumes twice. Failed issues support unchanged retry, linked correction with new IDs, or local cancellation; accepted history stays immutable.

IndexedDB version 11 adds the kitchen outbox without replacing existing stores. Recovery format 16 carries kitchen setup and linked issues; format 15 still supports previous name-only issues. Older formats remain readable but cannot claim later document types. Tenant, generation, reference and identity checks remain enforced. Restoring an archive does not trust exported acceptance flags.

The additive hosted migrations enable forced tenant RLS on the private issue and kitchen directory tables and preserve the existing guarded trial backup. Trial cleanup includes issues and kitchen configuration in dependency order; it runs only under the existing explicit cleanup authorization, not during this release.
