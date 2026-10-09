# GitHub checks, protection and releases

Repository: [3azam0/Sas](https://github.com/3azam0/Sas). Development uses task branches from `main`; staging, client demo and production use separate environment configuration. No permanent environment or client forks are needed.

## Current state

The owner published main at 8085bdf and chore/github-workflow at 42d8edf. [PR #1](https://github.com/3azam0/Sas/pull/1) exists, and branch and PR CI gates passed. The latest setup report verified squash merging, branch cleanup, immutable release tags, staging and client-demo registrations, and production approval/release-tag policy. Only main protection remains pending: GitHub rejected the helper request with HTTP 422 because it sent both contexts and checks. The helper now sends checks only, preserves existing requirements, and has 22 regression checks passing in both PowerShell versions. Publication and remote verification of this final payload fix remain pending. Codex cannot access the Windows credential store from its restricted process.

Hosted infrastructure and deployments are also pending. Registering a GitHub environment does not create a database or application deployment. The selected Supabase project has no assigned environment role yet.

## Publish and configure

After local verification and committing the task branch, double-click the workspace's `Configure-Fodo-GitHub.cmd` in File Explorer. Keep its window open. It runs `scripts/github-setup.ps1 -Task All` in the user's session. Sign in to GitHub if normal Git Credential Manager requests it.

The helper confirms the repository, current branch and clean working tree; publishes the initial `main` only if the remote has no branches; publishes `chore/github-workflow`; verifies its remote SHA; and opens/reuses a PR against `main`. It then waits up to 20 minutes for successful `CI gate` checks before applying repository controls. It stops if the remote base has changed, authentication fails, or CI fails. It never force-pushes, merges the PR or deploys the application. Review the PR and merge through GitHub when its required checks pass.

Use `./scripts/github-setup.ps1 -Task Publish` to publish/open the PR without configuring controls. If CI takes longer or a control is unavailable, fix the reported issue and rerun `./scripts/github-setup.ps1 -Task Configure` from the task branch or updated `main` after that commit passes CI. Existing controls are read back after changes; stricter review/access requirements are preserved or flagged for review. Failures are reported independently, and the final result stays unsuccessful if any control remains pending. The PR URL and published SHA are saved in ignored `.cache/github-pull-request.json`.

To retry main protection, close the old setup window and rerun **Configure-Fodo-GitHub.cmd** after the payload fix is committed. It publishes the fix, reuses PR #1, waits for new CI checks and retries/read-backs all controls. The saved .cache/github-setup-result.json includes exact per-control errors. The previous plan/access failures no longer occur; this last failure was an invalid request from the helper. The corrected status-check request uses checks only, with CI gate bound to GitHub Actions, and preserves other required checks.

The helper uses Git's existing credential interface for GitHub API calls and holds the token in memory only. It never reads Chrome cookies, stores tokens in files, changes repository visibility, upgrades the account, or creates broader credential access. A Git credential may need repository/workflow permissions already granted by its owner. If GitHub denies a control, inspect the account/repository plan and token permissions; no automatic upgrade or access expansion occurs.

## Repository policy

- Require PRs to `main`, the GitHub Actions `CI gate`, an up-to-date base, and resolved conversations. Apply protection to administrators too. Block force pushes and deletion.
- Initially use zero **independent review approvals** for the solo owner, while still requiring a PR and successful checks. GitHub does not allow authors to approve their own PRs. Once a second maintainer is available, rerun the helper with `-RequiredApprovals 1` and use an independent review for each change.
- Use squash merging and automatically remove merged task branches. Shared changes use revert/follow-up PRs; history rewriting requires explicit agreement on an unprotected task branch.
- Protect `v*` tags against updates and deletion. Create release tags explicitly after review; never move an existing release tag.
- Register `staging` and `client-demo` for protected branches. Register `production` for `v*` tags with approval by `3azam0`. The sole owner may approve their own deployment initially; add another reviewer and prevent self-review when the team supports it. Future deployment jobs must explicitly reference `environment: production` to use this gate. Before granting live credentials, disable **Allow administrators to bypass configured protection rules** in GitHub Settings → Environments → production where the plan supports it. The supported REST/GraphQL environment APIs do not expose that switch; the helper explicitly leaves this UI verification pending.

GitHub plan restrictions can limit branch rules and environment protection in private repositories. The helper reports these limitations rather than changing visibility or purchasing a plan. [GitHub protected branches](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches) and [deployment environments](https://docs.github.com/en/actions/reference/workflows-and-actions/deployments-and-environments) describe availability and behavior.

## Checks on every change

`Fodo CI` runs on every PR to `main`, pushes to the project's task/main branches, merge-queue candidates, and manual runs. No path filters skip required checks. The `CI gate` succeeds only when both jobs succeed; failed, cancelled or skipped prerequisites fail the gate.

The quality job installs the frozen lockfile with Node 24.19.0 and pnpm 11.25.0, then runs type checking, unit/integration tests, production build, and every offline/recovery/launcher browser scenario. Chrome is installed for Playwright. Tests use isolated CI data and need no cloud credentials. The secret job scans complete Git history with Gitleaks; no raw leak reports or PR comments are uploaded. CI has read-only repository permissions and cannot deploy. Every third-party action is pinned to its verified commit SHA.

Before committing locally, run typecheck, tests, build, and `pnpm test:browser` (or the Windows runbook equivalents). Review explicit staged paths and run `git diff --cached --check`. Keep `.env*` except `.env.example`, databases, archives, backups, dependencies and build outputs excluded. Do not add broad secret-scan exceptions to make a failure pass; remove exposed secrets, rotate them through the owner, and address history deliberately.

## Release workflow

1. Finish and review the change on a task branch. For a release, set the intended version in `package.json` and commit complete notes at `docs/releases/vX.Y.Z.md`. Include the behavior change, validation, database/offline compatibility, and rollback conditions. Merge the PR after checks pass.
2. Verify the chosen source on `main`; create an annotated `vX.Y.Z` tag whose version matches `package.json`. Push only that tag when the release is authorized.
3. `Fodo draft release` reruns the entire CI workflow, validates that the tag resolves to the checked-out commit in `origin/main`, checks the version and notes, and creates a GitHub **draft** release with a source/lockfile manifest. Its only write permission is creating the draft release. Creating a tag does not deploy or publish the release; the application remains a local prototype until hosted readiness is delivered.
4. Once hosted infrastructure exists, promote the reviewed source through staging and approved demo/production jobs. Build separately for each environment's compiled public settings. Each live deployment must record source SHA, environment, build ID, migration level, approval, smoke-test results and recovery point. Wire production jobs to the protected environment before granting live credentials.

Do not tag today's checkpoint automatically; versioned release notes and review are prerequisites. A failed draft run is fixed with a new version/tag through review; immutable tags are not rewritten. Existing releases are not silently replaced on reruns.

## Database and offline upgrades

Every schema/command change must state which previously shipped clients remain supported. Prefer an expand/migrate/contract sequence: deploy additive schema and adapters, support both old/new commands, migrate data without rewriting accepted ledger events, upgrade clients, then remove old support only after the documented compatibility window. Test an older device with a pending queue against the upgraded server, including retries and recovery imports. Use a new idempotent migration file rather than editing one already applied.

Rollback is permitted only when the previous application understands the current schema and command versions. Otherwise roll forward with a tested repair. Preserve accepted receipts/movements and unsynchronized work; reversing an inventory transaction uses a compensating business operation. Test a backup restore into an isolated destination before a data-affecting release. Production migration execution, client compatibility enforcement and demo reset generations remain planned work.

## Local verification record

Local checks on 9 October 2026: typecheck, 27 unit/integration tests, production build, and nine browser/process scenarios passed. Release tests reject tag/version mismatch, unreviewed source, mismatched workflow SHA, a changed checkout, and incomplete notes. Workflow validation passed with actionlint 1.7.12. Gitleaks 8.30.1 found no secrets in the committed history. PowerShell syntax validation passed. Tool downloads were verified against publisher checksums, and pinned package versions were checked against npm. The browser runner now falls back to its own child-process handle when the Windows sandbox denies `taskkill`; the repeated run passed and exited successfully.

Remote branch and PR CI passed at 42d8edf. The latest helper fix has 22 regression checks covering REST arrays, retained API errors, production reviewer conflicts, and serialized status-check requests; all pass in Windows PowerShell 5.1 and PowerShell 7. Remote validation of the payload fix and main protection requires another owner-session helper run. Production administrator bypass requires the separate UI check described above. No hosted environment or production database was created.
