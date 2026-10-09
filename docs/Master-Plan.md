# Fodo — Modular Business Management SaaS Master Plan

Updated: 9 October 2026

Status: planning baseline. Client-specific inputs are deferred. This document specifies intended behavior; it does not claim that integrations, compliance, or software have already been implemented.

Delivery status on 9 October 2026: the local receiving/waste inventory prototype includes validated recovery, same-organization renewal, stable startup and tested local database restore. Verification passed 27 unit/integration tests and nine browser/process scenarios, including the prepared release-validation checks. These complete the local reliability checks; the full first restaurant release remains pending. The selected Supabase project is `bkkxrptgwbrwredauopq`; its Auth endpoint accepts the configured publishable key. Production tenant/access implementation still requires management access and migrations.

## 1. Product objective

Build one extensible, Arabic-first SaaS platform for Egypt and Arab markets. Organizations use shared core capabilities and optional business modules across one or many branches.

The first release serves restaurants through inventory, purchasing, production, and cost control. It supports central warehouses, central preparation kitchens, combined central locations, and local branch preparation.

The first client application is an offline-first web application. Mobile and desktop applications follow, sharing backend contracts, synchronization behavior, and business rules.

Foodics is a reference for restaurant workflows and usability. This specification defines the platform's own transaction, costing, and extensibility rules.

## 2. Product layers

| Layer | Responsibilities |
|---|---|
| SaaS foundation | Tenants, memberships, permissions, modules, subscriptions, support administration |
| Core management | Catalog, suppliers, purchasing, inventory, transfers, shared sales records, expenses, reports |
| Business modules | Restaurant cost control, POS, restaurant operations, butchery/fish, mobile retail, future workflows |
| Country packages | Localization, tax configuration, fiscal documents, electronic invoicing, local integrations |
| Client applications | Web now; mobile and desktop later |
| Offline infrastructure | Local data, durable operations, synchronization, conflict resolution, recovery |

Each capability has one owner. Modules never maintain competing inventory ledgers or sales databases.

## 3. Tenant, legal entity, and location structure

```text
Organization / SaaS Tenant
  ├── Subscription and Module Entitlements
  ├── Users and Memberships
  └── Legal Entities
        ├── Country, Currency, Tax Registration
        ├── Central Locations
        └── Branches / Outlets
              └── Warehouses / Stock Locations
```

Use one tenant for a customer organization, not one tenant per branch. Support multiple legal entities where the actual business structure requires them.

- Tenant-owned records include organization identity.
- Fiscal and financial documents identify their legal entity.
- Stock transactions identify their stock locations.
- Relationships prevent cross-tenant references.
- Same-entity transfers preserve allocated inventory cost.
- Cross-entity movements require explicit commercial workflows.
- Reports distinguish entity, branch, country, currency, and stock scope.

Platform operators do not obtain unrestricted routine access to customer data. Support access must be scoped and audited.

## 4. Central warehouses and preparation kitchens

Storage and preparation are capabilities, not mutually exclusive location types.

| Arrangement | Supported behavior |
|---|---|
| Independent branches | Direct purchases and local preparation |
| Central warehouse | Receives supplies and distributes ingredients |
| Central kitchen | Produces prepared items and distributes outputs |
| Combined central location | Storage, preparation, and distribution |
| Mixed operation | Central and branch workflows used together |

Each stock location has separate balances and layers. Production identifies input and output locations. Central production may consolidate branch requests.

## 5. Extensible business types and modules

Business templates supply default modules, terminology, and settings. They do not hard-code a fixed list of permitted businesses.

Reusable capabilities include weight selling, recipes/BOMs, production, variants, serials/IMEI, lots/expiry, warranties, services, and non-stock products. Specialist records extend core products rather than adding irrelevant fields to every item.

| Module | Scope |
|---|---|
| Core management | Purchasing, receiving, inventory, transfers, expenses, shared sales and reporting |
| Restaurant cost control | Recipes, production, yield, costing, food cost, consumption reconciliation |
| POS | Checkout, shifts, payments, discounts, returns, receipts |
| Restaurant operations | Tables, waiter workflows, takeaway, delivery, kitchen orders, KDS |
| Butchery/Fish | Scales, cutting, multiple outputs, yield, cost allocation |
| Mobile retail | Serial/IMEI, variants, warranty, serialized returns |
| Finance/accounting | Receivables, payables, ledgers, statements, integrations |
| Country integrations | Applicable fiscal submission and local services |
| Future modules | Additional retail, production, and service workflows |

Enable modules at organization level and assign them to outlets. Validate dependencies. Disabling a module retains history; mandatory fiscal controls cannot be bypassed by disabling a feature.

## 6. First-release scope

Include multi-branch access, central locations, catalog and units, suppliers, opening imports, purchasing, receiving, returns, FIFO, transfers, recipes/BOMs, production, yield, waste, counts, external POS imports, consumption reconciliation, basic expenses, dashboards, and audit history.

Offline-first applies to operational reading and capture from the first release. Authoritative stock posting follows the synchronization policy below.

Defer native POS, full accounting, payroll, kitchen displays, delivery management, and specialist business modules. Initially manage subscriptions manually while retaining an entitlement model.

## 7. Egypt and Arab-market readiness

### Language and operational settings

- Arabic-first RTL; localization-ready for English and bilingual use.
- Arabic/English names and correct mixed-direction handling for codes and numbers.
- Arabic search normalization without altering official identifiers.
- Arabic spreadsheet templates and verified Arabic printing/PDF output.
- Country, currency precision, timezone, business-day cutoff, working week, document language, and phone/address settings.
- Store timestamps consistently; use named timezones rather than fixed country UTC offsets.

### Tax and currency model

- Effective-dated tax categories/rates, inclusive/exclusive prices, exemptions, charges, discounts, and returns.
- Defined recoverable/non-recoverable purchase taxes and landed-cost treatment.
- Country-specific rounding and retained historical tax snapshots.
- Separate quantity, unit-cost, and currency precision.
- Base currency by legal entity. Cross-currency reports require explicit exchange rates and reporting currency.
- Do not sum currencies directly or hard-code a country tax rate.

### Country adapters

| Market | Integration direction |
|---|---|
| Egypt | ETA electronic invoice/eReceipt workflows as applicable |
| Saudi Arabia | ZATCA generation and applicable Fatoora integration |
| UAE | Electronic invoicing aligned with the Ministry of Finance framework |
| Other Arab markets | Validated country package before fiscal operation is offered |

Adapters handle applicable registration, codes, validation, signatures, identifiers, submission, responses, retries, corrections, and retained payloads. Existing POS retains customer fiscal-document responsibility in the first release unless explicitly reassigned.

Regional architecture readiness is not a claim of legal compliance. Validate current taxpayer applicability, privacy, hosting, retention, and fiscal requirements before each country release.

Official reference sources:

- Egypt: https://sdk.sit.invoicing.eta.gov.eg/
- Saudi Arabia: https://www.zatca.gov.sa/en/E-Invoicing/Pages/default.aspx
- UAE: https://www.tax.gov.ae/en/taxes/Vat/uae.einvoicing.aspx

## 8. Offline-first behavior and limits

After online enrollment and initial download, a permitted user can reopen the cached application, read downloaded records, and save supported operations without internet. First login, a new device, and undownloaded data require connectivity.

| Workflow | Offline behavior in V1 |
|---|---|
| Catalog, recipes, balances | Read downloaded data with freshness labels |
| Purchase/receiving | Capture documents and queue posting requests |
| Production and waste | Save actual quantities and provisional effects |
| Stock counts | Capture observations; finalize cutoff/reconciliation online |
| Transfers | Capture requests and dispatch/receiving claims; validate dependencies online |
| Reports | View retained snapshots, clearly dated |
| User/module/tax administration | Online only |
| Large imports and fiscal submission | Online commit/processing; retain drafts where supported |
| Central approvals and period closure | Online only |

Offline-first V1 means durable local capture and useful local reads. It does not promise globally final stock transactions while every device is disconnected.

Unsynchronized attachment files are separate durable upload tasks. A document must show whether its attachments remain pending.

## 9. Local-first architecture

```text
Web / Mobile / Desktop
        ↓
Local Database + Durable Operation Outbox
        ↕
Scoped Data Synchronization + Validated Command API
        ↕
Authoritative Posting Engine
        ↓
Central PostgreSQL Database
```

Persist an operation and its local provisional projection in one local transaction. Server acknowledgments determine accepted business effects.

Evaluate PowerSync for scoped PostgreSQL-to-local-SQLite synchronization. Prototype browser persistence, migrations, tenant scoping, and inventory command uploads before committing to it. A sync vendor does not replace domain validation or guarantee correct financial conflict handling.

Source: https://docs.powersync.com/intro/powersync-overview

## 10. State management

| State | Owner |
|---|---|
| Downloaded business records | Local synchronized database and reactive queries |
| Pending commands and provisional effects | Durable outbox and local projections |
| Shared UI state | Zustand |
| Form state | React Hook Form + Zod |
| Shareable filters | URL parameters |
| Component-only state | React state/reducers |
| Online-only APIs, job status, unsupported sync data | TanStack Query |

Do not copy synchronized entity lists into competing global stores. TanStack Query cache and localStorage are not the durable business database.

Scope stores, queries, outboxes, and local databases by tenant/user as appropriate. Switching tenant must not upload old operations under the new tenant. Protect pending work during sign-out with an explicit recovery/sync flow.

## 11. Operation synchronization and conflict handling

Each command includes a unique operation ID, actor/device, tenant/entity/location, operation type, payload version, document revision, dependencies, business date, client capture time, and pinned definition versions.

Maintain distinct local and server statuses:

```text
Saved Locally → Pending → Uploading → Accepted
                              └── Needs Review / Rejected
```

Business documents separately track draft, submitted, approved, posted, and reversed states. Upload completion does not mean inventory posting succeeded.

Rules:

- Idempotent server processing and persistent acknowledgments.
- Retry transport failures; isolate permanent business errors so later independent work can sync.
- Process dependencies before dependent stock operations.
- Revalidate permission, stock, period status, and document revision at acceptance.
- Use optimistic concurrency for master data; detect simultaneous edits.
- Use append-only validated commands for inventory, costs, sales, and fiscal documents.
- Never resolve quantity/cost conflicts through last-write-wins.
- Preserve rejected input for repair, cancellation, or linked resubmission.
- Show queue counts, last sync, provisional effects, errors, and accepted server values.

Cache valid published definitions offline. Revoked or superseded definitions follow explicit acceptance rules; never silently substitute a recipe.

## 12. Multi-device stock authority and FIFO ordering

Two disconnected devices cannot guarantee exclusive access to the same stock. V1 shows local provisional availability but validates global stock at server acceptance.

Example: two devices both see 10 kg and request 8 kg. Both may save locally; the server can accept only what the stock policy permits. The other operation remains reviewable. Physical activity already performed must be reconciled explicitly, not erased from history.

V1 authoritative FIFO follows a deterministic server posting sequence. Retain business dates separately for reporting. Late uploads do not silently reallocate finalized costs or rewrite closed periods. Counts and period closure require resolution of known pending work and a defined late-arrival process.

If a customer requires final posting during long disconnections, add either preallocated stock authority or a branch-local posting service with a controlled authority handover. That is a future deployment mode, not an assumed capability of basic sync.

## 13. Offline access, durability, and recovery

- Online device enrollment and an explicit offline authorization expiry.
- Online revalidation on reconnect; centrally revoked permissions cannot be learned instantly while offline.
- Download only permitted operational data and histories.
- Distinguish screen lock, session expiry, and irreversible local-data removal.
- Prevent edits/posting after offline authority expires; retain existing pending work.
- Define device revocation and local purge behavior when connectivity returns.
- Request persistent browser storage where supported and monitor quotas.
- Provide recovery/export options for unsynchronized operations.
- Do not claim browser storage survives manual clearing, device loss, or every eviction scenario.
- Synchronize on app open/reconnect and provide manual sync; background browser execution is best effort.
- Test schema upgrades against pending outboxes and maintain compatible command versions.

Browser storage reference: https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria

## 14. Users and permissions

Initial roles: Owner, Manager, Storekeeper. Later: cashier, accountant, purchaser, kitchen manager, cost controller, auditor.

Separate view-cost, create, approve, post, reverse, close-period, and administration permissions. Enforce tenant/entity/location scope in API and database. Offline downloads need their own scope controls; database row security alone is not sufficient to secure replicated client data.

## 15. Catalog and units

Support raw materials, prepared/finished items, packaging, consumables, stocked assemblies, virtual bundles, services, and non-stock products.

Shared editable master fields include SKU, Arabic/optional English name, category, barcode, base unit, purchase conversions, supplier, stock behavior, and production definition. Location settings include minimum stock and applicable recipe versions.

Derive quantities, values, and price indicators from transactions. Normalize posted quantities while retaining entered unit/factor. Carton/sack conversions are item-specific; weight-to-volume needs an explicit factor. Prevent base-unit changes after stock history.

## 16. Inventory and purchasing

Maintain posted ledger, balances, cost layers, and allocations. Atomic server posting validates, locks stock, consumes FIFO, writes movements, updates balances, and audits. Block negative authoritative stock in V1.

Purchases support approvals, partial receiving, discounts, charges, tax treatment, price history, and receipt-linked supplier returns. Only accepted posted receiving increases authoritative stock.

Offline documents show provisional effects separately. Reversals respect downstream use and period locks. Reconciliation checks rebuild/compare balances and layer values against authoritative history.

## 17. Transfers

```text
Request → Approval → Dispatch → In Transit → Receiving → Resolution
```

Dispatch decreases source stock; inventory remains in transit until received/resolved. Receiving increases destination stock with preserved allocations. Partial receipts, shortage, damage, and returns are explicit.

Do not double-count in-transit inventory in consolidated reporting. Receiving commands depend on valid dispatch records. If destination staff lack the dispatch offline, capture an unmatched receipt observation for later reconciliation rather than inventing a finalized transfer.

## 18. Recipes and BOMs

Recipes handle preparation and yield; BOMs handle kits/assemblies. Both use standard outputs, normalized components, immutable published versions, effective dates, exact nested versions, dependency tracking, and cycle checks.

Support arbitrary valid nesting with computational safeguards. Stocked preparations consume ingredients when produced; virtual definitions expand at use. Stock consumption stops at stocked components. Further raw-material explosion is analytical only.

Shared organization definitions may have explicit branch variations. Offline production pins its actual definition version.

## 19. Production, yield, and waste

Select a version, calculate planned requirements, capture actual inputs/output, validate, consume input layers, and create output stock/cost layers. Use the same engine in central kitchens and branches.

Actual output unit cost = allocated production cost / usable output. Local estimates remain provisional until authoritative acceptance.

Track output attainment, comparable mass yield, normal loss, and abnormal waste separately. Never deduct the same loss twice. Waste entries include quantity, reason, location, actor, and allocated cost.

V1 supports one primary production output. Co-products/by-products require a defined later allocation policy.

## 20. Costing

Provide actual FIFO transaction cost, latest-purchase replacement estimate, and remaining-stock weighted-average estimate.

Prepared-item replacement estimates derive from definitions. Show scope, timestamp, missing costs, and fallback source. Keep latest/previous receipt price history. Recalculate affected estimates after prices, layers, or definitions change.

Retain historical transaction allocations. Offline cost views explicitly distinguish last synchronized costs and provisional calculations.

## 21. Counts and consumption reconciliation

Counts capture physical observations offline. Finalization resolves intervening movements, cutoffs, pending operations, and approvals online. Negative adjustments use FIFO; positive adjustments use an explicit valuation policy.

Imported sales generate theoretical consumption without a second physical issue in V1. Compare production actuals against standards separately from sales residual depletion.

```text
Residual depletion =
Opening physical quantity + Receipts + Transfers in + Production outputs
− Supplier returns − Transfers out − Production inputs
− Recorded waste and other known issues − Closing physical quantity
```

Compare at the same stocked-item boundary. Label incomplete counts, sales mappings, and synchronization as provisional. Do not count adjustment results as a second consumption measure. Report cost valuation basis and last physical verification.

## 22. Imports, shared sales, and integrations

Use upload/staging/mapping/validation/preview/commit for product/opening-stock and external POS imports. Preserve receipt-level versus summary granularity, branches, dates, refunds, voids, pinned recipe versions, file hashes, external IDs, and source rows.

File hashes alone do not deduplicate differently formatted overlapping exports. Define summary-overlap rules. Server commits and opening stock are transactional and retry-safe.

Large imports are online operations in V1. Downloads/templates and supported drafts remain locally accessible. Imported/native sales share one model; define which system owns stock deductions per workflow.

## 23. Expenses, margins, and reports

Basic expenses include legal entity, outlet/central location, category, date, amount/currency, description, approval, and optional attachment.

Distinguish estimated margin, food cost percentage, posted issue cost, waste, variance, and operating result based on recorded expenses. Define central overhead allocation; do not silently capitalize overhead or call incomplete operating figures net profit.

Provide branch/central/entity/consolidated views with source drill-downs. Every number identifies scope, period, basis, completeness, and freshness. Offline reports are dated snapshots, not live consolidated results.

## 24. Traceability and audit

Link receipts, input layers, production, output layers, transfers, subsequent issues, and reconciliation. Sales link to definitions and theoretical calculations.

Audit local capture and server acceptance separately, retaining actor/device, changes, references, and timestamps. No silent rewriting of posted stock history.

Supplier lots, expiry, recalls, and precise batch allocation are separate explicit capabilities. Count-based sales do not prove exact batch-to-meal traceability.

## 25. Future POS, mobile, desktop, and hardware

Web: Next.js responsive PWA with cached shell and persistent local data. Offline routes cannot depend on an unavailable server render; first load must establish the required local shell/data.

Mobile: React Native/Expo with a platform-appropriate local database, scanning, camera, notifications, and operational layouts.

Desktop: provisionally Electron for POS/hardware workflows; verify printer, scale, drawer, and payment SDK compatibility before locking the choice.

Share TypeScript contracts, API client, validation, localization, and pure domain calculations. Server authority remains centralized under V1 sync rules. Platform layouts and device integrations are implemented separately.

Future native POS adds shifts, payments, returns, receipts, configured stock issues, and country adapters. Payment terminal operation and fiscal submission have separate connectivity constraints; offline order capture does not guarantee either is possible offline.

Fiscal submission state remains separate from sale and stock state. Apply country-specific timing/format/correction rules; never assume queue-and-submit-later is universally permitted.

## 26. Technical and repository structure

Use a modular monolith with Next.js/TypeScript, PostgreSQL, Supabase Auth where suitable, Tailwind/shadcn, React Hook Form/Zod, Zustand, local reactive queries, and TanStack Query for non-replicated services.

```text
apps/
  web/
  mobile/        # later
  desktop/       # later
packages/
  contracts/
  api-client/
  validation/
  localization/
  design-tokens/
  sync-contracts/
server/
  modules/
  posting/
  country-adapters/
  workers/
```

Keep UI, transport, domain rules, and transactional storage separate. Browser/native clients must not depend solely on Next.js Server Actions. Use stable authenticated command/query APIs and compatible schema versions.

Choose hosting/sync regions against market requirements. Verify dependencies and sync platform support during implementation.

## 27. SaaS operations and security

### Environments and delivery

Maintain one codebase with four isolated environments: development for feature work, staging for internal release validation, client demo for prospective-client trials using sample data, and production for real business operations. Use distinct application origins, databases, storage, auth/signing configuration and integration credentials. Hosted environments use separate Supabase projects; local development can use an isolated stack. Register the purpose and owner of every project before deployment. The supplied Supabase project has not yet been assigned an environment role.

Client demos use isolated, clearly labeled organizations with seeded data, limited accounts, expiry and a disclosed reset policy. Payments, notifications and fiscal integrations use sandboxes or remain disabled. A reset rotates a server-owned workspace generation so stale offline commands and imported archives cannot repopulate the reset ledger. Transition to production creates a new tenant and imports only approved setup data through validation; demo transactions and offline queues are not promoted. These hosted-demo controls remain planned.

Use short-lived task branches and a protected releasable default branch, with immutable release tags. Environments are deployment targets, not separate product forks or permanent client branches. Commits include the relevant source, tests, migrations and documentation; pushes use the confirmed authorized remote. Review pull requests and validate migrations/offline compatibility before promoting a recorded source commit. Build environment-specific bundles when public configuration is compiled into the client, and record source SHA, environment, build ID and migration level for each deployment. See Developer Guide section 4 for branch naming, commit/push procedure, conflicts, reviews, releases and hotfixes.

### Operations

Platform administration covers onboarding, plans, limits, trials, entitlement changes, subscription records, support, and integration health. Subscription payments are separate from merchant customer payments.

Use scoped access, protected secrets, secure backups, audit retention, exports/offboarding, monitoring, and incident response. Assess privacy, data residency, transfer, and retention requirements per market; do not assume one region works universally.

Monitor sync lag, pending/rejected operations, ledger discrepancies, stale reports, job failures, and fiscal integration responses. Backups do not include unsynchronized device-only work until uploaded; communicate and mitigate that distinction.

## 28. Delivery roadmap

Current status: the local receiving/waste/FIFO prototype, Fodo UI and tested local reliability fixes are delivered. Initial main/workflow branches are published and GitHub CI passed at `919c319`. The owner-session setup helper has a tested follow-up fix for skipped PR creation; publishing that fix and verifying the PR/protection settings remain pending. Hosted environment separation, client-demo lifecycle and production tenant/access controls remain pending. The next usable milestone is a two-branch inventory pilot; full restaurant cost control follows with recipes, production and consumption reconciliation. See Developer Guide version 2.3 for the implementation order and environment/Git workflow.


| Stage | Outcome |
|---|---|
| 0 | Fix session renewal, stable startup, review resolution, recovery import, Git and verified backups |
| 1 | Real tenant/entity/location foundation, production identity, permissions and sync contracts |
| 2 | Offline prototype: persistent reload, outbox, retries, conflicts, scoped downloads |
| 3 | Inventory/FIFO posting engine and reconciliation |
| 4 | Opening imports, purchasing, receiving, transfers, waste, counts |
| 5 | Recipes/BOMs, central/local production, yield, costing |
| 6 | POS imports, consumption reconciliation, expenses, reports |
| 7 | Egypt restaurant pilot, offline/recovery acceptance, production release |
| 8 | Billing automation, mobile operations, supported integrations |
| 9 | Desktop/native POS and verified country fiscal workflows |
| Ongoing | Restaurant operations, specialist modules, validated country expansion |

Client-specific data gathering is deferred. Use labeled examples and configurable settings instead of blocking architecture work.

## 29. Acceptance criteria

Core checks:

- Tenant/entity/location isolation and action permissions pass.
- Duplicate requests and concurrent posting preserve stock.
- Ledger, balances, layers, and in-transit stock reconcile.
- Transfers preserve allocated cost.
- Published definitions are historical, nested, and cycle-safe.
- Production and sales never deduct components twice.
- Imports and counted-period consumption reports are reproducible.
- Arabic screens, exports, and print layouts work.
- Currency/tax rules retain historical values.
- Restoration and customer export are verified.

Offline checks:

- Cached app restarts without connectivity on supported browsers/devices.
- Local records and operations survive ordinary restart.
- Abrupt closure cannot leave a saved command without its matching local projection.
- Reconnect/retry cannot duplicate server effects.
- Dependency failures and business conflicts remain visible and recoverable.
- Concurrent offline issues cannot silently create invalid accepted stock.
- Offline permission expiry and tenant switching preserve correct scope.
- Pending operations survive compatible schema upgrades.
- Storage exhaustion, attachment failures, and stale snapshots are visible.
- FIFO acceptance ordering and late uploads do not rewrite finalized history.

Country/launch checks:

- Fiscal responsibility is explicit for the first external-POS deployment.
- Applicable fiscal adapters are validated before native POS rollout.
- Privacy/hosting/retention review is completed for each launched market.

## 30. Provisional assumptions and deferred inputs

Use Egypt as the first market, Arabic as the default, one-or-many entities/branches, configurable central locations, external POS imports, and count-based consumption reconciliation.

Define the final stock acceptance, count cutoff, tax/landed-cost, refund, lot/expiry, browser/device, retention, and fiscal responsibility configurations before live onboarding. Actual files, volumes, branches, and next-country priorities can be supplied later.

This plan establishes one offline-first regional SaaS with shared business foundations, optional specialist modules, and verified country releases. It does not promise fully disconnected global stock authority or blanket compliance across Arab countries.
