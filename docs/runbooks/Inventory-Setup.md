# Inventory setup — first-client development walkthrough

Delivered locally on 10 October 2026. This milestone uses the existing local organization/session and retains tenant scoping. Membership administration and hosted demos are deferred.

## Open the application

Double-click the project's `Start-Fodo.cmd` in File Explorer, keep its console open, and wait for `READY`. Use the saved address, normally `http://127.0.0.1:3108/`. A server started inside a restricted Codex command session may be unreachable from the ordinary browser; launch the existing CMD in your Windows session. Do not clear browser storage or move to another origin to resolve connection errors.

After a new build, stop the old Fodo console with Ctrl+C and start the same launcher again. On first use of the new setup feature, connect and synchronize to download the migrated catalog. The additive local database migration preserves existing items, balances, layers and operation IDs; seeded item units are mapped into the unit catalog. Dexie adds a setup outbox without deleting snapshots or pending stock operations.

## Working scenario

The menu now places **إعداد المخزون** under **الإعدادات والمتابعة** and **الموردون** under **إدارة المخزون**. In Add/Edit material, **الفئة** opens all categories from the complete tenant catalog. Type to search, use arrows/Enter to select, or use **إضافة فئة جديدة** / F2. Enter a 2–100 character name and choose **إضافة واختيار**; an existing normalized name selects the existing category. It is saved only with the material. Cancelling the category form returns to the material, and cancelling the material saves nothing. These are flat categories; there is no separate empty-category manager.

In **المخزون**, **تكلفة الوحدة الفعلية** means accepted inventory value divided by accepted quantity at the selected location, shown as EGP per base unit. It uses the current confirmed stock valuation, supports sorting and shows a dash when no cost is known.

You can also create a material while entering **استلام مواد**: use **إضافة مادة جديدة** in its searchable selector (or F2), complete name/code/category/inventory unit, then **حفظ واختيار**. This reuses the setup outbox and shared validation, starts at zero stock and returns to the same receipt row. The unit must be chosen explicitly. Cancelling the receipt afterward keeps the created catalog material; cancelling the creation form saves nothing.

Suppliers are available directly from the main menu under **الموردون → إضافة مورد**. The supplier tab in **إعداد المخزون** accesses the same records. You can add/edit contact details, search, deactivate suppliers and review rejected changes from the direct page; offline saves use the existing setup outbox.

1. Open **إعداد المخزون**. Add a missing base unit in **وحدات المخزون**.
2. Add a supplier with optional phone, email and address.
3. Add a restaurant branch, warehouse, preparation kitchen or combined storage/preparation location.
4. Add a material with its SKU, category, base unit and minimum stock. Optionally add a purchase pack, for example a sack containing 25 kg.
5. Select the new location and open **استلام مواد**. Choose the material, supplier and receiving unit. Cost is explicitly per base inventory unit: two 25-kg sacks at EGP 32/kg produce 50 kg valued at EGP 1,600. Pack price entry is not part of this milestone.
6. Record waste in the base unit. Inspect confirmed/local quantities, FIFO layers and movement history; the receipt retains supplier and pack metadata.
7. Repeat setup and receipt capture offline after the app/data have downloaded, reload, then reconnect and synchronize. Setup uploads in dependency order before stock commands. Only server acceptance changes confirmed stock/value.

Creating a material/location does not create stock. Use **الرصيد الافتتاحي** for a pristine item/location; see the [opening stock walkthrough](./Opening-Stock.md). Use **المشتريات** for orders and partial receiving; see [Purchasing](./Purchasing.md). Supplier returns are next.

## Editing and review

Existing item base units and existing purchase-pack names/factors are fixed. Add a new pack for another conversion; create another material for a different base unit. Unit-name edits change a display label, not quantities or conversion factors.

An item, supplier or location can be made inactive. Its history remains visible; new stock commands using it are rejected for review. Queued work is never silently dropped, and retries of already accepted IDs still return the previous accepted result.

Each setup save carries an expected revision and an operation ID. A second device's conflicting edit is retained for review instead of overwriting newer data. A pending record cannot be edited again on the same device until synchronized. Review rejected setup in the setup screen: retry unchanged data for transient/dependency errors, or cancel the rejected change and reopen/re-create the record with current values. Cancellation retains the captured command locally.

## Recovery and validation

Recovery version 4 exports opening documents together with setup and stock commands. Import previews counts, validates organization/envelope/line IDs, rejects conflicting payloads atomically and deduplicates known operations. Server acceptance is verified rather than trusted from the file. Versions 1–3 remain readable. Earlier builds cannot import version 4 and should not be used after creating opening documents.

Verification: 53 unit/integration tests and twelve Chrome browser/process scenarios pass, including a full offline unit/supplier/location/item setup followed by pack receipt, reload, reconnect and FIFO waste. Desktop/mobile screenshots are saved in the workspace outputs. The production build/type check pass. Automated browser data is isolated from `.data-local`.
