# Phase 3 architecture — operational alpha

**Status:** Work Package 3.1 contract as amended by 3.1.1 / ADR 0009; **3.2–3.7 implemented** (first operational vertical slice through 3.6; 3.7 adds immutable `content_revisions` and supporting/counterevidence comparison UX; public-demo remains fixture-backed; **3.8 not started**)  
**Plan:** [phase-3-plan.md](./phase-3-plan.md)  
**ADRs:** [0008](./decisions/0008-phase-3-operational-alpha-contract.md), [0009](./decisions/0009-phase-3-operational-slice-corrections.md)  
**Foundation:** [architecture-phase-2.md](./architecture-phase-2.md), ADRs 0002–0005, capability matrix, audit registry

This document records service boundaries, table groups, routes, and projections for Phase 3. Package 3.2 owns the durable topic/claim/evidence migration and repositories. Package 3.3 owns capability/assurance contracts, audited invitation issuance, and the operator bootstrap ceremony. Later packages own topic authoring UI, submissions, and vendor installs. A real off-device multi-user alpha requires an approved reachable gated deployment and persistent PostgreSQL; do not select a vendor here.

---

## 1. Public-demo versus gated request/data flows

```mermaid
flowchart TB
  subgraph publicDemo [APP_MODE public-demo]
    v1[Visitor]
    fixtures[Fixture catalog]
    demoRoutes[Topic and stage routes]
    v1 --> demoRoutes --> fixtures
  end

  subgraph gated [APP_MODE gated]
    v2[Visitor]
    p[Participant session]
    staff[Staff session]
    op[Operator CLI or bootstrap]
    pubRead[Published projection reader]
    workspace[Gated workspace routes]
    services[Domain services]
    repos[Repositories]
    pg[(PostgreSQL 16)]
    audit[(Audit ledger)]
    capture[CaptureEmailAdapter]
    v2 --> pubRead --> repos
    p --> workspace --> services --> repos --> pg
    staff --> workspace
    services --> audit
    op --> services
    services --> capture
  end

  publicDemo -.->|must not construct| pg
  publicDemo -.->|must not load| AuthRuntime[Auth.js runtime]
```

| Concern | Public-demo | Gated alpha |
| --- | --- | --- |
| Topic pages | `fixtureCatalog` selectors; local TopicsExplorer / EvidenceInventory query state; `discoveryState` active\|proposed | Published projection from DB only |
| Auth / DB | Refused (`assertEnvironmentSafe` / noop adapters) | Auth.js + Drizzle after safe assert |
| Mutations | None for real accounts; local URL/filter state only | Capability-gated services |
| Email | N/A | Capture-only until vendor addendum |
| Alpha reset | N/A (fixtures in repo) | Wipes accounts + topic workflow tables |
| Visitors | **Single-user** synthetic walkthrough (see below) | Invite-only multi-user |
| Geography | Fixture `jurisdictionLevel` / `countyFips` labels | DB columns + TN authoring validation |

**Invariant:** Server components, route handlers, and gated services/repositories must not import the synthetic fixture catalog for gated mutations.

### Public-demo single-user contract

Public-demo means one unauthenticated browser visitor with local, ephemeral, resettable interaction state. It has no accounts, login sessions, shared server-side visitor state, cross-visitor mutations, PostgreSQL/Auth.js/invitation/bootstrap/role/audit writes, or claims that other visitors are live.

Fixed synthetic records may depict multiple example participants and institutional actions to explain the process; they are demonstration fixtures, not live users. Gated improvements may appear in the demo only via fixtures, labels, fixture-backed projections, and shared presentation components with mode-specific data—never via gated repository/service imports, real or demo invitation tokens, fake operational admin controls, audit writes, server-persisted visitor actions, or gated secrets at build/runtime.

---

## 2. Planned service and repository boundaries

Keep domain rules independent of React. Suggested modules (names indicative):

| Layer | Responsibility | Must not |
| --- | --- | --- |
| `src/domain/*` | Shared types/enums/schemas for topic/claim/evidence workflow | Import Next.js, DB clients, fixtures for writes |
| `src/lib/topics/*` services | Topic lifecycle transitions + draft geography metadata | Touch React; skip authz; treat geography as eligibility |
| `src/lib/claims/*`, `src/lib/evidence/*`, `src/lib/submissions/*` | Submission envelope (claim + evidence + link + claim disclosure) | Fetch remote URLs; attach disclosure to both subjects |
| `src/lib/geography/*` | Checked-in TN county FIPS reference + validation | Call external geography APIs |
| `src/lib/moderation/*` | Visibility transitions | Hard-delete history |
| `src/lib/conflicts/*` | Disclosure capture | Publish private detail |
| `src/lib/*/repository.ts` | SQL via Drizzle | Import `@/fixtures` |
| `src/app/workspace/**` | Gated UI (RSC + server actions/route handlers) | Authorize only in UI |
| `src/app/topics/**` | Public read; mode-branched data source | Leak staff fields |
| `src/lib/authz/*` | Capabilities | Infer participant from administrator |
| `src/lib/audit/*` | Registered events | Accept unregistered actions |

Adapter reuse from Phase 2: `PersistenceAdapter`, `AuthAdapter`, `EmailAdapter`, `AuditPublishAdapter`, `VerificationAdapter`. No new adapter vendors in the initial slice.

---

## 3. Table groups and relationships (implemented in 3.2)

Migration: `drizzle/0012_topic_evidence.sql`. Repositories: `src/lib/topics|claims|evidence|conflicts/repository.ts` (gated only).

### 3.1 Core topic group

- `topics` — opaque text id, unique slug (not used as FK identity), title, question, background, scope, **`workflow_state`**, **`publication_status`**, **`jurisdiction_level`** (`statewide` | `county`), **`state_code`** (TN-only in this release), **`county_fips`** (required iff county; derived display names from checked-in FIPS reference), `created_by_account_id`, `published_at`, `published_by_account_id`, `synthetic` (default false), timestamps
- Operational workflow and publication status are independent; pause must not flip publication; published requires publication provenance
- Topic geography is **content/jurisdiction taxonomy only** — not eligibility, residency, representation, or voting; geography edits remain draft-only metadata (3.5)
- No Pol.is conversation ID or popularity/consensus columns

### 3.2 Claims and evidence

- `claims` — topic_id, author_account_id, title, summary, approach_label, workflow_state, moderation_visibility (`visible` | `held` | `hidden`), synthetic, timestamps
- `evidence_submissions` — **single** alpha source-submission model: topic_id, submitter_account_id, source_url + metadata (title, organization, author_type, source_type, limitations), workflow_state, quality_status, moderation_visibility, synthetic, timestamps (no remote fetch/scrape columns)
- `claim_evidence_links` — topic_id + claim_id + evidence_submission_id + relationship (`supporting` | `counterevidence`); unique claim/evidence pair; composite FKs enforce same-topic integrity

### 3.3 Disclosures

- `conflict_disclosures` — disclosing_account_id, nullable `claim_id` and `evidence_submission_id` with CHECK requiring exactly one subject, public_summary, optional private_detail, synthetic, timestamps (no unenforced polymorphic subject_type/subject_id)

### 3.4 Revisions (Package 3.7)

- `content_revisions` — append-only content history (migration `0017_content_revisions`):
  - Exactly one subject: `claim_id` XOR `evidence_submission_id` (CHECK)
  - `topic_id` with same-topic composite FKs (`claim_id, topic_id` → `claims`; `evidence_submission_id, topic_id` → `evidence_submissions`)
  - `revision_number` unique per subject (partial unique indexes)
  - `editor_account_id`, `changed_fields[]` (nonempty), `before_snapshot` / `after_snapshot` JSONB, `synthetic`, `created_at`
  - Claim snapshot shape: `title` / `summary` / `approachLabel`
  - Evidence snapshot shape: `sourceUrl` / `title` / `organization` / `authorType` / `sourceType` / `limitations`
  - Immutable after insert: `content_revisions_immutable` trigger rejects UPDATE/DELETE

**Service boundaries (3.7):**

| Surface | Behavior |
| --- | --- |
| `updateOwnClaimContent` / `updateOwnEvidenceContent` | Owner content edit; writes a revision row **only** when workflow is `changes_requested` (draft edits overwrite without revision history) |
| `resubmitOwnClaim` / `resubmitOwnEvidence` | Subject-specific resubmit (`changes_requested` → `submitted`); does not invent joint claim+evidence resubmit |
| `withdrawOwnClaim` / `withdrawOwnEvidence` | Subject-specific withdraw; revision rows retained |
| Owner history DTOs (`getOwnClaimRevisionHistory` / `getOwnEvidenceRevisionHistory`) | Full before/after snapshots for the owning account; requires `claims.edit_own` / `evidence.edit_own` + ownership |
| Staff history DTOs (`getStaffClaimRevisionHistory` / `getStaffEvidenceRevisionHistory`) | Full snapshots for reviewers; requires `claims.review` / `evidence.review` |
| Public revision summary | Allowlist only: `revisionCount`, `latestRevisionAt`, `changedFieldLabels` on published included rows — never historic bodies, URLs, editor account IDs, or revision row IDs |

**Relationship comparison UX (3.7):** Uses existing `claim_evidence_links` only (`supporting` \| `counterevidence`). No new relationship types or link tables.

### 3.5 Review artifacts

- `claim_reviews` — append-only decision rows (changes_requested | accepted | rejected), public_rationale, private_notes, reviewer_account_id, decided_at; UPDATE/DELETE rejected by trigger
- `evidence_reviews` — append-only workflow and/or quality decisions (`quality_decided` requires quality_status); current claim/evidence row state may be updated separately for filtering; history is never only an overwritten rationale column

### Relationships (logical)

```
accounts 1---* topics.created_by
topics 1---* claims
topics 1---* evidence_submissions
claims *---* evidence_submissions  (via claim_evidence_links; same topic)
claims/evidence 1---* conflict_disclosures  (exactly one subject FK)
claims 1---* claim_reviews
evidence_submissions 1---* evidence_reviews
claims/evidence 1---* content_revisions  (exactly one subject FK; immutable)
all mutable institutional actions ---> audit_events
```

**Non-joins for public APIs:** public projection queries must not require contact_channel, verification artifacts, assent payloads, or disclosure private_detail.

---

## 4. Proposed public read projection

Allowlisted fields for gated anonymous/public topic reads when `publication_status = published`:

| Include | Exclude |
| --- | --- |
| Topic title, question, background, scope, published timestamps, operational workflow public label | Account IDs, contact channels |
| Claims/sources in workflow `accepted` (or explicitly publication-eligible) **and** visibility `visible` | Drafts, rejected-only bodies, held/hidden bodies |
| Evidence quality status + **public** rationale | Private moderation/review notes |
| Public conflict summaries (deepened after 3.8) | Private disclosure detail |
| Revision summaries safe for public (deepened in 3.7/3.10) | Invite tokens, verification cases |
| Allowlisted audit summaries (existing 2.9 projectors) | Raw privatePayload |

Projection builder lives in a pure module (`src/lib/topics/public-projection.ts`) testable without React. **Minimal path is wired in 3.6** via mode-branched `/topics` + `src/lib/topics/gated-public-read.ts`; **3.10** completes and hardens.

---

## 5. Planned routes

### Gated workspace (authenticated)

| Route (planned) | Purpose | Capabilities |
| --- | --- | --- |
| `/workspace` | Alpha home / tasks | session |
| `/workspace/topics` | Staff/participant topic list | read scoped |
| `/workspace/topics/new` | Create topic | `topics.create` |
| `/workspace/topics` | List topics (workflow + publication columns) | `topics.create` (admin gate) |
| `/workspace/topics/new` | Create draft | `topics.create` |
| `/workspace/topics/[slug]` | Edit draft metadata; open/review/reopen/pause/archive; publish readiness + publish | `topics.*` including `topics.publish` |
| `/api/workspace/topics*` | Create/list/update/transition APIs | matching `topics.*`; public-demo 404 |
| `/workspace/topics/[slug]/submit` | Claim/evidence submit with basic relationship | `claims.submit`, `evidence.submit` |
| `/workspace/submissions*` | Own submissions list/detail; public rationales; edit/resubmit | ownership + submit/edit/withdraw |
| `/workspace/review*` | Claim/evidence review queues and decisions | `claims.review`, `evidence.review` |
| `/api/workspace/review*` | Review list/detail/mutations | matching review caps; public-demo 404 |
| `/api/workspace/topics/[id]/publish` | Publish readiness GET + publish POST | `topics.publish`; public-demo 404 |
| `/workspace/review` | Claim and evidence review queues | `claims.review`, `evidence.review` |
| `/workspace/moderation` | Visibility hold/hide/restore-to-visible | `moderation.review_submission` |
| `/staff/invitations` + `POST/GET /api/staff/invitations` | Issue/list invites (hash-only; one-time raw link; public-demo 404) | `invites.issue` |

Exact paths may align with existing `/account/*` and `/staff/*` trees; do not expose them on public-demo.

### Public routes

| Route | Public-demo | Gated |
| --- | --- | --- |
| `/topics`, `/topics/[slug]` | Fixtures (unchanged behavior) | Published projection only |
| `/topics/[slug]/consult` | Demonstration Public Input (fixture) | Remains out of Phase 3 operational scope; **Pol.is planned for Phase 4 of the alpha — not installed or called in Phase 3** |
| Agenda/deliberation/decision | Fixtures | Unchanged unless a later package explicitly says otherwise |

### Mutation / API boundaries

- Prefer server actions or App Router route handlers under `/api/...` that call services.
- Each mutation: CSRF → session → `authorizeCapability` → Zod → transaction → audit.
- Probe-style authz tests may extend `/api/authz/*` patterns from Phase 2.
- Public-demo: gated mutation endpoints return 404.

---

## 6. Transaction and concurrency expectations

| Operation | Transaction scope |
| --- | --- |
| Topic create | topic row + audit |
| Topic operational transition | `workflow_state` update + audit (+ optional changelog); **must not** alter `publication_status` unless the mutation is explicitly a publish/unpublish |
| Submit claim+evidence+disclosure | all inserts/links + audit; fail together |
| Resubmit / edit after changes_requested | content update + append-only `content_revisions` row (on content change) + workflow state + audit (`*.updated` / `*.revision_recorded` / `*.resubmitted` as applicable) |
| Claim workflow decision | `claims.review` + audit |
| Evidence workflow / quality decision | `evidence.review` + audit; must not rewrite unrelated popularity fields |
| Moderation visibility | visibility ∈ {visible,held,hidden} + audit; restore action → visible + `moderation.submission_restored`; never delete revisions |
| Invite issue | invitation row (hash) + audit; raw token only in response memory |
| Bootstrap invitation | singleton lock + zero-admin check + bootstrap invitation (hash) + operator audit |
| Bootstrap finalize | singleton lock + re-check gates + operator_bootstrap verification provenance + activation + administrator grant + completion mark + audit |
| Publish | `publication_status` → published + projection stamp + audit (minimal in 3.6) |
| Alpha reset | documented ordered deletes/truncates in one operator procedure; audited |

**Concurrency:** use row-level conditions (update … where state = expected) or equivalent to prevent lost updates on workflow transitions; follow Phase 2 patterns used for invite claim / dual-control.

---

## 7. Audit event families (planned)

Register in implementing packages (unregistered actions must fail):

| Family | Examples |
| --- | --- |
| `operator.*` | `operator.bootstrap_invitation_issued`, `operator.bootstrap_verification_recorded`, `operator.bootstrap_administrator` |
| `invites.*` | `invites.issued`, `invites.revoked` |
| `topics.*` | **Registered:** `topics.created`, `topics.updated`, `topics.opened`, `topics.review_started`, `topics.reopened`, `topics.paused`, `topics.archived`, **`topics.published` (3.6)** |
| `claims.*` | `claims.draft_created`, `claims.submitted`, `claims.changes_requested`, `claims.accepted`, `claims.rejected`, `claims.withdrawn`, **`claims.revision_recorded` (3.7 registered)** |
| `evidence.*` | parallel to claims + `evidence.quality_decided`, `evidence.quality_revised`, **`evidence.revision_recorded` (3.7 registered)** |
| `conflicts.*` | `conflicts.disclosed`, `conflicts.updated` |
| `moderation.*` | `moderation.submission_held`, `moderation.submission_hidden`, `moderation.submission_restored` |
| `alpha.*` | `alpha.reset_executed` |

Public projectors must never echo contact channels, raw tokens, or private notes.

---

## 8. Reset strategy

Alpha-test interim council requires full reset of included alpha users and topic discussion ([ADR 0007](./decisions/0007-alpha-test-interim-council-dispositions.md)).

**Resettable:** accounts (non-retained), profiles, sessions, invitations, role assignments, verification cases as used in alpha, topics, claims, evidence, disclosures, revisions, moderation rows, conversation pseudonyms tied to alpha accounts, topic-related audit private payloads as specified by the reset runbook.

**Retained outputs:** product source, migrations, and the **post-alpha report** (OQ17)—not live alpha user/topic databases carried into production.

**Not a silent production migration:** restoring an alpha dump into a future production cluster as living membership/topic history is forbidden by contract.

Operator procedure lands in **3.12** (design may start earlier). Reset is gated-only, audited, and never exposed in public-demo.

---

## 9. First operational vertical slice (packages 3.2–3.6)

```mermaid
sequenceDiagram
  participant Op as Operator
  participant Admin as Administrator
  participant Part as Participant
  participant Rev as Reviewer
  participant DB as Gated DB

  Op->>DB: 3.3 bootstrap administrator
  Admin->>DB: 3.3 issue invitation hash
  Part->>DB: Phase 2 accept + onboard + activate
  Admin->>DB: 3.4 create draft topic + open
  Part->>DB: 3.5 submit claim URL relationship disclosure
  Rev->>DB: 3.6 claims.review / evidence.review / quality
  Admin->>DB: 3.6 topics.publish publication_status
  Note over DB: Visitor reads published projection; 3.10 hardens UI depth
```

**Slice done means:** staff can run topic open → submit → review → publish, and a visitor can see the minimal gated published projection—with durable schema, capabilities, and audits. **3.10** hardens presentation/revision/disclosure/moderation depth.

---

## 10. Authorization reminder

- Default deny; UI hide ≠ authorize.
- Administrator ≠ participant voter.
- Council seats ≠ platform roles.
- Active lifecycle + assurance ladder still wrap new capabilities.
- `invites.issue` is an ordinary active-administrator capability.
- `operator.bootstrap_administrator` is an **environment-operator** action (operator secret + label), not a normal authenticated principal capability.
- Alpha staff duty concentration in the project owner is allowed operationally; capability checks and actor audit remain mandatory ([ADR 0008](./decisions/0008-phase-3-operational-alpha-contract.md)).

---

## 10a. First-administrator bootstrap ceremony (3.3)

Implemented in Package 3.3. Summary (full runbook in [secrets-and-operations.md](./secrets-and-operations.md)):

1. Operator authenticates with gated env + `OPERATOR_BOOTSTRAP_SECRET` + non-secret `OPERATOR_LABEL` (secret never on CLI argv).
2. While zero administrators exist, issue at most one live administrator-bootstrap invitation under a DB singleton lock; store token hash only; print raw acceptance link once.
3. Candidate uses the existing accept → contact verification → assent path.
4. **Zero-administrator verification loop:** ordinary `verification.review_case` needs a reviewer/administrator. Finalize may record required alpha attestations only as structurally tagged `operator_bootstrap` decisions (operator label + reason; no fake `reviewer_account_id` as independent review). Exception is scoped to the first-administrator candidate and disabled permanently after completion.
5. Finalize re-locks singleton state, re-checks zero administrators and gates, activates via existing activation rules, grants `administrator` with reason, does not grant a council seat, does not grant participant solely from the admin grant, audits `operator.bootstrap_administrator`, marks bootstrap completed.
6. Concurrent issue/finalize attempts yield one winner; retries after completion fail closed until deliberate alpha reset.
7. Later administrators use ordinary `roles.grant_platform`. Public-demo never constructs this path.

Owner-run interim limitation: operator self-attestation is not independent third-party verification ([open-questions.md](./open-questions.md) OQ21).

---

## 10b. 3.3 follow-ups closed at start of 3.4

1. **Invitation CSRF:** `POST /api/staff/invitations` calls `assertCsrfSafe` after the public-demo mode check and before body parsing (in addition to the network proxy).
2. **Pending-contact uniqueness:** migration `0015_pending_participant_invite_unique` enforces at most one `pending` + `participant` invitation per `lower(intended_contact_channel)`; revoke-and-reissue remains; uniqueness races return a safe conflict without leaking contact or token.
3. **Assurance kinds:** L2/L3/L4 constants live in `src/lib/verification/assertion-kinds.ts`; `seed-assurance.ts` remains seed/test-only (`seedApprovedAssertions`). Operator bootstrap imports kinds from the production-neutral module.

## 10c. Topic authoring service boundary (3.4)

**Implemented.** Package 3.4 owns gated administrator create / metadata-update / open / begin-review / reopen / pause / archive over the existing topic schema.

| Surface | Behavior |
| --- | --- |
| `src/lib/topics/authoring.ts` | Capability + assurance + expected-state mutation + audit in one transaction |
| `src/lib/topics/transitions.ts` | Allowlisted operational transitions only |
| `/workspace/topics*` | Administrator UI; public-demo `notFound()` before gated imports |
| `/api/workspace/topics*` | CSRF on mutations; 401/403/404/409; `Cache-Control: no-store` |

Publication is available via `topics.publish` (3.6). Pausing or archiving never changes `publication_status`. Drafts and unpublished topics are never exposed on gated anonymous `/topics` reads. Public-demo `/topics` remain fixture-backed and must not static-import gated DB/auth/review modules. Stale expected-state updates return conflict without emitting audit.

---

## 11. Deferred by owner / later hardening register

Items below may be completed later **without** silently weakening core authorization, data integrity, environment isolation, auditability, or reset requirements. They are **not** complete.

| ID | Item | Notes |
| --- | --- | --- |
| D1 | Managed PostgreSQL host selection + DPA | Still blocked pending addendum; required for real off-device multi-user alpha once approved |
| D2 | Production email vendor (Resend/SES/etc.) | Capture-only + operator-delivered links until then |
| D3 | Dual-control for all moderation/publish actions | Phase 2 dual-control exists for holds/closure; broader use deferred |
| D4 | File uploads / object storage | Out of initial slice |
| D5 | Remote source fetch, preview, malware scan | Explicitly excluded; URLs stored only |
| D6 | Rich-text authoring dependencies | Plain text / Markdown-as-text TBD later without inventing legal HTML policy |
| D7 | Full-text search engine vendor | 3.11 may use SQL `ILIKE`/simple indexes first |
| D8 | Notifications (email/push) beyond invite/auth | Forbidden until designed |
| D9 | Pol.is-powered Public Input | **Planned Phase 4 alpha integration** — not installed or called in Phase 3; hosted vs self-hosted remains an open permitted-service decision |
| D10 | AI APIs, analytics, payments | Forbidden |
| D11 | Penetration test / formal security review | Before later pilot—not Phase 3 exit fiction |
| D12 | Manual NVDA sign-off on new workspace UI | Track in handoff |
| D13 | Distributed rate limiting | OQ14 carryover |
| D14 | Public attribution model for claim authors | See OQ18 |
| D15 | Post-alpha retention vs alpha wipe edge cases for assent/audit copies in reports | See OQ19 |
| D16 | Participant visibility into others’ in-flight submissions pre-publish | See OQ20 |

Completing a deferred item requires its own package or ADR touch; do not mark it done inside an unrelated package.

---

## 12. Future Pol.is integration boundary

**Public-facing name:** Public Input. When live, copy may say “Public Input, powered by Pol.is.” Pol.is results represent participant preferences, agreement, and disagreement. They do **not** determine factual truth, research quality, agenda qualification, or the institution’s recommendation.

**Phase 3.2 schema boundary (binding now):**

- Internal topic IDs remain the institutional source of truth.
- Future provider conversation IDs must live in a **separate mapping table**, not on `topics`, `claims`, or `evidence_submissions`.
- Provider-specific fields must **not** be added to topic/claim/evidence tables in 3.2.
- Conversation-scoped pseudonyms remain isolated from accounts.
- No public or moderator API may reverse-map opinion activity to contact details or legal identity.
- Imported Pol.is reports will be versioned aggregate snapshots.
- Pol.is outcomes must **never** update evidence-quality fields.
- The future Phase 4 package must define provider approval, authentication, retention, reset, export, outage, moderation, and audit behavior before install.

**Phase 2 registry caution:** The synthetic-only `closed_test_conversations` registry is **not** the production Pol.is registry and must **not** be relaxed or repurposed for live Pol.is.
