# Phase 3 Plan — Operational Invite-Only Alpha

**Status:** Active work-package source for Phase 3 (packages 3.1–3.12)  
**Baseline:** Phase 2 foundation at or after `a894317317f3ff1e80d0a3602df69e5b4d8cd589` (tag `phase-2-foundation` recorded in [phase-2-handoff.md](./phase-2-handoff.md))  
**Current package:** **Phase 3 complete and owner-accepted** (`APPROVE PHASE 3 COMPLETE`, 2026-08-13). Active work is Phase 4.1 — see [phase-4-plan.md](./phase-4-plan.md). Baseline on `main` after PR #16: `7254cf5e55cb64426f93f3d7685956655af916ec`.

Related: [product-charter.md](./product-charter.md), [open-source-think-tank-mvp-plan.md](./open-source-think-tank-mvp-plan.md), [phase-2-plan.md](./phase-2-plan.md), [phase-2-handoff.md](./phase-2-handoff.md), [architecture-phase-2.md](./architecture-phase-2.md), [architecture-phase-3.md](./architecture-phase-3.md), [capability-matrix.md](./capability-matrix.md), [data-map.md](./data-map.md), [threat-model.md](./threat-model.md), [open-questions.md](./open-questions.md), [decisions/0006-phase-3-two-lane-sequencing.md](./decisions/0006-phase-3-two-lane-sequencing.md), [decisions/0007-alpha-test-interim-council-dispositions.md](./decisions/0007-alpha-test-interim-council-dispositions.md), [decisions/0008-phase-3-operational-alpha-contract.md](./decisions/0008-phase-3-operational-alpha-contract.md), [decisions/0009-phase-3-operational-slice-corrections.md](./decisions/0009-phase-3-operational-slice-corrections.md)

---

## 1. What Phase 3 is

Phase 3 builds an **operational, invite-only, multi-user alpha-test system** on the Phase 2 gated foundation. It is **not**:

- A single-user alpha
- Merely another synthetic demonstration
- A public launch, public pilot, or open recruitment
- Permanent production history for alpha participants or topic discussions

Someone reviewing Phase 3 should be able to answer:

1. How an operator bootstraps the first real administrator and issues invitations
2. How an active participant submits claims/sources with limitations and conflict disclosures
3. How evidence-quality review stays independent from workflow status, popularity, and later consultation consensus
4. How publication exposes only approved public projections
5. How revision and audit records show how a public result was produced
6. How all alpha-test accounts and topic workflow data can be fully reset

### Dual-mode invariant (unchanged)

| Mode | Purpose | Topic / participant data |
| --- | --- | --- |
| **Public demo** (`APP_MODE` unset or `public-demo`) | Synthetic institutional walkthrough | Fixture catalog only; **never** constructs gated DB or Auth.js runtime |
| **Gated alpha** (`APP_MODE=gated`) | Invite-only multi-user operational workflow | PostgreSQL 16 + Drizzle; resettable alpha data; no carry-over into a later production system |

### Public-demo single-user invariant

The public demo remains a **single-user synthetic walkthrough**:

- one unauthenticated browser visitor
- no public-demo accounts or login sessions
- no shared server-side visitor state
- no cross-browser or cross-visitor mutations
- no PostgreSQL, Auth.js, invitation, bootstrap, role, or audit writes
- no claim that another visitor’s activity is live
- interactive state is local, ephemeral, and safely resettable
- refreshing or restarting may return the demonstration to its fixture state

Fixed synthetic fixtures may depict **multiple example participants**, viewpoints, reviews, and institutional actions to explain a multi-user process. Those records are not live users.

Future gated improvements may be mirrored into the demo only through updated fixtures, clearer labels, fixture-backed projections of later workflow states, and shared presentation components that receive mode-specific data. The demo must **never** import gated repositories/services, issue invitation tokens, create fake operational administrator controls, write audit events, persist visitor actions on the server, simulate other current visitors, or require gated secrets at build or runtime.

### Standing delivery rule — public-demo visual parity (owner-approved 3.8)

Every future **user-visible** Phase 3 work package (through **3.10** and beyond where the feature can be represented safely) must add or update a **fixture-backed preview** so phone-based review can inspect the changed surface without a gated session:

- Public-demo remains synthetic, unauthenticated, single-user, local/ephemeral, resettable, and isolated from gated runtime dependencies.
- Prefer stable, shareable deep links (for example `/demo/workflow?task=…&step=…` for practice, or `/demo/workflow?view=…` for secondary snapshots) so a PR can point reviewers at the exact phone surface.
- Use fixed role-view snapshots and local query/client state only; never present a local toggle as a real institutional moderation action, account, invitation, or audit write.
- Label synthetic previews plainly (“Synthetic role preview,” “Example held state,” “Preview next state”). Do not add a fake operational admin console.

### Hard rules for agents and collaborators

- Complete **only** the approved work package; stop for human review before the next package.
- Do **not** mark later packages complete from this contract.
- Do **not** install new external services in 3.1–3.12 unless the permitted-services register (Phase 2 §4) and a linked ADR explicitly authorize the install.
- Managed PostgreSQL host and production email vendors remain **blocked** pending addenda; do not select or install them in Phase 3 packages that only consume existing adapters.
- Public-demo paths must not import gated clients, `DATABASE_URL`, or mutation services that touch real alpha data.
- Server components, route handlers, and gated service/repository modules must **not** import the synthetic fixture catalog for gated mutations.
- Hiding a control in the UI is never authorization.
- Owner risk acceptance is never equivalent to counsel status `cleared`.

---

## 2. Locked architectural decisions

These are binding for packages 3.2–3.12 (recorded in [ADR 0008](./decisions/0008-phase-3-operational-alpha-contract.md), amended by [ADR 0009](./decisions/0009-phase-3-operational-slice-corrections.md), and [architecture-phase-3.md](./architecture-phase-3.md)):

1. **One repository / one Next.js App Router application.**
2. **PostgreSQL 16 + Drizzle** remains the gated persistence stack.
3. **Domain and workflow rules stay independent from React** (services/repositories callable from route handlers and tests).
4. **Gated mutations never read the synthetic fixture catalog** as a write source.
5. **Public-demo mode remains fixture-backed** and must never construct the gated database or authentication runtime.
6. **Topic operational workflow is independent from publication status** (ADR 0009). Pausing submissions must not unpublish an already published topic.
7. **Gated public read model exposes only published projections** (`publication_status = published`). Drafts, rejected material, private moderation notes, contact channels, verification records, and account identifiers are not public.
8. **All mutations** use server-side `authorizeCapability` checks, Zod validation, transactions where multiple records change, CSRF protection, and registered audit events.
9. **Store source URLs and submitter-provided metadata initially.** Do not fetch, scrape, preview, or download remote source content in the initial slice.
10. **Do not add** file uploads, rich-text dependencies, AI APIs, analytics, payments, notifications, or new external services in the Phase 3 operational slice. **Pol.is-powered Public Input** is planned for **Phase 4 of the alpha**; it is **not installed or called in Phase 3**.
11. **Evidence-review status** remains independent from submission workflow status, participant popularity, and later consultation consensus.
12. **Revisions are preserved.** Withdrawal, rejection, or moderation does not erase institutional history.
13. **Alpha-test data remains fully resettable** (no alpha users or topic discussions carried into a later production system).
14. **A real off-device multi-user alpha** requires an approved reachable gated deployment and persistent PostgreSQL. Do **not** select a managed host or email vendor in the contract packages.

---

## 3. Package outcomes (3.1–3.12)

| Package | Outcome |
| --- | --- |
| 3.1 | Written operational contract, architecture, and ADR 0008 |
| 3.1.1 | Contract corrections (ADR 0009) + plain-language public UI |
| 3.2 | Durable topic/evidence schema and repositories, including basic claim↔evidence supporting/counterevidence links (migrations; no authoring UI yet) |
| 3.3 | Capability additions + audited first-administrator bootstrap and invitation issuance |
| 3.4 | Topic authoring and operational workflow transitions (draft → open → …); publication status stays independent |
| 3.5 | Participant claim/evidence submissions with basic relationship, limitations, and conflict disclosure |
| 3.6 | Claim/evidence review queues, evidence-quality decisions, and **minimal visitor-visible publish path** |
| 3.7 | Richer counterevidence linking/comparison and immutable revision history |
| 3.8 | Conflict-disclosure workflow depth and moderation visibility actions |
| 3.9 | Source-URL security and abuse controls (no remote fetch) |
| 3.10 | Complete and harden the gated public topic interface (revision, disclosure, moderation, presentation depth); public-demo fixtures preserved |
| 3.11 | Search and export for staff/account-appropriate scopes |
| 3.12 | Operational hardening, reset drill, and Phase 3 handoff |

### First operational vertical slice (packages 3.2–3.6)

Demonstrable path after 3.6 (still invite-only, still resettable):

operator bootstrap → invitation → onboarding → topic create/open → claim/source submit (with supporting/counterevidence relationship) → claim/evidence review → administrator sets `publication_status = published` → **visitor sees** the published topic, accepted visible claims/sources, quality labels, and public review explanations

Package **3.10** then completes and hardens that public interface. It is not the first introduction of visitor-visible gated publication.

---

## 4. Phase 3 end-to-end acceptance journey

Phase 3 is complete only when a closed alpha environment can demonstrate all of the following without fixture mutations:

1. An operator bootstraps the first real administrator safely (audited gated CLI or operator workflow; not public-demo).
2. The administrator issues an invitation (hashed token; raw token shown once or delivered via operator channel until email vendor addendum).
3. The participant completes the existing gated account/onboarding process (Phase 2 assent, verification, activation gates).
4. An administrator creates and opens a topic.
5. An active participant submits a claim, source URL, relationship (supporting/counterevidence), limitations, and conflict disclosure.
6. A reviewer requests changes or records an evidence-quality decision.
7. A moderator can record a reasoned visibility action without deleting history.
8. An administrator publishes the topic.
9. A visitor sees the published topic and review explanations but no private account, verification, contact, or granular participation data.
10. Revision and audit records show how the public result was produced.
11. The operator can reset all alpha-test accounts and topic workflow data.

---

## 5. Planned workflow and publication states (contract only — not implemented in 3.1)

Phase 1 fixture `TopicStatus` (`open` / `paused` / `closed`) and institutional `TopicStage` remain for the **public-demo catalog**. Gated alpha separates **operational workflow** from **publication status** ([ADR 0009](./decisions/0009-phase-3-operational-slice-corrections.md)). Mapping into demo labels is a presentation concern; see [open-questions.md](./open-questions.md) OQ9a / OQ18.

### 5.1 Topic operational workflow (independent of publication)

| State | Meaning |
| --- | --- |
| `draft` | Administrator-authored brief; not open for submissions |
| `open_for_submissions` | Active participants may submit claims/evidence |
| `under_review` | Submissions frozen or limited; staff review in progress |
| `paused` | Temporarily not accepting submissions |
| `archived` | Closed for further workflow; retained for audit/reset until alpha wipe |

### 5.1a Topic publication status (independent axis)

| Status | Meaning |
| --- | --- |
| `unpublished` | No visitor-facing gated public projection |
| `published` | Approved public projection available to visitors on gated public routes |

**Hard rule:** Changing operational workflow (including `topics.pause` / reopen) **must not** change `publication_status`. Pausing an already published topic leaves it published unless a separate unpublish/archive policy action is explicitly modeled later.

#### Topic operational transitions

| From | To | Actor capability | Reason required? | Audit event (planned) |
| --- | --- | --- | --- | --- |
| (none) | `draft` | `topics.create` | No | `topics.created` |
| `draft` | `draft` | `topics.update` | No | `topics.updated` |
| `draft` | `open_for_submissions` | `topics.open` | No | `topics.opened` |
| `open_for_submissions` | `under_review` | `topics.update` (admin) | Recommended | `topics.review_started` |
| `open_for_submissions` | `paused` | `topics.pause` | Yes | `topics.paused` |
| `under_review` | `open_for_submissions` | `topics.open` | Yes | `topics.reopened` |
| `under_review` | `paused` | `topics.pause` | Yes | `topics.paused` |
| `paused` | `open_for_submissions` | `topics.open` | Yes | `topics.reopened` |
| `*` (except archived) | `archived` | `topics.archive` | Yes | `topics.archived` |

#### Topic publication transitions

| From | To | Actor capability | Reason required? | Audit event (planned) |
| --- | --- | --- | --- | --- |
| `unpublished` | `published` | `topics.publish` | Yes | `topics.published` |
| `published` | `unpublished` | `topics.publish` (or later dedicated unpublish if split) | Yes | `topics.unpublished` |

**Disallowed:** skipping `draft` creation; publishing without a reviewed topic ready for projection; any transition by UI-only checks; treating pause as unpublish.

**Alpha note:** An administrator may perform reviewer/moderator **operations** where Phase 2 already permits administrator fallback, but every action records the **actual capability exercised** and the actor account.

### 5.2 Claim / evidence submission workflow

Applies to claim records and evidence-source submission records (linked; may share a submission envelope in 3.5).

| State | Meaning |
| --- | --- |
| `draft` | Authoring; not in review queue |
| `submitted` | In staff queue |
| `changes_requested` | Returned to submitter with reason |
| `accepted` | Workflow-accepted for inclusion in publication pipeline |
| `rejected` | Workflow-rejected; history retained |
| `withdrawn` | Submitter withdrew; history retained |

#### Submission transitions

| From | To | Actor capability | Reason required? | Audit event (planned) |
| --- | --- | --- | --- | --- |
| (none) | `draft` | `claims.submit` / `evidence.submit` | No | `claims.draft_created` / `evidence.draft_created` |
| `draft` | `draft` | `claims.edit_own` / `evidence.edit_own` | No | `*.updated` |
| `draft` | `submitted` | `claims.submit` / `evidence.submit` | No | `*.submitted` |
| `submitted` | `changes_requested` | `claims.review` (claims) / `evidence.review` (evidence) | Yes | `*.changes_requested` |
| `changes_requested` | `submitted` | `claims.edit_own` / `evidence.edit_own` then submit | No | `*.resubmitted` |
| `submitted` | `accepted` | `claims.review` / `evidence.review` | Yes (brief rationale) | `*.accepted` |
| `submitted` | `rejected` | `claims.review` / `evidence.review` | Yes | `*.rejected` |
| `draft` / `submitted` / `changes_requested` | `withdrawn` | `claims.withdraw_own` / `evidence.withdraw_own` | Recommended | `*.withdrawn` |

**Disallowed:** submitter self-accept; deleting history on withdraw/reject; changing evidence-quality enum via submission workflow alone; using `evidence.review` to decide claim workflow (use `claims.review`).

### 5.3 Evidence-quality review (independent axis)

| State | Meaning |
| --- | --- |
| `pending` | No quality decision yet |
| `accepted` | Meets rubric for the stated use |
| `limited` | Usable with published limitations |
| `disputed` | Material conflict on quality/reliability |
| `rejected` | Does not meet rubric |

#### Quality transitions

| From | To | Actor capability | Reason required? | Audit event (planned) |
| --- | --- | --- | --- | --- |
| (default on submit) | `pending` | system | No | (covered by `*.submitted`) |
| `pending` | `accepted` / `limited` / `disputed` / `rejected` | `evidence.review` | Yes | `evidence.quality_decided` |
| any decided | another decided | `evidence.review` | Yes | `evidence.quality_revised` |

**Independence rule:** Changing quality status must not silently flip submission workflow status, popularity metrics, or consultation consensus fields (consultation remains out of Phase 3 scope).

### 5.4 Moderation visibility (independent axis)

Stored visibility values are only:

| State | Meaning |
| --- | --- |
| `visible` | Eligible for staff and (when topic `publication_status = published`) public projection if otherwise allowed |
| `held` | Temporarily withheld from public projection; retained |
| `hidden` | Hidden from public projection; retained |

**Restoration** is an **action**, not a stored state: it transitions `held`/`hidden` → `visible` and emits `moderation.submission_restored`.

#### Visibility transitions

| From | To | Actor capability | Reason required? | Audit event (planned) |
| --- | --- | --- | --- | --- |
| `visible` | `held` | `moderation.review_submission` | Yes | `moderation.submission_held` |
| `visible` / `held` | `hidden` | `moderation.review_submission` | Yes | `moderation.submission_hidden` |
| `held` / `hidden` | `visible` (restore action) | `moderation.review_submission` | Yes | `moderation.submission_restored` |

**Disallowed:** hard-delete of submission content as the moderation action; public exposure of private moderation notes; persisting a distinct `restored` enum value.

---

## 6. Planned capability additions and role mappings

Existing Phase 2 capabilities and rules remain in force ([capability-matrix.md](./capability-matrix.md)):

- Administrator does **not** automatically gain `institutional.vote` / participant rights.
- Council seats remain independent from platform roles.
- Active lifecycle and assurance checks still apply via `authorizeCapability`.
- During alpha, administrator may fall back for reviewer/moderator **operations** where Phase 2 already allows that pattern; audit must record the capability and actor.

### New capabilities (implemented in 3.3; topic UI begins 3.4+)

| Capability | Lifecycle | Platform role | Ownership / seat | Notes |
| --- | --- | --- | --- | --- |
| `topics.create` | active | administrator | — | Creates `draft` topic (`publication_status = unpublished`) |
| `topics.update` | active | administrator | — | Edit draft / meta; not a substitute for publish |
| `topics.open` | active | administrator | — | → `open_for_submissions` |
| `topics.publish` | active | administrator | — | Sets `publication_status = published` (independent of pause); reason required |
| `topics.pause` | active | administrator | — | → operational `paused`; **does not** change publication status |
| `topics.archive` | active | administrator | — | → `archived`; reason required |
| `claims.submit` | active | participant | — | Create/submit own claims |
| `claims.edit_own` | active | participant | own draft/changes_requested | Server checks ownership |
| `claims.withdraw_own` | active | participant | own non-terminal where allowed | History retained |
| `claims.review` | active | reviewer **or** administrator | — | Claim workflow accept/reject/changes_requested only |
| `evidence.submit` | active | participant | — | Source URL + metadata only; may link supporting/counterevidence |
| `evidence.edit_own` | active | participant | own draft/changes_requested | No remote fetch |
| `evidence.withdraw_own` | active | participant | own | History retained |
| `evidence.review` | active | reviewer **or** administrator | — | Evidence workflow accept/reject/changes **and** evidence-quality decisions |
| `conflicts.disclose_own` | active | participant (any role that submits) | own disclosure | Required on submit path in 3.5 |
| `moderation.review_submission` | active | moderator **or** administrator | — | Visibility hold/hide/restore-to-visible with reason |

### Operator / invite capabilities (3.3)

| Action | Lifecycle | Actor | Notes |
| --- | --- | --- | --- |
| `operator.bootstrap_administrator` | n/a | **Environment operator** (operator-only secret + label; not a normal account capability) | First-administrator ceremony only; audited; never public-demo; permanently refused after completion until alpha datastore reset |
| `invites.issue` | active | **administrator** (ordinary capability) | Creates invitation with hashed token; raw token/link returned once for operator delivery while email remains capture-only |

Gaining `administrator` does **not** itself grant participant voting rights or a council seat. Exact assurance ladder rows for new Phase 3 capabilities are set in 3.3 without weakening Phase 2 assurance tests.

### First-administrator bootstrap ceremony (3.3 contract)

Documented before implementation. The ceremony must:

1. Authenticate the environment operator through `OPERATOR_BOOTSTRAP_SECRET` (or equally strong operator-only mechanism)—never as a CLI argument.
2. Create one administrator-bootstrap invitation only while the database has **no** administrator.
3. Persist **only** the token hash; display the raw acceptance link **once** for operator delivery.
4. Have the candidate accept via the existing invitation path and complete contact verification plus applicable assent.
5. Explicitly resolve the zero-administrator verification loop: ordinary review requires a reviewer/administrator, but none exist yet. Any one-time operator attestation is structurally identified as `operator_bootstrap` (not an independent reviewer decision), scoped to the first-administrator candidate, audited with a non-secret operator label and substantive reason, and permanently disabled after bootstrap completion.
6. Activate the candidate only after required bootstrap gates pass (contact, assent, verification/eligibility floor, counsel activation gates).
7. Grant the `administrator` role with recorded reason and provenance; do **not** grant a council seat; do **not** grant participant merely because administrator was granted (ordinary onboarding may already have granted participant independently).
8. Enforce a persistent singleton/lock (or equivalent DB invariant) so concurrent finalize attempts cannot create two first administrators.
9. After completion, further first-admin bootstrap issuance/finalization refuses until deliberate alpha reset; later administrators use ordinary `roles.grant_platform`.

Owner-run alpha limitation: operator self-attestation for the first candidate’s verification floor is an interim engineering path, not third-party or government-ID verification. See [open-questions.md](./open-questions.md) OQ21.

---

## 7. Operational carryovers (prominent)

| Item | Current state | Phase 3 handling |
| --- | --- | --- |
| Email delivery | **Capture-only** (`CaptureEmailAdapter`) | Keep until vendor addendum; 3.3 must support **operator-delivered single-use links** |
| Invitation issuance UI/CLI | **Implemented in 3.3** (`/staff/invitations`, `invites.issue`) | Operator-delivered single-use links; email remains capture-only |
| First-administrator bootstrap | **Implemented in 3.3** (`npm run operator:bootstrap`) | Audited operator ceremony; OQ21 for interim self-attestation |
| Token safety | Phase 2 hashes invite tokens | Raw tokens shown **once**, never persisted unhashed, never written to application logs, never exposed in public-demo |
| Managed PostgreSQL | Blocked pending addendum | Do **not** select/install in contract packages; a real off-device multi-user alpha still **requires** approved reachable gated deployment + persistent PostgreSQL when that addendum lands |
| Production email vendor | Blocked pending addendum | Do **not** select/install in contract packages |
| Public topic pages | Fixture-backed (`/topics`, `/topics/[slug]`) | Minimal gated **published** projection by end of **3.6**; **3.10** completes/hardens; public-demo fixtures remain intact |

---

## 8. Permitted-services posture for Phase 3

Phase 3 **inherits** [phase-2-plan.md](./phase-2-plan.md) §4. No new vendor classes are approved by this contract.

Still **forbidden in Phase 3** unless a future ADR + register update says otherwise: payments, analytics, AI APIs, identity-verification SDKs, remote source fetching services, file-storage vendors. **Pol.is:** planned for Phase 4 of the alpha; not installed or called in Phase 3. Hosted versus self-hosted Pol.is remains a future permitted-service, privacy, deployment, and operational decision.

---

## 9. Privacy, security, accessibility, governance assumptions

| Area | Assumption |
| --- | --- |
| Privacy | Public projections exclude account IDs, contact channels, verification artifacts, private moderation notes, drafts, and rejected-only material |
| Security | CSRF on browser mutations; Zod at boundary; transactions for multi-row writes; rate limits extended in 3.9; no secrets in client bundles |
| Accessibility | New gated and public topic UIs keep keyboard access, ≥44px targets, 16px form text, no hover-only actions (same Phase 1/2 bar) |
| Governance | Alpha-test interim council scopes (ADR 0007) remain; do not invent statutory membership or board-binding authority; prefer **delegate** / account holder language |
| Evidence integrity | Quality labels ≠ popularity; algorithms (later phases) recommend only |
| Reset | Alpha wipe removes accounts and topic workflow data; retained institutional outputs are the product + post-alpha report (OQ17) |

---

## 10. Work packages

### Work package 3.1 — Operational contract

**Status:** Complete when this file, [architecture-phase-3.md](./architecture-phase-3.md), and [ADR 0008](./decisions/0008-phase-3-operational-alpha-contract.md) are accepted and AGENTS/README/handoff updates land.

**Objective:** Lock the multi-user alpha definition, workflow contract, capabilities, data boundaries, and package sequence so 3.2–3.12 do not invent core rules.

**Prerequisites:** Phase 2 foundation available; ADR 0006/0007 understood; no runtime Phase 3 work started.

**Implementation steps:**

1. Create `docs/phase-3-plan.md` (this file) covering packages 3.1–3.12.
2. Create `docs/architecture-phase-3.md` with flows, boundaries, table groups, projections, routes, audit families, reset, vertical slice, and deferred register.
3. Create `docs/decisions/0008-phase-3-operational-alpha-contract.md`.
4. Update `AGENTS.md` to use this plan as the active Phase 3 package source while preserving operating rules.
5. Update `README.md` status and documentation map without claiming Phase 3 runtime exists.
6. Update `docs/phase-2-handoff.md` CI evidence URL.
7. Add open questions only where 3.1 exposes genuine unresolved decisions.

**Expected user-visible outcome:** None in the running app. Developers gain an implementable contract.

**Authorization and audit requirements:** Document planned capabilities and audit event families; do not register or enforce them yet.

**Privacy/security/accessibility assumptions:** Documentation must not expose secrets; must restate demo/gated isolation and accessibility bar for later UI packages.

**Tests and acceptance criteria:**

- A developer can implement 3.2–3.12 without inventing workflow, permissions, data boundaries, or operational definition.
- Contract consistently describes a real multi-user gated alpha.
- First operational vertical slice (3.2–3.6) is explicit.
- Public-demo and gated data cannot be confused.
- Every mutation has a planned capability, validation boundary, transaction expectation, and audit event.
- Public versus protected data is explicit.
- Owner-deferred items are visible and not falsely marked complete.
- No documentation claims unimplemented Phase 3 functionality already exists.
- `npm run lint`, `typecheck`, `test`, and `build` pass (docs-only; e2e may be skipped).

**Non-goals:** Dependencies, migrations, routes, APIs, components, repositories, capability code, vendor selection, weakening Phase 2 gates/tests.

**Stop condition:** Human review and approval before starting **3.2**.

---

### Work package 3.2 — Durable topic/evidence model

**Status:** Complete (schema + repositories; awaiting human approval before 3.3).

**Objective:** Add gated Drizzle tables and repositories for topics (separate `workflow_state` and `publication_status`), claims, evidence submissions, basic `claim_evidence_links` (`supporting` | `counterevidence`), disclosures, moderation visibility (`visible`/`held`/`hidden`), and quality axes—without authoring UI. Rich revision history remains **3.7**.

**Prerequisites:** 3.1 and 3.1.1 Checkpoint 1 approved.

**Implemented decisions (3.2):**

1. Migration `drizzle/0012_topic_evidence.sql` adds enums and tables: `topics`, `claims`, `evidence_submissions` (single source-submission model; URL + metadata only), `claim_evidence_links` (composite same-topic FKs), `conflict_disclosures` (exactly one of `claim_id` / `evidence_submission_id`), append-only `claim_reviews` / `evidence_reviews` (DB immutability triggers).
2. Topic `workflow_state` and `publication_status` are independent; `paused` + `published` allowed; published requires `published_at` + `published_by_account_id`; no Pol.is / popularity columns.
3. Moderation visibility enum is `visible` | `held` | `hidden` only (no stored `restored`).
4. Gated repositories: `src/lib/topics|claims|evidence|conflicts/repository.ts` with `assertEnvironmentSafe()` via `src/lib/persistence/gated.ts`; expected-state updates for workflow/publication/quality; no fixture imports; no public mutation APIs.
5. Synthetic seed + gated E2E truncate lists include the new tables; public-demo fixtures unchanged.

**Expected user-visible outcome:** None in UI. Migrations apply in gated local/CI DB.

**Authorization and audit:** No public mutation APIs yet; repository tests may simulate actors. Capability enforcement remains **3.3**.

**Privacy/security/accessibility:** No public projection yet; repository types do not join contact/verification/assent/pseudonym tables. Disclosure `private_detail` is structurally separate from `public_summary`.

**Tests and acceptance criteria:**

- Clean migrate from empty DB.
- Invalid state combinations rejected; `paused` + `published` is allowed.
- Public-demo build still has zero `DATABASE_URL` requirement.
- Fixture catalog unchanged in behavior.

**Non-goals:** Authoring UI, publish routes, invite bootstrap, remote URL fetch, file uploads, rich revision UX (3.7).

**Stop condition:** Human review before **3.3**.

---

### Work package 3.3 — Capabilities and operator bootstrap

**Status:** Complete (awaiting human approval before 3.4).

**Objective:** Add planned capabilities to the matrix/authz code; deliver audited first-administrator bootstrap and invitation issuance with operator-delivered single-use links (email remains capture-only unless an addendum lands). Preserve the public-demo single-user invariant.

**Prerequisites:** 3.2 schema available; Phase 2 auth/invite accept paths unchanged in spirit.

**Implemented:**

1. Phase 3 capabilities + L3 assurance + table-driven authz tests; `operator.bootstrap_administrator` kept as a typed operator action (not an account capability).
2. Migrations `0013_invitation_bootstrap` / `0014_bootstrap_verification_provenance`; `invites.issue` service + `/staff/invitations` + `POST /api/staff/invitations` (hash-only; one-time raw link; no-store).
3. `npm run operator:bootstrap` issue/finalize ceremony with singleton lock, `operator_bootstrap` verification provenance, activation gates, and single administrator grant (no council seat).
4. Public-demo single-user copy on How Joining Works; issuance/bootstrap absent in public-demo.
5. Operator runbook in [secrets-and-operations.md](./secrets-and-operations.md); OQ21 for interim operator self-attestation.

**Expected user-visible outcome:** Gated administrator can obtain a one-time invite link/token to give a participant; public-demo remains a single-user synthetic walkthrough.

**Authorization and audit:** All issuance/bootstrap paths require capability or operator secret + audit; CSRF on browser forms.

**Privacy/security/accessibility:** Tokens single-use/expiring; no token recovery after leave/reload; staff UI keyboard-usable.

**Tests and acceptance criteria:**

- Cannot bootstrap second “first admin” silently.
- Invite accept still works with issued tokens.
- Capture email may record messages in gated test without vendor.
- Public-demo exposes no bootstrap/invite issuance APIs.

**Non-goals:** Choosing Resend/SES/etc.; managed DB; topic UI.

**Stop condition:** Human review before **3.4**.

---

### Work package 3.4 — Topic authoring

**Status:** Complete (awaiting human approval before 3.5).

**Objective:** Gated workspace UI + mutations for administrators to create, update, open, begin-review, reopen, pause, and archive topics. Show operational workflow and publication status as separate fields. Publish mutation may land with 3.6; pause must not flip publication.

**Prerequisites:** 3.3 capabilities live; Checkpoint 1 corrections (invitation CSRF, pending-contact uniqueness, production-neutral assurance kinds).

**Implemented:**

1. Domain services in `src/lib/topics/authoring.ts` over the existing repository; expected-state workflow updates; draft-only metadata; atomic audit append.
2. Transition table enforced server-side (`src/lib/topics/transitions.ts`); no publish/unpublish path.
3. Workspace pages `/workspace/topics`, `/new`, `/[slug]` and APIs under `/api/workspace/topics*` with CSRF, capability checks, no-store, public-demo 404.
4. 3.3 follow-ups: invitation CSRF, pending-contact unique index `0015`, assertion-kinds module.
5. Public-demo process copy clarifies fixed walkthrough; workspace routes absent.

**Expected user-visible outcome:** Administrator creates a draft topic and opens it for submissions.

**Authorization and audit:** `topics.*` capabilities; events `topics.created|updated|opened|review_started|reopened|paused|archived` (not `topics.published`).

**Privacy/security/accessibility:** Staff-only; no public leak of drafts; keyboard-usable forms.

**Tests and acceptance criteria:** Participant cannot create topics; invalid transitions fail closed; pausing a published topic keeps `publication_status = published`; audit rows present; public-demo workspace APIs 404.

**Non-goals:** Full public-interface hardening (3.10); participant submissions (3.5); publication (3.6).

**Stop condition:** Human review before **3.5**.

---

### Work package 3.5 — Participant claim/evidence submissions

**Status:** Complete (awaiting human approval before 3.6).

**Objective:** Active participants submit claims and evidence source URLs with **basic** supporting/counterevidence relationship, limitations, and conflict disclosure. Owner-approved amendment also delivers Tennessee topic geography classification (not eligibility) and public-demo Tennessee discovery / evidence inventory interactivity over fixtures.

**Prerequisites:** 3.4 topics can be `open_for_submissions`.

**Implementation steps:**

1. Submission forms in gated workspace for own claims/evidence (`/workspace/topics/[slug]/submit`, `/workspace/submissions`).
2. Persist URL + metadata only (title, organization, authorType, sourceType, limitations) and `claim_evidence_links.relationship` (`supporting` | `counterevidence`). Never fetch URLs.
3. Require `conflicts.disclose_own` on submit; attach one disclosure to the **claim** only (exactly-one-subject). “No known conflict” still stores a meaningful public summary.
4. Enforce edit/withdraw ownership rules and workflow transitions in §5.2 (content edit in draft/changes_requested; withdraw retains rows).
5. Transaction: claim + evidence + link + disclosure + allowlisted audits; fail closed on audit failure.
6. Topic geography: `jurisdiction_level` / `state_code` / `county_fips` with TN-only authoring, checked-in 95-county FIPS reference, draft-only geography edits, statewide backfill in migration `0016`.
7. Public-demo: `discoveryState` active|proposed; TopicsExplorer advanced search with URL query state; EvidenceInventory local sort/filter. Not gated DB search (3.11).
8. Tests for ownership, topic-state gates, relationship integrity, Zod URL validation (syntax only), geography invariants, discovery filters, and evidence inventory.

**Expected user-visible outcome:** Participant submits a claim with a source URL, supporting or counterevidence relationship, and disclosure while topic is open. Public-demo visitors explore Tennessee-labeled synthetic topics and filter evidence inventories locally.

**Authorization and audit:** `claims.submit` / `edit_own` / `withdraw_own`, `evidence.*` submit/edit/withdraw, `conflicts.disclose_own`; audits `claims.submitted` / `evidence.submitted` / `conflicts.disclosed` / update / resubmit / withdraw variants.

**Privacy/security/accessibility:** Submissions staff-visible; not visitor-public until published projection; private disclosure detail never projected publicly; accessible forms; public-demo never loads gated runtime.

**Tests and acceptance criteria:** Cannot submit on `draft`/`archived`/`paused`/`under_review`; cannot edit others’ drafts; no HTTP fetch of URL; relationship required when linking evidence to a claim; proposed fixtures excluded until advanced opt-in; geography is classification only.

**Non-goals:** Review rubric UI (3.6); richer comparison/revision history (3.7); moderation visibility UI (3.8); ACL-protected gated workspace search/export (3.11).

**Stop condition:** Human review before **3.6**.

---

### Work package 3.6 — Review queues and minimal visitor-visible publish

**Status:** Complete (awaiting human approval before 3.7).

**Objective:** Reviewers (and admin fallback) record **claim** workflow decisions (`claims.review`), **evidence** workflow decisions and independent evidence-quality decisions (`evidence.review`), then administrators publish a reviewed topic so a **visitor** sees the minimal gated public projection.

**Prerequisites:** 3.5 submissions exist.

**Implementation steps:**

1. Staff review queues for claims and evidence (redacted as needed).
2. Rubric checklist UI that writes structured reason fields (not a popularity score); never imply a quality label proves a claim true.
3. Mutations for claim/evidence changes_requested / accepted / rejected and evidence quality axis (§5.2–5.3).
4. Keep quality independent from workflow in schema and UI copy.
5. Minimal publish path: `topics.publish` sets `publication_status = published`; gated `/topics/[slug]` (or equivalent) serves allowlisted projection; public-demo remains fixture-backed.
6. Tests for independence invariant, reason requirements, leak checklist, and visitor-visible happy path.

**Expected user-visible outcome:**

- Reviewer requests changes or records a quality decision visible to the submitter in workspace.
- After publish, a visitor sees the topic, accepted visible claims/sources, quality labels, and public review explanations—not private account/verification/contact data.

**Authorization and audit:** `claims.review`, `evidence.review`, `topics.publish`; `evidence.quality_decided` / `*.changes_requested` / `topics.published` / etc.

**Privacy/security/accessibility:** Private reviewer notes excluded from public projection; queue and public topic a11y.

**Tests and acceptance criteria:** Quality change does not alter popularity fields; denied for plain participants; admin fallback audited; unpublished topics 404 for visitors in gated mode; demo mode never queries DB.

**Non-goals:** Full revision/disclosure/moderation/presentation hardening (3.10); automated source scoring; AI assist.

**Stop condition:** Human review before **3.7**. End of first operational vertical slice (visitor-visible result included).

**3.6 delivery notes (implemented):**

- Domain services: `src/lib/claims/review.ts`, `src/lib/evidence/review.ts`, `src/lib/topics/publish.ts`, pure `src/lib/topics/public-projection.ts`, gated read `src/lib/topics/gated-public-read.ts`, queues `src/lib/review/queues.ts`.
- Workspace: `/workspace/review` (+ claim/evidence detail), publish controls on workspace topic detail, participant public rationales + edit/resubmit on own submission detail.
- Mode-branched `/topics` and `/topics/[slug]`: public-demo retains 3.5 Tennessee fixtures; gated serves published allowlisted DTOs only via dynamic import + `connection()`.
- No incremental migration: reused 3.2 review/publication schema and append-only triggers.
- No unpublish; pause/reopen leave publication status unchanged.

---

### Work package 3.7 — Richer linking, comparison, and immutable revision history

**Status:** Complete (awaiting human approval before 3.8).

**Objective:** Build on the basic supporting/counterevidence links from 3.2/3.5 with richer comparison UX and append-only revision history for edits after submit.

**Prerequisites:** 3.6 review + minimal publish path available.

**Implementation steps:**

1. Enrich linking/comparison presentation (still using the basic relationship model unless a justified extension is approved).
2. On edit after submission, write revision rows; do not overwrite historical bodies silently.
3. Staff/submitter views of history; deepen public revision summaries for published topics.
4. Tests that withdraw/reject/hide do not delete revision rows.

**Expected user-visible outcome:** Users can see that a submission changed over time and compare supporting vs counterevidence more clearly.

**Authorization and audit:** Edits still capability-gated; `*.revision_recorded` events.

**Privacy/security/accessibility:** History must not reveal private notes or account IDs publicly.

**Tests and acceptance criteria:** Immutable history under moderation/withdraw; relationship integrity constraints remain.

**Non-goals:** Full legal e-discovery export; git-like UI chrome; inventing a second relationship model that abandons 3.2 links.

**Stop condition:** Human review before **3.8**.

**3.7 delivery notes (implemented):**

- Migration `0017_content_revisions`: append-only `content_revisions` with exactly-one subject (`claim_id` XOR `evidence_submission_id`), same-topic composite FKs, per-subject `revision_number` uniqueness, JSONB before/after snapshots, immutable UPDATE/DELETE trigger.
- Subject-specific owner edit / resubmit / withdraw (`updateOwnClaimContent` / `updateOwnEvidenceContent`, `resubmitOwnClaim` / `resubmitOwnEvidence`, `withdrawOwnClaim` / `withdrawOwnEvidence`); revision rows written only for post-submit `changes_requested` edits (not draft overwrites).
- Owner and staff full history DTOs; public published projection gets summary-only allowlist (count, timestamps, field labels—never historic bodies, URLs, or account IDs).
- Supporting vs counterevidence comparison UI over existing `claim_evidence_links` only (no new relationship types).
- Audits registered and emitted: `claims.revision_recorded`, `evidence.revision_recorded`.

---

### Work package 3.8 — Conflict disclosures and moderation

**Status:** Complete (owner-reviewed; concurrency + interactive-demo carryovers addressed in 3.9).

**Objective:** Deepen disclosure capture and moderation visibility actions (`visible`/`held`/`hidden`, with restore-to-visible action) with mandatory reasons; keep public-demo isolated **and** fixture-backed with safe visual parity for 3.5–3.8.

**Prerequisites:** 3.7 history model.

**Implementation steps:**

1. Disclosure create/update rules for submitters; one current disclosure per claim/evidence subject; staff summary vs private detail split by audience DTO.
2. Append-only `moderation_actions` (migration `0018`) + moderation mutations per §5.4; never hard-delete content; never store `restored` as a state.
3. Surface reasoned visibility in `/workspace/moderation` staff UI; allowlisted public withhold/restore notices on published projections.
4. Tests for reason required, admin/moderator allow, participant deny, restore → `visible`, rollback, import isolation.
5. Owner-approved public-demo parity: `/demo/workflow` fixture tour with shareable deep links (not a fake admin console).

**Expected user-visible outcome:** Moderator holds or hides a submission with a recorded reason; restore returns it to visible; history remains; phone reviewers can inspect the slice via public-demo deep links.

**Authorization and audit:** `moderation.review_submission`, `conflicts.disclose_own`; audits `conflicts.updated`, `moderation.submission_held`, `moderation.submission_hidden`, `moderation.submission_restored` (plus preserved `conflicts.disclosed`).

**Privacy/security/accessibility:** Private detail and private notes never in anonymous DTOs; accessible moderation/disclosure forms; public notices omit hidden titles/bodies/URLs/IDs.

**Tests and acceptance criteria:** Hide ≠ delete; restore audited and lands on `visible`; public-demo remains isolated and fixture-backed, with safe visual parity (not “unaffected” / frozen).

**Non-goals:** Dual-control for every moderation action (deferred unless owner pulls forward); appeals tribunal; legal disclosure taxonomy.

**Stop condition:** Human review before **3.9**.

---

### Work package 3.9 — Source security, abuse controls, and interactive user demo

**Status:** Complete (awaiting human approval before 3.10).

**Objective:** Harden stored source URLs and high-value mutation surfaces without fetching remote content, close 3.8 concurrency and demo-journey carryovers, and turn `/demo/workflow` into a user-operated local practice journey.

**Prerequisites:** 3.5–3.8 mutation surfaces exist; 3.8 owner-reviewed.

**Implementation steps:**

1. Close 3.8 carryovers: SQL-level expected-`updated_at` concurrency for disclosure/moderation; interactive local practice as the primary `/demo/workflow` experience (snapshot explorer secondary).
2. Centralize one pure `https:` source-URL policy (no credentials, no private/local hosts, default port only; length ≤ 2000) for create, edit, publish-readiness, and public projection.
3. Bounded JSON bodies (32 KiB → `413 PAYLOAD_TOO_LARGE`) and replaceable `MutationRateLimiter` (in-process sliding window for single-instance alpha; shared limiter required before multi-instance — OQ14/D13).
4. Wire mutation routes for submissions, edits/resubmit/withdraw/disclosure, review/quality, and moderation; denials are `429 MUTATION_RATE_LIMITED` with `Retry-After`, no domain/audit writes.
5. Interactive public-demo tasks: **Recommend a topic** (interaction prototype / not gated intake) and **Contribute a source** with shared URL validation categories; `sessionStorage` + safe deep links; guided Reset clears practice state.
6. Confirm logs/audits never contain raw invite tokens, verification artifacts, raw source URLs, raw IPs, or private disclosure/moderation text.

**Expected user-visible outcome:** Clear validation errors on unsafe URLs; accessible rate-limit / payload errors; `/demo/workflow` leads with operable practice journeys.

**Authorization and audit:** Existing mutation authz; rate-limit denials emit at most one deduplicated security-log event per bucket/window (opaque refs only) — no institutional audit row per denial.

**Privacy/security/accessibility:** Error copy non-enumerating; phone-first practice UI; keyboard operable; no remote URL fetch/DNS.

**Tests and acceptance criteria:** Malicious schemes/hosts rejected; concurrent writers proven; body/rate gates pass; demo practice E2E with zero `/api/workspace/` calls; import isolation preserved.

**Non-goals:** Real gated topic-recommendation intake; link previews/scrapers/malware scanning; distributed rate-limit vendor; file uploads; 3.10 public-interface completion.

**Stop condition:** Human review before **3.10**.

**3.9 delivery notes (implemented):**

- Shared pure `src/lib/security/source-url.ts` (`https:` only; credentials/private/local/metadata/non-443 rejected; no DNS/fetch); wired into submit/edit/publish/projection.
- Bounded JSON (32 KiB) + replaceable in-process `MutationRateLimiter` on submission, edit/resubmit/withdraw/disclosure, review/quality, and moderation routes; denials are no-store `413`/`429` without domain/audit writes.
- Disclosure/moderation `expectedUpdatedAt` enforced in SQL; concurrent same-token writers proven in unit tests; successful writes advance `updated_at` by ≥1 ms.
- `/demo/workflow` primary surface is local topic-recommendation + source-contribution practice (`sessionStorage`, safe deep links); snapshot explorer secondary. Topic recommendation labeled interaction prototype (not gated intake).
- Log/redaction regressions expanded for invite tokens, verification artifacts, raw URLs/IPs, and private disclosure/moderation fields.

---

### Work package 3.10 — Public interface completion and hardening

**Status:** Complete (awaiting human approval before 3.11). Carryover in **3.11:** thrown failures from `getTopicBySlug` / `loadProjectionInputs` normalize to `PUBLIC_TOPIC_PROJECTION_UNAVAILABLE` (sanitized unavailable UI), preserving generic 404 only for missing/unpublished slugs.

**Objective:** Complete and harden the gated public topic interface introduced minimally in **3.6**, including later revision, disclosure, moderation, and presentation depth. Keep public-demo fixture pages operational with fixture-backed visitor parity for the completed presentation.

**Prerequisites:** 3.6 minimal publish path exists; 3.7–3.9 enrichments available as applicable.

**Public contract (precise):**

1. **Evidence conflict summaries** — Load and project the current public conflict summary for included evidence; never project `privateDetail`. Render beside the relevant evidence source.
2. **Evidence quality eligibility** — Workflow must be `accepted`. Publicly eligible quality states are `accepted`, `limited`, or `disputed`. Quality `pending` or `rejected` cannot satisfy publish readiness and cannot appear as included sources. Existing published topics are not auto-unpublished when a source becomes ineligible. Axes stay independent (workflow / quality / moderation / publication / revision). OQ22 remains unresolved (no automatic quality reset after revision).
3. **Empty published shell** — Missing/unpublished slugs remain a generic 404. A topic that remains `publication_status = published` stays addressable even when no claim/evidence is currently eligible, with a safe shell (background, scope, geography, publication metadata, neutral empty/withheld explanation). No titles/bodies/URLs/IDs/private reasons/counts that reveal excluded material.
4. **Read failure semantics** — Operational list/detail failures use sanitized unavailable UI; they must not render as empty catalogs or false 404s.
5. **Presentation** — Finished list/detail hierarchy; equal supporting/counterevidence treatment; deterministic ordering; semantic `<time dateTime>` with one America/Chicago public formatter; long text/URL wrap; comparison as a compact reading aid without duplicating every evidence field.
6. **Still unresolved** — OQ18 (public attribution), OQ22 (pre-revision quality), OQ23 (richer moderation chronology / appeals / dual-control). No search/export (3.11).

**Implementation steps:**

1. Expand allowlisted public DTO/projection (evidence conflict summaries, quality eligibility, empty published shell, deterministic ordering) without inventing a second data model.
2. Harden topic route branching and error handling: public-demo → fixtures; gated → published projection only; failures ≠ 404/empty.
3. Complete gated list/detail presentation and public-demo visitor parity fixtures.
4. Regression: unpublished slugs 404; pause does not unpublish; sentinel leak tests for private disclosure detail.
5. E2E: gated public path + public-demo fixture/practice smoke still pass.

**Expected user-visible outcome:** Visitor on gated deployment sees a complete, hardened published topic surface (still without private account data).

**Authorization and audit:** Existing publish capability + public reads remain unauthenticated allowlist only.

**Privacy/security/accessibility:** Same responsive/a11y bar as Phase 1 topic pages; axe A/AA; no horizontal overflow at phone/desktop widths.

**Tests and acceptance criteria:** Draft/rejected/held hidden; quality-rejected excluded from readiness and projection; empty published shell addressable; read failures sanitized; demo mode never queries DB; projection tests against leak checklist + private sentinels; pause≠unpublish covered.

**Non-goals:** Consultation integration; agenda engine; replacing Phase 1 decision/deliberation fixture journeys; selecting a managed DB vendor; search/export (3.11); resolving OQ18/OQ22/OQ23.

**Stop condition:** Human review before **3.11**.

---

### Work package 3.11 — Search and export

**Status:** Complete (awaiting human review before 3.12).

**Objective:** Search topics/submissions in gated workspace; export account-appropriate and staff-appropriate bundles without cross-account leakage.

**Prerequisites:** 3.10 projections stable.

**Authorization contract (capabilities):**

| Capability | Lifecycle | Roles | Assurance |
| --- | --- | --- | --- |
| `workspace.search` | active | participant, reviewer, moderator, or administrator | L3 uniqueness |
| `topics.export_staff` | active | reviewer or administrator | L3 uniqueness |
| `account.export_own` | invited / pending_onboarding / active | any session holder | existing (own export) |

Auditor with only `audit.read_restricted` does **not** receive workspace content search. Administrator does **not** inherit participant “own submission” semantics. Multi-role principals receive the union of authorized result classes; every hit links only to an authorized route.

**Audience rules (search):**

- **Participant:** topics open for submissions; published topic metadata; topic metadata for own submissions; own authored claims; own submitted evidence. Never another participant’s draft / rejected / withdrawn / changes-requested / unpublished submission content.
- **Reviewer:** topic/claim/evidence metadata needed by `claims.review` / `evidence.review` (metadata summaries only; private notes stay on authorized detail surfaces).
- **Moderator:** claim/evidence metadata for `moderation.review_submission`; no private disclosure detail, reviewer private notes, account/contact data, or privileged pseudonym mappings.
- **Administrator:** administrative topic metadata + reviewer-appropriate claim/evidence metadata.

**Implementation steps:**

1. Workspace search service + `/workspace/search` (session + `workspace.search`; Zod query 2–100 chars; entity filters; page size ≤50; ILIKE wildcard escape; SQL ACL).
2. Extend `/api/account/export` with owned Phase 3 workspace section; structured ownership checks before serialization + serialized foreign-account abort.
3. Staff topic export `/api/workspace/topics/[id]/export` via allowlisted projector; audit `topics.staff_export_generated` (metadata counts only).
4. 3.10 carryover: normalize thrown public-read failures to `PUBLIC_TOPIC_PROJECTION_UNAVAILABLE`.
5. Tests for ACL on search hits, export redaction, public-demo 404, and no remote source fetch.

**Expected user-visible outcome:** Staff/participants find their topics/submissions; exports download intentionally scoped data.

**Authorization and audit:** Search gated by session + capability; staff exports audited (`topics.staff_export_generated`); own export retains `privacy.export_generated`.

**Privacy/security/accessibility:** No public global people search; accessible results list; export headers `no-store` / attachment / JSON / `nosniff`.

**Tests and acceptance criteria:** Participant cannot search others’ drafts; export leak tests pass; staff export redacts prohibited fields; public-demo search/export are generic 404 with zero gated DB calls.

**Non-goals:** Public sitewide search of private data; Elasticsearch vendor; analytics; remote source fetching; schema migration (none required).

**Migrations:** none.

**Stop condition:** Human review before **3.12**.

---

### Work package 3.12 — Operational hardening and handoff

**Status:** Complete; Phase 3 engineering closure candidate awaiting explicit owner acceptance before Phase 4.

**Objective:** Reset drill, regression hardening, Phase 3 handoff doc, and explicit deferred register closure for owner follow-up. Closure corrections (post-3.12) harden operational document regeneration, quiesced reset locking, receipt provenance, mandatory PostgreSQL CI evidence, deterministic revision E2E, and connected acceptance-journey proof.

**Prerequisites:** 3.2–3.11 acceptance criteria met or explicitly waived by owner in handoff.

**Implementation steps:**

1. Close 3.11 carryovers: bounded SQL search + pagination UI; multi-role admission-class hrefs; sanitized thrown search/export failures; dynamic gated import for own export.
2. Document table-by-table reset classification ([alpha-reset-classification.md](./alpha-reset-classification.md)).
3. Implement operator-only alpha reset (`npm run operator:reset-alpha`) with dry-run default, fingerprint confirm, advisory lock, transactional deletes, `alpha.reset_executed` metadata audit.
4. Disposable reset drill: `npm run alpha:reset:smoke` against `ostt_alpha_reset` only.
5. Write [phase-3-handoff.md](./phase-3-handoff.md) + [alpha-reset-runbook.md](./alpha-reset-runbook.md); map §4 journey to evidence; keep D1–D16 deferred.
6. Stop for human authorization before Phase 4.

**Expected user-visible outcome:** Operators can reset alpha data via CLI; participants see corrected search pagination; handoff readable by humans.

**Authorization and audit:** Reset is operator-controlled (`OPERATOR_RESET_SECRET`), gated-only, audited.

**Privacy/security/accessibility:** Reset does not push alpha PII into fixtures, prompts, or logs; search pagination accessible.

**Tests and acceptance criteria:** End-to-end journey §4 mapped to evidence; reset leaves disposable DB without alpha users/topics; deferred items listed not marked done.

**Migrations:** none.

**Non-goals:** Production launch; managed host selection; penetration-test certification; installing Pol.is (Phase 4).

**Stop condition:** Human review / explicit owner acceptance before any Phase 4 package.

---

## 11. Mutation contract (applies to all implementing packages)

Every gated browser or API mutation must:

1. Resolve session principal (or reject).
2. Call `authorizeCapability` for the exact capability.
3. Validate input with Zod.
4. Use a DB transaction when more than one record changes (including audit append when required atomically).
5. Append a **registered** audit event (extend `AUDIT_EVENT_REGISTRY` in the implementing package).
6. Enforce CSRF on cookie-session browser posts.
7. Fail closed in public-demo (404 / disabled).

UI hiding is never sufficient.

---

## 12. Public vs protected data (Phase 3)

| Class | Examples | Visitor? |
| --- | --- | --- |
| **Public (published projection)** | Published topic brief; accepted+visible claims/sources; quality labels; public review explanations; public conflict summaries; allowlisted audit summaries | Yes, after publish |
| **Account-private** | Own drafts, own disclosures detail, own export | No |
| **Staff-restricted** | Review queue, private moderation notes, invitation metadata | No |
| **Security-restricted** | Raw tokens (never stored), verification artifacts, account↔pseudonym maps | No |
| **Never in initial slice** | Fetched remote page content, uploaded files, payment data, live opinion matrices | — |

---

## 13. Phase 3 exclusions

Do **not** introduce during Phase 3 initial packages:

- Public self-registration or recruitment CTAs
- Donations, payments, analytics, AI APIs, notifications
- Live Pol.is install/call (planned for Phase 4 of the alpha; not Phase 3)
- File uploads or rich-text editor dependencies
- Remote fetch/scrape/preview/download of source URLs
- New external services outside the Phase 2 register
- Treating alpha topic discussions as permanent production history
- Calling account holders statutory members without ADR 0007 continual test-purpose communication rules
- Weakening Phase 2 authorization, environment isolation, or tests to make Phase 3 green

---

## 14. Phase 3 definition of done

- Packages 3.1–3.12 acceptance criteria met (or owner-waived items listed in handoff).
- End-to-end journey §4 demonstrable in gated alpha.
- Public-demo still synthetic, separately deployable, fixture-backed.
- Alpha reset proven.
- Deferred register items visible and not marked complete.
- `docs/phase-3-handoff.md` exists.

### Stop conditions (halt and escalate)

- Public-demo can construct gated DB/auth or read alpha participant data.
- A mutation ships without capability + audit.
- Remote source fetching or new forbidden vendor appears.
- Alpha data is designed as non-resettable production history.
- Tests are weakened to hide authz/privacy failures.
- Product copy invents settled legal authority beyond ADR 0007 scopes.

---

## 15. Deferred by owner / later hardening

See the living register in [architecture-phase-3.md](./architecture-phase-3.md) §11. Completing deferred items later must not silently weaken authorization, data integrity, environment isolation, auditability, or reset requirements.
