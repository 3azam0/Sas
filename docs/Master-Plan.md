# FooDo — Modular Business Management SaaS Master Plan

Updated: 15 October 2026. This is the main development roadmap and progress reference.

## Current development progress

Read this summary for **what is done and what remains**. The dated checkpoints below describe earlier releases; their old statements about pending hosting, sales deductions or reports do not override this summary. See the [developer guide](./Developer-Guide.md) for implementation rules and [hosted release](./Hosted-Release.md) for operational behavior.

**Current milestone: Phase 4C3, the client guide and daily-workflow usability are delivered.** The first-client trial is hosted at [FooDo](https://fodo.am-agent2026.workers.dev/). This is a working trial release, not completion of the full SaaS roadmap or approval to start real operations.

| Area | Status | Completed / practical limit |
| --- | --- | --- |
| Web foundation and local environment | Delivered | Arabic RTL application, FooDo branding, local launcher and shared domain/API contracts. Native mobile/desktop applications remain later work. |
| Hosted access and tenant isolation | Delivered for first-client trial | Cloudflare frontend, Supabase Auth/API, tenant-scoped storage and authorization. Membership administration and self-service onboarding remain deferred. |
| Client organization | Delivered | Organization name, logo/contact profile and details opened from **المؤسسة الحالية**. Temporary trial data remains until an explicitly authorized cleanup. |
| Inventory setup | Delivered | Materials, independent categories, units, purchase-unit conversions, suppliers and stock locations; quick material/category creation during receiving. |
| Opening stock and receiving | Delivered | Multi-material opening documents/imports, multi-item receiving, optional supplier/reference, newest-first entry list and unit-cost conversion. |
| Purchasing and supplier returns | Delivered | Purchase documents, partial receiving, cancellation of unreceived quantities and source-linked supplier returns. |
| Inventory valuation | Delivered | Moving weighted average as the default, FIFO option, exact allocated value and ledger/balance checks. Development reset tools are excluded from the hosted client interface. |
| Waste and balance adjustments | Delivered | Recorded waste and direct balance editing with reasons and server checks. Balance edits do not replace physical counts for consumption reconciliation. |
| Transfers and physical counts | Delivered | Dispatch/partial receipt/transit loss, reviewed partial counts, explicit zero counts and stale-location protection. |
| Kitchen stock and POS routing | Delivered | Kitchens hold stock under the main warehouse; each POS routes to one kitchen; a meal may be prepared independently in several kitchens. Kitchen supply transfers stock/value. |
| Recipes and composition — 4A | Delivered | Versioned recipes/BOMs, nested definitions, item composition entry point, batch/portion estimates and food-cost percentages. Definitions alone do not move stock. |
| Production and yield — 4B | Delivered | Actual inputs, usable stocked outputs, exact cost allocation, normal yield loss, abnormal waste and failed batches. |
| Menu mapping and sales import — 4C1 | Delivered | Pinned recipes/output ratios, completed-sale CSV preview and duplicate-safe accepted imports. Refunds/voids are not yet supported. |
| Theoretical usage and selected deductions — 4C2 | Delivered | All recipe ingredients count toward theoretical usage; only selected ingredients deduct from the selling kitchen. Shortages are highlighted while otherwise valid imports succeed. |
| BI reports and charts | Delivered | Overview and dedicated reports, Recharts, filters/sorting/server pagination, full-range aggregates, CSV and cached report queries; kitchen supply report included. |
| Actual versus theoretical consumption — 4C3 | Delivered | Physical-count-based reconciliation, independent movement checks, variance charts, shortages, incomplete reasons and closing-count cost valuation. Valid opening/closing counts are needed to establish actual consumption. |
| Forms and list usability | Delivered baseline | Task-first home, daily/grouped navigation, mobile all-sections menu, compact essential fields and optional details, visible entry lists and accurate save/sync feedback; searchable dropdowns, keyboard help, pagination/filtering/sorting and collapsible sections retained. See [daily workflow](./runbooks/Daily-Workflow.md). Further fixes depend on trial feedback. |
| Offline capture and recovery | Delivered operational foundation | Durable tenant-bound queues, dependency ordering, retries/review, bounded offline access and recovery formats. Production restore rehearsal remains a launch task. |
| Sales financial corrections | Not implemented | Explicit accepted-sale refund/void handling, financial reversal and controlled stock disposition are the next functional cost-control slice. |
| Restaurant expenses and profitability | Not implemented | Expense capture/categories and reliable period profitability remain; recipe contribution estimates are not net profit. |
| Client usage guide | Delivered | **دليل الاستخدام** with 21 Arabic task topics, normalized search and contextual **مساعدة** in screens/document headers. Help preserves form entries and reuses keyboard instructions. No guide downloads. See [operating guide](./runbooks/Client-Guide.md). |
| Real-use launch readiness | Remaining | Trial acceptance, verified restore, controlled temporary-data removal, real opening balances and operating procedures before real use. |
| GitHub publication of latest work | Pending verification/publication | Latest milestone has a local commit and hosted deployment. The recorded Windows credential-helper issue still prevents claiming the latest work is pushed or merged. |

### Remaining work in delivery order

1. **Sales financial corrections:** define and implement linked refunds/voids against accepted sale lines, duplicate-safe amounts/quantities, explicit stock disposition, audit and report effects. A financial reversal must not automatically recreate physically consumed ingredients. Keep original sales immutable and verify kitchen scope, shortages and retries.
2. **Basic restaurant expenses and profitability:** dated categorized expenses, validation and audit, inclusion in period reports, and a clearly defined distinction between revenue, inventory consumption, recipe estimates and expenses. Prevent double-counting waste/production costs. Include electricity, phone credit and knife sharpening as expense examples rather than inventory materials.
3. **First-client acceptance:** review actual operating workflows and guide clarity, fix reported issues, confirm receiving units/recipe quantities and selective deduction choices, test real POS file formats, and agree physical count boundaries. Use isolated data for write/destructive tests.
4. **Launch and recovery checks:** rehearse backup/restore in an isolated target, verify offline/reconnect/conflict behavior on the client's devices, document support/recovery, confirm access and external-POS fiscal responsibility, and complete GitHub publication/CI review. Hosted deployment alone does not confirm these checks.
5. **Move from trial to real use:** only after explicit authorization, remove the marked temporary trial transactions/data according to the cleanup runbook, preserve the approved client catalog/settings as agreed, settle pending queues, establish real opening balances and confirm readiness. Do not clear client data merely to complete this checklist.

These are roadmap items, not authorization to deploy new transactions or delete data. The client guide is implemented; keep it current with each feature release. The next functional slice after reconciliation remains financial corrections.

### Deferred until needed

- Membership/user administration, invitations, additional-client onboarding and granular permission management.
- Subscription billing and enforced entitlements: base subscription for one branch, additional branches as paid capacity; kitchens/stock locations must not accidentally count as paid branches.
- Dedicated client-demo environments. Continue with local development and the hosted first-client trial; a separate demo is not needed now.
- Native POS/checkout, cashier shifts, tables, KDS, delivery and broader restaurant operations.
- Native mobile/desktop clients, other business modules, full accounting and country fiscal adapters. Arabic/Egypt-first foundations do not establish legal compliance in every Arab market.

### Latest verification and release evidence

Daily-workflow release: hosted build **1a84a8b7f338a9cf**, Cloudflare version **67**, Supabase API remains **14**. All 29 targeted tests, TypeScript and production/offline builds passed. See [release evidence](./releases/daily-workflow-usability-2026-10-15.md). No client transaction was posted or reset. The next functional slice remains sales financial corrections, followed by expenses/profitability.

Client-guide release: hosted build **d61643ced1ead0a0**, Cloudflare version **65**, Supabase API remains **14**. Eleven targeted tests, type checking, production/offline builds and desktop/mobile hosted checks passed. Unsaved receiving reference/item entries survive help opening/closing; help shortcuts cannot submit the receipt. No client transaction was posted. See [guide release evidence](./releases/client-guide-2026-10-13.md).

Previous Phase 4C3 release: hosted build **a118debb99abcb76**, Cloudflare version **63**, Supabase API version **14**, local commit **7072d62**. The full 329-test suite passed; subsequent targeted checks included one additional regression (330 distinct tests covered across runs). Final type checking, production/offline builds and desktop/mobile hosted checks passed. No client records were posted or reset by those checks. See [4C3 release evidence](./releases/consumption-reconciliation-2026-10-13.md).

Keep this progress table and remaining-work list current whenever a slice ships. Mark a slice delivered only with its actual verification and deployment scope; use the dated sections below as supporting history.

## Current scope amendment

The hosted client release and sales policy in [Hosted release](./Hosted-Release.md) supersede earlier roadmap text about sales stock deduction, demo provisioning and membership/billing administration. Sales calculate all theoretical usage; new imports deduct only ingredients selected in their pinned recipe version. Imports with shortages succeed, deduct available stock and highlight the recorded shortage. Older sales and recipes without selections remain calculation-only. Earlier delivery entries below remain historical checkpoints.

## Product architecture and historical delivery checkpoints

Updated: 13 October 2026

Platform branding: the accepted **FooDo** name and logo are used across the app. Organization names and logos remain tenant-specific. See [brand identity](./branding/FooDo.md); existing technical identifiers and historical records remain compatible.

Current kitchen workflow: each kitchen holds stock under its main warehouse, shares the material catalog and costing policy, and has its own POS routing. One meal may be available in multiple kitchens; each prepares the complete meal independently. New kitchen supply conserves stock/value as a transfer. New sales deduct only the selected ingredients from the selling kitchen, accept shortages without negative stock and retain immutable required/deducted/missing quantities. Historical immediate-consumption issues remain separately labelled. See [Kitchen inventory/POS scope](./Kitchen-Inventory-POS-Plan.md).

Status: current scope with dated historical delivery checkpoints. Current hosted release records govern implemented behavior; regional integrations and future modules remain planned.

Inventory composition entry point delivered on 11 October 2026: **مكونات الصنف** opens or creates a stocked recipe linked to an inventory item, and **فتح إعداد المكونات بعد الحفظ** continues directly from item setup. Component quantities and output yield use the existing versioned recipe/production workflows. Definitions leave stock unchanged; accepted production performs consumption and creates output. An item may still be purchased ready-made. This adds no second BOM model, category hierarchy, client seed data, schema migration or billing requirement. Verification passed: 202 unit/integration tests, TypeScript, production build/offline manifest and three targeted browser scenarios.

Delivery status on 10 October 2026: local inventory setup includes editable items, units, suppliers, stock locations and fixed purchase packs, connected to receiving, waste, moving-average/FIFO costing, offline outboxes and recovery. Opening stock now supports multi-material documents and bounded CSV mapping/preview, atomic baseline posting, offline dependency sequencing and version-4 recovery. Purchase orders now support offline drafts/submission, revisions, partial receiving, immutable source-linked receipts, cancellation of unreceived quantities and original-stock reversal. Source-linked supplier returns now trace original source quantities and deduct selected-policy inventory values atomically, preserve gross receiving and support offline review/correction. Verification passed: 202 unit/integration tests across 33 files, 35 browser/process scenarios (33 fixture regressions plus 2 isolated empty-workspace checks), TypeScript, production build and offline manifest. Transfers now support dispatch, original-cost partial receiving, transit loss and offline revision sequencing. Stock counts now support partial physical capture, explicit review, shortages under the selected costing policy, explicit-cost surpluses, strict location-sequence rejection, independent reconciliation and linked offline recount. Recovery format 13 includes all outboxes and a reset generation; formats 1–12 are parseable but pre-reset archives cannot restore into a new generation. Versioned recipes, pinned sub-recipes, batch/portion cost estimates and food-cost percentages are delivered locally with stock-neutral offline publication. Preparation batches now post actual ingredient issues and usable stocked output atomically under FIFO or moving average, preserve exact cost, separate abnormal waste, support failed batches and offline recovery. Menu codes now pin recipe versions/output-per-sale, and completed sales can be imported through validated CSV preview with stable external-detail deduplication, immutable stock-neutral records and offline recovery. Sales stock consumption, refunds/voids, reports and the full restaurant release remain pending. The selected Supabase project is `bkkxrptgwbrwredauopq`; its Auth endpoint accepts the configured publishable key. Production tenant/access implementation still requires management access and migrations; it is deferred while restaurant workflows are completed in development.

## 1. Product objective

Build one extensible, Arabic-first SaaS platform for Egypt and Arab markets. Organizations use shared core capabilities and optional business modules across one or many branches.

The first release serves restaurants through inventory, purchasing, production, and cost control. It supports central warehouses, central preparation kitchens, combined central locations, and local branch preparation.

The first client application is an offline-first web application. Mobile and desktop applications follow, sharing backend contracts, synchronization behavior, and business rules.

Current delivery scope: one hosted first-client organization with real authentication, tenant-isolated cloud storage, the approved catalog, selective kitchen sales deduction and BI reporting. Membership UI, invitations, subscriptions and separate demos remain deferred. The client can try the operational workspace at the Cloudflare URL; local development keeps its own database.

Phase 2A opening stock, 2B purchase documents/partial receiving and 2C source-linked supplier returns are delivered locally. Phase 3A transfers and 3B counts/reconciliation are also delivered locally. Moving-average costing with FIFO selection is delivered before recipes. Phase 4A versioned recipes/sub-recipes and transparent estimates are delivered; see the [Phase 4 plan](./Phase-4-Plan.md) and [Recipes walkthrough](./runbooks/Recipes.md). Phase 4B production/yield is delivered locally; see [Production walkthrough](./runbooks/Production.md). Phase 4C1 menu mapping and completed-sales imports are delivered locally; see [Sales import](./runbooks/Sales-Import.md). Phase 4C2 theoretical sales quantities/cost estimates and first-client hosting are delivered. New sales deduct selected recipe ingredients from their routed kitchen and highlight shortages. Phase 4C3 adds physical-count-based actual-versus-theoretical period reconciliation. Financial corrections follow as a separate slice. Complete each slice with offline persistence, server validation, recovery and acceptance checks. See the [Phase 2 implementation plan](./Phase-2-Plan.md). Stock-consuming production builds on the delivered stock movements, count integrity and stock-neutral recipe definitions; period consumption reconciliation now uses physical-count evidence. No further client planning inputs are needed to start the development slices with labeled examples.

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

Include multi-branch access, central locations, catalog and units, suppliers, opening imports, purchasing, receiving, returns, moving-average/FIFO costing, transfers, recipes/BOMs, production, yield, waste, counts, external POS imports, consumption reconciliation, basic expenses, dashboards, and audit history.

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

V1 issue valuation uses organization-level moving average by default, with FIFO selectable. Source quantity tracing and FIFO valuation follow a deterministic server posting sequence. Retain business dates separately for reporting. Late uploads do not silently reallocate finalized costs or rewrite closed periods. Counts and period closure require resolution of known pending work and a defined late-arrival process.

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

Maintain posted ledger, balances, cost layers, and allocations. Atomic server posting validates, locks stock, values issues under the organization policy, writes movements, updates balances, and audits. Block negative authoritative stock in V1.

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

Provide actual transaction cost under the selected policy, latest-purchase replacement estimate, and current remaining-stock average. Distinguish recipe estimates from finalized transaction costs.

Prepared-item replacement estimates derive from definitions. Show scope, timestamp, missing costs, and fallback source. Keep latest/previous receipt price history. Recalculate affected estimates after prices, layers, or definitions change.

Retain historical transaction allocations. Offline cost views explicitly distinguish last synchronized costs and provisional calculations.

## 21. Counts and consumption reconciliation

Counts capture partial physical observations offline against a consistent accepted location snapshot. Blank materials are uncounted; zero is physically absent. Online finalization requires the exact saved location movement sequence and expected quantities, with known local stock work resolved first. Any intervening accepted location movement rejects the count, even if quantity returns to the same number. Recount physically at a fresh baseline with new linked IDs; never silently overwrite current balances. Negative adjustments use the selected costing policy; positive adjustments require an explicit per-base-unit cost. Ledger, balances and remaining layers reconcile independently before/after atomic posting. Transit is excluded. Business date does not backdate costs. Late uploads after finalization remain subsequent movements; device acknowledgments, closed periods and historical correction policies remain future work. See [Stock counts walkthrough](./runbooks/Stock-Counts.md).

Imported sales generate theoretical consumption for all ingredients and issue only selected materials once from the selling kitchen. The reconciliation report never posts a second issue. Compare production conversion separately from sales consumption.

```text
Residual depletion =
Opening physical quantity + Receipts + Transfers in + Production outputs
− Supplier returns − Transfers out − Production inputs
− Recorded waste − Closing physical quantity
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

For the first client, use development for feature work and walkthroughs; provision isolated production when ready for real operations. Defer dedicated hosted staging and client-demo infrastructure. Future expansion may add those environments using the same codebase. Keep production origins, databases, storage, auth/signing configuration and integration credentials distinct from development. Register the purpose and owner of every project before deployment. The supplied Supabase project has not yet been assigned an environment role.

Client demos use isolated, clearly labeled organizations with seeded data, limited accounts, expiry and a disclosed reset policy. Payments, notifications and fiscal integrations use sandboxes or remain disabled. A reset rotates a server-owned workspace generation so stale offline commands and imported archives cannot repopulate the reset ledger. Transition to production creates a new tenant and imports only approved setup data through validation; demo transactions and offline queues are not promoted. These hosted-demo controls are deferred and are not part of the current first-client delivery.

Use short-lived task branches and a protected releasable default branch, with immutable release tags. Environments are deployment targets, not separate product forks or permanent client branches. Commits include the relevant source, tests, migrations and documentation; pushes use the confirmed authorized remote. Review pull requests and validate migrations/offline compatibility before promoting a recorded source commit. Build environment-specific bundles when public configuration is compiled into the client, and record source SHA, environment, build ID and migration level for each deployment. See Developer Guide section 4 for branch naming, commit/push procedure, conflicts, reviews, releases and hotfixes.

### Operations

Platform administration covers onboarding, plans, limits, trials, entitlement changes, subscription records, support, and integration health. Subscription payments are separate from merchant customer payments.

Use scoped access, protected secrets, secure backups, audit retention, exports/offboarding, monitoring, and incident response. Assess privacy, data residency, transfer, and retention requirements per market; do not assume one region works universally.

Monitor sync lag, pending/rejected operations, ledger discrepancies, stale reports, job failures, and fiscal integration responses. Backups do not include unsynchronized device-only work until uploaded; communicate and mitigate that distinction.

## 28. Delivery roadmap

Current status, 13 October 2026: setup, opening stock, purchasing/returns, transfers, counts, moving-average/FIFO costing, recipes, production, selective sales imports, hosted authenticated tenant access, kitchen stock/POS routing, BI and kitchen supply reports are delivered. Receiving/issue forms, searchable selectors, keyboard entry and collapsible sections are delivered. Phase 4C3 consumption reconciliation is delivered; next are sales financial corrections, basic expenses and live-use acceptance. Membership/billing, native POS and dedicated demos remain deferred. Current release details supersede historical local checkpoints above. GitHub publication remains pending the recorded credential-helper issue.


| Stage | Outcome |
|---|---|
| 0 | Fix session renewal, stable startup, review resolution, recovery import, Git and verified backups |
| 1 — delivered locally | Editable item/unit/supplier/location setup, supplier receiving and purchase packs; tenant scoping retained |
| 2 — delivered locally | Opening stock, purchasing, receiving and returns using the offline engine and selected inventory costing policy |
| 3A — delivered locally | Multi-branch transfers, partial receiving, transit loss and offline recovery |
| 3B — delivered locally | Partial physical counts, strict baseline, reviewed selected-policy/explicit-cost adjustments, reconciliation and offline recount |
| 3C — delivered locally | Moving-average/FIFO policy, exact valuation and development generation reset |
| 4 — delivered | Recipes/BOMs, production, yield and costing |
| 5 — partly delivered | Sales imports, selective kitchen deductions and BI delivered; Phase 4C3 reconciliation delivered; financial corrections and expenses remain |
| 6 — partly delivered | Hosted Auth and tenant isolation delivered; verified restore, removal of temporary trial data and live-use acceptance remain |
| 7 | Egypt restaurant pilot and supported market adapters |
| 8 | Membership administration, additional-client onboarding, billing, mobile operations and optional hosted demo/staging |
| 9 | Desktop/native POS and verified country fiscal workflows |
| Ongoing | Restaurant operations, specialist modules, validated country expansion |

Client-specific data gathering is deferred. Use labeled examples and configurable settings instead of blocking working development workflows. Membership administration and dedicated demo provisioning must not block the first-client development milestones. Cross-tenant protections remain part of the architecture and regression checks.

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


## Moving weighted-average costing — development scope

Moving weighted average is the default organization policy; FIFO remains selectable. Valuation pools are per material/location, with exact decimal quantity and value. Inbound transactions add their accepted value; issues use current pool value divided by quantity, with rounding residual consumed on full depletion. Receipt/source quantity tracing stays separate from pooled valuation. Transfers preserve dispatched value; destination receipts blend it into the destination pool. Source-linked returns retain original supplier reference value and separately record inventory deduction and valuation difference. Reconciliation compares ledger, balances and current layer values.

Development starts empty. The authorized one-time baseline reset clears setup/catalog and transactions, retains tenant identities, defaults to moving average and rotates generation. Subsequent method selection clears transactions to zero while retaining user-entered setup. Neither operation reseeds samples. The development_empty_baseline marker prevents erasing entered data on later restarts. Production history conversion remains deferred. Browsers clear the matching organization's old snapshot/outboxes atomically and stale archives/API generations are rejected. The local origin stays unchanged. Method changes with posted stock require explicit development reset acknowledgment; production history conversion remains deferred. Offline quantities remain durable; costs finalize only at acceptance. Costing policy is delivered before recipes/production. See [Costing methods walkthrough](./runbooks/Costing-Methods.md). `feat/start-from-scratch` is stacked on moving-average commit `eb94f37`; commit locally after checks and follow the existing authorized publication/PR workflow.


## Start from scratch — authorized development reset

The user now wants all old development data removed, including catalog/setup. Supersede the previous sample reseed and setup-preservation behavior for this one-time baseline reset: clear all development transaction tables, items/purchase packs, suppliers, units and stock locations; retain tenant identity and default moving-average policy. Rotate the reset generation so existing browser queues and recovery archives cannot restore the deleted data. New normal development workspaces start empty and never automatically seed sample catalog/stock. Fixture seeding is explicit and isolated to automated tests. After the one-time reset, entered data survives restarts. Method selection clears transactions to zero without reseeding, retaining the user-entered setup. Provide an empty-workspace path to create a stock location, unit, item and supplier, then enter opening stock.

Implementation verified: empty accounts show an onboarding path and disable stock posting until an active location and material exist. Empty locations render safely on desktop and mobile. Normal database initialization creates identities only; SAAS_SEED_FIXTURES=1 is reserved for isolated automated checks. A persistence test closes/reopens the database and confirms entered setup and stock survive. The authorized .data-local reset was applied after the user stopped the server, with a verified cold backup first; catalog, stock, transaction and audit counts were verified as zero. Keep the saved local origin and synchronize to receive the new generation before entering data.

## Supplier navigation

Expose **الموردون** as a direct main-menu destination, using the same tenant-scoped supplier records, editor and offline setup outbox as Inventory Setup. The direct page opens suppliers immediately and includes add/edit, contact details, active status, search and rejected-change review. Inventory Setup keeps its existing supplier tab. This navigation change does not add supplier accounting or duplicate data. Verify direct access, offline supplier creation, shared visibility and mobile layout using the existing setup/empty-workspace browser scenarios.

## Direct multi-item receiving

UI/forms completion (11 October 2026): stages 0–5 are delivered locally on `feat/ui-form-polish`. Grouped dialogs, shared inventory/recipe/production/sales editors, inline feedback, Enter submission, offline Arabic/SKU item search, count filters retaining entered quantities/zero, persistent actions, compact mobile navigation, shared operation states and source/correction links are implemented. Verification passed: 216 unit/integration tests, 43 browser/process scenarios, TypeScript and production build/offline manifest. Client catalog/stock are unchanged. The [completion record](./UI-UX-Remaining-Work.md), [UI forms walkthrough](./runbooks/UI-Forms.md) and Developer Guide 2.22 document delivery, evidence and the tool-session localhost restriction. Phase 4C2 calculation-only sales reporting and hosted access are now delivered; see Hosted-Release.md.

Receiving-unit extension delivered locally (11 October 2026): all configured organization units are available alongside item-specific purchase packs. Standard mass/volume conversions are automatic; other relationships need a positive per-line factor into the fixed item base unit. The chosen unit names/factor are captured with the document, with exact local/server validation, offline correction/recovery and unchanged per-base-unit cost entry. This does not add stock or alter the imported catalog. Verification passed: 216 unit/integration tests, TypeScript, production build/offline manifest and three targeted browser scenarios. Delivery checks are tracked in Developer Guide 2.20.

Direct receiving supports 1–200 distinct items in one document with a common location/date/reference and optional supplier. Each line has a base quantity/cost and optional catalog-unit or purchase-pack conversion. The UI previews line/document totals; all lines post atomically under the tenant costing policy. Offline documents remain durable, participate in stock/transfer dependency ordering and recovery format 14, and support rejected-document retry/correction/cancellation. The sync center shows all locations' receipts; activity history follows the selected location. Existing single-item queues/corrections remain supported. No catalog import, data reset or default-supplier behavior is introduced. See [Direct receiving](./runbooks/Direct-Receiving.md).

## BI reporting — first client implementation

Recharts `3.10.1` and matching `react-is 19.3.0` power the BI summary in **نظرة عامة** and the dedicated **التقارير والتحليلات** view. Reporting uses the new tenant-authenticated `POST /api/v1/reports`, complete date-range aggregates and server pagination, rather than the truncated operational snapshot. Keep current balance valuation, period posted costs, recipe estimates, selected sales deductions, supplier-reference values and shortages distinct. Reports cache up to 24 responses per tenant/generation/exact query in the existing preferences store; pending outboxes never enter accepted totals. CSV exports include all filtered rows up to 10,000 and reject checkpoint changes; printing covers the current detail page. Chart clicks and keyboard alternatives open filtered details. Empty periods, missing prices, units and equal previous periods remain explicit. See [BI runbook](./runbooks/BI-Reports.md) and [verified BI release](./releases/bi-reports-2026-10-12.md). No schema or Dexie/recovery version change is needed.

## Kitchen inventory and POS — delivered 13 October 2026

Delivered at the hosted client URL: each kitchen holds its own inventory under its selected main warehouse in the existing organization/location scope. One shared menu item may be available in multiple kitchens, each preparing the whole meal independently. Each POS belongs to one kitchen, and a sale deducts only checked recipe ingredients from that POS's kitchen. Main warehouse → kitchen is a transfer, not consumption; organization stock remains intact until actual consumption or waste. Retain successful sales imports with recorded shortages, per-location costing, tenant isolation and durable offline operations. Cashier shifts and split meal preparation across kitchens are deferred. See the [agreed implementation scope](./Kitchen-Inventory-POS-Plan.md).

Verified build `11a85380a337ca2e`, API version 12, additive migration `20261013062806_kitchen_inventory_pos`, and 303 passing tests. Existing balances and history remain unchanged. Configure POS and meal availability before new routed sales; formal subscription/branch administration remains deferred. See the [release record](./releases/kitchen-inventory-pos-2026-10-13.md).
