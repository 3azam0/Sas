Fodo had a documented Git policy but no GitHub checks to enforce it. This change adds an always-running `CI gate` backed by type checking, unit/integration tests, a production build, offline/recovery/launcher browser scenarios, and a full-history secret scan. Actions and runtime versions are pinned.

Version-tag pushes rerun checks and prepare a draft release only when the tag matches the package version, belongs to `main`, and has committed release notes. The draft includes a source/lockfile manifest and does not deploy the application.

The Windows browser runner now terminates its own test-server child through its process handle when the restricted session denies `taskkill`, with a bounded shutdown check. This fixes a successful browser run remaining open during cleanup.

The Windows setup helper publishes this branch, opens this PR, waits for CI, and configures/verifies branch protection, squash merging, immutable version tags, and staging/demo/production environment registrations using the owner's existing Git credential. A solo owner uses zero required independent approvals initially; add a reviewer and increase this once the team expands. Hosted databases, hosting, production authentication, environment secrets and deployed-client migration handling remain implementation work.

Validation: see the local verification record in `docs/runbooks/GitHub-Setup.md`; GitHub Actions provides the remote results. No database schema or posting/offline contracts change.
