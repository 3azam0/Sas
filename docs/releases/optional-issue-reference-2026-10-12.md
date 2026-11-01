# Optional stock issue reference — 12 October 2026

**مرجع الصرف** is optional in the stock issue/kitchen issue editor. The required star is replaced by `اختياري`; a blank field passes validation and Enter advances to material entry. The shared contract accepts blank, whitespace-only or omitted reference input and normalizes it to an empty string. If supplied, a reference still requires 2–100 characters. Existing nonempty documents parse exactly as before, preserving accepted retry hashes. Automatic `KI-` document identity remains stable. Reference-free history/ledger descriptions omit the empty separator, and printing shows a dash for the absent reference.

- TypeScript, Next production build/42-asset offline manifest and hosted bundle passed.
- Twenty tests in four files passed, including new blank/omitted reference validation, reference-free server posting/idempotent retry/reconciliation, and offline reload/recovery coverage. The first test invocation hit the Windows sandbox temporary-directory limit; rerunning with the existing workspace temporary-directory configuration passed.
- Supabase project `bkkxrptgwbrwredauopq`, `fodo-api` version 8 is active; bundle SHA-256 `310311391dd8a6bcc1c7572fab33a23dd3ac1e22a8d7a57a4c8768adb144b0ba`. Existing custom authentication and tenant authorization remain in place, with the existing `verify_jwt:false` gateway setting and explicit relative `deno.json` import-map path retained. No schema migration was needed.
- Cloudflare upload returned HTTP 200 with existing Worker settings/bindings preserved. The first upload timed out with HTTP 504; deployment inspection confirmed the previous version remained active before a successful retry. Worker version identifier returned by the successful upload: `b77591dd0a194fe5b511e158836e27ea`.
- The loaded browser asset confirms hosted build `4961872ae49ad020` at https://fodo.am-agent2026.workers.dev/.
- Deployment inspection confirms version `b77591dd-0a19-4fe5-b511-e158836e27ea` at 100% in deployment `ad57350d-2cea-4136-ad84-a34c8d5c2ef1`.
- Live DOM checks confirmed the optional label, `required:false`, valid blank input and keyboard advancement to `مادة الصرف 1`. The screenshot was inspected. The verification draft was cancelled without stock posting; overview remained 338 materials, 196,820.65 EGP and zero pending operations. Server acceptance was tested with isolated fixtures rather than posting a test issue in the client's warehouse.
- Developer guide v2.35; branch `feat/optional-issue-reference`, stacked from `019fd20`. Source publication remains subject to the previously recorded Windows Git credential-helper restriction.

Screenshot: sibling `outputs/Forms-UX-20261012/13-optional-issue-reference.png`.
