<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Commonhall v2 agent operating rules

Commonhall v2 is a proposed computational-democracy digital town hall. The active product contract supersedes the old Open-Source Think Tank Phase 1–4 scope.

## Required reading and planning

Before editing:

1. Read `docs/README.md` and follow its canonical order.
2. Read the authorized phase in `docs/v2/implementation-plan.md`.
3. Inspect current source, migrations, tests, git status/history, and open PRs for every affected path.
4. Restate user journeys and acceptance criteria.
5. Propose exact files, migration/backfill/rollback, tests, feature flags, and PR commit sequence.
6. Identify organization/service authority, privacy, security, moderation, legal-language, accessibility, and operational assumptions.
7. List relevant entries from `docs/v2/open-decisions.md`; do not silently choose production values.

`docs/v2/governance-state-machine.json` is executable institutional law. Narrative may explain it but not create an untested shortcut. If canonical documents conflict, stop and propose a correction.

## Documentation authority

- Active: `docs/product-charter.md` and the v2 documents indexed by `docs/README.md`.
- Operational safeguards to carry forward: current threat, incident, secrets/operations, privacy, data-map, reset, capability, and provider-assessment documents until replaced.
- Historical: Phase 1–4 plans, handoffs, architecture files, MVP plan, and ADRs 0001–0021. They explain existing code but do not authorize the old product sequence.
- Preserve the report-integrity work from PR #22 or its merged result. The v2 reset does not waive privacy/integrity defects.

## Institutional invariants

- Open community membership precedes elevated membership. Community membership never implies moderator, Chamber, Council, organization-admin, service-admin, nonprofit, or statutory authority.
- Service/platform roles and organization authority are separate principals and capabilities.
- Every organization resource and decision is organization-scoped. Repository/service/API/database tests must deny cross-organization access.
- Chamber and Council appointments are explicit, independent, time-bounded, organization-issued, non-self-grantable, and auditable.
- Moderation judges behavior, safety, completeness, and published criteria—not viewpoint, ideology, popularity, or moderator agreement.
- Safety and qualification are independent records. Formal status means criteria were checked, not that content is endorsed.
- No actor can decide their own proposal, conflict, appeal, appointment, or role grant.
- No elevated actor can directly promote a pre-qualification topic or alter consultation metrics based on preference.
- Preference, cross-group agreement, evidence quality, community outcome, Chamber verdict, Council recommendation, and action remain separate axes.
- Algorithms organize, validate, summarize, and apply published rules. Named humans/bodies make institutional decisions.
- Council reason rules, Public Agenda residency, dead-topic behavior, and disqualification visibility must match the state contract exactly.
- Every Chamber/Council seat records yes, no, abstain, recused, or absent. Do not infer one from another.

## Privacy and provider invariants

- Production participant data never enters prompts, fixtures, logs, screenshots, traces, test artifacts, or the repository.
- Public projections are explicit allowlists. Never expose raw/individual consultation data, XIDs, provider mappings, storage paths, staff notes, identity/verification artifacts, exact private location, or inferred ideology.
- Evidence quality never changes from a consultation result.
- Hosted Pol.is remains fail-closed until the v2 vendor/privacy/security/CSP/retention/deletion/incident gates are recorded as resolved and activation is explicitly authorized.
- A site ID or embed snippet is configuration, not vendor/privacy approval. No provider request occurs before the visitor activates the disclosed third-party surface.
- Exact origin matching only. No suffix matching, query credentials, wildcard CSP, or undocumented provider behavior.
- Aggregate publication uses validated versions, immutable content, exact counts, complementary suppression, reviewed reporting floors, and the current consultation only.
- If a map is displayed, use aggregate geometry/density only; never participant points, hover identities, or reconstructible small cells.
- A successor/disqualified topic always receives a new topic ID and provider entity.
- Local deletion/reset never claims remote provider deletion without verified execution.

## Engineering rules

- Complete only the authorized phase/checkpoint.
- Preserve stronger existing security/privacy behavior while migrating old product concepts.
- Add new schema/services alongside adapters; do not relabel old accounts, seats, votes, or provider entities as v2 authority.
- Route handlers and components call organization-scoped services; they do not write tables directly.
- Default deny. The URL, client state, or hidden control is never authorization.
- Keep public-demo synthetic and gated/authorized data unmistakably separated until Phase 6 retires the old lane.
- Do not add analytics, ads, AI political ranking, payments, identity vendors, hosted databases, email vendors, or live provider calls without an approved decision and phase.
- Do not claim incorporation, tax status, counsel clearance, representation, statutory membership, government authority, or production readiness without recorded evidence.
- Use plain language, timezone-aware dates, mobile-first layouts, keyboard operation, semantic controls, reduced motion, and tested focus behavior.
- Do not weaken a test, type, database constraint, access check, or acceptance criterion to make CI pass.

## Phase-subagent rule

The implementation orchestrator creates one dedicated subagent per authorized phase. Before delegation, the orchestrator expands the six-phase plan into exact journeys, files, migrations, rollback, authority/privacy risks, tests, commits, and PR evidence. It passes that detailed plan and the canonical reading order to the phase subagent. Phases run sequentially; do not run phase subagents concurrently against the same worktree or let a phase subagent start the next phase.

## GitHub and completion

1. Start from current `main` only after the preceding phase PR merges.
2. Check open PRs for overlap.
3. Create `v2/phase-<n>-<scope>`; never push directly to `main` or force-push.
4. Commit reviewable units, push, and open/update a draft PR using `.github/pull_request_template.md`.
5. Run targeted checks and the full required phase suite. Wait for `CI / required` and inspect failures/artifacts.
6. Report changed files, migrations/backfill/rollback, commands/results, screenshots for UI, privacy/security/accessibility analysis, open decisions, disabled features, and shortcuts/placeholders.
7. State that no production participant data entered development artifacts.
8. Request human approval and stop. Do not merge or begin another phase unless explicitly authorized.

