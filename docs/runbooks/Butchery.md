# Butchery operations

Open **التقارير والتحضير → الجزارة**. On a phone, open **القائمة → الجزارة**.

1. Select the stock location used for the central kitchen/butchery. Create a separate location through inventory setup if your operation needs a separate processing balance. This release does not automatically rename or create locations in the live organization.
2. Under **تعريف أصناف الجزارة**, create products with your own names, or classify existing kilogram items. The four kinds are purchased beef, live sheep, beef kitchen product, and lamb kitchen product. Classification does not change stock. Sync definitions before selecting them in processing batches.
3. Receive purchased meat or live-weight sheep through normal receiving. Use existing transfers to send inputs into the selected butchery location and confirm receipt before processing.
4. Under **دفعة تجهيز**, choose beef cutting or sheep slaughter/cutting. Enter actual input weight, output weights, losses and optional processing charges. For sheep, record head count and usable carcass weight, including organs that will become kitchen products. Live weight equals usable weight plus slaughter loss; output weights plus cutting loss equal usable weight. Beef output weights plus cutting loss equal input weight.
5. Assign each output its cost percentage. Percentages must total 100. A usable by-product can have a zero share. Purchase and processing cost, including normal loss, are carried by the outputs; do not issue that same loss again as separate waste.
6. Send finished products directly to main inventory or kitchen stock through **تحويلات المخزن والمطابخ**. Split destinations with separate transfers. Dispatch deducts source stock; receipt adds destination stock, and a partial receipt leaves the balance in transit.
7. Inspect accepted stock and batch costs under **السجل والأرصدة**. Pending operations remain on the device until accepted. Rejected operations can be retried unchanged or cancelled and re-entered. Accepted documents are immutable.

Offline capture requires a downloaded, valid session. Recover pending butchery work using the sync center's recovery archive. The expected local stock projection is provisional; final quantity and costing come from server acceptance. Pending butchery work blocks approval of affected stock counts until resolved.
