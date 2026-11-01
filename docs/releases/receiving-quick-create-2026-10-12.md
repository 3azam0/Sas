# Receiving material creation and optional reference — 12 October 2026

Receiving has an **إضافة مادة جديدة** action in the material dropdown, including when no items match. Clicking it, selecting it with arrows/Enter, pressing F2 or pressing Enter on an unmatched query opens compact creation. Search prefills the name; SKU/category/inventory unit are required, the unit starts unselected, and known duplicate codes show inline feedback. **حفظ واختيار** saves through the setup outbox, selects the new zero-stock material on the originating row and focuses quantity. The parent receipt stays mounted, retaining supplier/date/reference/other rows. Cancel/Escape returns to its selector. Cancelling a receipt later retains its independently created material. A receipt can be started with an empty item catalog once units and a destination exist.

**مرجع الاستلام** is optional in UI validation and the shared server contract. Blank, whitespace-only or omitted input normalizes to an empty string. Nonempty references retain the 2–200 character limit. Existing nonempty serialized documents retain their order/hash; system document/line IDs, audit and idempotent replay remain authoritative. Reference-free history and accepted ledger movements have readable labels. Setup uploads first; a missing or inconsistent confirmed material/unit/location/supplier puts the saved receipt into review without uploading it.

Validation:

- All 280 unit/integration tests in 50 files passed, including new optional-reference limits/hash compatibility, server acceptance/idempotency/reconciliation, offline zero-stock creation/recovery/dependency ordering, and rejected setup blocking.
- TypeScript, Next production build with 42 offline assets and the hosted bundle passed.
- Live hosted checks verified the new dropdown action, F2, unmatched-search Enter, mouse creation, name prefill, explicit required unit, duplicate-code error, Enter navigation, Ctrl+Enter validation and Escape/cancel returning to the same row. Supplier, date, other rows, quantities and total were retained; the reference field is `required:false` and Enter advances.
- Desktop and 390×844 phone checks showed no horizontal overflow and visible Save/Cancel footers. Screenshots were inspected. Verification drafts were cancelled; no catalog material or receipt was saved into the client's organization. The overview remained 338 materials, 196,820.65 EGP and zero pending operations.
- An additional browser regression is saved in `tests/browser/receiving-create.spec.ts` for an isolated local fixture. It was not executed in this session: automatic approval review rejected starting its local test server because sandbox approval is disabled. Hosted draft checks and isolated Vitest fixtures supplied the verification above.

Deployment:

- Hosted URL: https://fodo.am-agent2026.workers.dev/; loaded asset confirms build `1a2e015e88c766a1`.
- Supabase project `bkkxrptgwbrwredauopq`: active `fodo-api` version 9, bundle SHA-256 `4975d2f10fdc6d8aa00163d3f7f6c71d80d02e0007e5c1f455bedb6f0128b484`. Existing custom bearer authentication, tenant authorization and gateway configuration were preserved; no schema migration.
- Cloudflare upload returned HTTP 200. Deployment `cad6c542-5f5e-4e30-9af4-8810a00e1ce8` serves Worker version `c9850f42-96e4-4165-a89e-8a2e9946030d` at 100%, preserving existing bindings and settings.
- Developer guide v2.36; branch `feat/receiving-quick-create`, stacked from `6805454`. Remote publication retains the previously documented Windows credential-helper limitation.

Proof screenshots are in the sibling `outputs/Receiving-Quick-Create-20261012` directory: `receiving-create-dropdown.png`, `new-material-dialog.png`, `receiving-reference-and-create.png`, `new-material-mobile.png`, and `receiving-mobile.png`.
