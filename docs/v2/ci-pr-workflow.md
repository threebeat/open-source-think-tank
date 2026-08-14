# GitHub CI and pull-request workflow

## Branch and PR model

Cloud agents never push to `main` and never force-push shared branches.

For each implementation phase:

1. Update local `main` after the preceding phase PR merges.
2. Create `v2/phase-<n>-<short-scope>` from that exact commit.
3. Make reviewable commits that keep migrations, services, projections, UI, tests, and docs traceable.
4. Push the branch and open one draft PR to `main` using the repository template.
5. Wait for `CI / required`, inspect every failed job/artifact, and fix root causes without weakening checks.
6. Mark ready only when phase acceptance criteria, migration/rollback, privacy/security/accessibility notes, and screenshots (when UI changes) are complete.
7. Request human review. Do not merge or begin the next phase without approval.

If a phase must be split, use a named checkpoint PR that is independently safe and explicitly states what remains disabled. Do not use a permanently red “contract PR.”

## CI shape

The v2 workflow has these logical gates:

| Gate | Purpose |
| --- | --- |
| `classify` | Determines docs-only versus runtime impact from changed paths |
| `contract` | Runs the governance/doc contract on every PR and push |
| `unit` | Install, lint, typecheck, unit, security, backup smoke, public build |
| `postgres` | Concurrency, migration, reset, report-integrity, and acceptance proofs |
| `e2e-public` | Public/browser/a11y suite in Chromium and WebKit |
| `e2e-gated` | Authenticated PostgreSQL/browser/a11y suite |
| `required` | Stable aggregate check suitable for branch protection |

The initial workflow keeps the existing runtime commands so the documentation reset does not pretend the application already implements v2. Phase subagents update commands and suites as their code lands. `required` treats skipped runtime jobs as valid only for a classified docs-only change.

## Permissions

CI uses read-only repository contents and does not receive production secrets. Synthetic database/auth values are test fixtures only. Fork PRs and untrusted code never receive privileged deployment/vendor credentials.

The Cursor/cloud-agent identity—not GitHub Actions—needs permission to push its `v2/phase-*` branch and create/update pull requests. The agent must use the repository’s configured GitHub remote/authentication and stop on permission failure. CI does not need `contents: write` or `pull-requests: write` merely to validate a PR.

## Required branch-protection recommendation

After the workflow lands and has one successful main-branch run, a repository administrator should configure:

- require pull requests before merging;
- require `CI / required` and up-to-date branches;
- require conversation resolution;
- block force pushes and deletion of `main`;
- use CODEOWNERS/review requirements when maintainers are ready; and
- optionally require signed commits or linear history after testing contributor ergonomics.

This document does not itself change repository settings.

## Failure and artifact handling

- Browser failures upload Playwright reports and traces without production data.
- Security/privacy test failures block the phase; they cannot be made advisory.
- Flaky retries must be justified and bounded. Quarantined tests need an issue, owner, expiry, and an equivalent blocking check.
- A migration failure includes the exact disposable database used; never run destructive reset tests against an unresolved URL.
- A docs-only classifier failure defaults to running more checks, not fewer.

## PR description minimum

- phase and contract links;
- user-visible and institutional behavior;
- exact changed boundaries;
- migrations/backfill/rollback;
- threat/privacy/accessibility analysis;
- tests and commands with results;
- open decisions and disabled features;
- screenshots for changed public/portal UI; and
- a statement that no production participant data entered prompts, fixtures, logs, screenshots, or artifacts.

