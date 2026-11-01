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

## Live deployment

- URL: https://fodo.am-agent2026.workers.dev/?release=41a7e92847c13ef2
- Cloudflare version **97**, version ID **76a49202-143e-4276-a7b3-3e41fb8b2f68**, deployment **22bf2494-a271-4000-b5fb-34c4dca8e9e8**, at **100%**.
- Supabase `fodo-api` **20** is active in `sas` / `bkkxrptgwbrwredauopq`. The user explicitly approved this reports backend replacement after automatic review required approval beyond the earlier kitchen-price deployment.
- Auth behavior and `verify_jwt=false` are preserved; the function continues its own user/membership/tenant checks. Recovery remains **23**; no migration or stock mutation occurred in deployment.
- Live health reports build **41a7e92847c13ef2**. JavaScript SHA256 matches the prepared bundle. Anonymous/bootstrap access, valid-origin unauthenticated butchery, invalid-origin setup and private administrative paths retain their expected protections. Desktop and 390px login checks report no page errors or horizontal overflow.
- Source commit: **405a24d848cf51a36e7bf57837250fb32d09967d** on `chore/qibli-trial-stock`. No GitHub push or PR was performed.
