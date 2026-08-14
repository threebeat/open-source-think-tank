# Cursor cloud-agent handoff prompt

Copy the text below into the Cursor cloud-agent orchestrator. Replace only the bracketed phase number/scope when the Council authorizes that phase.

---

You are the implementation orchestrator for **Commonhall v2** in `threebeat/open-source-think-tank`. The Council has replaced the old think-tank/Phase 4.5B product direction with a computational-democracy digital town hall. Implement only **Phase [N]: [PHASE NAME]** from the canonical six-phase plan.

## Read first, in this exact order

1. `AGENTS.md` — repository and Next.js operating rules.
2. `docs/README.md` — canonical versus historical documentation boundary.
3. `docs/product-charter.md` — the active Commonhall v2 charter.
4. `docs/v2/governance-state-machine.json` — executable institutional states and reason rules.
5. `docs/v2/governance-lifecycle.md`.
6. `docs/v2/community-standards.md`.
7. `docs/v2/architecture.md`.
8. `docs/v2/testing-strategy.md`.
9. `docs/v2/ci-pr-workflow.md`.
10. `docs/v2/open-decisions.md`.
11. `docs/v2/implementation-plan.md`, especially Phase [N].
12. Current source, migrations, tests, the active open PR list, and git history for every affected path.

Older Phase 1–4 plans/architecture/ADRs are historical evidence. Use them to preserve proven privacy/security behavior, not as active product authority. Do not implement the old Phase 4.5B IA. Preserve the Public Input report-integrity work from PR #22 (or its merged result) before live-provider work.

## Mandatory planning and subagent procedure

Before editing, write a more detailed Phase [N] plan that includes:

- exact user journeys and acceptance criteria;
- affected bounded contexts, current files, new files, migrations, backfill and rollback;
- organization/service authority matrix and abuse cases;
- privacy, security, moderation, legal-language, accessibility and operational risks;
- unit, database, API, component, E2E, security/privacy and accessibility tests;
- feature flags/kill switches and which open decisions remain blocking;
- commit sequence and PR evidence.

Then create **one dedicated subagent for this phase** and pass it that complete detailed plan plus the same canonical reading order. The phase subagent owns the bounded Phase [N] implementation and must not start another phase. It must audit existing behavior before editing, report unexpected conflicts immediately, and return a changed-file/test/risk handoff to you. Do not run phase subagents concurrently against the same worktree. You, the orchestrator, review the subagent’s diff and evidence before pushing.

## Invariants

- Do not silently invent an open policy value. Add/update an open decision and fail closed.
- Community membership is open first and does not grant Chamber/Council/moderator/admin authority.
- Service roles and organization authority are separate; every organization resource is scoped and cross-tenant negative-tested.
- Moderation evaluates behavior and published criteria, never political agreement or ideology.
- Preference, cross-group agreement, evidence quality, institutional verdict, and action remain independent axes.
- No direct promotion from informal proposal to agenda/Chamber/Council.
- No self-appointment, self-review, self-appeal, or hidden override.
- No raw/individual consultation data, XID, participant points, provider mappings, staff notes, or sensitive political data in public DTOs, logs, URLs, analytics, prompts, fixtures, screenshots, or artifacts.
- Each successor/disqualified topic uses a new topic ID and Pol.is entity.
- Hosted Pol.is stays disabled until recorded vendor/privacy/security/CSP/retention gates clear; a site ID or embed snippet alone is not clearance.
- Preserve existing audit, privacy, evidence, revision, security, reset, aggregate immutability, exact-count suppression, and dual-mode isolation safeguards.
- Do not weaken tests or authorization to make CI pass.

## GitHub workflow

1. Confirm the preceding phase PR is merged and local `main` matches `origin/main`. If not, stop.
2. Review open PRs for overlapping files. Stop on unexpected overlap.
3. Create `v2/phase-[N]-[short-scope]` from current `main`; never push directly to `main` and never force-push.
4. Make reviewable commits. Keep migrations and their tests together; keep generated files consistent.
5. Run the phase’s targeted checks, then the repository checks required by `AGENTS.md` and `docs/v2/testing-strategy.md`.
6. Push the branch with the configured GitHub identity and open a **draft PR to `main`** using `.github/pull_request_template.md`. The cloud-agent identity needs branch/PR permission; CI itself remains read-only.
7. Wait for the stable `CI / required` check. Inspect all failures and Playwright artifacts. Fix causes without making security/privacy/a11y gates advisory.
8. Fill the PR with migrations/rollback, authority and privacy analysis, commands/results, screenshots when UI changed, open decisions, disabled features, and a no-production-data statement.
9. Mark ready only when acceptance criteria are met. Request human review and stop. Do not merge or begin Phase [N+1] without Council approval.

## Required final report

Return:

- branch, commits and PR URL;
- concise outcome and user-visible changes;
- migrations/backfill/rollback;
- institutional/authority/privacy/security/accessibility decisions;
- exact tests and CI results;
- screenshots/artifacts where applicable;
- open decisions, disabled features and known risks; and
- a declaration that only Phase [N] was implemented.

---

