# Manual collapse after validation — 13 October 2026

The shared section component previously reopened whenever its DOM contained a field error. In **صرف مواد للمطبخ → بيانات المستند**, a missing kitchen or invalid reference therefore made **طي** appear ineffective.

Remove that continuous error-based reopening. An explicit collapse now remains closed with earlier errors and draft values retained. Save validation still dispatches the existing reveal/focus behavior; native invalid events and linked navigation retain their reveal behavior. This fix applies to every shared section.

Hosted build ef05dedd408d8a75; Cloudflare version a6dd63b4-192c-458b-94be-6f9d88e9850b, number 60; deployment 8b9b1a1f-06ba-4e4c-ab22-850ed2d2e20c, verified at 100% traffic, created 2026-10-13T12:57:01.480611Z. No API/schema changes; Supabase API remains 13.

Type-check and hosted build passed. Added a browser regression for Save → error → Collapse → Save → focused required kitchen → Collapse again; the isolated browser suite was not run in this restricted session. Live validation reproduced the original failure and verified both repeated collapse and required-field reopening after the fix. The validation-only draft was cancelled without submitting client data. Proof: outputs/Collapsible-Sections-20261013/kitchen-details-fixed.png. Developer Guide 2.46 and the section runbook record the corrected behavior. GitHub push remains pending the existing credential-helper issue.
