# Counter POS and kitchen screen

## Configure before use

1. In **المبيعات → إدارة نقاط البيع**, activate each POS and assign exactly one active kitchen with its stock location. Its source must match its menu mappings; source identifiers are fixed after creation, so create a suitable new terminal/mapping when a different source is required. Several POS terminals can use the same kitchen.
2. In **أصناف البيع**, edit each menu item. Select its published recipe/output ratio and the kitchens that independently prepare the complete meal. Enter **سعر البيع ج.م** and optionally **فئة قائمة البيع**. A blank price prevents cashier selection; zero is an explicit valid price. Prices are never inferred from stock cost.
3. Check the recipe's selected deduction materials. Only these deduct from the selling kitchen when the sale is accepted. All recipe materials remain part of estimated cost. Supply kitchen stock before service.
4. Open **نقطة البيع** and choose the POS. Existing client menu prices are left unconfigured until the owner enters real selling prices. In this trial, the 99 menu mappings use FODO, while the existing two terminals use POS: configure compatible mappings/terminals and kitchen availability before expecting cashier catalog results.

## Take a cash sale

Search/filter the menu and select items. Use +/− or **الكمية / ملاحظة** to adjust quantity and kitchen instructions. **تفاصيل الطلب** sets a label, order note and counter/takeaway service. On phones, **عرض الطلب** jumps to the cart. Every edit is saved on this browser/device; **تعليق الطلب** preserves an unpaid order without revenue or stock movement. Restore it from **طلبات معلقة**. Held orders are not shared across devices.

Choose **دفع نقدي**, review the total and enter cash received. Short cash cannot be confirmed. The displayed change uses exact currency rounding. Confirm once; the paid sale and cart removal are one durable local transaction. A saved sale can still be pending server acceptance. Watch its status in **سجل الإيصالات النقدية** or **مركز المزامنة**. An ambiguous response retries the same operation ID, never creates a second charge.

Current prices/mappings are checked before taking payment. If they changed, refresh the cart prices and review the total. An already paid offline sale retains its accepted server-owned historical menu revision. A POS/kitchen routing change may still require administrator review. Paid review records are retained and cannot be discarded or edited into another payment.

## Prepare and hand over

Open **شاشة المطبخ** on the kitchen device and select its kitchen. Only server-accepted FooDo cash sales appear. Unsynced/offline cashier sales are visible to that cashier and reach other devices after connectivity and acceptance. External CSV imports do not become kitchen tickets.

Advance **جديد → قيد التجهيز → جاهز → تم الاستلام** using each ticket's action. Quantities, item notes, order notes, POS and elapsed time remain visible. A locally saved status update is clearly pending; another step waits for acceptance. Conflicting device revisions require refresh/review. Rejected status commands can be dismissed after review without deleting the sale. Kitchen updates never deduct stock again.

The workspace refreshes at 20-second intervals while the kitchen screen is active and connected, using the existing synchronization loop. **تم الاستلام اليوم** uses the sale's Cairo business date. Search, stages, date filters, ordering and pagination apply to the downloaded operational snapshot.

## Stock, reporting and corrections

Sale acceptance atomically records revenue, the selected stock deduction and required/deducted/missing quantities. Shortages do not stop an otherwise valid sale; no negative balances, main-warehouse fallback or later automatic shortage backfill occur. Current/held carts and printing do not move stock.

Use **تقرير مبيعات نقطة البيع** for accepted sales and **مرتجع / إلغاء** for the existing linked financial-correction workflow. Corrections never automatically recreate ingredients or undo preparation. Kitchen tickets with linked corrections warn staff to check with the cashier. Physical restocking/waste follows separate recorded inventory operations.

Direct cash sales use the reserved FD receipt identity and a separate source namespace from imported sales. Do not reimport a FooDo receipt as an external POS sale.

## Receipts, offline work and recovery

**الإيصال** opens A4/80 mm preview and the existing paired Windows helper. A receipt shows its stable reference, POS/kitchen, quantities, unit prices, notes, cash/change and pending/review/accepted status. Printing/reprinting never posts a sale. Exact printer output, paper width and helper pairing still need physical acceptance. Android direct printing is deferred.

First login/download and shared kitchen updates need connectivity. Within the normal offline grant, cashier carts and paid sales can be saved locally. Expiry prevents new checkout but retains saved carts and queues. Recovery format **20** includes carts and kitchen status commands, excludes printer/authentication preferences, and cannot resurrect a paid cart. Dexie schema **13** adds the kitchen status outbox. Older supported recovery formats remain readable. Recovery is not a replacement for an operational database backup.

## Remaining scope and acceptance

This first version is cash counter/takeaway only. Shifts, table service, split bills, discounts/payment providers, delivery integration, country fiscal adapters and Android direct printing remain later work. It uses existing organization access rather than new cashier-specific permissions.

Before real service, the client must approve actual selling prices, recipe portions, selected deductions, POS/kitchen routing, offline/reconnect operation, staff handling of corrections/shortages and physical A4/80 mm output. Technical fixture tests do not establish client acceptance or tax-system compliance.
