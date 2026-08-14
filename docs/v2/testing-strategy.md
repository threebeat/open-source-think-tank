# Commonhall v2 testing strategy

Tests are institutional safeguards, not only implementation checks. Every state transition, authority boundary, privacy projection, and public explanation needs a positive test and a negative/abuse test.

## Test layers

1. **Contract** — machine-readable state graph, canonical-doc links, configuration floors, transition reason rules. Fast; always required, including docs-only PRs.
2. **Unit/domain** — pure transition logic, threshold snapshots, reason requirements, projection allowlists, assignment policy, expiry calculation.
3. **Database** — organization constraints, composite foreign keys, immutability, concurrency, current-conversation uniqueness, complete roll-call publication.
4. **Service/API** — deny-by-default capabilities, organization context, no self-elevation, moderation/appeal separation, provider activation gates.
5. **Component** — formal/informal disclaimer, topic tabs, state/rationale labels, consent-before-embed, roll-call semantics.
6. **E2E** — visitor, community member, moderator, Chamber clerk/member, Council clerk/member, organization admin, and service operator journeys at desktop and phone widths.
7. **Security/privacy** — cross-tenant matrix, IDOR, origin/CSP, logs/exports/URLs, small-cell/reconstruction, provider outage, deletion claims.
8. **Accessibility** — axe plus keyboard, focus, zoom/text resize, reduced motion, screen-reader names, tables/roll calls, live validation, and third-party fallback.

## Mandatory invariants

- An informal proposal cannot jump to Public Agenda, Chamber, or Council.
- Moderator agreement/disagreement cannot be recorded as qualification input.
- A moderator cannot decide their proposal, conflict, restriction appeal, or self-appointment.
- Only community-accepted topics automatically enter the Chamber.
- A Council decline of a Chamber-accepted verdict and acceptance of a Chamber-disputed verdict require reasons.
- A Council Agenda transition removes the topic from Public Agenda; Chamber states keep it there.
- Disputed and inconclusive topics remain visible until the captured retention deadline.
- Honorable disqualification is publicly discoverable in Informal Commons; dishonorable content is not.
- A successor topic gets a new topic ID and provider conversation.
- Evidence status is unchanged by consultation outcomes.
- Public reports omit people, raw votes, XIDs, provider mappings, storage paths, moderator notes, and small cells.
- The provider script makes no request before explicit activation and fails closed on wrong origin/config/gate.
- Every organization service denies cross-organization reads/writes even when IDs are guessed.
- Service admins cannot cast organization votes; organization admins cannot gain service capabilities.
- Community enrollment does not grant Chamber/Council authority.
- Every Chamber/Council member has one explicit position: yes, no, abstain, recused, or absent.
- All public times show timezone; stored times are unambiguous.

## Existing suite disposition

Do not delete the current 123 tests wholesale. Classify them during Phase 1:

| Existing area | v2 treatment |
| --- | --- |
| Auth, privacy, assent, audit, CSRF, origin, rate-limit, bounded JSON | Preserve and organization-scope |
| Evidence, revisions, verification, moderation, report integrity/suppression | Preserve and adapt terminology/tenancy |
| Public-demo isolation and synthetic fixtures | Preserve until Phase 6 demo replacement proves parity |
| `join` tests that require disabled/uninvited enrollment | Replace in Phase 2 with open-enrollment abuse and assent coverage |
| `idea-commons`, `formal-topics`, `agenda`, `deliberation`, `decisions` UI tests | Migrate route-by-route to Commons/Public Agenda/Chamber/Council/Records |
| Phase-number assertions and old council role names | Replace when the corresponding domain migrates; never mass-search/replace without semantic review |
| Current Public Input report/concurrency tests, including PR #22 closure | Carry forward as prerequisites to live provider work |

Keep a compatibility test only while a redirect/adapter is intentionally supported. Mark its removal phase and issue. Do not use broad snapshots for governance wording.

## Phase acceptance suites

### Phase 1 — foundation

- state-contract tests green;
- organization schema isolation and migration rollback;
- legacy adapter characterization;
- service admin vs organization authority matrix;
- report-integrity closure retained.

### Phase 2 — landing, enrollment, authenticated shell

- unauthenticated visitor limited to `/`, `/demo`, auth pages;
- landing a11y, keyboard, Commonhall wordmark;
- gated enrollment: assent, password, duplicate/rate/honeypot/kill-switch;
- explained synthetic-org assignment, history, correction event;
- no elevated capability from community membership;
- public-demo mode still cannot construct a database or create accounts.

### Phase 3 — Commons and member posts

- formal/informal ordering and disclaimer;
- member can create a post; organization-scoped persistence;
- qualification/safety independence, conflict/recusal, no self-review;
- synthetic catalog hideable via `COMMONHALL_SYNTHETIC_SEED=off`;
- no elevated capability from posting.

### Phase 4 — Agenda, fixture consultation, member positions

- topic tabs and history;
- no `pol.is` network request; unavailable/fixture states;
- in-house agree/disagree/pass on synthetic statements;
- aggregate-only publication, exact-count suppression;
- only community-accepted topics enter the Chamber queue.

### Phase 5 — Chamber, Council, Records

- schedules, rosters, attendance, conflicts, complete roll calls;
- verdict/recommendation versioning and reason rules;
- Public Agenda residency and Council transfer;
- community member cannot self-appoint or vote a seat they do not hold;
- member a11y and mobile layout for tables/timelines.

### Phase 6 — legacy retirement and delivery

- old think-tank routes gone or hard-redirected;
- active tests match Commonhall architecture;
- backup/restore/reset by organization;
- `docs/v2/final_overview.md` lists vendor/legal holds;
- full browser/accessibility/security matrix.

## CI policy

The stable required check is `CI / required`. Contract checks always run. Runtime checks may skip only when classification proves every changed path is documentation/agent guidance/PR metadata; workflow, test, package, schema, config, or source changes always run the full matrix. See [ci-pr-workflow.md](./ci-pr-workflow.md).

