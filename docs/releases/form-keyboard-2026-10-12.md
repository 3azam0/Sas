# Form keyboard and user guide release — 12 October 2026

The workspace top bar now has **اختصارات**, a keyboard icon/button opening a complete Arabic user guide. Document/setup forms also show compact hints. The guide remains accessible on phone layouts, wraps its descriptions without horizontal scrolling, closes with Escape and returns focus to its opener.

Shared form behavior now uses Enter for the next data field and Shift+Enter for the previous field. Enter on a focused button activates that button. Ctrl/Command+Enter explicitly validates and submits only through an enabled primary action; it cannot bypass preview/confirmation requirements or busy state. Alt+Insert adds an available material/component/purchase-pack row and focuses it. Tab, multiline Enter, native file controls, checkbox Space and composition input retain their intended behavior.

Search selection opens matching results automatically and advances to the next field after selection. Empty-query Enter retains the selected material; Shift+Enter moves back rather than selecting a result. Enter reveals retained document rows when crossing pages, skips excluded rows and follows pagination inside the current filters. Reveal attempts are bounded if a row cannot become visible. Kitchen issues retain their quantity-to-next-material/add-row behavior. Kitchen management also restores focus after cancelling an editor whose original button was temporarily unmounted.

`WorkflowForm` supplies these controls to balance edits, opening stock, purchasing/receipts/reversals, supplier returns, transfers, counts, recipes, production, menu mapping, sales imports, kitchen editors and hosted sign-in. `KeyboardForm` retains the existing validation/layout for setup, direct receiving, legacy waste, recovery and development-only costing settings. No backend, database migration, costing arithmetic or stock policy changed. The local launcher and address remain stable.

## Publication

- Live application: [FooDo](https://fodo.am-agent2026.workers.dev/).
- Final hosted build: `7292ebfa65f8585b`, confirmed in the browser's loaded asset.
- Cloudflare deployment: `35cf0bd758d448b9ada0eae6929e783a`; upload succeeded with HTTP 200. Existing bindings, compatibility, observability and other deployment settings were retained.
- Supabase Edge Function remains version 7; IndexedDB remains version 11 and recovery format 16. No cloud database or authentication configuration was changed.
- Task branch: `feat/form-keyboard`, stacked from kitchen checkpoint `3a54aa5d9bb0c597266923faf526b9b2d3674070`. Local commit, remote push and deployment are distinct. The previous Windows Git credential-helper failure remains a publication limitation; do not report remote publication without a verified pushed SHA.
- Developer guide is version 2.31. The current [forms runbook](../runbooks/UI-Forms.md) supersedes older ordinary-Enter submission instructions.

## Verification

- All **264 unit/integration tests in 47 files** passed. Three keyboard-policy tests cover ordinary Enter versus explicit submission, native controls/composition, and busy/held shortcuts. The policy tests were rerun after the final UI fixes and passed.
- Final local production build and TypeScript passed; its offline manifest has **42 assets**. Final hosted bundling passed.
- Hosted draft-only checks verified receiving initial focus, header navigation, empty-query selection retention, search-result selection, Shift+Enter, next-field/save-button focus, missing-reference validation and Alt+Insert focus. No receiving draft was saved.
- Supplier setup verified initial name focus, forward/backward navigation, required-field validation, Escape and focus restoration. Purchase drafts verified navigation skipping pagination controls, Alt+Insert and Escape. Recipe drafts verified header navigation and component addition.
- Stock count navigation crossed from row 25 to row 26 and back, both unfiltered and within a 47-item category, preserving the category and revealing the appropriate page without saving. A five-match name search advanced from its last matching row to Save; an invalid quantity excluded by a later search was revealed and focused on validation with its value retained. Sales CSV Enter inserted a newline; Ctrl+Enter could not bypass the disabled preview/confirmation action. Direct balance edits focused the required reason and were cancelled without acceptance.
- Kitchen management verified name/save-button navigation, empty-name validation, editor cancellation returning to Add, and manager cancellation returning to its opener. An unsaved issue verified header navigation, search-to-quantity selection, Enter adding the next material row and required-field validation. All drafts were cancelled.
- The guide was inspected at the default desktop viewport and **390×844**. Its phone body width and scroll width both measured 338px after the wrap fix. Screenshots are saved beside this repository in `outputs/Keyboard-Forms-20261012/keyboard-guide-desktop.png` and `keyboard-guide-mobile.png`. The temporary viewport override was reset.
- The final overview still showed **338 materials**, confirmed stock value **196,868.65 EGP**, and **zero pending operations**. No client setup records or documents were saved, and no reset, recovery or stock operation was run during browser verification.

The new `tests/browser/keyboard.spec.ts` contains four fixture regressions for receiving, setup, guide behavior and filtered count navigation; intentional count/purchase submissions in `workflow-ux.spec.ts` now use Ctrl+Enter. These runner scenarios were added for isolated regression use but were not executed in this restricted session. Hosted draft checks provide the UI evidence above; physical operating-system keyboards and every individual workflow path have not been separately exercised.
