# Stock balance editing

Open **المخزون**, select the stock location and click **تعديل الرصيد** on a material row. Enter the new balance and a reason. Zero is valid. The form shows the previous balance and the adjustment difference. For increases, confirm the added unit cost; a known average/latest receipt price is suggested, and explicit zero cost is accepted. The cost applies only to added quantity. Decreases use the organization's FIFO or moving-average policy.

Saving queues one `count.save` marked `entryMode: balance_edit` and its `count.finalize` in one Dexie transaction. Both survive reload and recovery export/restore. The confirmed balance changes only after server finalization. The count engine retains old/new quantities, delta, valuation, reason, server timestamp and authenticated actor in existing count/audit records. Review the result under **الجرد والتسوية** and the movement under **سجل الحركات**. No new table, migration or offline database version is required.

Synchronize or review earlier operations for the location before a new balance edit. A queued edit may be captured offline with a valid grant. If stock changes elsewhere after the captured checkpoint, the edit enters review instead of overwriting newer inventory. Use the existing linked recount workflow with a newly checked quantity. A previous accepted draft can be cancelled from the count screen. Never retry a stale absolute quantity by changing its baseline silently.

This action records an inventory correction. Supplier receiving, returns, production, waste and transfers retain their own workflows and references.
