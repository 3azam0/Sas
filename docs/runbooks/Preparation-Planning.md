# Preparation planning — خطة التحضير

Open **خطة التحضير ←** from the home screen, or **المطابخ والتحضير → خطة التحضير**. Plans are device drafts, scoped to the organization and data generation. They persist offline on this browser; they are not shared server documents or stock reservations.

## Plan the work

Create a plan, choose its date, destination kitchen and a different active source location. Add exact published recipe versions and planned output in each recipe's base output unit. Both stocked preparations and non-stocked meals are supported. Recipe versions must be effective by the plan date. Saving a plan does not issue stock or add output.

**احتياجات المتبقي** aggregates ingredients across the unfinished quantities. Non-stocked child recipes expand; stocked child preparations use their output material rather than deducting their raw ingredients again. Stocked-root requirements use the existing production scaling/rounding rules. Other fractional requirements round upward to six decimals after aggregation. Limits are 100 distinct recipe versions and 200 materials per plan.

The table compares requirements with the latest accepted kitchen balance. It is not a historical/future balance forecast and does not reserve stock against other plans. A planned stocked output does not count as available stock before production is accepted.

## Supply the kitchen

**إنشاء مسودة صرف للمطبخ** suggests only the shortage, capped by accepted source stock and the amount still available after local movements. Pending source receipts do not enlarge this suggestion. Review the existing kitchen supply form before saving. It retains editable document prices and normal availability validation; opening the form does not post stock. For a future plan, the supply form starts on today's date.

Unresolved supply to that kitchen on the device blocks another suggestion until acceptance or review is resolved. This protects against repeated local suggestions; it is not a cross-device stock reservation. After acceptance, refresh updates the kitchen balance and remaining shortage. A draft opened and cancelled creates no inventory transaction.

## Record actual execution

For a stocked preparation, **تسجيل إنتاج فعلي** opens the existing production form using the pinned version, remaining target, plan date and kitchen as both input/output location. Actual output starts blank. Enter observed input/output and abnormal waste, explain waste/failure, review and confirm before saving. Future-dated production is unavailable. The existing server posting policy and review workflow apply.

Only accepted, explicitly linked production contributes completed output. Pending/rejected batches are visible but not completed. A rejected batch blocks a new batch for that line until resolved. Existing linked corrections are followed once; a failed batch contributes zero output. Missing accepted execution history is unknown and blocks recalculation, rather than becoming zero. Material-level usage/waste variance remains in the linked production history. Remaining work is max(planned − usable completed output, 0); overproduction remains visible as an output variance.

For a non-stocked meal, enter completed usable portions, discarded portions and notes as planning observations. These do not post inventory: sales retain their existing ingredient deduction. Discarded portions remain separate and do not automatically increase the plan target; revise the target explicitly if replacement portions are needed. Do not record the same physical waste twice.

After a production link is created, its target/version cannot be changed. After a handoff is opened, date/source/kitchen stay fixed; create another plan for a different scope. Close a plan to make it read-only; reopening is explicit. Closing is an organizational action on this device, not a financial period lock.

## Saving, export and recovery

Use **حفظ الخطة** before leaving. Unsaved changes block switching/new plans and exports; **إلغاء التعديلات** restores the saved version. Revision checks reject stale edits from another window. An expired work grant permits reading/exporting saved plans, but saving/execution requires renewal.

**تنزيل نسخة الخطة** exports validated JSON. **استيراد نسخة خطة** accepts only the same organization/generation and refuses to overwrite a different saved copy. Transfer/production outboxes are not part of this file: use the sync center's existing recovery export for unsynchronized transactions. Do not execute the same planning backup concurrently on multiple devices. Recovery format 23 is unchanged; it does not include these device drafts. **تصدير احتياجات CSV** includes full plan progress, current ingredients, shortages and source suggestions, with exact decimal strings and spreadsheet formula escaping.

Plans use namespaced IndexedDB device storage without a Dexie upgrade. Generation reset hides old-generation drafts and rejects restoring them into the new ledger. Clearing browser data removes device drafts; retain downloaded plan backups. There is no automatic shared planning or multi-device reservation in this delivery.
