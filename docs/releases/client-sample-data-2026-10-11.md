# Client menu trial — 11 October 2026

The user approved temporary operational data in the existing [hosted Fodo workspace](https://fodo.am-agent2026.workers.dev) for واحة أولاد سعد. Menu names come from the supplied image; selling prices, recipes, yields, costs and transactions are fictional assumptions. This uses the main warehouse and existing account, without a separate demo tenant or branch. No development/reset control was added to the interface.

Verified hosted state:

| Record | Count |
| --- | ---: |
| Original catalog preserved in private backup | 328 |
| Current catalog, including 10 additions | 338 |
| Menu ingredients with stock and cost prices | 50 |
| Menu mappings / source sections | 99 / 12 |
| Published recipes / versions | 100 / 100 |
| Suppliers | 3 |
| Purchase orders, including one draft | 2 |
| Purchase receipts, partial then final | 2 |
| Source-linked supplier return | 1 |
| Production batches | 2 |
| Completed-sales imports / accepted sales lines | 8 / 100 |
| Sales imports with recorded shortages | 1 |
| Balance correction | 1 |
| Accepted seed commands / stock movements | 334 / 170 |

The period is 5–11 October 2026. Six meal combinations use a pinned rice sub-recipe. A stocked tomato sauce has two production batches with recorded output and waste. The first rice receipts demonstrate moving average: 2 kg at 20 EGP plus 8 kg at 30 EGP equals 28 EGP/kg, before later deliveries. Sales deduct selected ingredients only. The large-sale example required 126 kg of chicken, deducted 66.65 kg and retained a shortage of 59.35 kg. A later 50-item replenishment supplies latest-receipt cost prices and leaves that earlier shortage unchanged. All stock balances are nonnegative and ledger/layer reconciliation matches.

The [source transcription](../clients/wahat-menu-sample.json) flags three small labels for client review: فرا محشي ومندي، حمص مندي (قدوس)، علة شمش. Recipe definitions and prices need client confirmation before real operation; source sections are transcription metadata, not a new sales-category feature.

Deployment and backup identifiers:

- Organization: `707a2ecc-a724-48ad-8e68-32069b308c63`.
- Trial run: `1ed0fd62-60a1-49be-b8ff-4dc146ad8643`, status `active`.
- Trial generation: `0a069a6d-ab1c-4904-ab9a-cdc2f9e5325a`.
- Migration `20261011152505`: `client_sample_data_backup`.
- Migration `20261011152653`: `sample_data_backup_deny_client_access`.
- Supabase `fodo-api`: active version **5**, deployed with the explicit Postgres.js JSON adapter. Existing serialized parameters are sent once; older double-encoded documents remain readable without changing IDs/hashes.
- Cloudflare frontend remains build `8d72f3c0de4379cb`, Worker version `96ed71b7-86bc-43f8-840c-0c99846cc2fe`. No frontend deployment was needed for this data/backend update.
- Source branch: `feat/client-sample-data`, based on `2bd6d0f`.

Validation passed: TypeScript; 244 tests in 41 files; final seed/JSON regressions rerun after replenishment and schema-guard assertions (3 passed). The seed/restore integration checks cost completeness, preserved shortages after replenishment, wrong-tenant/generation/schema refusal, restoration, repeated cleanup, another tenant's isolation and stale queue rejection. Hosted read-only browser checks passed for sign-in/profile, stock balance editing without saving, 100 recipes, complete estimated costs, checked/unchecked deduction ingredients, 99 mappings, shortage history, theoretical reports, purchase receiving, source return, production, mobile fit and offline reload. Browser page errors: zero. Screenshots were inspected.

The backup table has RLS, an explicit deny policy and no read privileges for `anon`, `authenticated` or `fodo_api`. The security advisor reports only the pre-existing [leaked-password protection setting](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection); this release did not change Auth settings.

The trial is still present. Follow [temporary client data](../runbooks/Temporary-Client-Data.md) only when the user requests its removal. Cleanup restores the original catalog/units/warehouse, preserves account access and current organization profile, and rotates the generation so old offline queues cannot reintroduce trial transactions. Manual activity during the trial is also removed; review/export any real records before cleanup. Local credentials, baseline snapshot, SQL, manifests and screenshots remain ignored by Git.
