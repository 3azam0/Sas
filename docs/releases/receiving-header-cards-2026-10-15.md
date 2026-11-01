# Compact receiving header and item cards — 15 October 2026

The receiving date and additional-details control moved to the left side of the desktop header. They remain inside the keyboard form, with busy/child-dialog disabling and existing validation. On phones they wrap beneath the title. Optional supplier/reference expand in the body; invalid hidden fields still reveal and receive focus. Header help/close remain explicit non-submit actions.

Receiving cards have reduced padding/gaps, compact item metadata and inline quantity, base-unit cost and line-value pairs. Height follows content rather than a fixed minimum; conversion hints and edit/delete actions remain. Kitchen issue cards and posting/calculation behavior are unchanged.

- Build: `5bf6606f98edf33b` at https://fodo.am-agent2026.workers.dev/.
- Cloudflare version **68**: `3734d549-ced5-45bf-a2ca-da4260e4cb90`.
- Deployment `ceff6ec8-8021-4dad-982e-8c385d3c5634`, verified 100% traffic, created `2026-10-15T15:40:19.219426Z`.
- Supabase API remains **14**. Existing bindings/settings were retained on upload.

Type checking, all eight receiving-entry/keyboard tests and hosted frontend build passed. Hosted checks at 1280×900 and 390×844 used an unsaved rice line: 10 kg × EGP 10/kg = EGP 100. Its card measured about 86 px on desktop and 105 px on mobile with wrapping; neither modal nor item pane overflowed horizontally. Date remained in the header. An invalid hidden reference reopened its section and received focus while retaining the added line. The draft was cancelled, no client transaction was posted, and the temporary viewport override was reset.

Screenshots: `outputs/Daily-Workflow-20261015/receiving-compact-desktop.png` and `receiving-compact-mobile.png` outside the repository. No new data schema, unit conversion, outbox format or stock policy was introduced.
