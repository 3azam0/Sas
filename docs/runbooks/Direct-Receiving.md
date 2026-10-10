# Direct multi-item receiving

1. Select the destination **الموقع**. Items, units and locations must exist; suppliers are optional.
2. Click **استلام مواد**. Choose a supplier or keep **بدون مورد محدد**, set the business date and enter **مرجع الاستلام** (invoice number or note).
3. Choose the first material, receiving unit/pack, quantity and cost **per base inventory unit**. For example, 2 bags × 5 kg = 10 kg; at 20 EGP/kg the line value is 200 EGP.
4. Click **إضافة مادة أخرى** for each additional material. Each item appears once; split receipts if the same item needs distinct costs. Up to 200 items are allowed. Removing a row updates the total.
5. Review base quantities, line values and the document total, then click **حفظ العملية**. All rows save together on this device, including offline. Confirmed stock changes only after the server accepts the whole document.
6. Open **مركز المزامنة** to see receipts from every location, including after a reload. **سجل الحركات** shows receipt documents and accepted line movements for the selected location.
7. Reconnect and synchronize. Repeated synchronization cannot post the same receipt twice. A rejected line rejects the whole receipt; no partial stock is posted. Retry the original document, correct it into a linked new document, or cancel the rejected document from its history. Accepted receipts cannot be edited/cancelled through this screen.

Use recovery export/import (format 10) to preserve whole receipts and rejected correction history. Formats 1–9 remain readable subject to organization/generation checks. Setup uploads precede receipts. Unaccepted opening stock and rejected preceding receipts put dependent stock operations into review; resolve them before retrying.

Direct receiving is independent of purchase orders. Order receipts remain in **المشتريات**. Returns from direct receipts, tax/discount/freight allocation and supplier balances/payments are future work. Item classification/import from the supplied workbook is deferred; this change does not import or delete catalog data.
