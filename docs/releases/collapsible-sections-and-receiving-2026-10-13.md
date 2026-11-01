# Collapsible sections and visible receiving — 13 October 2026

Long form groups and page panels use shared **طي / توسيع** controls. Receiving entry/list, kitchen issue metadata/entry/list, setup groups and purchase packs, document metadata/lines, recipe details, sales upload/mapping, directories, inventory, operation histories and report filters/charts/details can collapse. Headings, counts and header actions remain visible. Sections start expanded; current-screen state is not persisted as tenant configuration.

Collapse retains mounted controls, draft values, files, collection filters, ordering and page state. Required validation reveals hidden groups before focus. Source-document navigation, recipe selection and report drill-down reveal their destination. Only responsive chart drawings remount on expansion; surrounding tables and filters remain mounted. Collapsed grid panels shrink independently of adjacent panels. Mobile buttons retain 44px targets.

Receiving now has side-by-side entry and receipt panes at widths >=900px, summarized/collapsible supplier/date/reference details and keyboard shortcuts in the compact fixed header. Mobile keeps entry above the list, with **عرض القائمة** and independent entry/list collapse. Adding/editing reopens the updated list and resets its page/order/scroll. The footer totals every item and stays available. Focus returns to material search after Add with its popup closed.

Hosted build 6f3471f3c1036424; Cloudflare version ed58bca5-bd53-4352-95b8-9eb9a2cc205e, number 59; deployment 8fff75e4-b00f-4cee-becb-d8307dd54f5b, verified at 100% traffic, created 2026-10-13T12:39:35.540489Z. Live URL: https://fodo.am-agent2026.workers.dev/. Worker bindings and observability were retained. No backend/schema/Dexie/recovery changes; Supabase API remains version 13.

Validation:
- Type-check and hosted build passed; local production build also checked.
- 36 tests passed across form-keyboard, receiving-entry, receiving-units, receipts and receipt-offline suites.
- New browser regressions cover retained receipt drafts, automatic list reopening, hidden setup errors and retained inventory filters. These isolated browser suites were not executed in this restricted session; live verification used read-only navigation and unsaved drafts instead.
- Live receiving checks preserved quantity across collapse/keyboard expansion, retained totals with the list hidden, merged 2+1 kg at EGP 28 into EGP 84 and reopened the updated list. Earlier list checks covered eleven items, paging, edit from page two, filtering/order reset and exact document totals.
- Live setup and shared recipe workflow validation reopened hidden required fields and focused the invalid field. Inventory category and text-descending sort survived collapse/expansion.
- Twelve additional workspace screens rendered their section controls. Chart collapse reduced height to about 97px independently of a 456px neighbor; expansion restored the plot without new runtime warnings.
- At 390x844, collapsing receiving entry showed both added item cards completely above the fixed footer; shortcuts stayed in the header, no horizontal overflow, and toggles measured 44px. At 390x640, the footer remained within the viewport and the body could scroll.
- All client verification drafts were cancelled; no receipt, supplier, recipe or stock update was submitted. Temporary viewport overrides were reset.

Developer Guide 2.45, receiving/form runbooks and the collapsible-section runbook record these behaviors. Proof screenshots are in outputs/Collapsible-Sections-20261013 (charts.png, receiving.png, mobile.png) and outputs/Receiving-Visible-List-20261013 (desktop.png, mobile.png), outside the repository. GitHub push remains pending the existing credential-helper issue.
