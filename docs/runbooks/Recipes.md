# Recipes and ingredient costing — Phase 4A

Delivered locally on 10 October 2026. Open **الوصفات والتكاليف** from the main menu. Definitions and estimates are available. Stocked preparation posting is also delivered under **الإنتاج والتحضير**; sales consumption is next.

## Create a recipe

### Start from an inventory item

In **إعداد المخزون → المواد والمكونات**, choose **مكونات الصنف** beside an active item. This opens its existing stocked recipe, or prepares a new definition with the item's name, a proposed unique `BOM-` code, output item and locked base unit. Nothing is saved automatically. Enter the complete batch ingredients and usable output, save the draft and publish its version when ready.

When adding or editing an item, enable **فتح إعداد المكونات بعد الحفظ** to continue into the same workflow after the item is saved locally. It also works offline: setup acceptance precedes recipe acceptance. The inventory table identifies items with a linked definition as **صنف مركّب**. Categories remain independent, single-level classifications.

For example, a stocked kofta item can consist of beef and spices. Enter their quantities and the resulting kilograms of kofta. Published sub-recipes can also be components under the existing version, unit and cycle rules. Defining components leaves all balances unchanged; record the actual batch in **الإنتاج والتحضير** to issue the ingredients once and add the resulting stock. The same item can still be received from a supplier. This entry point does not create fictitious ingredients, quantities or recipes in the client's catalog.

1. Add your materials and measurement units in **إعداد المخزون**. A supplier or stock location is not required to save a recipe. Choose a location with accepted stock/receiving later to obtain prices.
2. Choose **إضافة وصفة**. Enter a unique code/name, output unit, batch output quantity and effective date.
3. Choose a non-stocked meal or a stocked preparation. A stocked preparation links an existing inventory material and its base unit; the linked item needs to be distinct from its inputs.
4. Add the complete batch's material quantities. Compatible mass units convert grams/kilograms, and volume units convert millilitres/litres. Custom units use their base quantity; mass and volume are never interchangeable without a separate conversion model.
5. Optionally enter the net selling price for one output unit, excluding tax. Save the draft, review its quantities and use **نشر إصدار** when ready.

Example: a batch consumes 1 kg of rice costing EGP 28/kg and produces 2 portions. Batch cost is EGP 28 and portion cost EGP 14. At EGP 100 net selling price per portion, food cost is 14% and gross contribution EGP 86 before operating expenses. Entering 1,000 grams produces the same base requirement of 1 kg.

Quantities must be positive, with up to six decimals. Definitions contain 1–200 distinct components. Changing the batch output changes cost per portion; it does not change the entered batch inputs. Save/publish never deducts ingredients or creates preparation stock.

## Sub-recipes and versions

Use **إضافة وصفة فرعية** to choose an exact published version and the amount of that version's output required. A non-stocked sub-recipe expands its ingredients proportionally to its batch output. A stocked sub-recipe is priced using its output inventory material, which avoids counting both the preparation and its raw inputs.

**تحليل المواد الخام** expands stocked preparations for analytical estimates. This is a separate view of raw requirements; it does not post inventory consumption. The root recipe always shows the inputs for producing its own batch.

Published versions are immutable. **إنشاء مسودة إصدار جديد** saves a new draft; subsequent publication creates the next version. Existing parent recipes retain the child version they reference. Explicitly edit a parent to adopt a newer child version. The version selector shows earlier definitions and effective dates, priced using the currently available cost source rather than a frozen historical price.

The system rejects direct/indirect recipe cycles, missing or cross-organization references, incompatible units, later-effective child versions and expansion above 20 levels/1,000 recipe nodes. Revision checks prevent silently overwriting another device's change.

## Understand the estimate

Choose a stock location and **مصدر تقدير التكلفة**:

| Source | Calculation | If unavailable |
|---|---|---|
| **متوسط المخزون المتبقي** | Accepted stock value divided by positive remaining quantity at that location | Incomplete when there is no positive stock quantity |
| **آخر سعر استلام مقبول** | Latest accepted direct/purchase receiving amount divided by received base quantity, from the full ledger | Incomplete if that material has never been received at that location |

Remaining-stock average is an estimate even when the inventory issuing method is FIFO. Opening stock supplies the first source, but it is not treated as a purchase price in the second source. The system does not silently switch between the two sources.

Missing prices display **—** and an incomplete-cost message. Known zero-cost material remains valid. The known subtotal does not represent the full recipe when a price is missing. Shortage is shown separately: a receiving price can exist even when there is insufficient stock to produce the batch.

Batch cost and cost per output unit require complete prices. Food-cost percentage and gross contribution also require a positive net selling price. The displayed snapshot time identifies freshness; pending receiving transactions do not supply accepted prices. Gross contribution excludes expenses, taxes and future production adjustments.

## Offline, review and recovery

Save and request publication offline while the organization's work grant remains valid. **محفوظ محلياً / غير نهائي** identifies actions and candidate versions awaiting acceptance. They survive reload. Synchronization accepts setup first, then recipe drafts and child publications before dependent parents. Same-ID delivery cannot create duplicate versions.

Network/authentication failures preserve queued actions. Business rejection enters review. Retry sends the unchanged action; cancellation applies only to a rejected action and has no stock effect. After cancellation, reopen the latest draft and save a fresh action to correct its definition. If an earlier draft or child publication is rejected, dependent actions also need review.

Current recovery format **13** includes recipe and production actions together with existing outboxes (recipes were introduced in format 11). Export from the sync center, then preview/restore into the same organization and generation with a valid grant. Identical actions are skipped; conflicting payloads abort the whole restore. Cancelled history stays cancelled. Formats 1–12 remain readable subject to the existing scope/generation checks. Database backups and browser recovery exports cover different data; unsynchronized device actions require the browser export.

## Development reset behavior

A costing-method transaction reset retains recipe definitions and versions, clears stock/prices and rotates generation so obsolete queued actions cannot return. A catalog-clearing reset also removes recipe dependencies, versions and definitions before their referenced catalog records. Recipe delivery does not itself reset or populate the client's database.

## Production and the next milestone

Phase 4B selects a pinned stocked-preparation version, captures actual inputs and usable output, consumes stock once using the organization's policy and allocates value to stocked output. Normal yield loss, abnormal waste and failed batches have separate posting rules; see [Production walkthrough](./Production.md). Sales imports and actual-versus-theoretical consumption are next in Phase 4C. See the [Phase 4 plan](../Phase-4-Plan.md).
