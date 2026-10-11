# Menu mapping and completed sales — Phase 4C1

Open **المبيعات**. Completed sales retain their recipe mappings and pinned versions. New sales issue only selected materials up to availability, with shortages highlighted. Refunds/voids and finalized full recipe food cost remain deferred.

In the recipe draft, use **خصم المخزون عند البيع** to select materials. Unchecked materials still contribute to estimated recipe cost. Non-stocked child recipes expand to ingredients; stocked preparations appear as their output material. When selling a stocked preparation itself, choose its output rather than raw inputs. Publish the version and update the menu mapping to use it. Existing sales keep their prior selection and history.

The import preview lists selected required, available, expected deducted and shortage quantities. A shortage permits saving and acceptance. The server values available issues using the organization's FIFO/moving average, records the actual shortage as of acceptance and never creates negative balances. **سجل المبيعات** highlights required/deducted/missing quantities and the accepted selected stock value separately from full estimated recipe cost. Later additions do not automatically backfill a historical shortage. Duplicate imported details never issue twice; ordinary mapping, identity, tenant and corrupt-ledger checks remain enforced.

## Map your menu codes

1. Publish your recipe in **الوصفات والتكاليف**. The recipe output may represent portions, pieces, kilograms or your configured base unit.
2. In **المبيعات → أصناف البيع**, choose **إضافة صنف بيع**. Enter the source name, the exact POS code and a readable item name.
3. Select the exact published recipe version and the quantity of its output represented by one sold unit. If a recipe batch produces 10 portions and a sale is one portion, enter **1**, not 10 or 0.1.
4. Save. Offline mapping remains provisional until synchronization accepts it. Source names and codes are normalized to uppercase and stay fixed after creation. Changing to another POS code requires another item; names, versions, ratios and active status can be edited through revisions.

Menu codes are separate from ingredient SKUs. Codes are unique within each source and organization, and can be shared across that organization's branches. Updating a mapping affects new imports; accepted sale details retain their stored name, code, version, ratio and mapping revision.

## Import a CSV

Choose **استيراد المبيعات → استيراد ملف مبيعات**. Select the source and stock location representing the sale branch. Load a UTF-8 CSV or paste its text. Explicitly map these distinct columns:

| Field | Required content |
|---|---|
| Transaction ID | Stable original POS transaction identifier |
| Line ID | Stable detail identifier within that transaction; do not renumber rows on each export |
| Menu code | Code already mapped for the selected source |
| Business date | Branch business day in `YYYY-MM-DD`; the pinned version must be effective on that date |
| Quantity | Positive sold quantity, up to six decimals |
| Net amount | Total for the entire detail after discounts and excluding VAT, in EGP; zero is valid |
| Status (optional) | `sale`, `completed` or `مكتمل`; other values are rejected |

The canonical header is `transactionId,lineKey,code,businessDate,quantity,netAmount,status`. Other headers work through explicit column selection. Arabic decimal digits and `٫` are supported. Thousands separators and alternate date formats are not inferred. Files are bounded to 1 MiB and 200 detail rows; split larger exports while retaining the original detail identifiers.

The preview shows each row's pinned recipe version, output-per-sale, quantity, net amount and duplicate state. Unknown/inactive menu codes, invalid values, duplicate keys within a file and refund/void statuses block saving. Confirm that all details are completed sales with correct net amounts, then choose **حفظ استيراد المبيعات**. There is no silent removal of invalid rows.

## Repeated files and conflicts

A sale detail's external key is organization + POS source + branch + business date + transaction ID + line ID. Identical repetitions under that key add no new sales, even in another file. A partially overlapping import adds only its new details. Accepted history reports both new and duplicate counts; the displayed net total sums only newly accepted details.

If any repeated external key carries changed quantity, amount or recipe mapping, the whole import is rejected before any new detail is written. Review the source export; do not invent new transaction IDs to bypass a conflict. When the external detail already exists, CSV preview retains its accepted recipe mapping even after later menu edits or deactivation. New details use the current mapping. Accepted financial correction will be a separate refund/void workflow, not editing history.

## Offline, review and recovery

Mappings and final import documents survive offline reload under a valid work grant. Setup and recipe publication synchronize first, then menu mapping revisions and sales imports. Network or authentication errors leave queued work intact; business conflicts enter review. The sync center lists actions from all locations; open the relevant location and **سجل المبيعات** to inspect them.

Rejected imports support unchanged retry, cancellation or **تصحيح استيراد المبيعات**. Correction retains the rejected document and creates fresh operation/detail IDs in the same source/location. It uses the current mapping and allows quantity, amount and date correction before explicit confirmation. Cancel a rejected mapping action before editing the latest definition or creating a replacement. Accepted records remain immutable.

Recovery format **13** includes menu and sales outboxes, production, recipes and earlier operations. Restore validates organization, reset generation, references, identifiers, payload conflicts and correction links before atomic import. Cancelled/superseded history stays resolved. Earlier formats remain readable under existing generation checks; they cannot contain newer command types. Browser recovery protects unsynchronized device work and complements server backups.

Transaction-only development reset clears imported sales while retaining menu/recipe definitions; catalog-clearing reset removes their references before recipes and materials. Both rotate generation. This implementation does not reset or populate the client's database.

Next: Phase 4C2 selected-policy inventory consumption from pinned sales, including stocked preparation boundaries and explicit refund/void rules. Phase 4C3 adds actual-versus-theoretical consumption, food cost and variance reports.
