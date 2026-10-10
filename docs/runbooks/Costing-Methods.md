# Inventory costing in development

Moving weighted average is the default. FIFO remains available under **إعداد المخزون → طريقة تكلفة المخزون**. The policy belongs to the organization; each material/location has its own quantity and value pool. It is shared by all of that organization's stock locations.

| Example | Moving weighted average | FIFO |
| --- | --- | --- |
| Receive 2 kg at EGP 20 and 8 kg at EGP 30 | 10 kg / EGP 280, average EGP 28/kg | Two sources with their original costs |
| Issue 3 kg | EGP 84; remaining 7 kg / EGP 196 | EGP 70; remaining 7 kg / EGP 210 |
| Dispatch 5 kg from that original pool | EGP 140 held in transit | EGP 130 held in transit |

Inbound receipts and explicitly priced count surpluses add their accepted quantity/value. Issues, waste, count shortages and dispatch use the selected policy at server acceptance. Receiving a transfer preserves its accepted dispatch value, then blends it into the destination pool for moving average. Offline quantities are provisional; cost is finalized when accepted, using the stock then available.

Source prices stay immutable for inspection and supplier reference. Source quantities are traced oldest first under either method. Under moving average, a source's remaining inventory value can therefore differ from quantity multiplied by its original price. This is valuation of the current pool, not a changed purchase price. Quantity/value arithmetic uses decimals and 12-place transaction values. Full depletion consumes the exact remaining value, including rounding residuals. Ledger, balances and current source values must reconcile; inconsistent pools reject posting.

Source-linked returns still require available quantity from the selected receipt. The return records the original supplier reference amount separately from the inventory deduction. For example, returning 1 kg from a EGP 20/kg receipt while the pool average is EGP 28/kg gives EGP 20 reference value, EGP 28 inventory deduction and EGP 8 valuation difference. Receipt reversals use the same inventory policy and retain their original reference amount. Supplier settlement/accounting entries are not implemented by this slice.

## Reset the sample data

All current data is development data. The first startup of this build resets old sample transactions once and reseeds moving-average samples; it keeps setup/catalog. Rice samples use the example above. This behavior is guarded by `SAAS_DEMO_MODE=1` and the organization's development-baseline marker. It is not a production history migration.

To select either method, connect online, choose it in inventory setup, acknowledge sample reset and apply. The transaction clears this organization's stock/purchase/return/transfer/count documents, command receipts and prior audit, keeps materials/units/purchase packs/suppliers/locations, rotates its generation and reseeds active materials at active locations. The reset itself is audited. Selecting the current method also explicitly resets samples. Other organizations are unaffected by this settings action.

Before uploading saved work, browsers download the current generation. A changed generation atomically clears that organization's six old outboxes and replaces its snapshot; other organizations and device preferences stay. Every stock/setup/document API checks `X-Fodo-Generation` against the current organization, so an older device cannot post old operations after reset. Keep the same local address. A disconnected device notices the reset when it reconnects.

Recovery format **9** carries the generation. A matching archive can be restored. Pre-reset archives, including older archives without a generation, are rejected for a generation-bound organization. Formats 1–8 can be parsed for legacy fixtures but cannot restore obsolete work into the reset development ledger. Export again after reset. Database backups and browser recovery archives are separate.

## Development checks and later work

Legacy FIFO regressions deliberately seed FIFO. Normal fresh development data seeds moving average. Browser tests use separate data and cover both choices, reset acknowledgment, responsive layout, offline waste and stale-device prevention. The unit suite also covers fractional depletion, transfer residuals, supplier valuation differences, reversal, reconciliation, tenant isolation and recovery generations.

Recipes/BOMs are next and must consume this selected costing policy. Real tenant authentication, production migrations, production method-change/history conversion, memberships and billing are deferred. Do not expose sample-reset controls in a production client deployment.
