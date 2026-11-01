# Compact kitchen supply header and cards — 15 October 2026

Kitchen supply now shares receiving's compact receipt-card styling: content-height rows, reduced padding, inline quantity/cost/value, with identity, available/remaining stock and edit/delete retained. Kitchen, date and additional-details controls occupy the left desktop header and wrap below the title on mobile. Reference/notes expand directly beneath the header. Repeated required hints are hidden while label markers remain.

`WorkflowForm.header` renders inside the existing form and validation provider before its scrolling body. Other forms keep their current layout/hints. Kitchen header fields retain busy disabling, registered validation, searchable selection and keyboard behavior; the header owns one shared keyboard hint. No stock, costing, outbox, schema or API behavior changed.

- Build **d19d6caa3698da89**, URL https://fodo.am-agent2026.workers.dev/.
- Cloudflare version **70**, ID `1b488465-7bc1-4612-b6b5-055b40fee585`.
- Deployment `c04ebb30-34fa-4f38-8c18-efae7311b2f4`, verified 100% traffic, created `2026-10-15T16:08:19.157789Z`.
- Supabase API remains **14**; prior Worker bindings/settings retained.

Type checking, 16 targeted receiving/kitchen-entry/stock-preview/keyboard tests and hosted frontend builds passed. Desktop 1280×900 and mobile 390×844 checks used a 10 kg rice line in an unsaved supply document. Cards measured about 86 px without horizontal modal/header overflow. Empty date validation focused the header date; an invalid hidden reference reopened its fields and received focus while retaining the line. The draft was cancelled without posting client stock. Final CSS removes duplicate required hints; validation tests preceded this CSS-only polish.

Evidence is outside the repository at `outputs/Daily-Workflow-20261015/kitchen-compact-desktop.png` and `kitchen-compact-mobile.png`. Browser checks do not represent a posted stock-transfer acceptance test. Existing transfer rules and shortage rejection remain unchanged.
