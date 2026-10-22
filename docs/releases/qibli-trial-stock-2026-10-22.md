# Qibli trial stock — 22 October 2026

The user authorized supplying the Qibli kitchen, then separately approved a temporary receipt for the chicken shortage. The active trial remains 1ed0fd62-60a1-49be-b8ff-4dc146ad8643, generation 0a069a6d-ab1c-4904-ab9a-cdc2f9e5325a. No cleanup/reset was run.

## Accepted documents

- Receipt TRIAL-QIBLI-RESTOCK-20261022, operation 02185e60-9f59-5b2f-a636-0681a7c46aa5: 6.2 kg chicken at the existing fictional receiving cost of EGP 160/kg, total EGP 992. The warehouse originally had 1 kg and the planned trial required 7.2 kg. No supplier was invented.
- Transfer TRIAL-QIBLI-POS-20261022, operation 0ed412bc-fd96-5fac-a4d7-f6ddc050d602: 16 materials from المخزن الرئيسي to المطبخ القبلي, value EGP 2,303.666 (displayed EGP 2,303.67). Quantities cover two servings of each of the 12 SAMPLE-WS menu entries using their existing published trial recipes. All recipe materials are included, including those not selected for automatic sales deduction.

| Material | Quantity | Unit |
| --- | ---: | --- |
| فرخة | 7.2 | كجم |
| طحينة | 0.3 | كجم |
| فلفل أسمر | 0.072 | كجم |
| ليمون | 0.04 | كجم |
| زيت رامبو | 0.538 | لتر |
| طلبات ضاني | 0.3 | كجم |
| أرز بسمتي | 0.5 | كجم |
| لحم بقري للفرم | 1.38 | كجم |
| عيش خارجي | 0.96 | كجم |
| أرز الهرم | 1.44 | كجم |
| خيار | 0.62 | كجم |
| بصل أبيض | 0.2 | كجم |
| طماطم | 1.16 | كجم |
| بطاطس | 0.5 | كجم |
| ملح طعام سائب | 0.108 | كجم |
| كباب ضاني | 0.5 | كجم |

## Verification and repeat safety

Both documents use the normal authenticated APIs, fixed saved IDs/bodies and the matching organization/generation. The transfer response was interrupted after server acceptance; a read-only verification confirmed acceptance before replay. Repeat apply skipped posting the accepted ID and verified exactly one document. Receipt and transfer quantities/values were checked against every before/after balance. The transfer has 16 outgoing and 17 incoming cost-allocation entries, with zero net quantity and value change. The kitchen has 16 positive material balances and EGP 2,303.666 total stock value.

Hashes confirm no changes to sales, finance, kitchen tickets, menu mappings, recipes, terminal routing, kitchens, locations, items, units or suppliers. No cash sale or refund was posted. Existing transfer tests (2) and script syntax checks passed. Live inventory shows Qibli, 16 stocked results and EGP 2,303.67; screenshot outputs/Qibli-Trial-Stock-20261022/live-qibli-stock.png.

Both operations are registered in private/local trial manifests as qibliPOSReplenishment and qibliPOSStock. The private manifest stockMovements count is refreshed from all 212 server rows. Existing guarded full-baseline cleanup covers them; cleanup still requires an explicit request and review/export of any client-approved configuration to retain.

Use scripts/pos-trial-kitchen-stock.mjs prepare, then apply, then verify. The replenish --approved-test-receipt mode requires separate human authorization for its saved temporary receipt. Preparation refuses shortages; it never invents a purchase price or creates stock implicitly. Saved private evidence is in ignored .cache/pos-trial-kitchen. Verification is against the preparation checkpoint and must run before subsequent legitimate client activity.

Frontend build 297b007f4aece661 / Cloudflare 85 / API 16 are unchanged; no application deployment or schema migration was needed. Real prices, portions, stock par levels, physical printer output and human client acceptance remain pending.
