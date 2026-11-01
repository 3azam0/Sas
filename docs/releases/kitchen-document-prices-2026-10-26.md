# Kitchen document prices — 26 October 2026

Kitchen supply has an editable price per stock unit, initially copied from the source balance's current average cost. Enter after quantity moves to price; Enter there adds the line. Zero is valid. Matching prices merge quantities; a different price requires editing the existing line explicitly.

Prices belong only to this document. Inventory item prices, warehouse/kitchen valuation, FIFO/average transfers, sales deductions and stock-cost reports retain their existing rules. History and printing distinguish document amounts from actual posted stock cost. Old documents without prices keep their historical behavior.

The optional `unitPrice` is retained in the existing kitchen document JSON payload. No database schema or Dexie table change was needed. Recovery 21 preserves prices, accepts earlier compatible archives and rejects priced documents falsely labeled as older exports.

All 392 tests across 75 files passed, including FIFO/average value conservation with a different document price, payload retry conflicts, price validation/merging and offline/recovery persistence. Production/TypeScript/offline and hosted builds passed. Both focused browser scenarios passed, including price default/edit, keyboard entry, compact responsive layout, offline save/reload and printed totals. Deployment dry run passed. No client transactions were posted for testing.

Supabase `fodo-api` 17 is active after explicit user approval. Existing in-function authentication and `verify_jwt=false` configuration were preserved. Build **e33acad393d7e76f**, Cloudflare **91**, version **a38f431d-e36b-43d7-9c35-bc6fdfb9a026**, deployment **18e146f9-6a82-4746-9e3b-e48c4e144b6b** at 100%.
