# Compact reports and arranged navigation — 28 October 2026

## Delivered behavior

The dedicated report screen uses a grouped report chooser, compact title/filters/cards and detail rows, optional charts, a shortcut to details and a full-screen/restore action. Full-screen retains mounted state, makes the surrounding workspace inert, traps keyboard focus and restores the opener on Escape. Its grid uses content-sized rows so phone filter panels cannot shrink into clipped strips. Home analytics keep their previous layout.

Kitchen supply reports read the accepted line's optional document-only unit price. Details, complete CSV and print preview retain the price, document amount and difference from actual posted stock cost. Full-range summary values include priced lines only and show the number of excluded unpriced lines. Saved zero prices remain zero; historical missing prices remain unknown. Source/destination filters count the outgoing document once, including transfers with several FIFO incoming allocations. Reporting does not modify stock valuation or journal entries. Existing scoped report caches remain readable; an older cached response asks for an online refresh for its new price fields.

The side menu keeps overview/POS/kitchen display/inventory as daily shortcuts. Stock operations include purchasing, returns, transfers, counts and movement history. Kitchens, recipes, production and butchery are grouped under **المطابخ والتحضير**. Sales, expenses and reports are under **المبيعات والتقارير**. Settings and help remain separate. The current group opens automatically and is highlighted. Desktop collapse and the native mobile menu preserve the mounted screen, report filters and focus return. All 21 workspace routes remain present once.

## Verification

- Production build/TypeScript/offline manifest and hosted build pass.
- 53 focused checks across 10 files: reporting/cache, complete kitchen supply pagination, known/zero/missing document prices, FIFO/average conservation, tenant/filter boundaries, navigation route coverage, kitchen stock/offline behavior, printing, sheep receiving, sales reports and consumption reconciliation.
- Two final browser scenarios pass: CSV values/columns and print preview, optional charts, details focus, full-screen/inert/Escape/focus return, content-sized phone filters, horizontally scrollable price columns, offline cached restoration, desktop menu collapse preserving filters, arranged route selection and native mobile menu dismissal/focus.
- Final hosted build: **41a7e92847c13ef2**. Isolated Worker dry run passes.
- Screenshots are kept in ignored `.cache/reports-release-evidence/` for desktop, full-screen phone prices and both menu layouts. No test movements were created in live client data.

## Release integrity

The branch includes the exact committed live sheep-receiving source **6a4d5e355bb3659a60c623b6b3c43ae6778b8947** before this release. It preserves butchery, sheep receiving, recovery 23 and existing authorization. No schema migration or IndexedDB upgrade is required. The backend needs the new read-only report fields before the frontend is activated; existing clients can consume its additive response fields.

Deployment identifiers and live verification are recorded after activation.
