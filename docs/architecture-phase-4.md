# Architecture — Phase 4 (computational democracy)

**Status:** Work Package **4.2** complete in PR (awaiting owner approval before 4.3). Builds on [architecture-phase-3.md](./architecture-phase-3.md) and Phase 2 dual-mode isolation.  
**Related:** [phase-4-plan.md](./phase-4-plan.md), [public-input-provider-assessment.md](./public-input-provider-assessment.md), [ADR 0010](./decisions/0010-computational-democracy-pipeline.md), [ADR 0011](./decisions/0011-idea-commons-formal-pipeline-separation.md), [ADR 0012](./decisions/0012-public-input-provider-boundary.md), [ADR 0013](./decisions/0013-canonical-formal-topic-page.md)

This document describes the Phase 4 product/architecture contract. **Public Input remains synthetic/demo-only.** The 4.2 adapter boundary and Pol.is assessment do **not** authorize a live embed. Live Pol.is remains blocked until 4.3 owner approval and vendor/privacy gates.

---

## 1. Product recenter

Primary visitor task:

> **Follow an idea from community discussion to collective action.**

Institutional journey stages:

1. Idea Commons (informal discussion / early ideas)
2. Qualified proposal (nomination + published scoping criteria)
3. Public Input (Pol.is-powered when approved; synthetic in 4.1)
4. Transparent agenda qualification (multi-signal, versioned)
5. Deliberation (capacity-limited)
6. Policy recommendation
7. Recommended member actions
8. Review and follow-up topics (lineage + audit)

Secondary: existing snapshot / workflow explorer remains available under `/demo/workflow` but is **not** the primary demo.

---

## 2. Route and data-flow map (4.1)

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
        │
        ├─► Public Input practice votes (sessionStorage)
        │         └─► sealed aggregate report DTO (allowlist; small-cell suppression)
        │
        ├─► Agenda qualification trace (independent signals + human review record)
        │
        └─► Member action opportunities (fixture geography/interests; explicit basis)
```

**Forbidden in public-demo:** gated DB/auth clients, Pol.is network calls, provider exports in public DTOs, free text / identifiers / raw URLs / opinion data in query strings.

### Gated lane (4.2)

PostgreSQL + Auth.js alpha remains for Phase 3 operational surfaces. Canonical gated topic pages load **only** the published allowlisted projection (no synthetic slug fallback). Public discussion relationships are not yet in schema — honest empty state. Conversation mapping tables / live adapters remain deferred; **no DB migration in 4.2**. Public-demo never imports gated DB/auth/provider network clients.

---

## 3. Module map (4.1–4.2)

| Module | Responsibility |
| --- | --- |
| `src/fixtures/journey-catalog.ts` | Synthetic Idea Commons threads, trajectories, qualification traces, member actions |
| `src/features/journey/*` | Guided-step content helpers, formal-topic panels, lineage, authority rules |
| `src/features/idea-commons/*` | Idea Commons UI + sessionStorage practice state |
| `src/features/public-input/*` | Allowlisted aggregate report projection + explicit suppressible cells + recursive leak checks |
| `src/lib/public-input/provider/*` | Provider-neutral adapter (fixture / no-provider); zero network |
| `src/features/formal-topics/*` | Canonical topic shell, section nav, Overview/Evidence/Discussions, dual-mode loaders |
| `src/features/agenda-qualification/*` | Independent-signal trace rendering |
| `src/features/member-actions/*` | Post-decision action surface |
| `src/features/demo/*` | Guided demo stepper (recentered steps); Reset clears journey local state |

---

## 4. Public Input privacy architecture

```
Protected: raw provider export / per-person votes / membership maps
                │
                │ versioned ingest (4.4+) — not in 4.1
                ▼
Allowlisted public report DTO
  - participation totals
  - neutrally labeled groups
  - cross-group agreement / disagreement
  - sufficiency + representation limitations
  - method version + import timestamps
  - small-cell suppression with status reported|suppressed (demo provisional n < 5; suppressed share is null, never 0)
```

Never in public DTOs/URLs/logs/exports: provider participant IDs, account IDs, per-person vote rows, individual group membership, cross-conversation linkage, contact/identity/verification data, secret-bearing provider URLs. Recursive forbidden-key walkers must reject nested leaks.

`xid` and other identity-linking mechanisms are **unsupported** until an explicit approval package.

---

## 5. Agenda qualification architecture

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

## 6. Authority boundaries

| Actor | Pre-deliberation | During/after deliberation |
| --- | --- | --- |
| Visitor / community participant | Idea Commons contributions; ordinary proposals | Observe; no secret promotion |
| Moderator | Safety/relevance/duplication/formatting/process with recorded reason; **no** agenda priority | Same process limits; does not become agenda authority |
| Administrator | Operational publish/workflow (gated); **no** preference-based promotion | Does not replace council seats |
| Deliberation council | — | Capacity-limited discussion, amendments, evidence requests |
| Policy council | — | Recommendation records (not enacted law / not board adoption) |
| Governing board | Unresolved / counsel-gated | Unresolved / counsel-gated |

Ordinary contributions by moderators or senior members use the **same** participant interface — no elevated badges or ranking advantages.

---

## 7. Member action opportunities

Post-decision surface examples: town hall, interest-group meeting, public comment, local agency proposal review, follow-up evidence session.

Each opportunity records: organizer; date/location; source link; eligibility; why shown; relationship to institutional recommendation; sponsorship/conflict; expiration/status; non-endorsement language where appropriate.

**4.1 personalization rule:** explicit fixture geography/interests only; explain recommendation basis. Forbidden: personalization from individual Pol.is votes, inferred ideology, or hidden behavioral profiles.

---

## 7a. Canonical topic loaders (4.2)

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
```

Never join public-demo and gated records by slug at runtime. Provider outage / no-provider must not remove Overview or Evidence.

## 8. Deferred to later Phase 4 packages

- Live hosted Pol.is embed and vendor DPA / register addendum (**4.3+**; assessment in 4.2 is not authorization)
- Operational conversation lifecycle, outage, retention jobs (4.3)
- Aggregate ingest + moderation ops (4.4)
- Production agenda qualification services (4.5)
- Gated deliberation/policy drafting bridges (4.6)
- Operational member-action feeds (4.7)
- Hardening handoff (4.8)

Phase 5 (agenda laboratory) may tune methods under shadow mode but **cannot erase** Phase 4 governance constraints.

---

## 9. Repository settings note

`main` currently appears unprotected. Architecture recommendation: require PR reviews + CI status checks; block force-push and deletion on `main`. Changing GitHub settings is an owner/admin action — **out of band** for application PRs.
