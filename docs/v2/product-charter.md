# Commonhall v2 product charter

**Status:** Proposed v2 build contract, authorized for planning and implementation. This document supersedes the Phase 1–4 product goals. It is not legal, tax, trademark, vendor, or production-launch clearance.

**Working name:** Commonhall v2. Drop “v2” only after name, legal, and migration review. “Commonhall” is a working product name, not a claim of trademark availability.

## Mission

Build a public, nonpartisan digital town hall in which open community participation, structured consultation, bounded deliberation, and accountable councils can turn discussion into explainable recommendations without collapsing into simple majority rule, hidden oligarchy, or algorithmic government.

The project explores computational democracy: computation should make participation legible, privacy-preserving, scalable, and auditable. It must not decide what is true, infer ideology, award political authority, or substitute popularity for evidence.

“Free populism” is an exploratory design analogy: participation and ideas should be able to enter freely, while published rules, plural institutions, evidence review, due process, and transparent authority constrain capture. It is not a claim of a settled political doctrine or a guarantee that software can eliminate power imbalances.

## The institutional promise

Commonhall separates powers and signals that ordinary social products often collapse:

| Concern | Responsible mechanism | Must never become |
| --- | --- | --- |
| Open participation | Community membership and Informal Commons | A hidden invite-only club |
| Safety and qualification | Viewpoint-neutral moderation and published criteria | Ideological approval |
| Preference | Structured consultation | Proof or a population mandate |
| Evidence | Sourced review with limitations and counterevidence | A popularity score |
| Community judgment | Accepted, disputed, or inconclusive consultation result | An automatic institutional decision |
| Elevated deliberation | Public Chamber | An invisible expert veto |
| Organization decision | Public Council agenda and roll call | Nonprofit or platform fiat |
| Service integrity | Constitutional minimums and audit | Power to cast organization votes |

Algorithms organize, summarize, check published thresholds, and expose anomalies. Named humans and bodies exercise institutional authority through versioned, public records.

## Product areas

1. **Commons** — formal categories first; informal categories after an unreviewed-content disclaimer.
2. **Public Agenda** — every qualified topic from consultation through its Chamber disposition, including disputed and inconclusive topics during their retention window.
3. **Chamber** — public, capacity-limited deliberation by organization-appointed members, ending in an accepted or disputed verdict.
4. **Council Agenda** — topics the organization Council accepts for public deliberation and recommendations.
5. **Records** — histories, votes, abstentions, recusals, rationales, revisions, qualification traces, and published consultation insights.
6. **Community portal** — open enrollment, profile, organization assignment, membership history, contributions, notifications/preferences when later approved, and privacy controls.
7. **Organization portal** — later-phase administration for schedules, locally configurable criteria, appointments, recusals, and public rosters within service-wide minimum rules.

## Membership and authority

- Community membership opens before elevated membership. In product language it means membership in a participating organization’s Commonhall community, not statutory membership in the service nonprofit.
- A global account may hold a chronological sequence of organization memberships. Exactly one primary organization is active for organization-scoped participation unless a future policy explicitly authorizes more.
- Initial organization matching uses the least precise location needed, published availability rules, and an explainable deterministic policy. It must not use consultation responses, ideology, or hidden behavioral profiles. Show the assignment and an appeal/correction path.
- Chamber and Council seats are explicit, time-bounded organization appointments. They are never inferred from a platform role, employment, donation, community activity, or another seat.
- The service nonprofit maintains software and service-wide safeguards. It cannot vote, deliberate, or appoint on behalf of an independent organization except through an openly recorded organization role granted under that organization’s rules.
- Service administrators and organization officers are different principals and capabilities. Emergency service action is narrow, logged, reviewable, and cannot fabricate an organization decision.

## Organization independence and federation

The first production architecture may host several organizations in one service, but every organization-owned row, authorization decision, schedule, rule version, roster, and audit entry is organization-scoped. Private data is not federated.

Organizations may configure schedules, participation thresholds, qualification rules, retention periods, and appointment procedures only inside versioned service constraints. They may never disable the community standards, privacy floor, accessibility floor, public roll-call requirement, appeals, conflict disclosure, or separation of platform and organization authority.

Cross-organization exchange uses allowlisted, versioned public projections or explicit link records. It does not provide cross-tenant database access. A later separately deployed instance must use the same boundary: public data sharing is opt-in and authenticated; private membership and consultation records stay local.

## Growth and launch order

Growth is a product requirement, but acquisition must not outrun safety, capacity, or honesty.

1. Ship a clear live demonstration and open community enrollment.
2. Make informal participation useful before requiring topic qualification.
3. Publish moderation capacity and expected review times; throttle formal submissions if review capacity is exceeded rather than silently lowering standards.
4. Integrate Pol.is consultation behind explicit privacy/security gates and an organization-level feature flag.
5. Add elevated membership and organization administration only after regular accounts, scoping, audit, and public process work.
6. Add organizations gradually, with isolation tests and a public service-status posture.

Growth metrics must measure healthy participation, completion, return, breadth, moderation latency, appeals, and institution throughput. Do not optimize outrage, time-on-site, or ideological engagement.

## Pol.is role and privacy boundary

Pol.is is a consultation instrument, not the institution. The provided embed configuration establishes a candidate site identifier, but each qualified topic needs a distinct configured page/conversation identifier and a documented mapping.

- Load `https://pol.is/embed.js` only after the visitor receives the third-party disclosure and activates consultation.
- Allow only the exact approved origin in CSP and runtime validation.
- Never place provider credentials, exports, individual responses, XIDs, or political profiles in public projections, logs, analytics, URLs, or agent prompts.
- Commonhall imports only a validated aggregate report. Provider-native raw data is not a product database.
- After consultation closes, publish allowlisted insights for accepted, disputed, and inconclusive outcomes.
- If a map is shown, render aggregate geometry or density only: no person-level dots, hover identities, response reconstruction, or small cells.
- A disqualified topic is immutable and dead. A successor may link it but receives a new Commonhall topic ID and a new Pol.is entity.
- An honorable archive may retain its already-published safe aggregate report. Dishonorable removal suppresses unsafe public content and follows protected deletion/audit rules.

Live hosted use still requires a recorded vendor/data-processing decision, security review, retention/deletion plan, CSP acceptance, and an explicit activation record. The site identifier alone does not clear those gates.

## Topic experience

Every qualified topic page starts with stable topic facts and the current institutional state. It then exposes four first-class tabs:

1. **Overview** — question, scope, organization, stage, dates, criteria trace, current actors, next decision, and representation limitations.
2. **Evidence** — claims, sources, quality status, limitations, conflicts, and counterevidence; never reordered by consultation popularity.
3. **Discussion** — linked formal and informal conversations and a clearly scoped “start linked discussion” action.
4. **History** — immutable transitions, rule versions, consultation publication, moderation reason categories, Chamber/Council records, and topic lineage.

## Non-negotiable safeguards

- Viewpoint-neutral procedural moderation and appeal.
- No direct promotion of a pre-qualification topic by an elevated role.
- No self-appointment or self-elevation.
- No preference-based evidence grading or personalized political ranking.
- No public person-level consultation data.
- No hidden cross-organization access or writes.
- No Council override without the reason rule in the governance contract.
- Public Chamber/Council rosters, schedules, positions, abstentions, recusals, and verdict versions.
- Keyboard access, readable mobile layouts, plain language, timezone-aware dates, and reduced-motion support.
- Synthetic fixtures and production data are unmistakably separated.
- Claims of representation, legal status, nonprofit control, or democratic legitimacy require evidence and review.

## Success for the first live iteration

A visitor can understand the full process without a presenter. A person can create an account, accept the enforceable community standards, receive an explained organization assignment, see membership history, participate informally, and follow a qualified topic. The public can inspect a complete synthetic or authorized live path through consultation, Chamber, Council, and recommendations. Elevated permissions remain organization-issued and auditable.

## Canonical references

- [Governance lifecycle](./governance-lifecycle.md)
- [Machine-readable state contract](./governance-state-machine.json)
- [Community standards and moderation](./community-standards.md)
- [Architecture](./architecture.md)
- [Six-phase implementation plan](./implementation-plan.md)
- [Testing strategy](./testing-strategy.md)
- [CI and pull-request workflow](./ci-pr-workflow.md)
- [Open decisions](./open-decisions.md)

