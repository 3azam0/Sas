# Authentication UI and session renewal — 18 October 2026

Delivered a dedicated Arabic RTL sign-in experience with FooDo branding, responsive desktop/phone layouts, email/password labels and autofill, show/hide password, Caps Lock guidance, accessible field errors and focused request feedback. Enter advances from email to password; password Enter and Ctrl/Cmd+Enter submit; Shift+Enter returns to email. Help explains administrator-managed account recovery without presenting an unsupported reset/signup flow.

Session renewal is a native modal over the current workspace. Closing it restores focus without clearing scope, drafts or pending outboxes. Successful renewal validates the expected organization before accepting a snapshot; a different organization's account is rejected. The account/session panel now has an explicit renewal action, and the expired offline grant has a compact explanatory banner. Cached-scope loading shows a branded loading state rather than briefly flashing a sign-in form.

Authentication and bootstrap use bounded requests. The UI distinguishes credential rejection, access problems, throttling, connectivity failure and service unavailability. The Worker preserves service failures as 503 instead of disguising them as bad credentials or inactive membership. Provider response bodies/details are not shown. HTTP-only Secure/SameSite cookies and server-managed tenant authorization remain in place; no Auth settings, schemas, permissions or user credentials changed.

## Release

- Source checkpoint: 9721b92, branch feat/auth-screen-ux.
- Hosted build: f2f4a5f166769ef3.
- Cloudflare version 79: 91cd907b-bbdd-45bb-8f37-78c1a83260f9.
- Deployment: 9b56a1bb-2bce-4607-ae91-f45cef1488af; read back at 100% traffic.
- Health endpoint confirms the build and unchanged selected-ingredient/shortage sales policies.
- Supabase API remains version 15. Windows printing helper remains 1.0.0.

## Verification

All 367 tests in 70 files passed, including new credential-validation, provider-status and interrupted-bootstrap/outbox checks. TypeScript, production/offline and hosted bundle builds passed. The first focused test run encountered a Windows temporary-directory resolution issue; rerunning with the repository's documented SandboxCompat preload and workspace temp directory passed.

Browser checks used the actual auth components with the full hosted stylesheet stack in an isolated local UI harness, never real client credentials. Verified desktop 1440×960, phone 390×844 and narrow 320×640 layouts; no horizontal overflow; 50px input/submit targets; empty-field validation/focus; password visibility; Enter navigation; Ctrl+Enter submission; service/throttling/access messages; collapsible recovery guidance; different-organization renewal rejection; successful same-organization renewal; cancellation preserving the existing draft and restoring focus. The main hosted application loaded the matching versioned JS bundle; the renewal action/dialog displayed the actual organization, opened and closed correctly, and returned to Overview without signing out or posting client transactions. A separate Worker version-preview URL returned Page not found, so it was not used as authentication proof. Live client-password entry and real offline network simulation were not performed for this UI release.

[Desktop screenshot](../../../Auth-UX-20261018/login-desktop.png) · [Hosted renewal dialog](../../../Auth-UX-20261018/renewal-hosted.png). Automated tests establish technical behavior, not human client acceptance. GitHub publication/remote CI remain pending after the earlier Windows Credential Manager restriction; this release is committed locally and deployed through the existing Cloudflare connector.
