# FooDo — In-app client guide plan

Status: implemented — Arabic guide screen, 21 task topics, search and contextual help. See the [operating guide](./runbooks/Client-Guide.md) and [release record](./releases/client-guide-2026-10-13.md).

Updated: 13 October 2026.

Audience: Arabic-speaking restaurant managers, storekeepers and kitchen operators.

Delivery: inside FooDo only. No downloadable guide, PDF, attachment or separate documentation website.

## Goal

Help a client complete real tasks, understand their effect on inventory and costs, and resolve common problems without leaving the application. Instructions must describe the current hosted release rather than future roadmap features. Communication about development can remain English; all client-facing guide content is Arabic and RTL.

## Where the guide appears

- Add **دليل الاستخدام** to the sidebar as a dedicated guide screen. Show a short **ابدأ هنا**, searchable task guides and links to related topics.
- Add a consistently placed **مساعدة** button to supported screens and document-form headers. It opens the relevant topic in a side panel; on small screens it becomes a full-width help view.
- Keep the underlying screen, entered form values, item list and unsaved document intact when opening or closing help. Help must not submit, reset or synchronize a document.
- Connect the existing **اختصارات لوحة المفاتيح** guide to the relevant topics. Maintain one source for shortcut descriptions.
- Do not automatically open a tutorial, force a tour or interrupt routine work. Show a clear guide link in useful empty states.

## Guide structure

Use tasks as titles, rather than a technical feature catalogue. Each topic contains:

1. A one-sentence explanation of what the task achieves.
2. Prerequisites, only when required.
3. Short numbered steps using the exact Arabic labels visible in FooDo.
4. A practical example, clearly marked as an example.
5. **ماذا يحدث بعد الحفظ؟** explaining stock, cost and synchronization effects.
6. Common errors and the next action the user can take.
7. Relevant keyboard shortcuts and related topics.

Use a current screenshot only where it materially clarifies the task. Prefer a focused crop over a full screen, provide meaningful Arabic alternative text and avoid showing account details or confidential client transactions. Text must remain useful without the image.

## Topics and delivery order

### First delivery — everyday workflow

| Topic | Required coverage |
| --- | --- |
| **ابدأ هنا** | Choose the current organization and stock location; distinguish the main warehouse from kitchen stock; explain where setup, operations and reports are found. |
| **تجهيز مواد المخزون** | Materials, independent categories, base units, receiving units/conversions, optional suppliers and initial balances. Explain that the base unit cannot simply be changed after item creation. |
| **استلام مواد** | Optional supplier/reference, receiving date, searchable material selection, quantity and cost, adding several items, newest-first list, reviewing totals, correcting/removing a line and saving. Explain cost per unit and receiving-unit conversion. Include quick creation of a material or category. |
| **صرف مواد للمطبخ** | Select the receiving kitchen, choose materials, enter quantities, add/review lines and save. Explain that this transfers stock and value from the main warehouse to kitchen stock. It does not immediately consume the materials. |
| **الوصفات وخصم المكونات** | Recipe output quantity, ingredients, stocked preparations, publication and menu mapping. Show where to select ingredients for automatic sales deduction. Explain that defining or editing a recipe alone does not move stock. |
| **استيراد المبيعات** | Kitchen/POS selection, completed-sale CSV mapping, preview, confirmation and duplicate handling. Explain pinned recipe versions, selected deductions, shortages and unchanged earlier sales. |
| **قراءة التقارير** | Dates, location/kitchen/category/material filters, sorting, pages and charts. Explain confirmed balances, actual unit cost, theoretical usage, recorded deductions and shortages. |
| **مطابقة الاستهلاك** | Opening/closing physical counts, actual versus theoretical usage, incomplete comparisons, variance and valuation coverage. Include the prerequisites below. |
| **العمل دون اتصال والمزامنة** | First online sign-in, saved workspace, locally pending documents, server acceptance, expired access, rejected actions and reconnecting. |

Deliver these as one coherent help release. Verify each topic against the current screen before publishing it.

### Additional available operations — included in the initial guide

- **إدارة المطابخ ونقاط البيع**: adding/editing kitchens and POS links; explain restrictions shown by the application before deletion or deactivation.
- **تحويل مخزون بين المواقع**: source, destination, units, quantities and accepted movement effects.
- **إنتاج صنف من مكونات**: actual inputs, usable output, normal yield loss, abnormal waste and failed production.
- **تسجيل الهالك**: quantity, reason and effect on stock and cost.
- **تعديل الرصيد**: setting the balance, reason, cost for an increase and handling a stale balance.
- **الجرد الفعلي**: partial counts, blank versus zero, review, synchronization and finalization.
- **المشتريات ومرتجعات الموردين**: only the flows available in the release, with their stock/value effects.
- **سجل صرف المطابخ**: document details, filters, charts and transfer versus historical consumption entries.
- **حل المشكلات الشائعة**: expired session, missing setup, no search results, unavailable stock, rejected synchronization and an incomplete report.

Do not describe subscription management, demos, cashier shifts, refunds/voids or other deferred features as available. Add their guide topics only when their implementation ships.

## Business rules the guide must explain accurately

- A kitchen holds its own stock. One menu meal may be prepared independently by multiple kitchens; each POS belongs to one kitchen.
- New accepted sales calculate theoretical consumption for all recipe ingredients, respecting stocked-preparation boundaries. Automatic deduction applies only to selected ingredients in the recipe version pinned to the sale, from that POS's kitchen.
- A stock shortage does not prevent sales import. FooDo deducts available stock, highlights the missing quantity and avoids negative stock. It does not take stock from another location or automatically deduct the shortage later.
- Identical repeated sales do not deduct stock a second time. Conflicting data for an existing sale must be corrected according to the import error; changing a recipe does not rewrite accepted sales.
- Pending local quantities are provisional. Server acceptance confirms movements and costs; explain the visible status and recovery action rather than implying every Save is immediately final.
- Direct balance editing is an adjustment with a reason. It is not a substitute for the physical count evidence required by reconciliation.
- Reconciliation requires a valid finalized opening count dated the day before the selected period and a closing count dated its last day. Count dates must match the physical cutoff in Cairo time. Intervening movements, late postings or unsupported adjustments can make the comparison incomplete.
- **غير مكتمل** means actual consumption and variance cannot yet be established; it must never be presented as zero consumption.
- Positive consumption variance means extra consumption compared with the recipe estimate; it is not automatically waste. Comparisons use the remaining-stock cost at the valid closing count, and unpriced/incomplete rows do not contribute to valued totals.
- Offline access is time-limited. An expired session preserves pending work; users reconnect and renew the session to continue synchronization. Reports are available offline only where the relevant query has been cached.

## Implementation approach

Keep the initial guide bundled with the web application. It needs no new service, database tables or paid package.

- Use typed topic records with stable IDs, Arabic title, summary, search terms, related topics, applicable screen/form IDs, content and content revision date.
- Use shared React components for the guide screen and contextual panel, so both display the same topic content.
- Map screen/form identifiers to topics explicitly. Avoid matching translated button text to decide which help to open.
- Search titles, summaries and topic text with the application's existing Arabic normalization. Include common alternate terms such as **استلام / توريد**, **صرف / تحويل للمطبخ**, and **جرد / رصيد**.
- Keep help state separate from transaction drafts. Opening help within a modal needs deliberate focus handling; the underlying form must remain mounted, and closing help returns focus to its trigger.
- Link screenshots as static assets with descriptive names. Do not query or upload client records to construct examples.
- Use the existing visual system, accessible headings, readable RTL spacing and collapsible longer sections. Show the core steps immediately; do not hide everything behind collapsed panels.
- Load images only when needed and include text/help assets in the existing offline cache. Do not extend offline authorization through the guide.
- Do not add guide downloads or export controls. Existing operational report exports are outside this guide's scope.

## Delivery checklist

1. Review current task labels and behavior against the runbooks and hosted release; write the first-delivery Arabic topics.
2. Build the guide screen, search, related-topic navigation and contextual help panel.
3. Add sidebar and screen/form entry points; reuse existing shortcut descriptions.
4. Capture focused screenshots where needed, using safe examples without changing client stock.
5. Verify keyboard/focus behavior, mobile layouts, search, offline access and draft preservation.
6. Publish with the normal release workflow and record the delivered topics and verification in the developer guide.
7. Maintain the additional operation topics with their associated features; these baseline instructions are included in the initial guide. Add screenshots or more detailed examples when client feedback shows they are needed.

## Acceptance criteria

- The user can find and complete receiving, kitchen supply, sales import and reconciliation tasks from the Arabic guide.
- Every supported screen/form opens its correct topic, and closing help preserves all entered values and added lines.
- Help is keyboard accessible, returns focus correctly and does not conflict with Enter-to-add or Ctrl/⌘+Enter-to-save on the underlying form.
- Search handles Arabic spelling variants and returns a helpful empty state. All topic and image links resolve.
- Desktop and mobile layouts have readable text without page-level horizontal overflow; long help content scrolls independently.
- Bundled help remains readable after a previously loaded workspace goes offline; sensitive data and transaction permissions retain their existing rules.
- Examples accurately distinguish transfers, consumption, theoretical costs, selective deductions, shortages and incomplete reports.
- No client data is seeded, reset or modified to demonstrate the guide. No downloadable guide is exposed.
- Verification includes meaningful draft-preservation and topic-mapping checks, Arabic keyboard/mobile review, type checking and the production/offline build.

## Maintenance and sources

Update the relevant guide topic in the same release as changes to labels, validation, stock behavior or synchronization. Record a content revision date; avoid instructions tied to a specific client's temporary data. The main guide provides general FooDo guidance while the current organization remains the source of the client's name and branding.

Use [Hosted release](./Hosted-Release.md), [Kitchen inventory and POS plan](./Kitchen-Inventory-POS-Plan.md), [Phase 4 plan](./Phase-4-Plan.md), [BI reports](./runbooks/BI-Reports.md), [Consumption reconciliation](./runbooks/Consumption-Reconciliation.md) and the current application as sources. Resolve outdated historical descriptions in favor of the current agreed behavior before writing client instructions.
