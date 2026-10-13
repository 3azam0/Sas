# Kitchens, stock and POS
Delivered 13 October 2026. **المطابخ** manages stock kitchens, POS and supply documents.

## First setup
1. Open **المطابخ → إدارة المطابخ**. Add a kitchen or edit the existing one and select its main warehouse. Each kitchen has an independent stock location, initially empty. The warehouse association uses the existing organization/location scope; it does not create a paid branch.
2. Open **إدارة نقاط البيع**. Add a POS name, choose its kitchen and enter the source used by menu codes. The current client's trial menu source is **FODO**. Several terminals may use that source; their sale identities stay separate. Source is fixed after creation; a kitchen assignment can be edited for future sales.
3. In **المبيعات → أصناف البيع**, edit each meal and add all kitchens allowed to prepare the whole meal. Search, arrows and Enter select kitchens; selected chips can be removed. Active meals need at least one kitchen.
4. Select the source warehouse in **الموقع**, then **صرف مخزون** or **إنشاء مستند صرف**. Choose a different destination kitchen and add materials/quantities. The reference remains optional. Save and synchronize before importing dependent sales.
5. Choose the POS in **استيراد المبيعات**. Its kitchen and source appear automatically; import the usual CSV, review selected deductions and confirm completed sales.

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
