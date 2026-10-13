# Arabic in-app client guide — 13 October 2026

Delivered **دليل الاستخدام** in the sidebar with 21 Arabic task topics: quick start, setup, receiving, kitchen supply/setup, opening stock, purchasing, returns, transfers, recipes, production, sales imports/selective deductions, waste, balance editing, counts, history, reports, reconciliation, offline synchronization, troubleshooting and shortcuts. Topics include practical steps, labeled examples, save/stock effects, cautions and related tasks. Search normalizes Arabic diacritics/alef and searches instruction text and aliases. Guide content is bundled with the application; no guide downloads, new service, database changes or dependencies are added.

Contextual **مساعدة** is available in the top bar, document/setup headers and selected report context. Its native modal is separate from transaction forms, preserving their state and returning focus on close. Help contains the shared shortcut table; Ctrl/Command+Enter and Alt+Insert inside it cannot operate the underlying form. Long guidance has collapsible sections. Mobile topics collapse into a browse control and the help panel occupies the screen with an independently scrolling body. The final sizing uses flex layout rather than an estimated header height.

## Verification

- **11 targeted tests passed** across guide, form-keyboard and report-cache files. Guide cases cover all navigation mappings/related references, normalized multi-term search/full instruction text, stock-transfer/shortage/count semantics and non-submit/non-download controls.
- Final type checking, Next production build and **44-asset offline manifest** passed. Hosted bundle build passed.
- Live Arabic search, topic selection/heading focus, related topics, mobile browse, no-results recovery and report-specific reconciliation help were checked.
- Live unsaved receipt: reference `GUIDE-UNSAVED-CHECK` and a rice line (2 kg × EGP 20) remained intact while opening/closing help. Ctrl+Enter inside help did not save. Escape closed help only and returned focus to its trigger. The receipt was cancelled without saving.
- Desktop and mobile 390×844 guide checks show no page-level horizontal overflow. Final mobile help scroll body reaches the dialog bottom and has no internal horizontal overflow.
- No runtime console errors/warnings captured in final checks. No client transaction, setup change, count, sale, balance update or data reset was posted. Offline bundle inclusion was verified; a separate live offline-network simulation was not performed.

## Deployment

- Branch: `feat/client-guide`, based on period reconciliation commit `7072d62`.
- Hosted build **d61643ced1ead0a0**.
- Cloudflare version **65**: `0d50f914-ad5e-4286-a88a-f3be59fa8bdc`.
- Deployment **2c7b03c3-99e2-4893-bc61-19243904e9ba**, verified at 100% traffic, **2026-10-13T16:06:56.783374Z** (19:06 Cairo).
- Supabase API remains version **14**. Existing bindings, compatibility date and observability settings were verified unchanged. There was no backend redeployment or schema/offline-format change.
- Live: https://fodo.am-agent2026.workers.dev/
- Version 64 was an intermediate guide release superseded by final version 65.
- Desktop/mobile and contextual-help screenshots are outside the repository in `outputs/Client-Guide-20261013/`.

Developer guide is version 2.49. The main progress table now marks client help delivered. Financial corrections, expenses/profitability and real-use launch checks remain next work. The previously recorded GitHub credential-helper issue remains; hosted deployment does not imply the latest branch is pushed or merged.
