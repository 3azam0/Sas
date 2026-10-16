# Sales refunds and voids

Open **المصروفات والتصحيحات**, select the stock location/POS kitchen of the original sale, then **مرتجع / إلغاء بيع**. Search the accepted sale by date, transaction/line, meal name and remaining amount. Only genuinely accepted sale lines can be corrected; duplicates in later files do not create a second source.

A partial refund records quantity and EGP amount. A void settles the full remaining quantity and amount; those inputs are read-only. The server serializes cumulative corrections and rejects excess, future/pre-sale dates, wrong locations/tenants and attempts to replace accepted records. A final quantity refund must settle the remaining revenue, including free items.

Choose the ingredient disposition explicitly: consumed, or independent stock review needed. Neither option returns ingredients, reverses preparation/theoretical demand or clears a shortage. Record any physical stock correction separately with its own evidence. The original sale and recipe pins remain immutable. This feature records financial adjustments; it does not send money through a payment provider.

Corrections are booked on their own date, including refunds for earlier periods. History records actor, reason, amount and synchronization state. Local saving remains pending until accepted; network/auth failures preserve the same operation, business rejections support retry, cancellation and a fresh linked correction. Recovery format 18 includes the journal.
