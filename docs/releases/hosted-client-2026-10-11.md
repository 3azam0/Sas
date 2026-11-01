# Fodo hosted client trial — 11 October 2026

Client URL: [Fodo](https://fodo.am-agent2026.workers.dev).

Cloudflare Worker `fodo` serves the shared Arabic workspace and authenticated API. Frontend build `819dc7075ec8c882`; deployment `abf97f15e4334b84a5f5c94bde90bbb5`, published at 11:21 UTC. Supabase project `bkkxrptgwbrwredauopq` hosts managed Postgres/Auth and Edge Function `fodo-api`, active version 2. Applied migrations: `202610110001_fodo_hosted.sql` and `202610110002_fodo_policy_indexes.sql`.

The first organization is Fodo, with owner `test@fodo.com`. Its generated password is stored only in the ignored private `.cloud-build/Initial-Fodo-Login.txt` file. Share it directly with the intended tester. No credentials were sent by email or committed. Only the public project URL/key are Worker bindings; server secrets remain in Supabase.

The approved catalog contains 328 items, 20 flat categories, eight units and one main warehouse. Stock movements and balances are empty. Existing local data is preserved. All 34 private database tables have RLS; business tables force tenant policies under the non-owner `fodo_api` role. Owner assignment is resolved on the server from validated Auth identity. No development sessions, reset route or provisioning endpoint are exposed by the hosted API.

Sales imports and reports remain stock-neutral. Theoretical quantities use accepted details and their pinned historical recipe versions. Current stock-average or latest-receipt prices produce estimates, with missing prices shown explicitly. Stocked preparation boundaries prevent double counting. These reports do not book historical COGS or deduct inventory. Production, waste, returns, transfers and count adjustments retain their normal stock effects.

Verification completed:

- 224 unit/integration tests across 36 files passed, including tenant recovery and stock-neutral sales reports.
- TypeScript and the Next production build passed; the local offline manifest contains 41 build assets. The Cloudflare frontend/backend/Worker bundles built successfully.
- Local browser coverage completed through 40 fixture regressions, one isolated receiving regression and two isolated empty-workspace checks. The receiving scenario now waits for durable save completion before reload.
- Live read-only cloud checks passed: real sign-in, operational pages, desktop/mobile layout, calculation-only report, offline reload with the tenant catalog, and logout locking saved data across reload. No browser runtime errors occurred.
- Actual API checks rejected unauthenticated access, wrong origins, another tenant's command and development/reset/provisioning routes. A direct RLS check returned no items for an unauthorized tenant. Client stock remained empty after verification.

First login and acceptance of queued work require connectivity. Saved workspaces allow a 24-hour offline grant; expiry retains pending work and requires sign-in. Signing out locks the workspace and preserves pending work for the same account. The service worker caches the shell/assets, never API responses.

The source checkpoint is on `feat/cloud-client-release`, including earlier local inventory/cost-control/UI milestones. Git publication from the Codex process was blocked by Windows Credential Manager access. `Publish-Fodo-Release.cmd` publishes the clean committed branch in the normal Windows session and creates or reuses its draft PR. It does not merge or deploy. Its verified result is saved in ignored `.cache/hosted-release-publication.json`.

Later work includes period actual-versus-theoretical reports, refunds/voids, full POS, billing, membership UI, tax/fiscal adapters, password changes and recovery using a real email. The Supabase advisor reports [leaked password protection disabled](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection); review that setting before broader onboarding. The initial password is randomly generated.
