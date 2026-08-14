# Phase 4 plan — Computational democracy journey & Public Input

**Status:** Active. Phase 4.1–**4.3** are **owner-approved and complete**. Phase **4.4** engineering merged (PR #20) but is **not accepted as complete** after the 2026-08-14 owner review — P0/P1 integrity defects require remediation. Active package: **4.5A** (Phase 4.4 integrity remediation). Public architecture rebuild (**4.5B+**) must not merge until 4.5A passes the verification ladder.  
**Baseline:** `origin/main` at `86dcfd10157869ba9443adee885332df7cc608a8` (PR #20 Phase 4.4 merged). Phase 4.3 comparison base: `9aba076e09b60ea95e2c69d42380494a1c4398ac`.  
**Related:** [architecture-phase-4.md](./architecture-phase-4.md), [public-input-provider-assessment.md](./public-input-provider-assessment.md), [0010](./decisions/0010-computational-democracy-pipeline.md), [0011](./decisions/0011-idea-commons-formal-pipeline-separation.md), [0012](./decisions/0012-public-input-provider-boundary.md), [0013](./decisions/0013-canonical-formal-topic-page.md), [0014](./decisions/0014-institutional-conversation-lifecycle.md), [0015](./decisions/0015-progressive-evidence-disclosure.md), [0016](./decisions/0016-provider-embed-activation-exact-origin.md), [0017](./decisions/0017-local-versus-remote-reset-semantics.md), [0018](./decisions/0018-aggregate-only-canonical-import-format.md), [0019](./decisions/0019-immutable-report-versioning-and-publication.md), [0020](./decisions/0020-public-input-moderation-versus-provider-moderation.md), [0021](./decisions/0021-complementary-small-cell-suppression.md), [phase-3-handoff.md](./phase-3-handoff.md), [product-charter.md](./product-charter.md)

This plan is a **product/engineering contract**. It is **not** legal clearance, counsel disposition, Pol.is vendor approval, production-launch approval, or authorization to enable a live consultation provider.

**Live Pol.is remains FAIL-CLOSED.** Packages **4.4** and **4.5A** authorize **aggregate import + moderation engineering / integrity remediation only**. They are **not** live activation, raw-export retention authorization, counsel clearance, or the five-area public IA rebuild.

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

Phase 4 retains these deliverables from the prior MVP plan:

1. Supported hosted embed (no undocumented APIs / hidden features) — **engineering shell in 4.3; live activation still blocked**.
2. Provider-neutral conversation mapping (institutional topic ID ≠ provider conversation ID) — adapter in 4.2; gated registry in 4.3.
3. Conversation-scoped pseudonymous participation (no `xid` / identity-linking until approved).
4. Moderation workflow with required reasons; no private agenda promotion.
5. Versioned import/export and consultation reports (aggregates only in public projections).
6. Outage, retention, reset, and audit behavior documented before install — institutional lifecycle + local/remote reset semantics in 4.3; remote wipe verification still an activation gate.

**4.1 documents** supported capabilities, vendor/data-processing approval needs, privacy constraints, and unsupported-feature prohibitions. Live Pol.is is **forbidden** until every activation gate in `src/lib/public-input/lifecycle/activation.ts` is resolved by an explicitly authorized future package (owner language equivalent to `ENABLE LIVE POLIS FOR GATED ALPHA`), plus permitted-services register addendum and counsel dispositions where required. Owner risk acceptance is never counsel `cleared`.

---

## 5. Work packages

| Package | Title | Goal |
| --- | --- | --- |
| **4.1** | Institutional contract and synthetic end-to-end demo | **Complete / owner-approved** (PR #17). |
| **4.2** | Public Input provider assessment, adapter boundary, canonical topic IA | **Complete / owner-approved** (PR #18). |
| **4.3** | Gated conversation lifecycle, embed activation readiness, progressive evidence disclosure | **Complete / owner-approved** (PR #19). |
| **4.4** | Moderation and aggregate report ingestion | Engineering merged (PR #20); **not owner-accepted** pending 4.5A integrity remediation |
| **4.5A** | Phase 4.4 integrity remediation | Fix published-finding immutability, current-consultation report selection, exact-count suppression, title hashing, import concurrency, moderation disclosure, unavailable vs not-found — **exit gate before 4.5B** |
| **4.5B+** | Public IA + qualification + council cycle + demo rebuild | Five-area public architecture (Commons / Public Agenda / Council Agenda / Records / About), qualification traces, council cycle, seven-minute demo — **blocked until 4.5A green** |
| **4.6** | Discussion, deliberation, and policy drafting | Bridge Formal Pipeline stages with operational gated workspace surfaces |
| **4.7** | Member action opportunities | Post-decision civic action surfaces with sponsorship/conflict/expiry rules |
| **4.8** | Hardening and handoff | Security/privacy/a11y hardening; Phase 4 handoff |

Stop after each package for human approval. Do **not** begin **4.5B** (public architecture) until **4.5A** passes verification and owner review. Completing 4.4 / 4.5A aggregate ingest engineering is **not** authorization for a live embed.

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
- `providerConversationRef` / opaque provider mapping tokens

Raw provider exports are **protected data**. Public reports are separate allowlisted aggregate projections. Configurable **small-cell suppression** (including **complementary** suppression — [ADR 0021](./decisions/0021-complementary-small-cell-suppression.md)) applies; synthetic demo provisional threshold is **5**. Production threshold still requires privacy review (**OQ27**) and explicit owner approval of the numeric value (**OQ35**).

Do **not** use `xid` or any identity-linking mechanism until supported status, purpose, retention, access control, deletion, and reidentification risk are approved.

Progressive evidence disclosure (4.3) collapses **already-public** fields for readability. It is **not** a confidentiality or access-control boundary (OQ34; [ADR 0015](./decisions/0015-progressive-evidence-disclosure.md)).

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
| **public-demo** | Synthetic, unauthenticated, session-scoped, resettable; incapable of gated writes; never loads Pol.is client, `DATABASE_URL`, or Auth.js; progressive evidence disclosure and aggregate reports use fixture/public projections only |
| **gated** | Authenticated PostgreSQL alpha; conversation lifecycle (4.3) + aggregate report ingest / moderation (4.4) with `none`/`fixture` provider kinds only; live Pol.is kinds fail closed |

Call `assertEnvironmentSafe()` before any DB client. Production participant data must never enter prompts, fixtures, logs, screenshots, or test recordings.

---

## 11. Repository hygiene

### 4.1 start

1. Verified `origin/main` = `7254cf5…` (PR #16 descendant); deleted obsolete merged remote branches.

### 4.2 start

1. Verified `origin/main` = `122c12c…` (PR #17 merged); no open PR on `phase-4/4.1-computational-democracy-demo-recenter`.
2. Deleted that obsolete remote branch (no force).
3. Created `phase-4/4.2-public-input-adapter-and-topic-navigation` from clean baseline.

### 4.3 start

1. Verified `origin/main` = `9f3fe4221e6eafcd46eccfe8adec0cfd5e7014f7` (PR #18 merged).
2. Deleted obsolete merged remote branch `phase-4/4.2-public-input-adapter-and-topic-navigation` (squash-merged via PR #18; no force).
3. Created / continued `phase-4/4.3-gated-conversation-lifecycle-and-evidence-disclosure` from that baseline.

### 4.4 start

1. Verified `origin/main` = `9aba076e09b60ea95e2c69d42380494a1c4398ac` (PR #19 Phase 4.3 merged).
2. Deleted obsolete merged remote branch `phase-4/4.3-gated-conversation-lifecycle-and-evidence-disclosure` (squash-merged via PR #19; no force).
3. Created / continued `phase-4/4.4-moderation-and-aggregate-report-ingestion` from that baseline.

**Branch-protection recommendation (do not silently alter settings):** `main` branch-protection settings read returned **403** (owner/admin task). Recommend requiring PR review + required status checks, and blocking force-push and branch deletion on `main`. Owner/admin action outside this package — **do not change repository settings from application PRs**.

---

## 11a. Phase 4.1 closure record

| Item | Record |
| --- | --- |
| Owner instruction | `APPROVE PHASE 4.1 COMPLETE. START PHASE 4.2.` (2026-08-13) |
| PR #17 | Merged to `main` at `122c12c2fa7272340910fe94aed5b6b0701102a0` |
| Obsolete branch | `phase-4/4.1-computational-democracy-demo-recenter` deleted after merge confirmation |
| Branch protection | `main` still appears unprotected — recommend require PR review + required checks; block force-push and deletion. Do not silently modify repository settings. |

## 11b. Package 4.2 — acceptance criteria

1. Dated Pol.is capability/privacy/vendor assessment exists with primary sources, pin, unknowns as blockers, hosted vs self-hosted vs no-provider comparison ([public-input-provider-assessment.md](./public-input-provider-assessment.md)).
2. ADRs 0012 (provider boundary) and 0013 (canonical topic page) accepted.
3. Provider-neutral adapter under `src/lib/public-input/provider/` with fixture + no-provider fail-closed paths; zero network calls; no SDK/credentials/migrations/`xid`.
4. Canonical topic route `/formal-topics/[slug]` with Overview / Evidence / Discussions & Proposals; allowlisted `section` only; legacy redirects preserved; Formal Topics is primary nav entry.
5. Small-cell suppression uses explicit `reported`/`suppressed` cells (never coerce suppressed → `0%`); recursive forbidden-key leak checks; cell policy documented.
6. Overview concise; Evidence holds full eligible inventory; Discussions relationships typed/allowlisted; gated relationships empty/not-yet-operational without speculative migration.
7. public-demo and gated loaders isolated (no slug join); provider outage does not remove Overview/Evidence.
8. Full verification ladder green; docs mark 4.2 complete and 4.3 awaiting owner approval.

**Non-goals for 4.2:** live Pol.is; production embed; raw export ingestion; provider credentials/env vars; DB migrations; xid; altering GitHub branch-protection settings.

## 11c. Phase 4.2 closure record

| Item | Record |
| --- | --- |
| Owner instruction | `APPROVE PHASE 4.2 AS COMPLETE` (owner approved Phase 4.2 complete and started 4.3) |
| PR #18 | Merged to `main` at `9f3fe4221e6eafcd46eccfe8adec0cfd5e7014f7` |
| Obsolete branch | `phase-4/4.2-public-input-adapter-and-topic-navigation` deleted after squash-merge confirmation (no force) |
| Branch protection | `main` still appears unprotected — recommend require PR review + required checks; block force-push and deletion. Do not silently modify repository settings. |
| Live Pol.is | Remains fail-closed; 4.2 assessment/adapter ≠ live activation |

## 11d. Package 4.3 — acceptance criteria

1. **Progressive evidence disclosure** on Formal Topic Evidence (and related public evidence surfaces): native `<details>`/`<summary>`; default closed; no auto-open from URL/storage/session; collapsed summary shows relationship, quality, title, source org/type, contribution sentence; expanded panel holds the rest (including source link with `noopener` / `referrerPolicy=no-referrer`). Disclosure is readability only — not confidentiality ([ADR 0015](./decisions/0015-progressive-evidence-disclosure.md), OQ34).
2. **Gated conversation registry** via migration `drizzle/0019_public_input_conversations.sql` and domain under `src/lib/public-input/lifecycle/`: one `current` conversation per topic; workflow states `draft → ready → open → commenting_closed → voting_closed → closed → archived`; recovery transitions with substantive reason + distinct audit action; administrator capabilities `consultations.create|transition|manage_provider_mapping|set_availability` ([ADR 0014](./decisions/0014-institutional-conversation-lifecycle.md)).
3. **Institutional workflow state ≠ provider availability.** Availability enum `not_configured|available|degraded|unavailable` is independent; provider outage must not invent institutional closure.
4. **Operational provider kinds only `none` and `fixture`.** DB CHECK + service layer reject `polis_hosted` / `polis_self_hosted`. No provider SDK, credentials, env vars, or network clients.
5. **Fail-closed embed activation readiness** ([ADR 0016](./decisions/0016-provider-embed-activation-exact-origin.md)): exact-origin allowlist (`https://pol.is` only in production path); reject credential/query-bearing origins; opaque conversation-ref shape validation; `buildEmbedUrl` returns `EMBED_ACTIVATION_GATES_UNRESOLVED` while any gate is unresolved. All **13** gates in `LIVE_PUBLIC_INPUT_ACTIVATION_GATES` ship as `unresolved`. No iframe UI wiring and no network call in 4.3.
6. **Public/staff DTOs never leak `providerConversationRef`** (or raw provider URLs/tokens); staff summaries expose only `hasProviderMapping: boolean`.
7. **Alpha reset:** `public_input_conversations` and `public_input_conversation_transitions` classified **reset**; local wipe does **not** claim remote provider deletion ([ADR 0017](./decisions/0017-local-versus-remote-reset-semantics.md); OQ29).
8. **Docs/ADRs:** phase-4 plan, architecture-phase-4, assessment, open questions (incl. OQ34), threat model, reset docs, README, ADRs 0014–0017; ADR 0012 notes lifecycle landed while live remains blocked.
9. **Tests:** lifecycle transitions/service, embed-url fail-closed, activation gates non-vacuous / all unresolved, EvidenceDisclosure behavior; no weakening of security posture.
10. Full verification ladder green for the package surface; docs mark 4.3 complete; **owner-approved** before 4.4 (see closure record below).

**Non-goals for 4.3:** enabling live Pol.is; resolving activation gates; permitted-services register install; counsel clearance; iframe UI; raw export ingest; xid; claiming remote provider deletion on alpha reset; altering GitHub branch-protection settings.

### Live activation gates (remain unresolved)

Engineering readiness ≠ live activation. Gates (all `unresolved` in code):

1. Hosted versus self-hosted deployment selection  
2. Data Processing Agreement and processing roles  
3. Complete subprocessors (including report/model providers)  
4. Data residency commitment  
5. Retention, deletion, and export procedures  
6. Breach and incident-notification terms  
7. Accessibility and mobile acceptance  
8. CSP, iframe, and third-party-script decision  
9. Permitted-services register / addendum  
10. Counsel review of applicable terms and AGPL implications  
11. Confirmation that xid / stable participant identifiers will not be used  
12. Verified handling of remote data during alpha reset  
13. Owner authorization equivalent to `ENABLE LIVE POLIS FOR GATED ALPHA`

There is no environment variable, database row, or admin toggle that can flip these gates from inside this repository.

### Phase 4.3 closure record

| Item | Record |
| --- | --- |
| Owner instruction | `APPROVE PHASE 4.3 COMPLETE. START PHASE 4.4.` |
| PR #19 | Merged to `main` at `9aba076e09b60ea95e2c69d42380494a1c4398ac` |
| Obsolete branch | `phase-4/4.3-gated-conversation-lifecycle-and-evidence-disclosure` deleted after squash-merge confirmation (no force) |
| Branch protection | `main` settings read returned **403** — recommend require PR review + required checks; block force-push and deletion. Owner/admin task; do not silently modify repository settings. |
| Live Pol.is | Remains fail-closed; 4.3 lifecycle/embed shell ≠ live activation |

## 11e. Package 4.4 — acceptance criteria

1. **ADRs 0018–0021** accepted: aggregate-only canonical import ([0018](./decisions/0018-aggregate-only-canonical-import-format.md)); immutable report versioning/publication ([0019](./decisions/0019-immutable-report-versioning-and-publication.md)); public-input moderation vs provider moderation ([0020](./decisions/0020-public-input-moderation-versus-provider-moderation.md)); complementary small-cell suppression ([0021](./decisions/0021-complementary-small-cell-suppression.md)).
2. **Independent axes** remain visibly separate in docs, domain model, and UI copy — mutating one must not silently mutate another:
   - conversation lifecycle  
   - provider availability  
   - provider-side comment moderation  
   - institutional finding publication eligibility  
   - report import validation  
   - report publication  
   - evidence quality  
   - agenda qualification (still deferred to 4.5; 4.4 must not invent qualification writes)
3. **Aggregate-only ingest:** gated import accepts only the versioned canonical aggregate descriptor; recursive forbidden-key rejection for vote rows/matrices, membership maps, provider participant IDs, account IDs, `xid`, raw provider URLs/tokens; raw provider exports are not an accepted ingest format in 4.4.
4. **Immutable versions:** successful validation creates immutable `public_input_reports` (+ `public_input_report_groups`, `public_input_report_findings`) tied to `public_input_report_imports`; corrections require a new import version; import never auto-publishes.
5. **Publication:** `consultations.reports.review` and `consultations.reports.publish` gate review/publish; public projection is allowlisted only; at most one current published report per the documented conversation/topic rule; public route `/formal-topics/[slug]/consultation/report` without leaking `providerConversationRef` or staff-only fields; drafts/import/review return generic not-found.
6. **Moderation:** `consultations.moderation.record` appends reasoned institutional actions to `public_input_report_moderation_actions`; provider-originated signals (fixture/staff observational only while live is blocked) land in `public_input_provider_moderation_records`; neither axis assigns agenda priority or edits consultation metrics.
7. **Complementary small-cell suppression:** public DTOs suppress reconstruction-enabling complementary cells; suppressed `share` is `null` (never `0`); demo provisional threshold remains **5**; production threshold still OQ27 + OQ35.
8. **Capabilities** registered: `consultations.reports.import`, `consultations.reports.review`, `consultations.reports.publish`, `consultations.moderation.record` (see [capability-matrix.md](./capability-matrix.md)).
9. **Alpha reset:** six new tables classified **reset** — `public_input_report_imports`, `public_input_reports`, `public_input_report_groups`, `public_input_report_findings`, `public_input_report_moderation_actions`, `public_input_provider_moderation_records` — local wipe only; never claim remote provider deletion ([ADR 0017](./decisions/0017-local-versus-remote-reset-semantics.md)).
10. **Dual-mode isolation:** public-demo cannot import/publish/moderate gated reports; synthetic reports remain fixture-backed; zero Pol.is network calls; operational provider kinds remain `none`/`fixture` only.
11. **Docs:** phase-4 plan, architecture-phase-4, open questions (OQ27 note + OQ35), threat model, reset docs, capability matrix, provider assessment, README updated; assessment explicitly states 4.4 aggregate ingest ≠ live Pol.is authorization.
12. Full verification ladder green for the package surface; docs mark 4.4 engineering complete in this PR **awaiting owner approval** before 4.5.

### 4.4 engineering closure (merged; integrity remediation required)

| Item | Record |
| --- | --- |
| Baseline main (4.4 start) | `9aba076e09b60ea95e2c69d42380494a1c4398ac` (PR #19) |
| Branch | `phase-4/4.4-moderation-and-aggregate-report-ingestion` |
| PR #20 | Merged to `main` at `86dcfd10157869ba9443adee885332df7cc608a8` |
| ADRs | 0018–0021 (amended by 4.5A for exact counts, finding lock, current-consultation selection) |
| Migration | `drizzle/0020_public_input_reports.sql` (six reset-classified tables) |
| Owner review | 2026-08-14 — strong foundation; **not accepted as complete** without P0/P1 corrections (see §11f) |
| Live Pol.is | Still fail-closed; aggregate ingest ≠ activation |
| Next | **4.5A** integrity remediation; do not begin 4.5B public IA until 4.5A exit gate |

**Non-goals for 4.4:** enabling live Pol.is; resolving activation gates; permitted-services register install; counsel clearance; iframe UI; raw provider-export retention as first-class ingest; `xid`; agenda qualification services (4.5B+); claiming remote provider deletion on alpha reset; settling production small-cell threshold; altering GitHub branch-protection settings.

## 11f. Package 4.5A — Phase 4.4 integrity remediation

**Owner decision (2026-08-14):** Phase 4.4 is a strong foundation (provider-neutral boundary, aggregate-only import, authorization, public/gated isolation, report state machine, audit coverage, complementary-suppression intent) but must not be accepted as complete until the defects below are fixed. Phase 4.5 begins with this **bounded remediation checkpoint**. **No public architecture work (4.5B+) merges until these corrections pass the verification ladder.**

### Acceptance criteria

1. **Published finding immutability (P0):** `decideFindingPublication` permits eligibility changes only while the parent report is `under_review`; requires `expectedConcurrencyVersion`; DB triggers reject content mutation and post-publication `publication_status` changes. Post-publication corrections require a **new import version**.
2. **Current-consultation report selection (P0):** `getLatestPublishedReportForTopic` resolves the topic’s **current** consultation first, then that conversation’s latest published report. Historical consultations’ published reports are not eligible for the live topic projection. Regression covers two consultations for one topic.
3. **Exact-count small-cell inputs (P0):** Canonical schema `@1.1` requires integer `participantCount` per group; partition sum equals `participationCount`; duplicate normalized labels rejected. Suppression uses exact counts (never `Math.round(share × N)`). Display shares derived from counts. Policy version `4.5.1-exact-count-complementary`. Production threshold still OQ27 / OQ35; exact-count rule confirmation OQ36.
4. **Canonical title hashing (P1):** Persisted `publicTitle` comes only from the validated payload; outer request title is ignored; hash covers all publicly immutable fields including title. Idempotency tests cover differing outer titles with identical payloads.
5. **Import concurrency (P1):** Imports serialize per conversation (`SELECT … FOR UPDATE`); version allocation occurs under that lock; identical concurrent imports resolve to idempotent replay rather than opaque failure when serialized.
6. **Moderation disclosure (P1):** Public DTO omits `moderationDisclosure` unless the immutable import carried a non-empty aggregate summary (`aggregateModerationDisclosure`). Never present “Reviewed 0” as meaningful information.
7. **Unavailable vs not-found (P2):** Gated report route renders `PublicReadUnavailable` for operational `unavailable`; reserves `notFound()` for absent/unpublished reports.
8. **Migration:** `drizzle/0021_public_input_report_integrity.sql` — `participant_count` column + immutability triggers; tables remain alpha-reset classified.
9. **Docs:** ADRs 0018 / 0019 / 0021 amended; architecture + threat model + open questions updated; this section records the exit gate.
10. Full verification ladder green for the remediation surface (format/lint/typecheck/unit/security/build/migration/reset/public e2e/gated report e2e as applicable).

### Exit gate

| Gate | Rule |
| --- | --- |
| Merge | 4.5A PR green with regressions for every finding above |
| Stop | **Do not start 4.5B** (five-area IA, Commons rename, demo rebuild, qualification services, council cycle) until owner approval after 4.5A |
| Live Pol.is | Still fail-closed |

**Non-goals for 4.5A:** public route consolidation; Commons / Public Agenda / Council Agenda / Records / About rebuild; seven-minute demo player; agenda qualification writes; council cadence values; live Pol.is; settling production small-cell threshold without privacy review.

### 4.5A engineering record

| Item | Record |
| --- | --- |
| Baseline main | `86dcfd10157869ba9443adee885332df7cc608a8` (PR #20) |
| Branch | `phase-4/4.5a-report-integrity-remediation` |
| Schema | Canonical import `public-input-aggregate-import@1.1` |
| Migration | `drizzle/0021_public_input_report_integrity.sql` |
| Suppression policy | `4.5.1-exact-count-complementary` |

## 12. Stop conditions

Stop if any of the following would be required to “finish” a package:

- Installing or calling live Pol.is / undocumented provider features / `xid` without approval
- Weakening public/protected data separation, aggregate-only ingest, or complementary small-cell suppression
- Treating progressive disclosure as a confidentiality boundary (or hiding protected fields behind `<details>` alone)
- Claiming local alpha reset deleted remote provider data without verified remote execution
- Allowing elevated roles to privately promote pre-deliberation topics
- Connecting public-demo to gated datastores or provider networks
- Inventing statutory membership or board-binding authority
- Skipping the verification ladder or weakening tests to pass
- Silently resolving activation gates or inventing counsel clearance
- Collapsing independent axes (lifecycle, availability, provider moderation, finding eligibility, import validation, report publication, evidence quality, agenda qualification)
- Auto-publishing imports or silently overwriting immutable report versions

After **4.5A** PR is green: **stop for owner review**. Do not begin **4.5B** public architecture work or enable a live embed without explicit owner approval and required vendor/privacy decisions.
