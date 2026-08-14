# Architecture — Phase 4 (computational democracy)

**Status:** Work Package **4.5A** active (Phase 4.4 integrity remediation). Phase 4.1–**4.3** owner-approved complete (PR #17 / #18 / #19). Phase **4.4** engineering merged (PR #20) but **not owner-accepted** until 4.5A closes P0/P1 integrity defects. Builds on [architecture-phase-3.md](./architecture-phase-3.md) and Phase 2 dual-mode isolation.  
**Related:** [phase-4-plan.md](./phase-4-plan.md), [public-input-provider-assessment.md](./public-input-provider-assessment.md), [ADR 0010](./decisions/0010-computational-democracy-pipeline.md), [ADR 0011](./decisions/0011-idea-commons-formal-pipeline-separation.md), [ADR 0012](./decisions/0012-public-input-provider-boundary.md), [ADR 0013](./decisions/0013-canonical-formal-topic-page.md), [ADR 0014](./decisions/0014-institutional-conversation-lifecycle.md), [ADR 0015](./decisions/0015-progressive-evidence-disclosure.md), [ADR 0016](./decisions/0016-provider-embed-activation-exact-origin.md), [ADR 0017](./decisions/0017-local-versus-remote-reset-semantics.md), [ADR 0018](./decisions/0018-aggregate-only-canonical-import-format.md), [ADR 0019](./decisions/0019-immutable-report-versioning-and-publication.md), [ADR 0020](./decisions/0020-public-input-moderation-versus-provider-moderation.md), [ADR 0021](./decisions/0021-complementary-small-cell-suppression.md)

This document describes the Phase 4 product/architecture contract. **Public Input remains fail-closed for live Pol.is.** Package 4.4 added aggregate-only report ingest, immutable report versioning/publication, institutional vs provider moderation records, and complementary small-cell suppression. Package **4.5A** hardens that contract: exact integer group counts, finding eligibility only while `under_review`, current-consultation report selection, title-in-hash, serialized imports, honest moderation disclosure omission, and unavailable vs not-found. **Aggregate ingest is not live activation** — every gate in `LIVE_PUBLIC_INPUT_ACTIVATION_GATES` remains `unresolved`. **4.5B+ public IA rebuild must not merge until 4.5A exits.**

---

## 1. Product recenter

Primary visitor task:

> **Follow an idea from community discussion to collective action.**

Institutional journey stages:

1. Idea Commons (informal discussion / early ideas)
2. Qualified proposal (nomination + published scoping criteria)
3. Public Input (Pol.is-powered when approved; synthetic / fail-closed / aggregate-import engineering in 4.1–4.4)
4. Transparent agenda qualification (multi-signal, versioned) — service work in 4.5
5. Deliberation (capacity-limited)
6. Policy recommendation
7. Recommended member actions
8. Review and follow-up topics (lineage + audit)

Secondary: existing snapshot / workflow explorer remains available under `/demo/workflow` but is **not** the primary demo.

---

## 2. Route and data-flow map (4.1–4.4)

### Public-demo routes

| Route | Area | Data |
| --- | --- | --- |
| `/` | Entry | Brand + primary CTA into guided journey |
| `/demo` | Guided journey | Stepper over the complete democratic path |
| `/idea-commons` | Idea Commons | Synthetic threads + local practice posts |
| `/idea-commons/[id]` | Idea Commons | Discussion / proposal lineage |
| `/formal-topics` | Formal Topic Pipeline | Gate-passed topics only |
| `/formal-topics/[slug]` | Canonical Formal Topic | Overview (default) / Evidence / Discussions via allowlisted `section` |
| `/formal-topics/[slug]/consultation/report` | Public Input report | Published allowlisted aggregate projection only (drafts → generic not-found) |
| `/topics` | Redirect | → `/formal-topics` |
| `/topics/[slug]` | Redirect | → `/formal-topics/[slug]` (preserve allowlisted `section`) |
| `/topics/[slug]/consult` | Public Input stage | Participation/practice route (preserved) |
| `/agenda/*`, `/deliberation/*`, `/decisions/*` | Formal stages | Existing Cedar River fixtures + journey projections |
| `/actions/[slug]` | Member actions | Synthetic post-decision opportunities |
| `/transparency` | Audit / public record | Lineage + allowlisted events |
| `/demo/workflow` | Secondary | Local practice + snapshot explorer |

### Data flow (public-demo)

```
Fixed journey fixtures (repo)
        │
        ├─► Idea Commons UI  ◄── sessionStorage practice posts/replies/proposals
        │
        ├─► Formal Topic projections (gate + lineage + criteria)
        │         └─► EvidenceDisclosure (progressive; already-public fields only)
        │
        ├─► Public Input practice votes (sessionStorage)
        │         └─► sealed aggregate report DTO (allowlist; complementary small-cell suppression)
        │
        ├─► Agenda qualification trace (independent signals + human review record)
        │
        └─► Member action opportunities (fixture geography/interests; explicit basis)
```

**Forbidden in public-demo:** gated DB/auth clients, Pol.is network calls, conversation lifecycle writes, report ingest/publish/moderation writes, provider exports in public DTOs, free text / identifiers / raw URLs / opinion data in query strings.

### Gated lane (4.3–4.4)

PostgreSQL + Auth.js alpha remains for Phase 3 operational surfaces plus Public Input domains:

**Lifecycle (4.3)**

- Tables: `public_input_conversations`, `public_input_conversation_transitions` (migration `0019`)
- Service: `src/lib/public-input/lifecycle/service.ts` (gated-only; `assertEnvironmentSafe()`)
- Operational `provider_kind` values: **`none` | `fixture` only** (DB CHECK + service)
- Live kinds `polis_hosted` / `polis_self_hosted` — never writable/operational
- Embed URL builder remains **fail-closed** while activation gates are unresolved

**Reports + moderation (4.4)**

- Tables (planned / package surface):
  - `public_input_report_imports`
  - `public_input_reports`
  - `public_input_report_groups`
  - `public_input_report_findings`
  - `public_input_report_moderation_actions`
  - `public_input_provider_moderation_records`
- Aggregate-only canonical import validation ([ADR 0018](./decisions/0018-aggregate-only-canonical-import-format.md))
- Immutable report versions + review/publish ([ADR 0019](./decisions/0019-immutable-report-versioning-and-publication.md))
- Institutional vs provider moderation axes ([ADR 0020](./decisions/0020-public-input-moderation-versus-provider-moderation.md))
- Complementary small-cell suppression on public projections ([ADR 0021](./decisions/0021-complementary-small-cell-suppression.md))
- Public-demo never imports gated DB/auth/provider network clients

---

## 3. Module map (4.1–4.4)

| Module | Responsibility |
| --- | --- |
| `src/fixtures/journey-catalog.ts` | Synthetic Idea Commons threads, trajectories, qualification traces, member actions |
| `src/features/journey/*` | Guided-step content helpers, formal-topic panels, lineage, authority rules |
| `src/features/idea-commons/*` | Idea Commons UI + sessionStorage practice state |
| `src/features/public-input/*` | Allowlisted aggregate report projection + complementary suppressible cells + recursive leak checks |
| `src/lib/public-input/provider/*` | Provider-neutral adapter (fixture / no-provider); exact-origin embed validator; zero network |
| `src/lib/public-input/lifecycle/*` | Conversation registry, transitions, availability, opaque mapping, embed URL shell, activation gates |
| `src/lib/public-input/reports/*` (4.4) | Canonical import validation, immutable versions, review/publish, public report DTO |
| `src/lib/public-input/moderation/*` (4.4) | Institutional moderation actions + provider moderation record ingestion (observational) |
| `src/features/formal-topics/*` | Canonical topic shell, section nav, Overview/Evidence/Discussions/Report, dual-mode loaders |
| `src/features/topics/EvidenceDisclosure.tsx` | Progressive evidence disclosure UI (`<details>`/`<summary>`) |
| `src/features/topics/evidence-disclosure-model.ts` | Presentation model (readability, not confidentiality) |
| `src/features/agenda-qualification/*` | Independent-signal trace rendering (fixtures until 4.5) |
| `src/features/member-actions/*` | Post-decision action surface |
| `src/features/demo/*` | Guided demo stepper (recentered steps); Reset clears journey local state |

---

## 4. Independent axes (do not collapse)

| Axis | Owner package | Mutates |
| --- | --- | --- |
| Conversation lifecycle | 4.3 | Institutional workflow state only |
| Provider availability | 4.3 | `not_configured\|available\|degraded\|unavailable` only |
| Provider-side comment moderation | 4.4 | `public_input_provider_moderation_records` (observational) |
| Institutional finding publication eligibility | 4.4 | Whether a finding may appear in the public report projection |
| Report import validation | 4.4 | Accept/reject aggregate descriptor → import + immutable version |
| Report publication | 4.4 | Review/publish/reject/supersede public projection |
| Evidence quality | 3.x / research review | Claim/evidence quality — **never** set by Pol.is results or report import |
| Agenda qualification | 4.5 | Multi-signal qualification trace — **out of scope for 4.4 writes** |

Moderators cannot alter consultation metrics. Import success does not publish. Publication does not qualify agenda items. Provider outage does not invent institutional closure. Provider comment moderation does not equal institutional endorsement.

---

## 5. Conversation registry (4.3)

Institutional topic IDs remain the source of truth. Provider conversation references are opaque, protected, and never appear on public or staff DTOs ([ADR 0014](./decisions/0014-institutional-conversation-lifecycle.md)).

### Workflow states (institutional)

```
draft → ready → open → commenting_closed → voting_closed → closed → archived
```

- Ordinary forward transitions use capability `consultations.transition`.
- `archive` may be reached from any non-archived state with a substantive reason.
- Recovery (out-of-pipeline) moves require a substantive reason, set `is_recovery = true`, and audit as `consultations.recovery_transition` — never reused for routine forward work.
- At most one `designation = 'current'` conversation per topic (partial unique index).

### Provider availability (independent axis)

| Availability | Meaning |
| --- | --- |
| `not_configured` | No usable provider mapping / not set up |
| `available` | Provider path believed usable (fixture path only while live blocked) |
| `degraded` | Partial impairment; institutional workflow unchanged unless staff acts |
| `unavailable` | Provider path not usable; Overview/Evidence/published reports remain |

**Do not** auto-close or archive a conversation solely because availability becomes `unavailable` / `degraded`. Institutional state and provider health are separate.

### Lifecycle projections

| Projection | Contains | Never contains |
| --- | --- | --- |
| `PublicConsultationView` | topicId, workflowState, providerAvailability, public title/prompt, schedule, configurationVersion | `providerConversationRef`, internal conversation id, account ids |
| `StaffConsultationSummary` | conversationId, topicId, states, `hasProviderMapping`, titles, versions | raw `providerConversationRef` |

Draft conversations have no public projection.

### Lifecycle capabilities

| Capability | Actor | Purpose |
| --- | --- | --- |
| `consultations.create` | administrator | Create current conversation for a topic |
| `consultations.transition` | administrator | Forward + recovery workflow transitions |
| `consultations.manage_provider_mapping` | administrator | Attach / rotate / remove opaque refs (`none`/`fixture` only) |
| `consultations.set_availability` | administrator | Set provider availability with reason when required |

---

## 6. Report ingest, versioning, and public route (4.4)

```
Aggregate-only descriptor (canonical schema)
        │  consultations.reports.import
        ▼
public_input_report_imports  (validation provenance; fail closed on forbidden keys)
        │
        ▼
immutable public_input_reports
   + public_input_report_groups
   + public_input_report_findings
        │  consultations.reports.review / .publish
        ▼
Allowlisted public report DTO ──► /formal-topics/[slug]/consultation/report
        │
        └─ complementary small-cell suppression (status reported|suppressed; share null when suppressed)
```

Rules:

1. Only aggregate-only canonical imports ([ADR 0018](./decisions/0018-aggregate-only-canonical-import-format.md)) — schema `@1.1` requires exact integer `participantCount` per group; partition consistency; no float-share inference.
2. Report **content** rows are immutable after create; finding `publication_status` and group `published_*` may change **only** while the parent report is `under_review` (DB triggers + service concurrency version). Corrections after publication = new import version ([ADR 0019](./decisions/0019-immutable-report-versioning-and-publication.md)).
3. Import never auto-publishes; publication records actor role, timestamp, method/import versions, conflicts.
4. Public topic projection selects the latest published report for the topic’s **current** consultation only — not an arbitrary `is_latest_published` row across historical conversations.
5. Public route exposes published allowlisted fields only — never `providerConversationRef`, import storage paths, raw export blobs, or staff-only moderation notes. Operational read failures use the established unavailable state; drafts/unpublished remain generic not-found.
6. `publicTitle` is taken only from the hashed canonical payload (outer API title ignored).
7. Imports serialize per conversation (`FOR UPDATE`); identical payloads replay idempotently under that lock.
8. Public `moderationDisclosure` is omitted unless the import carried a non-empty aggregate summary — never invent “Reviewed 0”.
9. Self-dealing provenance must remain auditable (who imported vs who published).
10. Complementary suppression uses exact counts ([ADR 0021](./decisions/0021-complementary-small-cell-suppression.md)); production threshold still OQ27 / OQ35.

### Report / moderation capabilities

| Capability | Actor | Purpose |
| --- | --- | --- |
| `consultations.reports.import` | administrator | Validate + store aggregate-only import → immutable version |
| `consultations.reports.review` | administrator | Review / reject imported versions with reason |
| `consultations.reports.publish` | administrator | Publish or supersede public projection |
| `consultations.moderation.record` | moderator or administrator | Append institutional moderation / finding-eligibility actions |

---

## 7. Moderation axes (4.4)

| Store | Axis | Meaning |
| --- | --- | --- |
| `public_input_provider_moderation_records` | Provider-side comment moderation | Observational provenance from fixture/staff notes (no live admin API while fail-closed) |
| `public_input_report_moderation_actions` | Institutional moderation / finding eligibility | Append-only reasoned actions; not agenda priority |

These axes are independent of conversation lifecycle, provider availability, import validation, report publication, evidence quality, and agenda qualification ([ADR 0020](./decisions/0020-public-input-moderation-versus-provider-moderation.md)).

---

## 8. Embed exact-origin policy (fail-closed)

Domain module: `src/lib/public-input/lifecycle/embed-url.ts` + `validateEmbedOrigin` in the provider adapter ([ADR 0016](./decisions/0016-provider-embed-activation-exact-origin.md)).

Rules:

1. **Exact origin allowlist** — production path allows only `https://pol.is` (never hostname suffix / `endsWith` matching).
2. **HTTPS required** — localhost only with explicit `OSTT_ALLOW_LOCALHOST_EMBED_ORIGIN=1` and non-production `NODE_ENV`.
3. **Reject credential-bearing / query-string origins** (tokens, `xid`, secrets, etc.).
4. **Opaque conversation refs only** — shape `kind:token`; reject URL-like, email-like, or forbidden substrings (`xid`, `session`, `token`, …).
5. **Live provider kinds never construct URLs** — `polis_hosted` / `polis_self_hosted` return `LIVE_PROVIDER_KIND_FORBIDDEN`.
6. **Activation checklist** — after input validation, `buildEmbedUrl` still returns `EMBED_ACTIVATION_GATES_UNRESOLVED` unless every gate is resolved. All 13 gates remain hardcoded `unresolved`; the success path is intentionally unreachable.
7. **No UI iframe / no network** for live providers in 4.4 — aggregate ingest does not change this.

Activation gate list: see [phase-4-plan.md](./phase-4-plan.md) §11d and `src/lib/public-input/lifecycle/activation.ts`.

---

## 9. Progressive evidence disclosure

Presentation-only collapse of **already-public** evidence fields ([ADR 0015](./decisions/0015-progressive-evidence-disclosure.md)):

- Default closed; keyboard/screen-reader accessible via native disclosure.
- Never auto-opens from query strings, localStorage, or sessionStorage.
- Collapsed: relationship, quality, title, source organization/type, contribution sentence.
- Expanded: metadata, rationales, limitations, public conflict summary, revision/moderation notices, linked claims, external source link (when present).
- Source anchors use `rel="noopener noreferrer"` and `referrerPolicy="no-referrer"`; the app does not fetch remote sources.
- **Not** an access-control or confidentiality mechanism — protected fields must be filtered before they reach the disclosure model (OQ34).

---

## 10. Public Input privacy architecture

```
Protected: raw provider export / per-person votes / membership maps / providerConversationRef
                │
                │ aggregate-only versioned ingest (4.4) — raw exports rejected
                ▼
Immutable report version (gated)
                │
                │ review + publish (human)
                ▼
Allowlisted public report DTO
  - participation totals
  - neutrally labeled groups
  - cross-group agreement / disagreement findings (eligibility-filtered)
  - sufficiency + representation limitations
  - method version + import timestamps
  - complementary small-cell suppression (reported|suppressed; demo provisional n < 5;
    suppressed share null, never 0; production threshold OQ27 + OQ35)
```

Never in public DTOs/URLs/logs/exports: provider participant IDs, account IDs, per-person vote rows, individual group membership, cross-conversation linkage, contact/identity/verification data, secret-bearing provider URLs, `providerConversationRef`. Recursive forbidden-key walkers must reject nested leaks.

`xid` and other identity-linking mechanisms are **unsupported** until an explicit approval package.

---

## 11. Agenda qualification architecture

Qualification produces a **versioned trace** of independent signals — not a single score:

- participation sufficiency  
- breadth / cross-group engagement  
- agreement findings  
- disagreement findings  
- evidence readiness (human research review; never Pol.is-updated)  
- scope / jurisdiction  
- duplication / lineage  
- capacity  
- moderator process/safety review  

Human deferral/override appends: public reason, actor role, timestamp, conflicts, method version. Moderators cannot edit consultation metrics. **Package 4.4 must not write qualification decisions** — fixtures/UI traces only until 4.5.

---

## 12. Authority boundaries

| Actor | Pre-deliberation | During/after deliberation |
| --- | --- | --- |
| Visitor / community participant | Idea Commons contributions; ordinary proposals | Observe; no secret promotion |
| Moderator | Safety/relevance/duplication/formatting/process with recorded reason; Public Input moderation records; **no** agenda priority | Same process limits; does not become agenda authority |
| Administrator | Operational publish/workflow (gated); conversation lifecycle; report import/review/publish; **no** preference-based promotion | Does not replace council seats |
| Deliberation council | — | Capacity-limited discussion, amendments, evidence requests |
| Policy council | — | Recommendation records (not enacted law / not board adoption) |
| Governing board | Unresolved / counsel-gated | Unresolved / counsel-gated |

Ordinary contributions by moderators or senior members use the **same** participant interface — no elevated badges or ranking advantages.

---

## 13. Member action opportunities

Post-decision surface examples: town hall, interest-group meeting, public comment, local agency proposal review, follow-up evidence session.

Each opportunity records: organizer; date/location; source link; eligibility; why shown; relationship to institutional recommendation; sponsorship/conflict; expiration/status; non-endorsement language where appropriate.

**4.1 personalization rule:** explicit fixture geography/interests only; explain recommendation basis. Forbidden: personalization from individual Pol.is votes, inferred ideology, or hidden behavioral profiles.

---

## 13a. Canonical topic loaders (4.2+)

```
public-demo                          gated
───────────                          ─────
journey + fixture catalog            getPublishedTopicProjection(db)
        │                                      │
        ▼                                      ▼
loadPublicDemoCanonicalTopic         loadGatedCanonicalTopic
        │                                      │
        └──────────► CanonicalTopicPage ◄──────┘
                     section=overview|evidence|discussions|report
                              │
                              ├─ Evidence section → EvidenceDisclosure
                              └─ Report section → published aggregate DTO only
```

Never join public-demo and gated records by slug at runtime. Provider outage / no-provider must not remove Overview or Evidence. Missing published report shows an honest empty/not-yet-published state.

---

## 13b. Local versus remote reset (4.3–4.4)

Alpha reset deletes local gated rows for conversation lifecycle tables **and** the six 4.4 report/moderation tables. That **does not** delete data held by a remote consultation provider. Operators must never claim remote deletion from a local wipe ([ADR 0017](./decisions/0017-local-versus-remote-reset-semantics.md); OQ29). Verified remote handling remains activation gate `remote_alpha_reset_verified`.

---

## 14. Deferred to later Phase 4 packages

- Live hosted Pol.is embed enablement (vendor DPA / register addendum / resolved activation gates) — **still blocked after 4.4 aggregate ingest**
- Production agenda qualification services (4.5)
- Gated deliberation/policy drafting bridges (4.6)
- Operational member-action feeds (4.7)
- Hardening handoff (4.8)

Phase 5 (agenda laboratory) may tune methods under shadow mode but **cannot erase** Phase 4 governance constraints.

---

## 15. Repository settings note

`main` branch-protection settings read returned **403** (owner/admin). Architecture recommendation: require PR reviews + CI status checks; block force-push and deletion on `main`. Changing GitHub settings is an owner/admin action — **out of band** for application PRs.
