# Architecture — Phase 4 (computational democracy)

**Status:** Work Package **4.3** complete in this PR (awaiting owner approval before 4.4). Builds on [architecture-phase-3.md](./architecture-phase-3.md) and Phase 2 dual-mode isolation.  
**Related:** [phase-4-plan.md](./phase-4-plan.md), [public-input-provider-assessment.md](./public-input-provider-assessment.md), [ADR 0010](./decisions/0010-computational-democracy-pipeline.md), [ADR 0011](./decisions/0011-idea-commons-formal-pipeline-separation.md), [ADR 0012](./decisions/0012-public-input-provider-boundary.md), [ADR 0013](./decisions/0013-canonical-formal-topic-page.md), [ADR 0014](./decisions/0014-institutional-conversation-lifecycle.md), [ADR 0015](./decisions/0015-progressive-evidence-disclosure.md), [ADR 0016](./decisions/0016-provider-embed-activation-exact-origin.md), [ADR 0017](./decisions/0017-local-versus-remote-reset-semantics.md)

This document describes the Phase 4 product/architecture contract. **Public Input remains fail-closed for live Pol.is.** Package 4.3 lands the gated institutional conversation lifecycle, a disabled embed URL shell, and progressive evidence disclosure. Engineering readiness is **not** live activation — every gate in `LIVE_PUBLIC_INPUT_ACTIVATION_GATES` remains `unresolved`.

---

## 1. Product recenter

Primary visitor task:

> **Follow an idea from community discussion to collective action.**

Institutional journey stages:

1. Idea Commons (informal discussion / early ideas)
2. Qualified proposal (nomination + published scoping criteria)
3. Public Input (Pol.is-powered when approved; synthetic / fail-closed in 4.1–4.3)
4. Transparent agenda qualification (multi-signal, versioned)
5. Deliberation (capacity-limited)
6. Policy recommendation
7. Recommended member actions
8. Review and follow-up topics (lineage + audit)

Secondary: existing snapshot / workflow explorer remains available under `/demo/workflow` but is **not** the primary demo.

---

## 2. Route and data-flow map (4.1–4.3)

### Public-demo routes

| Route | Area | Data |
| --- | --- | --- |
| `/` | Entry | Brand + primary CTA into guided journey |
| `/demo` | Guided journey | Stepper over the complete democratic path |
| `/idea-commons` | Idea Commons | Synthetic threads + local practice posts |
| `/idea-commons/[id]` | Idea Commons | Discussion / proposal lineage |
| `/formal-topics` | Formal Topic Pipeline | Gate-passed topics only |
| `/formal-topics/[slug]` | Canonical Formal Topic | Overview (default) / Evidence / Discussions via allowlisted `section` |
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
        │         └─► sealed aggregate report DTO (allowlist; small-cell suppression)
        │
        ├─► Agenda qualification trace (independent signals + human review record)
        │
        └─► Member action opportunities (fixture geography/interests; explicit basis)
```

**Forbidden in public-demo:** gated DB/auth clients, Pol.is network calls, conversation lifecycle writes, provider exports in public DTOs, free text / identifiers / raw URLs / opinion data in query strings.

### Gated lane (4.3)

PostgreSQL + Auth.js alpha remains for Phase 3 operational surfaces plus the **Public Input conversation lifecycle domain**:

- Tables: `public_input_conversations`, `public_input_conversation_transitions` (migration `0019`)
- Service: `src/lib/public-input/lifecycle/service.ts` (gated-only; `assertEnvironmentSafe()`)
- Operational `provider_kind` values: **`none` | `fixture` only** (DB CHECK + service)
- Live kinds `polis_hosted` / `polis_self_hosted` exist for forward compatibility labels only — never writable/operational
- Embed URL builder is domain-only and **always fail-closed** while activation gates are unresolved
- Canonical gated topic pages still load the published allowlisted projection; public discussion relationships remain empty/not-yet-operational
- Public-demo never imports gated DB/auth/provider network clients

---

## 3. Module map (4.1–4.3)

| Module | Responsibility |
| --- | --- |
| `src/fixtures/journey-catalog.ts` | Synthetic Idea Commons threads, trajectories, qualification traces, member actions |
| `src/features/journey/*` | Guided-step content helpers, formal-topic panels, lineage, authority rules |
| `src/features/idea-commons/*` | Idea Commons UI + sessionStorage practice state |
| `src/features/public-input/*` | Allowlisted aggregate report projection + explicit suppressible cells + recursive leak checks |
| `src/lib/public-input/provider/*` | Provider-neutral adapter (fixture / no-provider); exact-origin embed validator; zero network |
| `src/lib/public-input/lifecycle/*` | Conversation registry, transitions, availability, opaque mapping, embed URL shell, activation gates |
| `src/features/formal-topics/*` | Canonical topic shell, section nav, Overview/Evidence/Discussions, dual-mode loaders |
| `src/features/topics/EvidenceDisclosure.tsx` | Progressive evidence disclosure UI (`<details>`/`<summary>`) |
| `src/features/topics/evidence-disclosure-model.ts` | Presentation model (readability, not confidentiality) |
| `src/features/agenda-qualification/*` | Independent-signal trace rendering |
| `src/features/member-actions/*` | Post-decision action surface |
| `src/features/demo/*` | Guided demo stepper (recentered steps); Reset clears journey local state |

---

## 4. Conversation registry (4.3)

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
| `available` | Provider path believed usable (fixture path only in 4.3) |
| `degraded` | Partial impairment; institutional workflow unchanged unless staff acts |
| `unavailable` | Provider path not usable; Overview/Evidence remain |

**Do not** auto-close or archive a conversation solely because availability becomes `unavailable` / `degraded`. Institutional state and provider health are separate.

### Projections

| Projection | Contains | Never contains |
| --- | --- | --- |
| `PublicConsultationView` | topicId, workflowState, providerAvailability, public title/prompt, schedule, configurationVersion | `providerConversationRef`, internal conversation id, account ids |
| `StaffConsultationSummary` | conversationId, topicId, states, `hasProviderMapping`, titles, versions | raw `providerConversationRef` |

Draft conversations have no public projection.

### Capabilities

| Capability | Actor | Purpose |
| --- | --- | --- |
| `consultations.create` | administrator | Create current conversation for a topic |
| `consultations.transition` | administrator | Forward + recovery workflow transitions |
| `consultations.manage_provider_mapping` | administrator | Attach / rotate / remove opaque refs (`none`/`fixture` only) |
| `consultations.set_availability` | administrator | Set provider availability with reason when required |

---

## 5. Embed exact-origin policy (fail-closed)

Domain module: `src/lib/public-input/lifecycle/embed-url.ts` + `validateEmbedOrigin` in the provider adapter ([ADR 0016](./decisions/0016-provider-embed-activation-exact-origin.md)).

Rules:

1. **Exact origin allowlist** — production path allows only `https://pol.is` (never hostname suffix / `endsWith` matching).
2. **HTTPS required** — localhost only with explicit `OSTT_ALLOW_LOCALHOST_EMBED_ORIGIN=1` and non-production `NODE_ENV`.
3. **Reject credential-bearing / query-string origins** (tokens, `xid`, secrets, etc.).
4. **Opaque conversation refs only** — shape `kind:token`; reject URL-like, email-like, or forbidden substrings (`xid`, `session`, `token`, …).
5. **Live provider kinds never construct URLs** — `polis_hosted` / `polis_self_hosted` return `LIVE_PROVIDER_KIND_FORBIDDEN`.
6. **Activation checklist** — after input validation, `buildEmbedUrl` still returns `EMBED_ACTIVATION_GATES_UNRESOLVED` unless every gate is resolved. In 4.3 all 13 gates are hardcoded `unresolved`; the success path is intentionally unreachable.
7. **No UI iframe / no network** in this package — shell only.

Activation gate list: see [phase-4-plan.md](./phase-4-plan.md) §11d and `src/lib/public-input/lifecycle/activation.ts`.

---

## 6. Progressive evidence disclosure

Presentation-only collapse of **already-public** evidence fields ([ADR 0015](./decisions/0015-progressive-evidence-disclosure.md)):

- Default closed; keyboard/screen-reader accessible via native disclosure.
- Never auto-opens from query strings, localStorage, or sessionStorage.
- Collapsed: relationship, quality, title, source organization/type, contribution sentence.
- Expanded: metadata, rationales, limitations, public conflict summary, revision/moderation notices, linked claims, external source link (when present).
- Source anchors use `rel="noopener noreferrer"` and `referrerPolicy="no-referrer"`; the app does not fetch remote sources.
- **Not** an access-control or confidentiality mechanism — protected fields must be filtered before they reach the disclosure model (OQ34).

---

## 7. Public Input privacy architecture

```
Protected: raw provider export / per-person votes / membership maps / providerConversationRef
                │
                │ versioned ingest (4.4+) — not in 4.3
                ▼
Allowlisted public report DTO
  - participation totals
  - neutrally labeled groups
  - cross-group agreement / disagreement
  - sufficiency + representation limitations
  - method version + import timestamps
  - small-cell suppression with status reported|suppressed (demo provisional n < 5; suppressed share is null, never 0)
```

Never in public DTOs/URLs/logs/exports: provider participant IDs, account IDs, per-person vote rows, individual group membership, cross-conversation linkage, contact/identity/verification data, secret-bearing provider URLs, `providerConversationRef`. Recursive forbidden-key walkers must reject nested leaks.

`xid` and other identity-linking mechanisms are **unsupported** until an explicit approval package.

---

## 8. Agenda qualification architecture

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

Human deferral/override appends: public reason, actor role, timestamp, conflicts, method version. Moderators cannot edit consultation metrics.

---

## 9. Authority boundaries

| Actor | Pre-deliberation | During/after deliberation |
| --- | --- | --- |
| Visitor / community participant | Idea Commons contributions; ordinary proposals | Observe; no secret promotion |
| Moderator | Safety/relevance/duplication/formatting/process with recorded reason; **no** agenda priority | Same process limits; does not become agenda authority |
| Administrator | Operational publish/workflow (gated); conversation lifecycle ops; **no** preference-based promotion | Does not replace council seats |
| Deliberation council | — | Capacity-limited discussion, amendments, evidence requests |
| Policy council | — | Recommendation records (not enacted law / not board adoption) |
| Governing board | Unresolved / counsel-gated | Unresolved / counsel-gated |

Ordinary contributions by moderators or senior members use the **same** participant interface — no elevated badges or ranking advantages.

---

## 10. Member action opportunities

Post-decision surface examples: town hall, interest-group meeting, public comment, local agency proposal review, follow-up evidence session.

Each opportunity records: organizer; date/location; source link; eligibility; why shown; relationship to institutional recommendation; sponsorship/conflict; expiration/status; non-endorsement language where appropriate.

**4.1 personalization rule:** explicit fixture geography/interests only; explain recommendation basis. Forbidden: personalization from individual Pol.is votes, inferred ideology, or hidden behavioral profiles.

---

## 10a. Canonical topic loaders (4.2+)

```
public-demo                          gated
───────────                          ─────
journey + fixture catalog            getPublishedTopicProjection(db)
        │                                      │
        ▼                                      ▼
loadPublicDemoCanonicalTopic         loadGatedCanonicalTopic
        │                                      │
        └──────────► CanonicalTopicPage ◄──────┘
                     section=overview|evidence|discussions
                              │
                              └─ Evidence section → EvidenceDisclosure
```

Never join public-demo and gated records by slug at runtime. Provider outage / no-provider must not remove Overview or Evidence.

---

## 10b. Local versus remote reset (4.3)

Alpha reset deletes local gated rows for `public_input_conversations` and `public_input_conversation_transitions`. That **does not** delete data held by a remote consultation provider. Operators must never claim remote deletion from a local wipe ([ADR 0017](./decisions/0017-local-versus-remote-reset-semantics.md); OQ29). Verified remote handling remains activation gate `remote_alpha_reset_verified`.

---

## 11. Deferred to later Phase 4 packages

- Live hosted Pol.is embed enablement (vendor DPA / register addendum / resolved activation gates) — **blocked after 4.3 engineering**
- Aggregate ingest + moderation ops (4.4)
- Production agenda qualification services (4.5)
- Gated deliberation/policy drafting bridges (4.6)
- Operational member-action feeds (4.7)
- Hardening handoff (4.8)

Phase 5 (agenda laboratory) may tune methods under shadow mode but **cannot erase** Phase 4 governance constraints.

---

## 12. Repository settings note

`main` currently appears unprotected. Architecture recommendation: require PR reviews + CI status checks; block force-push and deletion on `main`. Changing GitHub settings is an owner/admin action — **out of band** for application PRs.
