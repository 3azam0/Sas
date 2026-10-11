# First-client organization branding — 11 October 2026

Client URL: [Fodo](https://fodo.am-agent2026.workers.dev).

The existing hosted tenant is now واحة أولاد سعد / Wahat Awlad Saed, using the approved enhanced logo and the public business details extracted from its Facebook page. Click **المؤسسة الحالية** in the sidebar to open the address, telephone, email, WhatsApp, map and Facebook links. The home page has no organization-details card. Fodo remains the platform name. The public contact email does not replace the existing owner login.

Tenant profiles are stored in the existing organizations table and returned through the authenticated bootstrap under the existing tenant policy. The additive `20261011124333_organization_profile.sql` migration matches the actual Supabase migration version. Shared local schema initialization appends this change to the frozen hosted bootstrap, preserving the original migration's rebuild check. No organization generation, stock transaction, costing rule or authentication assignment was changed.

The 66,306-byte web logo uses a content-versioned path and is included in both offline asset manifests. Original high-resolution artwork is preserved separately. The native dialog supports Escape, its close button, backdrop dismissal and focus restoration to the organization trigger.

Final hosted build: `a0e4ccfd0e21398d`. Cloudflare deployment: `9d0eae14067742049a11d5fb5acc461f`, published at 12:54 UTC. Supabase `fodo-api` is active version 3.

Validation: 226 tests across 37 files passed; six focused profile/auth tests also passed after schema organization. TypeScript, local production/offline build and hosted build passed. Live browser checks confirmed sign-in, no home profile card, opening/closing and focus restoration, contact link targets, desktop/mobile layout without page overflow, offline details/logo, existing operational pages and logout locking. No browser runtime errors occurred. A live database check confirmed 328 items, 20 categories, one warehouse and zero stock movements/balances.

The Supabase security advisor reported no database-policy findings. Its existing [leaked password protection notice](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection) remains; this branding update does not change Auth settings.

Source branch: `feat/client-branding`, based on the hosted release checkpoint. This update does not merge main. Public client details are recorded in `docs/clients/wahat-awlad-saed.json`; credentials and generated build/browser outputs remain ignored.

Offline-card layout follow-up: `العمل دون اتصال` now uses its own content height instead of stretching to the inventory-category chart. Verified on the hosted site at 1440, 1024 and 390px widths, with the full content and synchronization link visible and no runtime errors. Local production/offline and hosted builds passed. Hosted build `b82596db1badc34b`; deployment `982e39d0ec7a4607a9aeaca007886525`, published at 13:50 UTC.
