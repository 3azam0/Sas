# Purchase orders and partial receiving — development walkthrough

Implemented in Phase 2B on `feat/purchase-documents`, stacked on local `feat/opening-stock` at `8de87cc`. Publication, merge and deployment are separate checkpoints. Keep the saved local address and existing data; restart the existing launcher to load the new build.

## Prepare and order

1. Open **إعداد المخزون** and create an active supplier. Choose an active branch, warehouse or preparation kitchen in the header. Existing fixtures have no suppliers until one is created.
2. Open **المشتريات**, select **أمر شراء جديد**, choose the supplier, date and reference, then add materials. At most 200 distinct materials are permitted per order.
3. Choose each material's base unit or a fixed purchase pack. Enter its purchase quantity and cost **per base inventory unit**. The screen shows converted base quantity and estimated net value. For example, four 5-kg sacks at EGP 20 per kg order 20 kg for EGP 400.
4. Save the draft. It changes no stock. Send the order before receiving. Both operations can be captured offline after the initial download and while the development grant remains valid.

## Partial receiving

1. On a submitted order, choose **استلام مقابل الأمر**. Enter a receipt reference, date and quantities in the order's captured purchase units. Leave untouched lines blank or zero.
2. Receive 8 kg of a 20-kg order. After acceptance, the order shows 8 kg received and 12 kg outstanding; stock and FIFO value increase by 8 kg and its captured cost.
3. Receive the remaining 12 kg. The order becomes fully received. Additional quantities are rejected. Multi-line receipt posting is atomic: one failing line rejects the entire receipt.
4. Review accepted receipts under the order and **سجل الحركات**. Supplier, pack, entered quantity, receipt and order-line links remain stored. Expand **سجل إصدارات الأمر** to inspect earlier captured definitions, prices and quantities.

The existing **استلام مواد** action stays available for simple unlinked receiving. Never enter the same delivery both there and against its purchase order.

## Edits, cancellation and corrections

- Every accepted purchase action advances the order revision. Edits and receipts specify the revision the device saw. A competing action makes the other device's stale action require review instead of overwriting or over-receiving.
- Before any receiving, editing a submitted order creates a new draft revision; send it again. Earlier submitted revisions remain inspectable. After receiving starts, definition edits are blocked to preserve accepted lines and prices. Fully reversing all untouched receipts can restore a submitted order for a new draft revision.
- **إلغاء المتبقي** closes only unreceived quantities. It preserves accepted stock, receipts and audit history. A fully received order has no remainder to cancel.
- For a mistaken accepted receipt, **عكس الاستلام للتصحيح** creates linked negative movements. It requires every originating layer to remain entirely available at its source location. A consumed or transferred portion prevents reversal; other layers never substitute for its original stock. All lines reverse atomically. The original receipt remains visible as reversed.
- After reversal is accepted, capture a replacement receipt with new document/movement IDs. The next receipt automatically links the unreplaced reversed receipt; the server validates the source belongs to that order, is reversed and has no earlier replacement. Reversal reopens the outstanding quantities unless the order's remainder was cancelled; cancellation remains closed.
- A locally rejected operation can be retried unchanged, or cancelled locally and recreated from the current order revision. Review/cancel dependent rejected actions too before capturing a fresh chain. Local cancellation cannot undo an accepted movement.

## Offline and recovery

IndexedDB version 4 adds the purchase outbox without removing setup/opening/stock data. Setup synchronizes first, then opening documents, purchase revisions/receipts, and dependent stock commands. Accepted revisions are downloaded between purchase actions. Network/session failures retain pending work; business conflicts become review. Pending receipts affect labeled provisional quantities, not confirmed balances.

Receipt reversal can be saved offline, but its quantity/order effects are shown after server acceptance; synchronize the reversal before capturing its replacement. Posting sequence determines FIFO; backdated business dates do not reorder accepted layers.

Recovery format 5 includes purchase actions and movement IDs alongside all earlier outboxes. Formats 1–4 remain readable. Import validates scope, references, IDs and payload conflicts, then restores atomically. Exported acceptance is never trusted without server reconciliation. Older application builds cannot read format 5; retain the current build when restoring a new archive.

## Financial and release boundaries

This slice records EGP net inventory cost for development. It does not calculate supplier payments, recoverable tax, discounts or freight, and its documents are not compliant tax invoices. Set and implement the client's financial allocation rules and real authentication before live operation. Membership/billing and separate demo infrastructure remain deferred. Source-linked supplier returns are Phase 2C; they are separate from reversing an erroneous entire receipt.

Checks cover stock-free drafts, 8+12 partial receiving, competing revisions, same-ID retry, pack conversion, tenant scope, atomic receipt/reversal rollback, original layer availability, migrations, offline reload, ordered sync, recovery and phone layouts. Use isolated browser data and port 3114, leaving `.data-local` untouched.
