# FooDo branding — accepted 12 October 2026

The platform uses the user-approved **FooDo** logo and exact capitalization. The shared logo appears in the workspace, welcome and sign-in screens; its compact mark serves loading, browser and installed-app icons. Arabic RTL layouts retain a left-to-right logo. The client organization keeps its own restaurant logo and profile.

Assets and full generation prompts: [FooDo brand identity](../branding/FooDo.md). Both assets are transparent RGBA PNGs; no vector master is claimed. Versioned filenames support immutable hosted caching.

## Verified delivery

- Live application: https://fodo.am-agent2026.workers.dev/
- Hosted build: `d52f389600b7b46a`.
- Cloudflare deployment: `5bf8880e962d4c4e91173057e424c414`, uploaded successfully on 11 October 2026.
- Live acceptance check on 12 October: title `FooDo | إدارة المخزون والتكاليف`, expected build script and loaded horizontal logo.
- TypeScript, hosted build and local production build with `-SandboxCompat` passed. Local offline precache includes both brand PNGs.
- Desktop and phone layouts were visually checked; the logo preserves its aspect ratio and fits the existing responsive header/sidebar.

This release changes visible branding only. It adds no database migration or tenant data mutation. Service names, environment variables, cookies, offline database identifiers and the saved local origin remain stable.

The source checkpoint is a focused branch from the verified all-screen UI commit `48c5152`. Remote Git publication is separate from the completed Cloudflare deployment; the existing restricted-process credential blocker requires the normal Windows `Publish-Fodo-Release.cmd` workflow. Do not report a push or PR as completed until remotely verified.
