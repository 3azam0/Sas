# Compact purchase draft — 27 October 2026

The purchase draft now shares the receiving layout: supplier/date/reference and compact keyboard guidance in the fixed header, full-screen/restore controls, one material/quantity/base-unit-cost/purchase-unit entry row, and horizontal material rows below it. The body scrolls while Save/Close remain available.

Enter from quantity moves to cost; Enter from cost and Alt+Insert add the entry. Matching material/unit/cost entries combine, and Edit replaces the selected row while preserving its identity. Unfinished entry/editing blocks document save. Existing pack conversion, the 200-material limit, base-unit costing, order revisions and stock-free drafts remain authoritative. Partial receiving, cancellation and receipt reversal use their existing commands.

The material dropdown, F2 and **إضافة مادة جديدة** reuse the existing catalog editor and setup outbox. Creation preserves supplier/date/reference, quantities, costs and committed rows. Save selects the material and focuses quantity; cancel returns to material search. Creating a material is separate from saving or cancelling the purchase order.

The already-live butchery commit `c5ca0af` was merged into this branch before activation. Its routes, stock processing, cost shares and recovery 22 remain included. Supabase API 18 and migration 20261026215636 were preserved; this release required no backend or schema deployment. Earlier staged Worker 94 was never activated.

Validation: TypeScript, production/offline and hosted builds passed. All 34 focused tests across six files passed. Five browser scenarios are covered by the combined run and a focused retry after a read-only connection reset: butchery, 8+12 partial receiving, mobile cancellation, receipt reversal/replacement, and the compact editor with packs, row editing, quick-create, offline reload/sync, revision editing and zero stock effects. The runner checks the prepared build's health endpoint during bounded Windows warm-up; bootstrap reads retry connection resets without retrying writes. Deployment dry run passed.

Build **611d1909728d0ef5**, Cloudflare **95**, version **02207d6e-c328-47b4-9750-d8f857ad9ce8**, deployment **2c1d739a-59d1-4401-a615-f2d3467792a4** at 100%. Live health and JavaScript hash match the prepared bundle. Anonymous/origin/private-file protections, retained butchery routing and desktop/phone login rendering passed. No client records were created for testing.
