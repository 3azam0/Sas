# Direct multi-item receiving

1. Select the destination **الموقع**. Items, units and locations must exist; suppliers are optional.
2. Click **استلام مواد**. Choose a supplier or keep **بدون مورد محدد**, set the business date and enter **مرجع الاستلام** (invoice number or note).
3. Choose the first material, receiving unit/pack, quantity and cost **per base inventory unit**. For example, 2 bags × 5 kg = 10 kg; at 20 EGP/kg the line value is 200 EGP.

   **وحدة الاستلام** includes every unit registered in **إعداد المخزون → وحدات المخزون**, together with this item's fixed purchase packs. The base unit appears once as **وحدة المخزون**. kg/g and litre/ml aliases convert automatically: 500 g received into a kg-based item = 0.5 kg; at EGP 20/kg the value is EGP 10. For another unit, enter **محتوى وحدة الاستلام**: for example, 1 **عدد** of a bag contains 5 kg, so 2 bags = 10 kg. This factor belongs to this receipt; define a fixed item purchase pack in setup if the relationship should be reused. A litre-to-kg relationship also requires an explicit factor; density is never assumed. Changing the selected item/unit clears an unfinished custom factor. Add any missing named unit through inventory setup.

4. Click **إضافة مادة أخرى** for each additional material. Each item appears once; split receipts if the same item needs distinct costs. Up to 200 items are allowed. Removing a row updates the total.
5. Review base quantities, line values and the document total, then click **حفظ العملية**. All rows save together on this device, including offline. Confirmed stock changes only after the server accepts the whole document.
6. Open **مركز المزامنة** to see receipts from every location, including after a reload. **سجل الحركات** shows receipt documents and accepted line movements for the selected location.
7. Reconnect and synchronize. Repeated synchronization cannot post the same receipt twice. A rejected line rejects the whole receipt; no partial stock is posted. Retry the original document, correct it into a linked new document, or cancel the rejected document from its history. Accepted receipts cannot be edited/cancelled through this screen.

Receipt history and correction retain entered quantity, chosen unit, base-unit name and conversion factor. Converted quantities must fit six decimal places without rounding. Standard conversion ratios and tenant references are checked locally and on the server; an invalid row rejects the whole document. Unit-name changes after capture require correcting a pending document using current names; historical names/factors remain intact in accepted documents and recovery.

Use recovery export/import (format 14) to preserve whole receipts, unit conversions and rejected correction history. Formats 1–13 remain readable subject to organization/generation checks; files containing the new catalog-unit metadata require version 14. Older Fodo builds cannot restore version 14. Setup uploads precede receipts. Unaccepted opening stock and rejected preceding receipts put dependent stock operations into review; resolve them before retrying.

Direct receiving is independent of purchase orders. Order receipts remain in **المشتريات** and use their existing captured pack definitions. Returns from direct receipts, tax/discount/freight allocation and supplier balances/payments are future work. The client's 328-item classified catalog is already imported; this unit extension does not import, edit or delete catalog data or add stock.
