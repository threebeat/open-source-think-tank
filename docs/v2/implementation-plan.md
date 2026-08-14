# Commonhall v2 six-phase implementation plan

**Audience:** Cursor cloud-agent orchestrator and its phase subagents. Phase 1 is complete (PR #24). The Council has authorized completing Phases 2–6 to deliver **Commonhall** as the working product: a new landing (demo or sign-in), account-gated participation, synthetic data that can be disabled, and retirement of the old think-tank IA.

Each phase still ends in its own reviewed PR. The orchestrator uses one dedicated subagent per phase. Implementation subagents do not run concurrently against the same worktree. The orchestrator may write the next phase’s detailed plan while a phase subagent works, and may start the next subagent once the previous phase has pushed a PR.

## Global execution rules

- Read `AGENTS.md`, then every canonical v2 document listed in `docs/README.md` before planning.
- Treat `docs/v2/governance-state-machine.json` as executable institutional law. If narrative and JSON conflict, stop and propose a contract correction.
- Inspect current code/tests; preserve security, audit, privacy, evidence, revision, reset, and Public Input integrity work.
- Do not continue the old Phase 4.5B sequence. Old Phase 1–4 documents are historical context only.
- Report-integrity closure from PR #22 is already in `main` via Phase 1. Do not enable live Pol.is.
- No live Pol.is, email vendor, analytics SDK, identity vendor, or production numeric threshold without the relevant open decision. Pre-alpha Council directions below are **not** production settlements.
- No elevated role can bypass formal review, self-appoint, promote based on preference, or inherit organization authority from a platform role.
- Community enrollment never grants Chamber, Council, moderator, organization-admin, or service-admin capability.
- Use a dedicated subagent for each phase. The orchestrator expands this plan into exact files, migrations, tests, risk controls, and rollback, then gives that plan to the subagent.
- The phase subagent audits, implements, tests, documents, commits, pushes, and opens/updates that phase PR. The orchestrator reviews the diff and CI evidence.

## Council pre-alpha product directions (2026-08-14)

These are engineering authorizations for the pre-alpha Commonhall build. They do not close legal, vendor, or production decisions.

1. **Commonhall is the product.** The old Open-Source Think Tank public IA is retired by Phase 6. The main page is Commonhall: take the demo, or create an account / sign in.
2. **Unauthenticated visitors** may use `/`, `/demo`, and auth pages only. Product routes require an account (V2-21). The demo satisfies “a visitor can understand the full process without a presenter.”
3. **Easy enrollment** uses a local identifier + password. No outbound email until V2-18. Email verification is deferred (V2-22).
4. **Bot defense** is in-house rate limits, honeypot, minimum fill time, and duplicate-identifier rejection until a vendor is approved (V2-23).
5. **Signed-in members** use Commons, Agenda, Chamber, Council, and Records; they can create posts and participate on synthetic topics. Elevated seats remain appointment-only.
6. **Synthetic catalog** fills the service and can be disabled with `COMMONHALL_SYNTHETIC_SEED=off`. Operator reset remains the pre-alpha → alpha ceremony.
7. **Hosted Pol.is stays disabled.** Fixture/unavailable consultation only.
8. Working name remains **Commonhall v2** in legal-adjacent copy (V2-01). UI may say Commonhall.

## Phase 1 — organization-scoped foundation and institutional kernel

**Status:** Complete (PR #24, merged).

Tenancy, constitutional floor, service-vs-organization authority, governance kernel, PR #22 integrity, and isolation tests are in `main`. Do not re-implement Phase 1.

## Phase 2 — Commonhall landing, easy enrollment, and authenticated shell

### Goal

Make Commonhall look and behave like a new application: a public landing that offers a demo or an account, working sign-in, and an authenticated shell. Product routes are account-gated. Elevated authority stays closed.

### Required work

1. Restyle the public surface (wordmark, metadata, header/footer, color/type) as Commonhall. Landing `/` offers **Tour the demo** and **Create an account / Sign in**.
2. Rebuild `/demo` as a self-contained synthetic process tour (Commons → qualification → consultation → Chamber → Council → records). No account required. Honest about what is fixture vs live.
3. Replace invite-only community activation with gated-mode open enrollment: identifier + password, versioned community-standards assent, explained assignment to the synthetic primary organization, recovery/kill switch, rate limits, honeypot, minimum fill time. Keep staff/bootstrap invitation separate.
4. Working sign-in (password) establishing an Auth.js session. No outbound email. Emergency enrollment switch `COMMONHALL_V2_OPEN_ENROLLMENT`.
5. Gate product routes: unauthenticated requests to Commons, Agenda, Chamber, Council, Records, account, and old think-tank URLs redirect to sign-in (or `/demo` where the URL is explicitly a demo alias).
6. Authenticated shell navigation: Commons, Agenda, Chamber, Council, Records, Account. Phase 2 may show honest placeholders for areas that Phase 3–5 implement, except account/profile/membership/privacy which must work.
7. Profile, membership history, assignment explanation, correction/appeal path, privacy controls. Copy: community membership is not nonprofit/statutory membership.
8. Prove enrollment grants no Chamber, Council, moderator, organization-admin, or service-admin capability.
9. Public-demo `APP_MODE` remains database-free: landing + demo only; account creation fails closed.

### Exit criteria

- Unauthenticated visitor: landing, demo, and auth pages only; a11y/keyboard pass.
- Gated visitor can create an account, assent, sign in, see assignment, and use the member shell.
- Duplicate/rate/honeypot/kill-switch abuse cases fail closed.
- Community member cannot exercise elevated capabilities.
- Existing security/privacy/CSRF/audit suites still pass.

## Phase 3 — Commons, member posts, and synthetic participation seed

### Goal

Signed-in members can post and follow the two-part Commons. Synthetic topics/discussions fill the hall and can be disabled.

### Required work

1. Implement `/commons` with formal categories first, the exact unreviewed-content disclaimer, then informal topic proposals, approach proposals, general discussion, and honorable Disqualified Topics.
2. Persist discussions/posts/proposals/links with organization scope, visibility, safe lineage, reports, and rate limits. Accessible creation flows.
3. Members can create informal posts and submit a proposal for formal review (kernel `submit_for_formal_review`).
4. Independent safety vs qualification records; no ideology/agreement field; no self-review.
5. Seed a disableable synthetic catalog: discussions, proposals, and at least one topic lineage in `informal_draft` / `formal_review_pending` / later states as authorized by later phases.
6. Replace old `/idea-commons` and `/formal-topics` with redirects after member-route parity tests.

### Exit criteria

- Signed-in member can create a post and see it in Informal Commons.
- Formal/informal ordering and disclaimer tests pass on phone and keyboard.
- Enrollment still grants no elevated capability.
- `COMMONHALL_SYNTHETIC_SEED=off` hides synthetic catalog rows from member UI.

## Phase 4 — Agenda, topic pages, fixture consultation, member deliberation

### Goal

Members follow qualified synthetic topics through consultation using the fixture provider. Hosted Pol.is remains disabled.

### Required work

1. `/agenda` and `/agenda/topics/[slug]` with Overview, Evidence, Discussion, History.
2. Compose kernel states through consultation close (accepted / disputed / inconclusive) using **fixture** metrics snapshots labeled synthetic. No production threshold invention: synthetic config only, V2-07 remains open.
3. One current provider entity per topic; new entity for successors. Site ID is configuration; page ID is protected mapping. No XID.
4. Consent-before-load, exact-origin/CSP, kill switch, accessible unavailable state, no-network tests. Hosted embed never loads (V2-11–13).
5. Members can take positions on synthetic consultation statements through an **in-house** agree/disagree/pass control that writes only to Commonhall (not Pol.is). This is member deliberation on synthetic topics, not a live provider.
6. Preserve aggregate-only publication, exact counts, complementary suppression. Evidence quality stays independent of preference.
7. Redirect old `/formal-topics/[slug]` and `/topics` aliases after parity.

### Exit criteria

- No `pol.is` network request in tests.
- Members can open a synthetic topic, read tabs, and record a fixture-local position.
- Only `community_accepted` can enter the Chamber queue (kernel).
- Public projections omit people, raw votes, XIDs, provider mappings.

## Phase 5 — Chamber, Council, Records, and synthetic appointments

### Goal

Members can observe a complete seeded path from closed consultation through Chamber, Council, and recommendations. Synthetic appointments fill the bodies; members do not self-appoint.

### Required work

1. Member routes `/chamber`, `/council`, `/records` with schedules, rosters, conflicts, attendance, roll calls (`yes|no|abstain|recused|absent`), verdict/recommendation versions, minority reasoning, timezones.
2. Council intake reason rules exactly as in the JSON contract.
3. Topic residency: Chamber stays on Public Agenda; Council acceptance leaves it; decline remains until captured retention (null retention = no auto-expiry; V2-08).
4. Seed synthetic Chamber/Council appointments and a complete fixture journey. Dual-control/no self-grant remains. A later operator reset wipes these with other alpha rows.
5. Minimal organization settings needed to publish fixture config versions (constitutional floor). Full multi-org portal can stay thin; two synthetic orgs already exist from Phase 1.
6. Enable kernel Chamber/Council transitions **only** for synthetic fixture playback and appointed clerks in gated tests — still not a production appointment policy (V2-09/10). Live flags may turn on for synthetic-seeded bodies inside gated mode; hosted Pol.is stays off.

### Exit criteria

- A signed-in member can walk one seeded topic from consultation through recommendations.
- Reason rules cannot be bypassed.
- A community member still cannot appoint themselves or cast a Chamber/Council seat they do not hold.
- Cross-tenant tests remain green.

## Phase 6 — legacy retirement, test-suite rewrite, reset, and delivery evidence

### Goal

Commonhall is the only active product surface. Legacy think-tank routes, copy, and duplicate tests are gone. Reset is ready for pre-alpha → alpha. Vendor/legal holds are explicit.

### Required work

1. Remove or hard-redirect remaining old routes (`/idea-commons`, `/formal-topics`, `/deliberation`, `/decisions`, `/process` think-tank copy, old home). No duplicate handlers.
2. Rewrite the active test suite to the Commonhall architecture: landing/demo, enrollment/abuse, Commons, Agenda, Chamber, Council, Records, isolation, privacy, a11y. Delete obsolete think-tank assertions only after replacements are green.
3. Operator reset classified for every new table; `COMMONHALL_SYNTHETIC_SEED` documented; pre-alpha → alpha runbook updated.
4. Produce `docs/v2/final_overview.md` for the Council: what shipped, how to run it, synthetic disable, reset, and **every vendor/legal hold**.
5. Full `CI / required` green. No production participant data in artifacts.

### Exit criteria

- Unauthenticated: Commonhall landing + demo only.
- Authenticated: members post and follow the synthetic institutional journey.
- No active source/test/doc contract claims the old think-tank product.
- Vendor holds (email, Pol.is DPA/CSP, matching, thresholds, counsel terms) are listed, not silently marked done.

## Orchestrator pipeline for Phases 2–6

1. Expand the phase into a detailed plan (journeys, files, migrations, tests, flags, open decisions).
2. Create `v2/phase-<n>-<short-scope>` from current `main` if the previous phase PR has merged; otherwise stack on the previous phase branch and say so in the PR.
3. Run one phase subagent. Do not start another implementation subagent on the same worktree.
4. While it works, write the next phase’s detailed plan.
5. When the subagent has pushed a PR, the orchestrator reviews, then starts the next phase subagent.
6. After Phase 6 CI is green, write `docs/v2/final_overview.md` if not already complete, request human review, and stop. Do not merge to production activation without Council sign-off.
