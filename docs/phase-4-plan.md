# Phase 4 plan — Computational democracy journey & Public Input

**Status:** Active. Phase 3 engineering closure is **owner-accepted** (`APPROVE PHASE 3 COMPLETE`, 2026-08-13). Phase 4.1 is the current package.  
**Baseline:** `origin/main` at `7254cf5e55cb64426f93f3d7685956655af916ec` (PR #16 merged).  
**Related:** [architecture-phase-4.md](./architecture-phase-4.md), [0010-computational-democracy-pipeline.md](./decisions/0010-computational-democracy-pipeline.md), [0011-idea-commons-formal-pipeline-separation.md](./decisions/0011-idea-commons-formal-pipeline-separation.md), [phase-3-handoff.md](./phase-3-handoff.md), [product-charter.md](./product-charter.md)

This plan is a **product/engineering contract**. It is **not** legal clearance, counsel disposition, Pol.is vendor approval, production-launch approval, or authorization to install a live consultation provider.

---

## 1. Board direction

Phase 4 is **not merely a Pol.is integration**. Recenter the product and demonstration around the complete democratic journey:

**Idea Commons → qualified proposal → Public Input (powered by Pol.is when approved) → transparent agenda qualification → deliberation → policy recommendation → recommended member actions → review and follow-up topics**

The public demo must make this journey understandable and operable. It must clearly distinguish **general discussion and unqualified proposals** (Idea Commons) from **formal topics that have passed published gates** (Formal Topic Pipeline).

Pol.is is an **input**, not a decision-maker. Preference, cross-group agreement, evidence quality, workflow, moderation visibility, publication, and agenda qualification remain **separate axes**.

---

## 2. Phase 3 acceptance record

| Item | Record |
| --- | --- |
| Owner instruction | `APPROVE PHASE 3 COMPLETE. START PHASE 4.1.` |
| PR #16 | Merged (`Phase 3 closure corrections…`) |
| Baseline SHA | `7254cf5e55cb64426f93f3d7685956655af916ec` |
| Phase 3 handoff status | Explicitly owner-accepted; see [phase-3-handoff.md](./phase-3-handoff.md) |

---

## 3. Two product areas

### A. Idea Commons

- General discussion, questions, early ideas, and unqualified proposals.
- All content labeled **informal** and **not yet in the Formal Topic Pipeline**.
- Public-demo visitors may write a practice post, cite a source, reply, and convert a contribution into a proposal (local / session-scoped only).
- Visible history when an idea is merged, split, deferred, or nominated for scoping.

### B. Formal Topic Pipeline

- Contains only topics that passed the required published gate.
- Every topic displays: current stage; origin and lineage; criteria met; unmet criteria; who can act now; next transition; public vs protected information; complete transition history.
- **No** moderator, administrator, board member, or individual participant may directly promote a pre-deliberation topic based on preference.

Authority details: [ADR 0010](./decisions/0010-computational-democracy-pipeline.md), [ADR 0011](./decisions/0011-idea-commons-formal-pipeline-separation.md).

---

## 4. Retained Pol.is / Public Input deliverables (packages 4.2–4.4+)

Phase 4 retains these deliverables from the prior MVP plan; **none are installed in 4.1**:

1. Supported hosted embed (no undocumented APIs / hidden features).
2. Provider-neutral conversation mapping (institutional topic ID ≠ provider conversation ID).
3. Conversation-scoped pseudonymous participation (no `xid` / identity-linking until approved).
4. Moderation workflow with required reasons; no private agenda promotion.
5. Versioned import/export and consultation reports (aggregates only in public projections).
6. Outage, retention, reset, and audit behavior documented before install.

**4.1 documents** supported capabilities, vendor/data-processing approval needs, privacy constraints, and unsupported-feature prohibitions. Live Pol.is is **forbidden** until a permitted-services register addendum and owner authorization for 4.2+.

---

## 5. Work packages

| Package | Title | Goal |
| --- | --- | --- |
| **4.1** | Institutional contract and synthetic end-to-end demo | Docs + ADRs + guided journey recentering; Idea Commons vs Formal Pipeline; synthetic Public Input report; qualification trace; member actions; no live Pol.is |
| **4.2** | Pol.is capability / privacy / vendor verification and adapter | Capability matrix, privacy review, vendor/DPA gate, provider-neutral adapter stubs; still no production embed without clearance |
| **4.3** | Gated conversation lifecycle and supported embed | Hosted embed behind gated mode; conversation registry; outage/reset/audit hooks |
| **4.4** | Moderation and aggregate report ingestion | Reasoned moderation; versioned aggregate import; public report projections |
| **4.5** | Consultation-to-agenda qualification | Transparent multi-signal qualification; no composite truth/importance score |
| **4.6** | Discussion, deliberation, and policy drafting | Bridge Formal Pipeline stages with operational gated workspace surfaces |
| **4.7** | Member action opportunities | Post-decision civic action surfaces with sponsorship/conflict/expiry rules |
| **4.8** | Hardening and handoff | Security/privacy/a11y hardening; Phase 4 handoff |

Stop after each package for human approval. Do **not** begin 4.2 without explicit owner review of the 4.1 PR.

---

## 6. Package 4.1 — acceptance criteria

1. Phase 4 contract docs and ADRs exist; README / charter / MVP plan / handoff / open questions / data map / threat model / capability matrix / verification ladder updated.
2. Home and `/demo` primary task: **Follow an idea from community discussion to collective action.**
3. Guided journey operates Idea Commons → proposal → scoping → Public Input → votes → aggregate report → agenda qualification → deliberation → policy recommendation → member actions → audit/lineage.
4. At least three synthetic trajectories: advance through every stage; merge/split with visible lineage; defer because a published criterion is unmet.
5. Idea Commons and Formal Topics cannot be mistaken for one another in UI copy and navigation.
6. Ordinary moderator proposals receive no privileged path; no elevated role can directly promote a pre-deliberation topic.
7. Public Input report exposes allowlisted aggregates only; raw votes / group membership / provider IDs never appear in public DTOs, URLs, logs, or exports.
8. Agenda qualification keeps consultation, evidence, and human review independent; human deferral/override records reason, role, timestamp, conflicts, method version.
9. Member action opportunities show organizer, date/location, source link, eligibility, why shown, relationship to recommendation, sponsorship/conflict, expiration/status, non-endorsement language; no personalization from Pol.is votes or inferred ideology.
10. Public-demo makes zero gated or provider network requests; interactive state is session-scoped and cleared by global Reset; no free text/identifiers/raw URLs/opinion data in query strings.
11. Keyboard, focus, axe, overflow, and deep-link tests pass at desktop and 390px.
12. Full verification ladder green (format/lint/typecheck/unit/security/backup/build/public e2e/gated e2e/applicable PG + Phase 3 acceptance).

**Non-goals for 4.1:** live Pol.is; payments; analytics; AI ranking; advertising; notifications; remote source fetching; production participant data; altering GitHub branch-protection settings.

---

## 7. Privacy contract (Public Input)

### Public report may show

- Total participation; comment and vote totals
- Neutrally named aggregate opinion groups
- Cross-group agreement; meaningful disagreement
- Participation sufficiency; representation limitations
- Versioned method and import timestamps

### Must not publicly expose

- Provider participant IDs; account IDs
- Per-person vote rows; individual group membership
- Cross-conversation linkage
- Contact, identity, or verification data
- Raw provider URLs containing secrets or access tokens

Raw provider exports are **protected data**. Public reports are separate allowlisted aggregate projections. Configurable **small-cell suppression** applies; synthetic demo provisional threshold is **5**, with production threshold requiring privacy review (open question).

Do **not** use `xid` or any identity-linking mechanism until supported status, purpose, retention, access control, deletion, and reidentification risk are approved.

---

## 8. Agenda qualification contract

Independent signals (no single composite “truth,” “importance,” or popularity score):

1. Participation sufficiency  
2. Breadth / cross-group engagement  
3. Agreement and disagreement findings  
4. Evidence readiness (never set by Pol.is results)  
5. Scope and jurisdiction  
6. Duplication / lineage  
7. Capacity  
8. Moderator process / safety review (process only — not agenda priority)

Moderators cannot alter consultation metrics. Human deferral or override requires public reason, actor role, timestamp, conflicts, and method version. Later agenda-laboratory work (Phase 5) may tune methods but cannot erase these governance constraints.

---

## 9. Authority and moderator limits

### Before formal deliberation

- Moderators may enforce safety, relevance, duplication, formatting, and process rules; every intervention records a reason.
- Moderators **cannot** assign agenda priority or privately promote a proposal.
- Moderator and senior-member topic recommendations and discussion contributions use the ordinary participant interface, attribution rules, and eligibility rules — **no elevated badges or ranking advantages**.
- Aggregate consultation results and published metrics help form the agenda; no single participant controls it.

### Once formal deliberation begins

Selected deliberation and policy bodies have different documented authority (capacity-limited deliberation; Policy Council recommendation; governing-board adoption unresolved / counsel-gated). Algorithms organize or recommend; humans decide.

---

## 10. Dual-mode isolation (unchanged)

| Lane | Rules |
| --- | --- |
| **public-demo** | Synthetic, unauthenticated, session-scoped, resettable; incapable of gated writes; never loads Pol.is client, `DATABASE_URL`, or Auth.js |
| **gated** | Authenticated PostgreSQL alpha; Phase 4 provider work lands only in authorized packages after register approval |

Call `assertEnvironmentSafe()` before any DB client. Production participant data must never enter prompts, fixtures, logs, screenshots, or test recordings.

---

## 11. Repository hygiene (4.1 Step 0)

Executed at Phase 4.1 start:

1. Verified `origin/main` = `7254cf5…` (PR #16 descendant).
2. Inventoried remote branches vs PRs #1–#16; **no open PRs**.
3. Deleted 15 obsolete remote branches whose PRs were merged (squash-merge divergence ignored; decision based on GitHub merged PR + no open PR).
4. Preserved: `main` only (plus new Phase 4.1 branch).
5. Fetched with prune.

**Branch-protection recommendation (do not silently alter settings):** `main` currently appears unprotected. Recommend requiring PR review + required status checks, and blocking force-push and branch deletion on `main`. Owner/admin action outside this package.

---

## 12. Stop conditions

Stop if any of the following would be required to “finish” a package:

- Installing or calling live Pol.is / undocumented provider features / `xid` without approval
- Weakening public/protected data separation or small-cell suppression
- Allowing elevated roles to privately promote pre-deliberation topics
- Connecting public-demo to gated datastores or provider networks
- Inventing statutory membership or board-binding authority
- Skipping the verification ladder or weakening tests to pass

After 4.1 PR is green: **stop for owner review**. Do not begin 4.2 without explicit authorization.
