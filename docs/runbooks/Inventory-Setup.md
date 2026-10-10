# Inventory setup — first-client development walkthrough

Delivered locally on 10 October 2026. This milestone uses the existing local organization/session and retains tenant scoping. Membership administration and hosted demos are deferred.

## Open the application

Double-click the project's `Start-Fodo.cmd` in File Explorer, keep its console open, and wait for `READY`. Use the saved address, normally `http://127.0.0.1:3108/`. A server started inside a restricted Codex command session may be unreachable from the ordinary browser; launch the existing CMD in your Windows session. Do not clear browser storage or move to another origin to resolve connection errors.

After a new build, stop the old Fodo console with Ctrl+C and start the same launcher again. On first use of the new setup feature, connect and synchronize to download the migrated catalog. The additive local database migration preserves existing items, balances, layers and operation IDs; seeded item units are mapped into the unit catalog. Dexie adds a setup outbox without deleting snapshots or pending stock operations.

## Working scenario

1. Open **إعداد المخزون**. Add a missing base unit in **وحدات المخزون**.
2. Add a supplier with optional phone, email and address.
3. Add a restaurant branch, warehouse, preparation kitchen or combined storage/preparation location.
4. Add a material with its SKU, category, base unit and minimum stock. Optionally add a purchase pack, for example a sack containing 25 kg.
5. Select the new location and open **استلام مواد**. Choose the material, supplier and receiving unit. Cost is explicitly per base inventory unit: two 25-kg sacks at EGP 32/kg produce 50 kg valued at EGP 1,600. Pack price entry is not part of this milestone.
6. Record waste in the base unit. Inspect confirmed/local quantities, FIFO layers and movement history; the receipt retains supplier and pack metadata.
7. Repeat setup and receipt capture offline after the app/data have downloaded, reload, then reconnect and synchronize. Setup uploads in dependency order before stock commands. Only server acceptance changes confirmed stock/value.

Creating a material/location does not create opening stock. Opening imports and purchasing documents/returns are the next milestone.

## Editing and review

Existing item base units and existing purchase-pack names/factors are fixed. Add a new pack for another conversion; create another material for a different base unit. Unit-name edits change a display label, not quantities or conversion factors.

An item, supplier or location can be made inactive. Its history remains visible; new stock commands using it are rejected for review. Queued work is never silently dropped, and retries of already accepted IDs still return the previous accepted result.

Each setup save carries an expected revision and an operation ID. A second device's conflicting edit is retained for review instead of overwriting newer data. A pending record cannot be edited again on the same device until synchronized. Review rejected setup in the setup screen: retry unchanged data for transient/dependency errors, or cancel the rejected change and reopen/re-create the record with current values. Cancellation retains the captured command locally.

## Recovery and validation

Recovery version 3 exports both setup and stock commands. Import previews counts, validates organization/IDs, rejects conflicting payloads atomically and deduplicates known operations. Server acceptance is verified rather than trusted from the file. Versions 1/2 remain supported for stock-only archives. Earlier app builds cannot import version-3 archives and should not be used after setup edits.

Verification: 39 unit/integration tests and ten Chrome browser/process scenarios pass, including a full offline unit/supplier/location/item setup followed by pack receipt, reload, reconnect and FIFO waste. Desktop/mobile screenshots are saved in the workspace outputs. The production build/type check pass. Automated browser data is isolated from `.data-local`.
