# POS sample meals — 21 October 2026

Added and verified **12** temporary, priced POS menu mappings in the existing hosted trial. They use source POS, codes SAMPLE-WS-*, the existing published trial recipes and their existing fictional sale prices, and both active kitchen availability assignments. The original 99 FODO mappings, recipe definitions, terminal routing and inventory remain unchanged. Total menu mappings: **111**, with five sample categories. The frontend remains build **378fa56fb59ab0e4**, Cloudflare **83**, API **16**; no application deployment or schema migration was required.

| Category | Sample selection | Test price (EGP) |
| --- | --- | --- |
| وجبات أولاد سعد | ربع فرخة + 3 كفتة + أرز + سلطات + عيش | 335 |
| وجبات أولاد سعد | نصف فرخة + 3 كفتة + أرز + سلطات + عيش | 470 |
| وجبات أولاد سعد | شيش + 3 كفتة + أرز + سلطات + عيش | 295 |
| وجبات أولاد سعد | ربع فرخة صدر + أرز + سلطات + عيش | 165 |
| وجبات أولاد سعد | ربع فرخة ورك + أرز + سلطات + عيش | 165 |
| وجبات أولاد سعد | نصف فرخة + أرز + سلطات + عيش | 300 |
| المندي | نصف فرخة مندي | 295 |
| مشويات | ربع كيلو كباب | 300 |
| مشويات | طبق مشويات أولاد سعد اسبيشيال | 390 |
| أطباق جانبية | طبق أرز بسمتي | 20 |
| أطباق جانبية | بطاطس محمرة | 20 |
| السلطات | سلطة خضراء | 20 |

## Verification and replay

Run scripts/pos-sample-menu.mjs prepare, review the ignored saved command set, then apply. The loader requires the matching original local trial record and current server organization/generation, uses existing owner authentication, and submits menu.save commands through the normal API. Saved deterministic IDs/bodies and accepted-operation checks allow interrupted runs to resume. It never posts sales, stock, expenses or kitchen commands, and never rewrites existing menu source identifiers.

All 12 commands were accepted. A repeat apply left 12 unique sample codes, each still revision 1. Hash comparisons confirmed unchanged stock balances, financial records, kitchen tickets, sales and the 99 original menus. The private active trial manifest now records counterPOSSample, including item and operation IDs. Local manifest/finalization SQL is updated too. The existing guarded baseline restore already covers these extra menu rows and their operation receipts; do not run cleanup until explicitly authorized.

Live browser verification: both current POS selectors show 12 enabled sample cards with prices/categories. A chicken meal added to an unpaid cart at EGP 335; the cash preview calculated EGP 65 change for EGP 400. The preview was cancelled and that unpaid test cart cleared; no payment, sale or deduction was posted. Screenshot: outputs/POS-UX-20261021/live-pos-sample-menu.png.

Existing routing observation: both the بحري and قبلي terminals currently point to المطبخ البحري. This addition does not reroute them. The menu is also available to المطبخ القبلي if a terminal is assigned there later. Client confirmation is required before treating terminal names as kitchen routing.

The verify mode compares against the preparation checkpoint; run it before client-created test transactions, since later legitimate sales/stock changes will correctly differ. Prices and recipe quantities remain illustrative trial data. Real pricing, portions, stock selections, terminal routing and physical printing need client acceptance before real operation.
