# Kitchen supply reporting — 13 October 2026

Delivered **سجل صرف المطابخ** as a separate full-history BI report, linked from the kitchen history and overview report shortcuts. Dates, current/all location scope, receiving kitchen, category, material, reference/document search, sorting and server pagination filter all accepted records. New report fields are additive to the existing response. No schema, RLS, Auth, stock posting, outbox or recovery format changes were made.

Outgoing supply lines are counted once. Incoming FIFO allocations and sale deductions are excluded. Historical direct issues remain separately labelled. Distinct document/material counts, posted line costs, daily transfers/legacy consumption and top-ten receiving-kitchen rankings cover the complete filtered period. Source or destination location can select a supply; kitchen-to-kitchen supplies rank under the recipient. CSV exports include stable KI document identifiers, all filtered pages (up to 10,000) and checkpoint validation. Existing printing covers the current detail page; loaded report queries/pages retain the offline cache.

Validation: 17 relevant tests across four files passed, with the supply and kitchen inventory suites re-run after strengthened assertions. Tests cover 104 lines from 103 multi-line/mixed-unit documents beyond the 100-document snapshot, independent page totals, previous period, destination and recipient routing, empty periods, tenant/foreign filter rejection, and unchanged stock. FIFO split incoming allocations are excluded and blended allocated unit cost is correct; moving-average behavior is also verified. Local and hosted production builds and TypeScript passed.

Live browser checks covered the history shortcut, full report load, chart kitchen drilldown, sorting/page-size controls, empty day, document-number search and CSV export. CSV contents matched the posted record: one legacy issue, one kg of beans, 48 EGP, 48 EGP/kg, with the stable document identifier. The monthly report matched a read-only database aggregate (48 EGP legacy, no supply transfers). Desktop 1440px and mobile 390px layouts had no page horizontal overflow; the detail table scrolls internally. No console errors were observed. Printing was not submitted to an OS printer. Browser verification made no stock writes.

Hosted build: `09e6c8cd291edf67`. Supabase fodo-api version 13 (custom authentication retained). Cloudflare version `c1a4d44b-be3b-4a23-8da0-fe35936af0ea`, number 50; deployment `ef6d79db-22f0-4dbb-aa80-5f777139abd7` at 100%, created `2026-10-13T08:47:19.454552Z` (11:47 Cairo). Bindings, compatibility settings and observability were retained.

Proof screenshots: outputs/Kitchen-Supply-Report-20261013/desktop.png and mobile.png (outside repository). GitHub push remains pending the existing credential-helper issue; no successful remote publication is claimed.

See [operating guide](../runbooks/Kitchen-Supply-Report.md).
