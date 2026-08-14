# Commonhall v2 six-phase implementation plan

**Audience:** Cursor cloud-agent orchestrator and its phase subagents. This plan authorizes application changes only when the Council starts the corresponding phase. Each phase ends in its own reviewed PR.

## Global execution rules

- Read `AGENTS.md`, then every canonical v2 document listed in `docs/README.md` before planning.
- Treat `docs/v2/governance-state-machine.json` as executable institutional law. If narrative and JSON conflict, stop and propose a contract correction.
- Inspect current code/tests; preserve security, audit, privacy, evidence, revision, reset, and Public Input integrity work.
- Do not continue the old Phase 4.5B sequence. Old Phase 1–4 documents are historical context only.
- Complete/retain the report-integrity closure from PR #22 before enabling any live provider path.
- No live Pol.is, vendor credential, production account migration, organization default threshold, or legal claim without the relevant open decision.
- No elevated role can bypass formal review, self-appoint, promote based on preference, or inherit organization authority from a platform role.
- Use a dedicated subagent for each phase. The orchestrator first expands this plan into exact files, migrations, tests, risk controls, and rollback; it then gives that phase-specific plan to the subagent. Run phases sequentially.
- The phase subagent audits, implements, tests, documents, commits, pushes, and opens/updates that phase PR. The orchestrator reviews the diff and CI evidence before handing it to humans.

## Phase 1 — organization-scoped foundation and institutional kernel

### Goal

Create the tenancy and authority foundation without changing public claims or enabling live membership/provider behavior.

### Required work

1. Inventory all tables, repositories, capabilities, routes, fixtures, and tests that assume one institution.
2. Define service principals versus organization principals and the non-configurable constitutional floor.
3. Add organizations, configuration versions, organization membership/event skeleton, and organization-scoped appointments.
4. Introduce organization context into authorization and audit. Add database protections against cross-organization references.
5. Implement the composed v2 state-machine domain from the JSON contract, initially behind adapters/feature flags.
6. Build legacy state/fixture adapters; do not relabel old seats or alpha accounts as v2 authority.
7. Preserve and verify the Public Input report-integrity/concurrency/suppression fixes, including PR #22 if merged.
8. Add migration, rollback, seed, reset, backup, and negative isolation coverage.

### Exit criteria

- No organization repository/service has an unscoped default.
- Cross-tenant reads/writes fail at service and database layers.
- Service administrator cannot cast an organization action.
- State contract and existing security/privacy suites pass.
- Public UI remains honest about what is not yet v2 operational.

## Phase 2 — open community membership, profile, and the two-part Commons

### Goal

Open regular community enrollment and make informal participation useful while keeping elevated authority closed.

### Required work

1. Replace invite-only community activation with abuse-resistant open enrollment, versioned assent, recovery, rate limits, and an emergency enrollment switch. Keep staff/elevated invitation or approval separate.
2. Implement coarse, explainable organization matching; show assignment, inputs/categories used, correction/appeal, and append-only membership history.
3. Build profile and membership/history/privacy pages. Distinguish service community membership from nonprofit/statutory membership.
4. Build `/commons` with formal categories first, the exact unreviewed-content boundary, then informal topic proposals, approach proposals, general discussion, and honorable Disqualified Topics.
5. Implement discussion/proposal/link persistence, visibility, safe lineage, reports, rate limits, and accessible creation flows.
6. Implement independent safety and qualification reviews, conflicts/recusal, dual control where required, notices, appeals, and moderator calibration records.
7. Prove community enrollment grants no Chamber, Council, moderator, organization-admin, or service-admin capability.

### Exit criteria

- A new person can enroll, assent, receive an explained organization assignment, correct/appeal, and see membership history.
- They can participate informally and submit for formal review.
- Moderator UI contains no agreement/ideology field and cannot bypass criteria trace.
- Formal/informal ordering/disclaimer and phone/keyboard/a11y tests pass.
- Elevated membership remains disabled except existing tightly scoped test fixtures.

## Phase 3 — Public Agenda, canonical topic pages, and guarded Pol.is

### Goal

Move qualified topics through consultation and publish safe explanatory insights.

### Required work

1. Implement `/agenda` and canonical topic tabs: Overview, Evidence, Discussion, History.
2. Compose qualification, provider lifecycle, consultation close, accepted/disputed/inconclusive results, retention deadline, and honorable/dishonorable disposition.
3. Create a new provider entity for each newly qualified/successor topic; enforce one current entity per topic.
4. Wire the provided `data-site_id` as deployment configuration and topic-specific `PAGE_ID` as protected mapping. Never hard-code credentials or use XID.
5. Add consent-before-load, exact-origin/CSP, feature flag, kill switch, accessible failure state, and no-network tests while gates are unresolved.
6. Resolve the vendor/privacy/security open decisions before enabling hosted Pol.is. If unresolved, ship the complete disabled boundary and fixtures, not a partial live embed.
7. Preserve aggregate-only validation, immutable versioning, independent review/publication, exact counts, complementary suppression, current-conversation selection, and honest moderation disclosure.
8. Publish post-close insights for accepted, disputed, and inconclusive topics. Any map is aggregate geometry/density only with privacy review and no individual points.
9. Keep evidence quality and topic discussion independent from consultation popularity.

### Exit criteria

- No provider request occurs before explicit activation.
- Wrong origin/config/gate fails closed; provider outage does not corrupt state.
- Public projections contain no person/raw/provider-sensitive fields.
- Only community-accepted topics can enter the Chamber queue.
- Disputed/inconclusive retention and disqualification work from captured rule versions.

## Phase 4 — Chamber, Council Agenda, and public transparency

### Goal

Implement the visible institutional path from a community-accepted topic to public recommendations.

### Required work

1. Build public Chamber schedule, roster, appointment terms, conflicts, attendance, agenda, topic observer, evidence requests, amendments, verdict versions, minority reasoning, and complete roll calls.
2. Implement Council intake from both Chamber verdicts with the exact reason rules in the state contract.
3. Build Council schedule, roster, agenda, deliberation observer, recommendation versions, minority reports, action opportunities, and complete roll calls.
4. Enforce topic residency: Chamber topics remain in Public Agenda; Council acceptance moves them to Council Agenda; Council decline remains public until expiry.
5. Keep verdict publication transactional with a roster snapshot and explicit yes/no/abstain/recused/absent for every seat.
6. Attribute every body and decision to its organization, never the service nonprofit by default.
7. Build mobile/keyboard/screen-reader-friendly tables and timelines; publish timezones and method/rule versions.

### Exit criteria

- A public visitor can follow one complete seeded topic from closed consultation through Chamber, Council, and recommendations.
- Reason/override rules cannot be bypassed by API or direct service calls.
- Public rosters, schedules, conflicts, abstentions, recusals, votes, verdicts, and history are complete.
- Service/organization authority and cross-tenant tests remain green.

## Phase 5 — organization administration, elevated membership, and multi-organization readiness

### Goal

Only after regular membership and public institutions work, let organizations appoint elevated members and configure permitted local rules.

### Required work

1. Build the organization portal with scoped navigation, member search/minimal disclosure, appointment workflows, dual control, term/revocation history, recusals, and no self-grant.
2. Add versioned schedule/threshold/retention/quorum/appointment configuration validated against service constitutional minimums.
3. Add organization public profile, service area, schedule, rule versions, rosters, and contact/appeal routes.
4. Implement membership reassignment/transfer with notice, history, correction, and clear voting eligibility. Avoid exact-location storage where coarse region suffices.
5. Seed and test at least two organizations with adversarial cross-tenant IDs and different valid configurations.
6. Add public-record link/import between organizations through allowlisted projections only. Do not build cross-instance private federation yet.
7. Add capacity/health observability for enrollment, moderation, consultation, Chamber, and Council without political profiling.

### Exit criteria

- Organizations operate independently inside service minimums.
- Elevated appointments require organization authority, cannot self-grant, and are publicly auditable.
- Different valid configs produce captured, explainable results without changing old records.
- Cross-organization private access remains impossible in the full matrix.

## Phase 6 — migration, demo, legacy retirement, and launch evidence

### Goal

Complete the v2 experience, remove obsolete active contracts, and produce a credible live demonstration/open-community launch candidate.

### Required work

1. Migrate synthetic fixtures and only explicitly re-consented alpha accounts. Never silently convert old invites, seats, or provider entities.
2. Replace the old guided think-tank journey with a concise Commonhall journey covering enrollment, Commons, qualification, consultation insights, Chamber, Council, recommendations, and organization transparency.
3. Add measured redirects for old public URLs, then remove legacy services/components/tests only after parity and link checks pass.
4. Update all active UI, API, fixtures, accessibility names, metadata, emails, errors, docs, and test language from old Phase/think-tank terminology.
5. Run full unit/database/E2E/security/privacy/a11y/performance/backup/restore/reset suites and a production-like deployment rehearsal with synthetic data.
6. Resolve launch-blocking open decisions or keep the affected feature disabled with honest UI.
7. Produce the final handoff: architecture, data map, threat model, incident/runbook, operator ceremonies, service/organization capability matrix, migration/rollback, test evidence, and remaining risks.

### Exit criteria

- A live audience can enroll as community members and use the authorized pages.
- One complete synthetic journey and any authorized live paths are clearly distinguished.
- No active source/test/doc contract claims the old project model.
- `CI / required` is green; branch protection and operational review are complete.
- Human Council approval is recorded before production activation.

