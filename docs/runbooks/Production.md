# Production and preparation — Phase 4B

Open **الإنتاج والتحضير**. A batch uses an exact published recipe version, records actual input/output and posts its stock movements together after synchronization accepts it.

## Prepare your catalog

Create the prepared material and base unit in **إعداد المخزون**. In **الوصفات والتكاليف**, choose **تحضير ينتج مادة مخزون**, link that material and publish the recipe. Keep the output distinct from its ingredients. Add stock locations and accepted ingredient quantities through opening stock or receiving.

The recipe describes a complete batch and its output. Production expands non-stocked sub-recipes and stops at stocked preparations. Using an existing mix consumes the mix's inventory; it does not issue its raw ingredients again. Non-stocked meals remain recipe estimates until sales consumption is added in Phase 4C.

## Record a batch

1. Select your location and **دفعة إنتاج جديدة**.
2. Choose the exact preparation version, business date, reference, input location and output location. Output can be stored at the same location or another location participating in the preparation.
3. Enter planned output and actual usable output in the recipe output's base unit. Planned output scales the recipe requirements; it does not replace your physical observation.
4. Review actual ingredient quantities. **تعبئة بالكميات المخططة** restores the proposed amounts. Enter zero for a planned ingredient not used; at least one actual input must be positive. Substituting materials requires a new recipe version.
5. Record abnormal wasted quantity within each total input and its reason. Confirm your observations, then choose **حفظ وترحيل الدفعة**.

Example: a planned 3 kg preparation uses 3 kg rice costing EGP 96 and produces 2 kg usable output. With normal yield loss only, the output carries EGP 96, or EGP 48/kg. If 0.6 kg of the input was abnormally spilled, it is already included within the 3 kg used: EGP 19.20 is recorded as abnormal waste, and the output carries EGP 76.80, or EGP 38.40/kg. Do not issue another 0.6 kg as separate waste for that same incident.

Actual output divided by planned output is **نسبة تحقيق الخطة**. This ratio compares the same output unit; it is not a weight-yield ratio between different ingredients or output dimensions. Ingredient usage variance compares actual quantities with scaled recipe requirements, rounded to six decimals.

## Failed batches and cost

Actual usable output of zero requires a failure reason. Acceptance consumes the observed inputs, records all input value as failed-batch waste and creates no output inventory or unit cost. It never divides by zero.

Input cost is allocated using the organization's current moving-average or FIFO issuing policy. Successful output receives input value less abnormal waste value; normal loss is reflected in the cost per usable output unit. Average output blends with the destination pool. Final batch value is exact to twelve decimal places; displayed unit cost has six decimals. FIFO output can contain two adjacent prices to preserve an exact batch value when division has a remainder. Independent balance/ledger/layer checks run before and after posting.

The form's preview uses accepted downloaded stock. Missing stock prevents a complete cost preview, but capture can remain queued while you resolve supply. Accepted pricing is calculated by the server at posting time. Historical production records retain their allocated values when recipe definitions or later receiving prices change.

## Offline and review

Queued batches survive reload. Local inventory projects ingredient deductions and usable output additions; projected quantities and costs are provisional until acceptance. Setup and recipe publication synchronize first. Earlier direct receiving, production and transfer dependencies settle in capture order. A rejected earlier movement or recipe publication puts dependent production into review. Pending/rejected production blocks count approval for affected locations; accepted production makes an older count baseline stale.

Transport/authentication failures preserve queued batches. Retry sends the unchanged document with its original identifiers. Cancellation applies only to a rejected batch and never reverses accepted stock. **تصحيح الإنتاج** creates a linked replacement with fresh document/movement identifiers in the same input/output locations, retaining the rejected history. Accepted batches are immutable; accepted reversal is a later workflow.

The sync center lists device production actions across locations. **عرض دفعة الإنتاج ومراجعتها** selects the batch's input location and opens its history. Each accepted record shows the recipe, quantities, usage variance, issuing policy, input/waste/output values and reasons.

## Recovery and development reset

Current recovery format **13** includes sales, production, recipe and existing inventory outboxes (production was introduced in format 12). Preview/restore requires the same organization and generation with a current grant; scope, references, independent IDs, correction links and conflicting payloads are checked before atomic import. Cancelled/superseded records retain their status. Formats 1–12 remain readable under the existing generation rules.

Transaction-only development reset clears production and stock while retaining recipe definitions/versions. Catalog-clearing reset removes production before referenced recipes/materials. Both rotate generation; old browser actions/archives cannot return to the new ledger. This feature does not reset or seed the client's workspace.

Next: validated sales imports, refunds/voids and actual-versus-theoretical consumption under [Phase 4C](../Phase-4-Plan.md). Production overhead allocation, multiple coproducts, approval scheduling, substitutions, production reversals, lots/expiry and production draft management remain later extensions.
