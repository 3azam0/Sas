# Kitchens, stock and POS
Delivered 13 October 2026. **المطابخ** manages stock kitchens, POS and supply documents.

Compact header/card update, 15 October: kitchen, date and **تفاصيل إضافية** now sit in the left side of the desktop header and wrap beneath its title on phones. Optional reference/notes open directly beneath the header. Compact receipt cards retain material identity, available/remaining stock, quantity, cost, value and edit/delete. The header uses the same keyboard/validation form as the body. This supersedes the earlier **المطبخ والتاريخ** section placement described below. See [verified compact kitchen release](../releases/kitchen-header-cards-2026-10-15.md).

Usability update, 15 October: **صرف للمطبخ** opens supply from the selected source location. **المطبخ والتاريخ** contains the essential fields; optional reference and notes are under **تفاصيل إضافية للصرف**. Desktop entry and added lines sit alongside one another. After adding a line, search regains focus without opening the result list over the controls below; typing/clicking still opens results. Validation reveals invalid optional details. Local save is provisional until confirmed acceptance updates stock. See [daily workflow](./Daily-Workflow.md).

## First setup
1. Open **المطابخ → إدارة المطابخ**. Add a kitchen or edit the existing one and select its main warehouse. Each kitchen has an independent stock location, initially empty. The warehouse association uses the existing organization/location scope; it does not create a paid branch.
2. Open **إدارة نقاط البيع**. Add a POS name, choose its kitchen and enter the source used by menu codes. The current client's trial menu source is **FODO**. Several terminals may use that source; their sale identities stay separate. Source is fixed after creation; a kitchen assignment can be edited for future sales.
3. In **المبيعات → أصناف البيع**, edit each meal and add all kitchens allowed to prepare the whole meal. Search, arrows and Enter select kitchens; selected chips can be removed. Active meals need at least one kitchen.
4. Select the source warehouse in **الموقع**, then **صرف مخزون** or **إنشاء مستند صرف**. In **المطبخ المستلم**, search for and choose a different destination kitchen, then add materials/quantities. The kitchen picker opens when the form appears; arrows and Enter select a result and move to the date. The reference remains optional. Save and synchronize before importing dependent sales.
5. Choose the POS in **استيراد المبيعات**. Its kitchen and source appear automatically; import the usual CSV, review selected deductions and confirm completed sales.

## Reporting accepted supplies
Open **تقرير صرف المطابخ والرسوم** next to the history heading for complete date-range reporting, charts, posted unit costs and CSV/PDF export. See [kitchen supply reporting](./Kitchen-Supply-Report.md). The operational history remains the recent snapshot plus local documents.

## Entering a supply document
Use the single **المادة** dropdown and the adjacent **الكمية** input. Clicking a result or pressing Enter selects it and moves to quantity; Enter after a valid quantity adds it to the receipt list and returns to item search. **إضافة للقائمة** and Alt+Insert do the same. Adding a line does not save or post stock.

The newest addition appears first. Repeated materials combine quantities exactly into their existing line and move to the top; validation considers the combined quantity against available stock. Each line shows name/code/category, quantity/unit, available/remaining stock, estimated unit cost and value. **تعديل** loads the quantity back into the entry row with the material fixed. **حفظ التعديل** replaces its quantity; **إلغاء التعديل** leaves the line unchanged. Removing the edited line cancels that edit. Add or clear an unfinished entry before editing another line.

Lists above ten materials expose search, sorting and pagination. Filters affect the view, not the document or footer totals. Adding, editing or removing restores the default view and first page so changed lines remain findable. Short receipts show their lines directly. The item and quantity stay side by side on phones; the Add button spans the row below.

**حفظ صرف المطبخ** requires at least one complete line, an empty entry row and no unfinished edit. The maximum is 200 distinct materials; combining or editing an existing material remains possible at that limit. Shortages cannot be added, and all listed quantities are checked again on Save and on server acceptance. The reference remains optional.

## Stock behavior
An accepted supply document decreases the warehouse and increases the kitchen atomically, conserving quantity and value. Supply shortages reject the complete transfer; repair its quantities and retry/correct it. Kitchen-to-kitchen movement and returns to the warehouse use **التحويلات**, including dispatch/receive and transit tracking.

Sales consume only ingredients checked in the pinned published recipe, from their POS kitchen. All ingredients still count toward estimated recipe cost. Sales with shortages succeed, issue only available stock and preserve required/deducted/missing quantities. No warehouse or other kitchen automatically covers a shortage, and later receiving does not backfill it. Duplicate sales never issue again.

The same menu item can be assigned to several kitchens; the selling POS selects one kitchen, not several. Each kitchen makes the complete meal. Cashier shifts and split-meal preparation are deferred.

## Inventory and reports
**مخزون المطابخ** shows confirmed/projected quantities, actual cost and value, with search, category/balance filters, sorting and pagination. Its buttons open that kitchen's normal inventory, sales and transfers. Receiving, counts, balance edits and waste use the existing location controls.

Kitchen consumption reports include selected sales issues from kitchen locations and historical immediate-consumption documents; supply transfers do not enter consumption totals. Separate cards show incoming/outgoing supply value. Sales reports offer a POS filter; accepted shortage rows and actual deduction totals follow that POS and period. Individual meal filters do not allocate posted ingredient cost to a meal.

## Editing and archival
Rename or archive a kitchen through **إدارة المطابخ**. First return/transfer all remaining stock, finish transit documents and deactivate its POS terminals. Its stock location identity stays fixed and cannot be edited independently in inventory setup. History stays readable. Archiving a POS preserves accepted sales and captured routing. POS reassignment never moves earlier stock deductions.

## Offline and compatibility
Setup synchronizes location → kitchen → POS before dependent menu/sales documents. Supply/receiving/production/transfer prerequisites settle before dependent stock use; rejected prerequisites keep dependent work available for review. Recovery format **17** includes routing and kitchen transfers. Older compatible archives remain readable; an older format cannot silently strip the new context. Dexie remains version 11.

The additive migration gave existing kitchens empty stock locations. No old stock or accepted sale was moved or reposted. Pending legacy immediate-consumption documents to a stock kitchen require a new transfer document. Accepted legacy documents retain their original meaning and exact retries.

Forms retain Enter/Shift+Enter navigation, Ctrl/Command+Enter validation/save, Alt+Insert where row addition exists, visible error focus and searchable dropdowns. See [keyboard guide](./UI-Forms.md) and [release verification](../releases/kitchen-inventory-pos-2026-10-13.md).
