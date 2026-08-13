# Architecture — Phase 4 (computational democracy)

**Status:** Work Package 4.1 contract. Builds on [architecture-phase-3.md](./architecture-phase-3.md) and Phase 2 dual-mode isolation.  
**Related:** [phase-4-plan.md](./phase-4-plan.md), [ADR 0010](./decisions/0010-computational-democracy-pipeline.md), [ADR 0011](./decisions/0011-idea-commons-formal-pipeline-separation.md)

This document describes the Phase 4 product/architecture contract. **4.1 is synthetic/demo-only for Public Input.** Live Pol.is is not installed.

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
| `/formal-topics/[slug]` | Formal Topic Pipeline | Stage, criteria, lineage, who can act |
| `/topics/*`, `/agenda/*`, `/deliberation/*`, `/decisions/*` | Formal stages | Existing Cedar River fixtures + 4.1 projections |
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

### Gated lane (unchanged in 4.1)

PostgreSQL + Auth.js alpha remains for Phase 3 operational surfaces. Phase 4.2+ may add conversation mapping tables and adapters **only after** permitted-services approval. Public-demo never imports those clients.

---

## 3. Module map (4.1)

| Module | Responsibility |
| --- | --- |
| `src/fixtures/journey-catalog.ts` | Synthetic Idea Commons threads, trajectories, qualification traces, member actions |
| `src/features/journey/*` | Guided-step content helpers, formal-topic panels, lineage, authority rules |
| `src/features/idea-commons/*` | Idea Commons UI + sessionStorage practice state |
| `src/features/public-input/*` | Allowlisted aggregate report projection + small-cell suppression |
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
  - small-cell suppression (demo provisional n < 5)
```

Never in public DTOs/URLs/logs/exports: provider participant IDs, account IDs, per-person vote rows, individual group membership, cross-conversation linkage, contact/identity/verification data, secret-bearing provider URLs.

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

## 8. Deferred to later Phase 4 packages

- Live hosted Pol.is embed and vendor DPA (4.2–4.3)
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
