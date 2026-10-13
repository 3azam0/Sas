# Collapsible forms and pages

Use **طي** beside a section heading to hide its contents; **توسيع** restores them. Tab to the button and press Enter or Space. Headings, counts and header actions remain available. Sections start expanded; collapse is local to the current screen/editor and is not an organization setting.

Document metadata, receiving/kitchen entry and added-item lists, recipe components, optional item packs, setup fields, sales upload/mapping, directories, report filters/charts/details, inventory and operation histories use this pattern. Existing document-level details and CSV import disclosures remain available. Compact metric cards and primary editor Save/Cancel footers remain visible.

Collapsing retains input values, files, selected items, receipt lines, filters, sorting and pagination. It never saves, deletes, deducts or changes synchronization. Add/edit in receiving reveals the updated list. A hidden required-field error reopens its group before focus; sections with active field errors remain open for correction. Report drill-down, recipe selection and source-document links reveal their destination.

Implement new long groups with `CollapsibleSection`; use a descriptive title or an existing first heading/header. Keep Save/Cancel and form-level errors outside collapsible bodies. `DocumentFields` and `DocumentLines` already provide groups; use `collapsible={false}` for fields inside an existing disclosure, as in receiving. Keep nested form validation registered while hidden. Use `focusControl` for field navigation so collapsed ancestors and paginated rows reveal together.

Use `CollapsibleChart` only for chart canvases: its drawing remounts on expansion, while chart data, surrounding controls and daily tables remain mounted. Collapsed grid panels shrink independently of taller neighbors. Mobile disclosure targets are at least 44px. Print styles reveal section bodies and hide toggle controls; document printing still follows the existing print action.

Regression cases are in `tests/browser/collapsible-sections.spec.ts`: retained receiving drafts/lines, reopening on new additions, hidden setup errors, and preserved inventory filters. Run stock-writing browser suites against isolated fixture data. Hosted verification must use unsaved drafts and cancel them afterward.
