# Phase 4 — restaurant cost control

## 4A: recipes and transparent cost estimates — delivered locally

Deliver Arabic **الوصفات والتكاليف** with tenant-scoped recipe drafts, revision-checked edits and immutable publication. Each recipe defines a code/name, stocked or non-stocked output, positive batch output, base output unit, effective date, optional net selling price per output unit and distinct ingredient/sub-recipe lines. Stocked output links an existing inventory material with the same unit. Definitions need units/items, but do not need a stock location to save/publish.

Support base units and validated g/kg and ml/l conversions; custom units use base quantities only. Store normalized quantities and entered units. Sub-recipes pin an exact published version. Reject tenant/reference/unit errors, self/indirect cycles, unavailable/future child versions, reused IDs and stale revisions. Bound expansion to 20 levels/1,000 nodes. Publication is serialized under the tenant lock and writes the version, dependency records, revision, audit and idempotent command receipt together. Recipe actions never post stock movements.

Use one pure resolver shared by preview/tests. The normal costing view stops at stocked sub-recipes, using their stock material cost; analytical expansion can show their raw ingredients. Root recipes always show their ingredient requirements. Display missing prices and shortages separately; known zero cost is valid and missing cost is never silently zero. Offer current remaining-stock average and latest accepted receiving price by selected location, with source/date/freshness. The latter is read from full server ledger history, not the latest-100 activity display. Show known subtotal, complete batch/per-output-unit cost, food cost percentage and gross contribution only when all costs and a positive net selling price are available. These are estimates, not finalized production allocation or net profit.

Add additive PostgreSQL recipe/version/dependency/revision tables, Dexie schema 8 recipe actions and generation-bound recovery format 11. Older archives remain readable. Upload setup before recipe saves and dependency publications before parents. Preserve rejected actions for retry/cancellation and let the user reopen the latest draft after a conflict. Include recipes in pending/review counts, tenant switching, reset generation, identity collision detection and atomic recovery. Catalog-clearing development reset removes recipes before referenced items/units; costing-method transaction reset retains definitions but clears obsolete action queues via generation.

Acceptance: version pinning, cycle/tenant/revision/date/unit protection, exact conversions and yields, stocked boundary vs analytical expansion, valid-zero/missing prices, historic latest receipt, stock-neutral posting, persistence, offline reload/dependencies/recovery/correction-by-new-action and desktop/mobile. No demo data is added to the client workspace.

Verification on 10 October 2026: 169 unit/integration tests, 31 browser/process scenarios, TypeScript, production build and offline manifest passed. Tests use isolated databases. See [Recipes walkthrough](./runbooks/Recipes.md) for the user workflow. Local branch `feat/recipe-cost-control` starts from receiving checkpoint `f3eab23`; production, sales consumption and deployment remain subsequent work.

## 4B: production and yield (next)

Plan requirements from a pinned version, capture actual inputs/usable output, consume selected-policy stock once and create stocked output at allocated cost. Treat normal loss in yield, separate abnormal waste and handle failed batches explicitly. Prove a stocked mix is consumed once without also issuing its raw ingredients.

## 4C: sales and consumption reconciliation (after production)

Add validated POS detail imports with pinned versions, refunds/voids, actual vs theoretical consumption and food-cost reports. Membership, subscriptions, separate demo deployment, country tax adapters and production access controls remain deferred under the current development scope.
