# Commonhall v2 architecture

**Status:** Target architecture and migration contract. Preserve proven Phase 2–4 security/privacy primitives, but do not preserve obsolete product authority or route names merely for compatibility.

## 1. Baseline assessment

The repository is not a clean slate. It already has useful foundations:

- Next.js App Router, TypeScript, React, Tailwind, Vitest, Playwright, and axe;
- PostgreSQL/Drizzle migrations and transaction-oriented services;
- Auth.js invitation, lifecycle, assent, verification, pseudonym, privacy, audit, and reset work;
- topic/evidence/revision/moderation services with public projections;
- an institutional Public Input lifecycle, aggregate-only report schema, immutable publication intent, and complementary small-cell suppression;
- dual public-demo/gated isolation and extensive synthetic fixtures; and
- server-enforced capability checks with council appointments separated from platform roles.

The gaps are structural:

- invite-only activation conflicts with open community enrollment;
- accounts, authority, topics, appointments, rules, and audit are not rooted in an organization tenancy model;
- current `deliberation_council` / `policy_council` language does not implement Chamber → organization Council intake;
- the Commons is informal-only and does not expose the required formal/informal information architecture;
- topic and Public Input state machines are separate but not composed into the v2 institutional lifecycle;
- public routes reflect the old think-tank journey;
- no organization profile/configuration, assignment history, elevated-member approval portal, or federation boundary exists; and
- tests assert disabled enrollment and old route/status language.

Therefore: evolve the codebase. Do not restart security, privacy, audit, evidence, or report-integrity work. Replace the institutional model behind explicit migrations and adapters.

## 2. Bounded contexts

| Context | Owns | Does not own |
| --- | --- | --- |
| Identity | global account, authentication, recovery, privacy requests | organization authority |
| Organizations | organization, service status, configuration versions, region/service area | global platform administration |
| Membership | community membership, organization assignment/history, status | Chamber/Council seat inference |
| Commons | discussions, proposals, links, formal/informal category projection | topic qualification state |
| Moderation | safety cases, qualification review, appeals, recusals | political agreement or agenda priority |
| Topics | canonical topic, evidence, lineage, composed institutional state | raw provider data |
| Consultation | provider mapping, lifecycle, aggregate import/publication | evidence quality or institution verdict |
| Chamber | appointment roster, schedule, deliberation, verdict, roll call | Council decision |
| Council | intake, agenda, deliberation, recommendations, roll call | service nonprofit authority |
| Records | allowlisted public projections, versioned history, transparency | private operational notes |
| Federation | signed/versioned public projection exchange and links | private tenant replication |

Each context exposes server-side services. Route handlers and React components do not write Drizzle tables directly.

## 3. Principal and tenancy model

Every authorization decision receives:

```text
principal account + platform capabilities + organization context
  + organization membership + organization appointment(s)
  + resource organization + applicable rule version
```

Rules:

1. Global accounts are not organization members automatically until an assignment event succeeds.
2. Every organization-owned table has `organization_id` and organization-scoped uniqueness.
3. Foreign keys between organization-owned resources are composite or guarded so cross-organization references fail at the database boundary, not just in TypeScript.
4. Repository functions require organization context; no “list all” default exists for organization data.
5. Service operators can administer uptime, abuse emergencies, and tenant lifecycle through separate capabilities. They cannot use organization mutation services without an organization appointment.
6. Chamber/Council appointment rows are independent, time-bounded, issuer-recorded, non-self-grantable, and organization-scoped.
7. Public IDs are opaque. Internal account IDs and provider mappings do not appear in public DTOs.
8. Audit events include organization, actor principal kind, capability, resource, rule/method version, reason, request correlation, and public/protected projection class.

Before adding multiple organizations, write negative cross-tenant tests for every repository/service and direct SQL constraints for high-impact tables.

## 4. Data model target

Exact table names may change after Phase 1 discovery, but the concepts and constraints are required.

### Identity and membership

- `organizations`
- `organization_service_areas`
- `organization_config_versions`
- `organization_memberships`
- `organization_membership_events` (append-only assignment, activation, transfer, suspension, closure)
- `organization_appointments` (Chamber, Council, clerk, moderator roles; independent rows)
- `appointment_conflicts_and_recusals`

Community enrollment is an account flow. Elevated appointment is a later organization-admin flow. Never add a `high_level_member: boolean` shortcut.

### Commons and moderation

- `discussions` with `organization_id`, category, formal status, visibility, author, and safe lineage
- `discussion_topic_links`
- `topic_proposals` / `approach_proposals` or one typed proposal table
- `qualification_reviews` with rule version and criteria trace
- `moderation_cases`, `moderation_decisions`, `moderation_appeals`, reviewer recusals

Safety state and qualification state are different columns/records. “Formal” is a projection that requires both allowed visibility and successful qualification/category rules.

### Topics and institutions

- canonical topics retain evidence/revision primitives and gain organization scope;
- one composed state event stream conforms to `governance-state-machine.json`;
- provider conversations remain separate entities with exactly one current conversation per topic at a time;
- `chamber_sessions`, `chamber_agenda_items`, `chamber_verdict_versions`, `chamber_roll_calls`;
- `council_sessions`, `council_intake_decisions`, `council_agenda_items`, `council_recommendation_versions`, `council_roll_calls`;
- retention deadlines are captured when a state is entered using the applicable rule version, so a later config change does not rewrite the deadline.

Roll-call rows use explicit `yes | no | abstain | recused | absent`; absence is not coerced to abstention. Verdict/recommendation publication happens transactionally with a complete roster snapshot.

## 5. Organization configuration

Configuration is versioned data, not mutable environment variables. A config version may define:

- qualification criteria extensions;
- consultation opening/closing schedule and thresholds;
- disputed/inconclusive retention windows;
- Chamber size, schedule, quorum, decision rule, and appointment procedure;
- Council schedule, quorum, intake and recommendation rules; and
- locally permitted Commons categories or labels.

The service validates every version against non-configurable constitutional minimums: community standards, viewpoint neutrality, public roll calls, conflicts/recusals, appeal, privacy/suppression, audit, accessibility, no self-elevation, and tenant isolation. Published decisions store the config version they used.

## 6. Pol.is integration boundary

The current aggregate-only Public Input code is the starting point. Complete the open report-integrity PR before live use, then adapt it under organization scoping.

### Embed

The candidate hosted embed is:

```html
<div
  class="polis"
  data-page_id="PAGE_ID"
  data-site_id="polis_site_id_NKQvXgIf5NkiaHeocv">
</div>
<script async src="https://pol.is/embed.js"></script>
```

Treat `PAGE_ID` as a per-topic public provider mapping, never a reusable constant. Store the site identifier in deployment configuration and the page mapping in the protected conversation record. Do not put provider admin credentials in `NEXT_PUBLIC_*` variables.

Render the embed through one client component that:

1. shows a clear third-party/privacy notice before any provider request;
2. loads the exact `https://pol.is/embed.js` URL only after activation;
3. uses a nonce/integrity posture supported by the security review and a narrow CSP;
4. rejects an unexpected origin, query credential, malformed page ID, or unresolved organization feature flag;
5. exposes an accessible unavailable/failure state; and
6. never sends Commonhall account ID, organization role, location, ideology, or an XID unless a later privacy decision explicitly changes the contract.

### Import and publication

- Provider access is operational and least-privilege.
- Commonhall accepts a versioned, validated aggregate-only canonical report.
- Immutable content hash covers every public report field.
- Import, review, and publish are separate capabilities and auditable actions.
- Published reports select the current consultation, use exact counts, complementary suppression, and a production-reviewed reporting floor.
- Public DTOs are allowlists. They omit provider mapping, raw exports, staff notes, storage paths, and individual data.
- Aggregate insight publication begins after close and is independent of accepted/disputed/inconclusive outcome.
- Map UI uses post-processed aggregate geometry, never provider participant points.

Hosted Pol.is remains feature-flagged off until the vendor, privacy, CSP, deletion/retention, incident, and operational gates in the v2 open-decision register are resolved. The integration phase may wire and test the disabled boundary before activation.

## 7. Public and authenticated routes

Unauthenticated (pre-alpha V2-21):

```text
/
/demo
/demo/...          (synthetic process tour only)
/join              (create account in gated mode; explanation in public-demo)
/auth/sign-in
/auth/error
/auth/accept       (staff/bootstrap invite only)
```

Authenticated member routes (account required; URL is never authorization):

```text
/commons
/commons/discussions/[id]
/agenda
/agenda/topics/[slug]?tab=overview|evidence|discussion|history
/chamber
/chamber/topics/[slug]
/council
/council/topics/[slug]
/records
/account
/account/profile
/account/membership
/account/history
/account/privacy
/member/discussions
/member/proposals
```

Unauthenticated product, account, and legacy think-tank paths redirect (V2-21 pre-alpha, not production public-observer law):

- public-demo → `/`
- gated → `/auth/sign-in`

Authenticated legacy paths map onto member placeholders or the demo: `/idea-commons` and `/formal-topics` → `/commons`; `/deliberation` → `/chamber`; `/decisions` → `/council`; `/transparency` and `/actions` → `/records`; `/topics` → `/agenda`; `/process` → `/demo`; `/about` → `/`. Remove remaining duplicates in Phase 6.

Elevated organization portal (Phase 5 seed / later expansion):

```text
/org/[organizationSlug]/moderation
/org/[organizationSlug]/chamber
/org/[organizationSlug]/council
/org/[organizationSlug]/memberships
/org/[organizationSlug]/settings
```

The URL is never authorization. Every loader/action resolves the organization and calls an organization-scoped service. Community membership does not open elevated portal routes.

## 8. Public projections and federation

Public pages read purpose-built allowlisted projections. A projection carries schema version, source organization public ID, record ID/version, publication time, method/rule versions, and a content hash. Protected records are transformed before caching, search indexing, federation, or logging.

Federation is deferred until the single-service multi-organization model passes isolation testing. Its first capability is link/import of public records, not remote account login or shared private data. Remote content is attributed to its source, remains immutable by the receiving organization, and can be locally linked without pretending to be locally qualified.

## 9. Migration rules

- Add new schema alongside old reads; backfill only synthetic/demo records first.
- Use explicit adapters from legacy Phase 4 fixtures/states into v2 public projections.
- Do not relabel old `policy_council` appointments as organization Council authority without a reviewed migration event.
- Do not migrate alpha users into open community membership without new assent and organization assignment.
- Do not reuse provider conversations for successor/disqualified topics.
- Preserve audit, revision, evidence, report hashes, privacy operations, and reset semantics.
- Old routes receive measured redirects only after v2 route parity tests pass.
- Remove legacy code and tests in Phase 6, never by weakening assertions mid-migration.

## 10. Observability and privacy

Log institutional event IDs and safe reason codes, not post bodies, consultation statements/responses, exact location, provider URLs, or sensitive identity data. Metrics are organization-scoped and privacy reviewed. No advertising, behavioral ranking, or political analytics SDKs.

Backups, export, deletion, incident response, and alpha reset must understand organization scope and provider boundaries. A local deletion must never claim remote provider deletion without verified execution.

## 11. Decisions intentionally deferred

Exact thresholds, hosted versus self-hosted Pol.is, final product name, statutory membership implications, regional matching inputs, federation protocol, and production retention values remain open. Implement interfaces and fail-closed states; do not invent final values. See [open-decisions.md](./open-decisions.md).

