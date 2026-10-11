# Hosted client release — agreed scope

The first hosted organization is Fodo. Initial owner login: test@fodo.com. Tenant isolation remains part of the architecture; subscription billing, membership administration and separate demo environments are deferred.

Sales imports remain stock-neutral. Reports calculate expected ingredient quantities from the accepted sale's pinned recipe version, respecting stocked preparation boundaries. Costs use the selected current stock-average or latest-receipt basis, with missing prices shown explicitly. These are estimates, not historical booked cost of goods sold. Sales never create stock issues, layers or balance changes in this release.

Cloudflare serves the shared React workspace and same-origin authenticated API. Supabase Auth supplies real accounts and managed Postgres stores tenant data behind an authenticated Edge Function. Browser tokens stay in secure HTTP-only cookies. Hosted routes reject development sessions and costing resets. The hosted interface excludes development notices, fixture-company switching and destructive controls. Local development keeps its existing launcher and database.

Use a new feature branch from the verified local checkpoint. Type-check, test shared business rules and auth boundaries, build the hosted bundle, apply the isolated database migration, provision the owner through the Auth Admin API and publish through the connected accounts. Record actual deployment identifiers and URLs after verification. Never commit credentials, generated owner passwords, local databases or cloud build output. Push the reviewed feature branch and open a PR; deployment does not imply merging main.

Copy only the previously approved 328-item catalog with zero balances into the fresh hosted organization. Do not copy development transactions, sessions or secret keys. Initial organization display name can be changed later.

Offline capture uses the existing tenant-bound Dexie outboxes and generation checks. First login and server acceptance require connectivity. A saved workspace has a bounded 24-hour offline grant; expired grants retain queued work and require sign-in. Signing out locks the workspace and retains pending work for the same account.

Release checks include unauthenticated rejection, cross-tenant rejection, invalid-origin rejection, duplicate-safe posting, sign-in/refresh/sign-out, no development/reset routes, no development notes in hosted screens, sales report completeness and unchanged stock after sales, reload and offline capture. Cloud Auth/storage integration must be verified with real requests before sharing the client URL.
