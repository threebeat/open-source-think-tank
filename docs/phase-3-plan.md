# Phase 3 Plan — Operational Invite-Only Alpha

**Status:** Active work-package source for Phase 3 (packages 3.1–3.12)  
**Baseline:** Phase 2 foundation at or after `a894317317f3ff1e80d0a3602df69e5b4d8cd589` (tag `phase-2-foundation` recorded in [phase-2-handoff.md](./phase-2-handoff.md))  
**Current package:** **3.1 — Operational contract (documentation only).** No Phase 3 runtime routes, migrations, or capabilities are implemented yet.

Related: [product-charter.md](./product-charter.md), [open-source-think-tank-mvp-plan.md](./open-source-think-tank-mvp-plan.md), [phase-2-plan.md](./phase-2-plan.md), [phase-2-handoff.md](./phase-2-handoff.md), [architecture-phase-2.md](./architecture-phase-2.md), [architecture-phase-3.md](./architecture-phase-3.md), [capability-matrix.md](./capability-matrix.md), [data-map.md](./data-map.md), [threat-model.md](./threat-model.md), [open-questions.md](./open-questions.md), [decisions/0006-phase-3-two-lane-sequencing.md](./decisions/0006-phase-3-two-lane-sequencing.md), [decisions/0007-alpha-test-interim-council-dispositions.md](./decisions/0007-alpha-test-interim-council-dispositions.md), [decisions/0008-phase-3-operational-alpha-contract.md](./decisions/0008-phase-3-operational-alpha-contract.md)

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

These are binding for packages 3.2–3.12 (recorded also in [ADR 0008](./decisions/0008-phase-3-operational-alpha-contract.md) and [architecture-phase-3.md](./architecture-phase-3.md)):

1. **One repository / one Next.js App Router application.**
2. **PostgreSQL 16 + Drizzle** remains the gated persistence stack.
3. **Domain and workflow rules stay independent from React** (services/repositories callable from route handlers and tests).
4. **Gated mutations never read the synthetic fixture catalog** as a write source.
5. **Public-demo mode remains fixture-backed** and must never construct the gated database or authentication runtime.
6. **Gated public read model exposes only published projections.** Drafts, rejected material, private moderation notes, contact channels, verification records, and account identifiers are not public.
7. **All mutations** use server-side `authorizeCapability` checks, Zod validation, transactions where multiple records change, CSRF protection, and registered audit events.
8. **Store source URLs and submitter-provided metadata initially.** Do not fetch, scrape, preview, or download remote source content in the initial slice.
9. **Do not add** file uploads, rich-text dependencies, AI APIs, analytics, payments, live Pol.is, notifications, or new external services in the initial slice.
10. **Evidence-review status** remains independent from submission workflow status, participant popularity, and later consultation consensus.
11. **Revisions are preserved.** Withdrawal, rejection, or moderation does not erase institutional history.
12. **Alpha-test data remains fully resettable** (no alpha users or topic discussions carried into a later production system).

---

## 3. Package outcomes (3.1–3.12)

| Package | Outcome |
| --- | --- |
| 3.1 | Written operational contract, architecture, and ADR (this package) |
| 3.2 | Durable topic/evidence schema and repositories (migrations; no authoring UI yet) |
| 3.3 | Capability additions + audited first-administrator bootstrap and invitation issuance |
| 3.4 | Topic authoring and lifecycle transitions (draft → open → …) |
| 3.5 | Participant claim/evidence submissions with limitations and conflict disclosure |
| 3.6 | Evidence review rubric and staff review queue |
| 3.7 | Counterevidence linkage and immutable revision history |
| 3.8 | Conflict-disclosure workflow depth and moderation visibility actions |
| 3.9 | Source-URL security and abuse controls (no remote fetch) |
| 3.10 | Database-backed gated public topic interface (demo fixtures preserved) |
| 3.11 | Search and export for staff/account-appropriate scopes |
| 3.12 | Operational hardening, reset drill, and Phase 3 handoff |

### First operational vertical slice (packages 3.2–3.6)

Demonstrable path after 3.6 (still invite-only, still resettable):

operator bootstrap → invitation → onboarding → topic create/open → claim/source submit → evidence review → (publication lands in 3.10; through 3.6 staff can preview gated projections)

Publication to anonymous visitors is **3.10**. Packages 3.2–3.6 must leave publication projection shapes ready so 3.10 does not invent a second data model.

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

## 5. Planned workflow states (contract only — not implemented in 3.1)

Phase 1 fixture `TopicStatus` (`open` / `paused` / `closed`) and institutional `TopicStage` remain for the **public-demo catalog**. Gated alpha uses the workflow states below. Mapping into demo labels is a presentation concern for 3.10; see [open-questions.md](./open-questions.md) OQ9a / OQ18.

### 5.1 Topic workflow

| State | Meaning |
| --- | --- |
| `draft` | Administrator-authored brief; not open for submissions; not public |
| `open_for_submissions` | Active participants may submit claims/evidence |
| `under_review` | Submissions frozen or limited; staff review in progress |
| `published` | Approved public projection available to visitors (gated public routes) |
| `paused` | Temporarily not accepting submissions; prior public projection may remain if already published (policy in transition table) |
| `archived` | Closed for further workflow; retained for audit/reset until alpha wipe |

#### Topic transitions

| From | To | Actor capability | Reason required? | Audit event (planned) |
| --- | --- | --- | --- | --- |
| (none) | `draft` | `topics.create` | No | `topics.created` |
| `draft` | `draft` | `topics.update` | No | `topics.updated` |
| `draft` | `open_for_submissions` | `topics.open` | No | `topics.opened` |
| `open_for_submissions` | `under_review` | `topics.update` (admin) | Recommended | `topics.review_started` |
| `open_for_submissions` | `paused` | `topics.pause` | Yes | `topics.paused` |
| `under_review` | `open_for_submissions` | `topics.open` | Yes | `topics.reopened` |
| `under_review` | `published` | `topics.publish` | Yes | `topics.published` |
| `published` | `paused` | `topics.pause` | Yes | `topics.paused` |
| `paused` | `open_for_submissions` | `topics.open` | Yes | `topics.reopened` |
| `paused` | `published` | `topics.publish` | Yes | `topics.published` (re-affirm) |
| `*` (except archived) | `archived` | `topics.archive` | Yes | `topics.archived` |

**Disallowed:** skipping `draft` creation; publishing from `draft` without opening/review path that records publication readiness; any transition by UI-only checks.

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
| `submitted` | `changes_requested` | `evidence.review` (or topic admin path) | Yes | `*.changes_requested` |
| `changes_requested` | `submitted` | `claims.edit_own` / `evidence.edit_own` then submit | No | `*.resubmitted` |
| `submitted` | `accepted` | `evidence.review` | Yes (brief rationale) | `*.accepted` |
| `submitted` | `rejected` | `evidence.review` | Yes | `*.rejected` |
| `draft` / `submitted` / `changes_requested` | `withdrawn` | `claims.withdraw_own` / `evidence.withdraw_own` | Recommended | `*.withdrawn` |

**Disallowed:** submitter self-accept; deleting history on withdraw/reject; changing evidence-quality enum via submission workflow alone.

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

| State | Meaning |
| --- | --- |
| `visible` | Eligible for staff and (when topic published) public projection if otherwise allowed |
| `held` | Temporarily withheld from public projection; retained |
| `hidden` | Hidden from public projection; retained |
| `restored` | Returned to `visible` after hold/hide |

#### Visibility transitions

| From | To | Actor capability | Reason required? | Audit event (planned) |
| --- | --- | --- | --- | --- |
| `visible` | `held` | `moderation.review_submission` | Yes | `moderation.submission_held` |
| `visible` / `held` | `hidden` | `moderation.review_submission` | Yes | `moderation.submission_hidden` |
| `held` / `hidden` | `restored` (`visible`) | `moderation.review_submission` | Yes | `moderation.submission_restored` |

**Disallowed:** hard-delete of submission content as the moderation action; public exposure of private moderation notes.

---

## 6. Planned capability additions and role mappings

Existing Phase 2 capabilities and rules remain in force ([capability-matrix.md](./capability-matrix.md)):

- Administrator does **not** automatically gain `institutional.vote` / participant rights.
- Council seats remain independent from platform roles.
- Active lifecycle and assurance checks still apply via `authorizeCapability`.
- During alpha, administrator may fall back for reviewer/moderator **operations** where Phase 2 already allows that pattern; audit must record the capability and actor.

### New capabilities (planned — implement in 3.3+)

| Capability | Lifecycle | Platform role | Ownership / seat | Notes |
| --- | --- | --- | --- | --- |
| `topics.create` | active | administrator | — | Creates `draft` topic |
| `topics.update` | active | administrator | — | Edit draft / meta; not a substitute for publish |
| `topics.open` | active | administrator | — | → `open_for_submissions` |
| `topics.publish` | active | administrator | — | → `published`; reason required |
| `topics.pause` | active | administrator | — | → `paused`; reason required |
| `topics.archive` | active | administrator | — | → `archived`; reason required |
| `claims.submit` | active | participant | — | Create/submit own claims |
| `claims.edit_own` | active | participant | own draft/changes_requested | Server checks ownership |
| `claims.withdraw_own` | active | participant | own non-terminal where allowed | History retained |
| `evidence.submit` | active | participant | — | Source URL + metadata only |
| `evidence.edit_own` | active | participant | own draft/changes_requested | No remote fetch |
| `evidence.withdraw_own` | active | participant | own | History retained |
| `evidence.review` | active | reviewer **or** administrator | — | Workflow accept/reject/changes **and** quality decisions |
| `conflicts.disclose_own` | active | participant (any role that submits) | own disclosure | Required on submit path in 3.5 |
| `moderation.review_submission` | active | moderator **or** administrator | — | Visibility hold/hide/restore with reason |

### Operator / invite capabilities (planned for 3.3)

| Capability | Lifecycle | Role | Notes |
| --- | --- | --- | --- |
| `operator.bootstrap_administrator` | n/a (CLI / break-glass gated env) | environment operator secret / empty-admin bootstrap | One-time or dual-control style; audited; never public-demo |
| `invites.issue` | active | administrator | Creates invitation with hashed token; raw token returned once |

Exact assurance ladder rows for new capabilities are set in 3.3 without weakening Phase 2 assurance tests.

---

## 7. Operational carryovers (prominent)

| Item | Current state | Phase 3 handling |
| --- | --- | --- |
| Email delivery | **Capture-only** (`CaptureEmailAdapter`) | Keep until vendor addendum; 3.3 must support **operator-delivered single-use links** |
| Invitation issuance UI/CLI | **Missing** for real operators (seeds only) | **Must** land in **3.3** |
| First-administrator bootstrap | **Missing** | **Must** land in **3.3** (audited gated operator workflow or CLI) |
| Token safety | Phase 2 hashes invite tokens | Raw tokens shown **once**, never persisted unhashed, never written to application logs, never exposed in public-demo |
| Managed PostgreSQL | Blocked pending addendum | Do **not** select/install in 3.1 |
| Production email vendor | Blocked pending addendum | Do **not** select/install in 3.1 |
| Public topic pages | Fixture-backed (`/topics`, `/topics/[slug]`) | Replaced by gated **published** read model in **3.10**; public-demo fixture behavior remains intact |

---

## 8. Permitted-services posture for Phase 3

Phase 3 **inherits** [phase-2-plan.md](./phase-2-plan.md) §4. No new vendor classes are approved by this contract.

Still **forbidden** unless a future ADR + register update says otherwise: payments, analytics, AI APIs, live Pol.is, identity-verification SDKs, remote source fetching services, file-storage vendors.

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

**Status:** Not started.

**Objective:** Add gated Drizzle tables and repositories for topics, claims, evidence submissions, disclosures, revision stubs, and moderation/quality axes—without authoring UI.

**Prerequisites:** 3.1 approved.

**Implementation steps:**

1. Design migrations for planned table groups in [architecture-phase-3.md](./architecture-phase-3.md) (topics, claims, evidence sources/submissions, relationships, conflict disclosures, revision records, moderation visibility).
2. Enforce enums/checks for workflow, quality, and visibility states.
3. Implement repository modules under gated persistence only; call `assertEnvironmentSafe()` before DB access.
4. Ensure repositories never import `@/fixtures` / fixture catalog.
5. Add unit/integration tests for constraints, ownership FKs, and immutability of revision/audit append paths.
6. Extend synthetic seed only if needed for schema smoke tests—label synthetic; do not invent real people.

**Expected user-visible outcome:** None in UI. Migrations apply in gated local/CI DB.

**Authorization and audit:** No public mutation APIs yet; repository tests may simulate actors. Register draft audit action names if append paths are exercised in tests.

**Privacy/security/accessibility:** No public projection yet; no contact/verification joins on topic tables.

**Tests and acceptance criteria:**

- Clean migrate from empty DB.
- Invalid state combinations rejected.
- Public-demo build still has zero `DATABASE_URL` requirement.
- Fixture catalog unchanged in behavior.

**Non-goals:** Authoring UI, publish routes, invite bootstrap, remote URL fetch, file uploads.

**Stop condition:** Human review before **3.3**.

---

### Work package 3.3 — Capabilities and operator bootstrap

**Status:** Not started.

**Objective:** Add planned capabilities to the matrix/authz code; deliver audited first-administrator bootstrap and invitation issuance with operator-delivered single-use links (email remains capture-only unless an addendum lands).

**Prerequisites:** 3.2 schema available; Phase 2 auth/invite accept paths unchanged in spirit.

**Implementation steps:**

1. Extend `CAPABILITIES`, `authorize`, assurance map, and `docs/capability-matrix.md`.
2. Implement gated operator bootstrap (CLI or staff-breakglass) that creates the first administrator when none exists; audit `operator.bootstrap_administrator`.
3. Implement `invites.issue`: generate token, store **hash only**, return raw token once to the issuer; support operator copy-out when email is capture-only.
4. Forbid raw tokens in logs, audit private payloads, and public-demo mode.
5. Positive/negative authz tests for every new capability; bootstrap tests for empty vs already-bootstrapped DB.
6. Document operator runbook in secrets/ops or Phase 3 handoff draft section.

**Expected user-visible outcome:** Gated administrator can obtain a one-time invite link/token to give a participant; public-demo unchanged.

**Authorization and audit:** All issuance/bootstrap paths require capability or operator secret + audit; CSRF on browser forms.

**Privacy/security/accessibility:** Tokens single-use/expiring; no token in URLs on public-demo; staff UI accessible if browser-based.

**Tests and acceptance criteria:**

- Cannot bootstrap second “first admin” silently.
- Invite accept still works with issued tokens.
- Capture email may record messages in gated test without vendor.
- Public-demo exposes no bootstrap/invite issuance APIs.

**Non-goals:** Choosing Resend/SES/etc.; managed DB; topic UI.

**Stop condition:** Human review before **3.4**.

---

### Work package 3.4 — Topic authoring

**Status:** Not started.

**Objective:** Gated workspace UI + mutations for administrators to create, update, open, pause, and archive topics (publish may be preview-gated until 3.10).

**Prerequisites:** 3.3 capabilities live.

**Implementation steps:**

1. Add gated routes (e.g. `/workspace/topics`, `/workspace/topics/[slug]`) behind authz.
2. Mutations: create/update/open/pause/archive with Zod + transactions + audit.
3. Show workflow state clearly; never imply statutory authority.
4. Keyboard-accessible forms; mobile-usable staff layout.
5. Tests for allowed/denied transitions and CSRF failure paths.

**Expected user-visible outcome:** Administrator creates a draft topic and opens it for submissions.

**Authorization and audit:** `topics.*` capabilities; events in §5.1.

**Privacy/security/accessibility:** Staff-only; no public leak of drafts.

**Tests and acceptance criteria:** Participant cannot create topics; invalid transitions fail closed; audit rows present.

**Non-goals:** Public published pages (3.10); participant submissions (3.5).

**Stop condition:** Human review before **3.5**.

---

### Work package 3.5 — Participant claim/evidence submissions

**Status:** Not started.

**Objective:** Active participants submit claims and evidence source URLs with relationship, limitations, and conflict disclosure.

**Prerequisites:** 3.4 topics can be `open_for_submissions`.

**Implementation steps:**

1. Submission forms in gated workspace for own claims/evidence.
2. Persist URL + metadata only (title, organization, authorType, sourceType, limitations, relationship).
3. Require `conflicts.disclose_own` fields on submit path.
4. Enforce edit/withdraw ownership rules and workflow transitions in §5.2.
5. Transaction: submission row + disclosure + audit (+ revision stub if model requires).
6. Tests for ownership, topic-state gates, and Zod URL validation (syntax only).

**Expected user-visible outcome:** Participant submits a claim with a source URL and disclosure while topic is open.

**Authorization and audit:** `claims.*`, `evidence.*`, `conflicts.disclose_own`.

**Privacy/security/accessibility:** Submissions staff-visible; not public until 3.10 projection rules; accessible forms.

**Tests and acceptance criteria:** Cannot submit on `draft`/`archived`; cannot edit others’ drafts; no HTTP fetch of URL.

**Non-goals:** Review rubric UI (3.6); counterevidence graph polish (3.7); moderation visibility UI (3.8).

**Stop condition:** Human review before **3.6**.

---

### Work package 3.6 — Evidence review rubric and queue

**Status:** Not started.

**Objective:** Reviewers (and admin fallback) record workflow decisions and independent evidence-quality decisions with published-safe rationales.

**Prerequisites:** 3.5 submissions exist.

**Implementation steps:**

1. Staff review queue (redacted as needed).
2. Rubric checklist UI that writes structured reason fields (not a popularity score).
3. Mutations for changes_requested / accepted / rejected and quality axis (§5.2–5.3).
4. Keep quality independent from workflow in schema and UI copy.
5. Tests for independence invariant and reason requirements.

**Expected user-visible outcome:** Reviewer requests changes or records a quality decision visible to the submitter in workspace.

**Authorization and audit:** `evidence.review`; `evidence.quality_decided` / `*.changes_requested` / etc.

**Privacy/security/accessibility:** Private reviewer notes field allowed only if excluded from public projection; queue a11y.

**Tests and acceptance criteria:** Quality change does not alter popularity fields; denied for plain participants; admin fallback audited.

**Non-goals:** Public visitor pages; automated source scoring; AI assist.

**Stop condition:** Human review before **3.7**. End of first vertical slice for staff workflow (publication still 3.10).

---

### Work package 3.7 — Counterevidence and immutable revision history

**Status:** Not started.

**Objective:** Explicit supporting/counterevidence relationships and append-only revision history for edits after submit.

**Prerequisites:** 3.6 review path available.

**Implementation steps:**

1. Relationship table/fields for supporting vs counterevidence links.
2. On edit after submission, write revision rows; do not overwrite historical bodies silently.
3. Staff/submitter views of history; public shape prepared for 3.10.
4. Tests that withdraw/reject/hide do not delete revision rows.

**Expected user-visible outcome:** Users can see that a submission changed over time and how counterevidence is attached.

**Authorization and audit:** Edits still capability-gated; `*.revision_recorded` events.

**Privacy/security/accessibility:** History must not reveal private notes or account IDs publicly.

**Tests and acceptance criteria:** Immutable history under moderation/withdraw; relationship integrity constraints.

**Non-goals:** Full legal e-discovery export; git-like UI chrome.

**Stop condition:** Human review before **3.8**.

---

### Work package 3.8 — Conflict disclosures and moderation

**Status:** Not started.

**Objective:** Deepen disclosure capture and moderation visibility actions (`visible`/`held`/`hidden`/`restored`) with mandatory reasons.

**Prerequisites:** 3.7 history model.

**Implementation steps:**

1. Disclosure create/update rules for submitters; staff summary vs private detail split.
2. Moderation mutations per §5.4; never hard-delete content.
3. Surface reasoned visibility in staff UI; prepare public reason string for 3.10.
4. Tests for reason required, admin/moderator allow, participant deny.

**Expected user-visible outcome:** Moderator holds or hides a submission with a recorded reason; history remains.

**Authorization and audit:** `moderation.review_submission`, `conflicts.disclose_own`.

**Privacy/security/accessibility:** Private detail never in public projection; accessible moderation forms.

**Tests and acceptance criteria:** Hide ≠ delete; restore audited; public-demo unaffected.

**Non-goals:** Dual-control for every moderation action (deferred unless owner pulls forward); appeals tribunal.

**Stop condition:** Human review before **3.9**.

---

### Work package 3.9 — Source security and abuse controls

**Status:** Not started.

**Objective:** Harden URL handling and abuse controls without fetching remote content.

**Prerequisites:** 3.5–3.8 mutation surfaces exist.

**Implementation steps:**

1. Strict URL scheme allowlist (`https:` preferred; reject `javascript:`, data URLs, credentials-in-URL).
2. Length limits, rate limits per account/IP for submit/review.
3. Optional SSRF-oriented rejection of clearly internal hosts for **stored** URLs (still no fetch).
4. Security tests and threat-model note update.
5. Confirm logs never include raw invite tokens or verification artifacts.

**Expected user-visible outcome:** Clear validation errors on unsafe URLs; rate-limit errors when abused.

**Authorization and audit:** Existing mutation authz; audit rate-limit denials where useful without PII spam.

**Privacy/security/accessibility:** Error copy understandable; no user enumeration via invite issuance.

**Tests and acceptance criteria:** Malicious schemes rejected; no outbound HTTP client added for sources.

**Non-goals:** Link previews, scrapers, malware scanning vendors, file uploads.

**Stop condition:** Human review before **3.10**.

---

### Work package 3.10 — Database-backed public topic interface

**Status:** Not started.

**Objective:** In gated mode, serve published topic projections from the database; keep public-demo fixture pages operational and unchanged in behavior.

**Prerequisites:** 3.4–3.9 data and review quality sufficient to publish.

**Implementation steps:**

1. Define allowlisted public DTO/projection (topic brief, accepted visible claims/sources, quality labels, public review explanations, public conflict summaries, revision summaries as allowed).
2. Branch topic routes: public-demo → fixtures; gated → published projection only.
3. Administrator `topics.publish` makes projection visible; unpublished slugs 404 for visitors.
4. Ensure no account IDs, contact channels, verification, private notes, or drafts leak.
5. E2E: gated publish path + public-demo fixture smoke still pass.

**Expected user-visible outcome:** Visitor on gated deployment sees published topic and review explanations only.

**Authorization and audit:** Publish capability + `topics.published`; public reads are unauthenticated allowlist only.

**Privacy/security/accessibility:** Same responsive/a11y bar as Phase 1 topic pages.

**Tests and acceptance criteria:** Draft/rejected/held hidden; demo mode never queries DB; projection tests against leak checklist.

**Non-goals:** Consultation integration; agenda engine; replacing Phase 1 decision/deliberation fixture journeys.

**Stop condition:** Human review before **3.11**.

---

### Work package 3.11 — Search and export

**Status:** Not started.

**Objective:** Search topics/submissions in gated workspace; export account-appropriate and staff-appropriate bundles without cross-account leakage.

**Prerequisites:** 3.10 projections stable.

**Implementation steps:**

1. Workspace search for topics/claims/evidence metadata the principal may see.
2. Export endpoints reuse Phase 2 own-account export discipline (abort on foreign account ids).
3. Staff export of topic packages excludes security-restricted fields.
4. Tests for ACL on search hits and export redaction.

**Expected user-visible outcome:** Staff/participants find their topics/submissions; exports download intentionally scoped data.

**Authorization and audit:** Search gated by session + capability; exports audited.

**Privacy/security/accessibility:** No public global people search; accessible results list.

**Tests and acceptance criteria:** Participant cannot search others’ drafts; export leak tests pass.

**Non-goals:** Public sitewide search of private data; Elasticsearch vendor; analytics.

**Stop condition:** Human review before **3.12**.

---

### Work package 3.12 — Operational hardening and handoff

**Status:** Not started.

**Objective:** Reset drill, regression hardening, Phase 3 handoff doc, and explicit deferred register closure for owner follow-up.

**Prerequisites:** 3.2–3.11 acceptance criteria met or explicitly waived by owner in handoff.

**Implementation steps:**

1. Implement/document alpha reset procedure that removes accounts and topic workflow data while preserving product code and required report inputs.
2. Run lint, typecheck, unit, build, public e2e, gated e2e; record evidence.
3. Write `docs/phase-3-handoff.md` with blockers, deferred register, and recommended Phase 4 entry.
4. Confirm no vendor silently installed; no demo/gated confusion.
5. Stop for human authorization before any “alpha complete” claim beyond handoff facts.

**Expected user-visible outcome:** Operator can reset alpha data; handoff readable by humans.

**Authorization and audit:** Reset is operator-controlled, audited, gated-only.

**Privacy/security/accessibility:** Reset does not push alpha PII into fixtures, prompts, or logs.

**Tests and acceptance criteria:** End-to-end journey §4 demonstrable; reset leaves DB without alpha users/topics; deferred items listed not marked done.

**Non-goals:** Production launch; managed host selection; penetration-test certification; Phase 4 Pol.is.

**Stop condition:** Human review before any Phase 4 package.

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
- Donations, payments, analytics, AI APIs, live Pol.is, notifications
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
