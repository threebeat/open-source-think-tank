# Phase 2 Plan — Invite-Only Foundation

**Status:** Active work-package source for Phase 2  
**Baseline:** Phase 1 demonstration release tag [`phase-1-demonstration`](https://github.com/threebeat/open-source-think-tank/releases/tag/phase-1-demonstration) at commit `33ff0cc`  
**Current package:** **2.5 complete** — next **2.6** after approval. Managed Postgres host and production email vendor remain blocked pending addenda.

Related: [product-charter.md](./product-charter.md), [open-source-think-tank-mvp-plan.md](./open-source-think-tank-mvp-plan.md), [open-questions.md](./open-questions.md), [legal-questions.md](./legal-questions.md), [data-map.md](./data-map.md), [threat-model.md](./threat-model.md), [phase-1-handoff.md](./phase-1-handoff.md)

---

## 1. What Phase 2 is

Phase 2 builds an **invite-only production foundation** in a **separate gated deployment environment**. It is **not** a public launch, public pilot, or open recruitment.

Someone reviewing Phase 2 should be able to answer:

1. Which counsel gates still block real enrollment language and authority claims?
2. Which environments exist, and how the public synthetic demo stays isolated?
3. How accounts, roles, assent, verification, invites, and audit will be modeled once architecture is approved?
4. Which external services (if any) are permitted—and that none are permitted until Work Package 2.2 ADRs approve them?

### Dual-mode invariant

| Mode | Purpose | Participant datastore |
| --- | --- | --- |
| **Public demo** (Phase 1 tagged build / demo deployment) | Synthetic institutional walkthrough | Must **not** connect to any production participant datastore |
| **Gated Phase 2 foundation** | Invite-only accounts, assent, verification, audit | Separate environment; real (non-public) data only after counsel and architecture gates |

The tagged Phase 1 synthetic demonstration remains separately deployable. Enforcement of datastore isolation is designed in **2.2**; this plan states it as a non-negotiable invariant.

### Hard rule for agents and collaborators

**npm installs for gated infrastructure begin only in the authorizing implementation package** (PostgreSQL/Drizzle in **2.3**, Auth.js in **2.4**, email vendor after addendum). Public-demo builds must not configure those clients. Package **2.2** records ADRs and adapter interfaces only.

---

## 2. Package outcomes (2.1–2.12)

| Package | Outcome |
| --- | --- |
| 2.1 | Written contract, counsel gates, and Phase 2 boundaries |
| 2.2 | Architecture, environments, vendors, and security decisions |
| 2.3 | Production data model and migrations |
| 2.4 | Authentication and account lifecycle |
| 2.5 | Server-enforced roles and permissions |
| 2.6 | Versioned documents and assent records |
| 2.7 | Verification ladder and review workflow |
| 2.8 | Invite-only onboarding |
| 2.9 | Institutional audit ledger |
| 2.10 | Conversation-scoped pseudonyms |
| 2.11 | Privacy and operational controls |
| 2.12 | Closed-environment QA and handoff |

---

## 3. Phase 2 exclusions

Do **not** introduce during Phase 2:

- Public self-registration or public recruitment CTAs
- Donations, payments, or fundraising flows
- Live Pol.is (or other live opinion mapping) integration
- Production agenda algorithms that affect real institutional outcomes
- AI APIs
- Native mobile applications
- Calling account holders **statutory members** without recorded counsel approval
- Silently resolving authority, retention, verification, or privacy questions in product copy or schema comments presented as settled law

---

## 4. Permitted-services register

Fable and human collaborators may introduce **only** services marked **approved** below, and only in the work package that authorizes them. Adapter names are reserved until 2.2 ADRs.

| Service class | Vendor / product | Status | Environments allowed | Adapter | Authorizing package |
| --- | --- | --- | --- | --- | --- |
| Persistence technology | PostgreSQL + Drizzle ORM | **approved (technology)** | local development + ephemeral CI/test — **never public-demo** | `PersistenceAdapter` | ADR 0003; install in **2.3** |
| Managed PostgreSQL host | TBD (Neon, RDS, Cloud SQL, etc.) | **blocked — pending vendor addendum** | staging / production **not authorized** until addendum | `PersistenceAdapter` | Future ADR addendum after DPA/region/SLA review |
| Authentication / identity | Auth.js (Auth.js / NextAuth v5) on the app server | **approved (gated only)** | development, test — staging/production auth wiring still invite-gated; **never public-demo** | `AuthAdapter` | ADR 0004; implement in **2.4** |
| Transactional email | Provider TBD behind adapter (Resend or SES candidate) | **conditionally approved — adapter only until vendor ADR addendum** | gated envs only; local may use Ethereal/Mailpit | `EmailAdapter` | ADR 0004; wire vendor in **2.4** after addendum |
| Identity / document verification | None selected | **blocked — no vendor** | — | `VerificationAdapter` (local/manual reviewer workflow first) | 2.7 |
| Audit publication (if external) | None — first-party DB ledger | **approved (first-party)** | gated envs | `AuditPublishAdapter` (DB + optional public projection) | 2.9 |
| Consultation / Pol.is | — | **forbidden in Phase 2** | none | `ConsultationParticipationAdapter` (stub only in 2.10) | not before Phase 4 |
| Payments / donations | — | **forbidden in Phase 2** | none | — | not before later phases |
| Analytics / advertising | — | **forbidden in Phase 2** | none | — | — |
| AI APIs | — | **forbidden in Phase 2** | none | — | — |

**Public-demo builds must not include or configure gated vendor clients.** See [0002-environments-and-demo-isolation.md](./decisions/0002-environments-and-demo-isolation.md).

---

## 5. Data classes (Phase 2 design)

Retention and legal basis remain unresolved until counsel disposition is recorded. Classes align with [data-map.md](./data-map.md) and the charter’s open-by-default / protected-by-necessity split.

| Class | Meaning | Examples (illustrative) |
| --- | --- | --- |
| **Public** | Intended for public institutional transparency | Published decision records, minority reports, approved audit summaries, public conflict summaries |
| **Account-private** | Visible to the account holder and narrowly authorized staff | Assent history download, own profile contact channel, own invitation status |
| **Staff-restricted** | Authorized reviewers/admins only | Invitation queues, onboarding status views, verification case metadata |
| **Security-restricted** | Highest sensitivity; minimal access, audited | Raw verification artifacts (if ever stored), account↔pseudonym maps, recovery secrets |
| **Never-collected (Phase 2)** | Must not be gathered in this phase | Donation instruments; public recruitment lists; live consultation opinion matrices; ideology labels |

Production participant data must never be placed in prompts, fixtures, logs, screenshots, or test recordings.

---

## 6. Decision register (feature → open / legal questions)

| Phase 2 feature area | Packages | Open questions | Legal questions | Engineering may proceed when |
| --- | --- | --- | --- | --- |
| Account holder terminology (not “statutory member”) | 2.1, 2.4, 2.8 | OQ2 | LQ3 | Counsel disposition recorded **or** product uses only “account holder” / “community participant” with unresolved label |
| Formation / fiscal sponsorship | 2.1–2.2 | — | LQ1–2 | Needed before public entity claims; not required to write adapters |
| Account vs council vs board authority | 2.5, 2.8 | OQ1, OQ3, OQ3a | LQ4–5 | Schema may model seats; UI must not invent binding board rules |
| Overlapping council seats | 2.3, 2.5 | OQ3b | LQ4 | Separate appointments always; no inferred equivalence |
| Electronic assent & document versions | 2.6, 2.8 | — | LQ8–9 | No active assent to “not legally reviewed” placeholders |
| Privacy basis characterization | 2.6, 2.11 | — | LQ10 | Do not label every basis “consent” unless counsel approves |
| Political-opinion & verification separation | 2.7, 2.10, 2.11 | — | LQ10–11 | Identity store separated from opinion/pseudonym maps |
| Eligibility / geography | 2.7, 2.8 | OQ5 | LQ12–14 | Assertions configurable; no national-mandate claims |
| Invite-only access enforcement | 2.2, 2.4, 2.8 | — | LQ3, LQ12 | Independent of auth success (design in 2.2) |
| Audit publication vs private payloads | 2.9 | OQ10 | LQ10, LQ18 | Public projections allowlisted only |
| Conversation-scoped pseudonyms | 2.10 | — | LQ10–11 | Stub adapter only; no live Pol.is |
| Retention, closure, export | 2.11 | — | LQ10–11 | Counsel-approved rules before destructive jobs |

---

## 7. Counsel disposition gates

**Nothing below is legal advice.** Status values invent no approvals.

### Status vocabulary

| Status | Meaning |
| --- | --- |
| **blocking** | No counsel disposition recorded; product must not claim the matter is settled |
| **conditionally cleared** | Counsel (or a linked decision record) cleared a **limited scope** under stated conditions; outside that scope the gate remains blocking |
| **cleared** | Counsel disposition recorded for the stated scope; not an owner-only decision |

**Project-owner approval** is a separate field. Owner risk acceptance may allow continued *engineering under blocking constraints*; it must **never** be recorded as equivalent to **cleared** or used to rewrite status from blocking to cleared.

### Required provenance when updating a row

Every change to status must fill: status, scope and conditions, recorded date, recorded by, counsel source or decision-record link (or explicit “none — still blocking”), project-owner approval (name/date or “n/a”), and affected packages. Do not silently change product language first.

| Gate | Linked questions | Status | Scope and conditions | Recorded date | Recorded by | Counsel source or decision-record link | Project-owner approval | Affected packages |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Statutory membership vs program participation | LQ3, OQ2 | blocking | Full gate; no product claim of statutory membership | 2026-08-09 | Phase 2.1 contract author | none — still blocking | n/a | 2.1, 2.4, 2.5, 2.8 |
| Formation or fiscal sponsorship | LQ1–2 | blocking | Full gate; no entity/tax claims | 2026-08-09 | Phase 2.1 contract author | none — still blocking | n/a | 2.1–2.2, 2.12 |
| Account and council authority | LQ4–5, OQ1, OQ3 | blocking | Full gate; recommendations only; no board-binding claims | 2026-08-09 | Phase 2.1 contract author | none — still blocking | n/a | 2.5, 2.8, 2.9 |
| Electronic assent | LQ8–9 | blocking | Full gate; no “not legally reviewed” doc may become active assent | 2026-08-09 | Phase 2.1 contract author | none — still blocking | n/a | 2.6, 2.8 |
| Eligibility and geography | LQ12–14 | blocking | Full gate; no national-mandate or settled residency rule | 2026-08-09 | Phase 2.1 contract author | none — still blocking | n/a | 2.7, 2.8 |
| Political-opinion and verification-data handling | LQ10–11 | blocking | Full gate; keep identity store separated from opinion/pseudonym maps | 2026-08-09 | Phase 2.1 contract author | none — still blocking | n/a | 2.7, 2.9–2.11 |

### How gates constrain engineering

- **Blocked for product claims:** Do not ship copy that states statutory membership, board-binding crowd decisions, approved legal terms, or settled retention/deletion rights while the relevant gate is **blocking**.
- **Allowed for foundation design:** Adapters, schemas, and invite-only scaffolding may be built using provisional language (“account holder,” “community participant,” “recommendation only,” `pending_onboarding`) while gates remain blocking.
- **Blocked for real participant activation:** No real (non-synthetic) participant account may enter **`active`** until applicable assent (2.6), verification (2.7), and onboarding (2.8) gates for that account are complete, and counsel gates that govern those claims are **cleared** or **conditionally cleared** for the relevant scope. Owner risk acceptance alone does not authorize `active` status or “cleared” counsel rows.

---

## 8. Phase 2 definition of done

Phase 2 is complete only when all of the following are true:

- Packages 2.1–2.12 acceptance criteria are met.
- Counsel-approved (or explicitly provisional, labeled) documents and role terminology are used wherever real assent or authority is represented.
- Production permissions are server-enforced and regression-tested.
- Public synthetic demonstration and gated account environment are isolated (demo cannot reach production participant data).
- No public signup, recruitment, donation, or live consultation path exists.
- Permitted-services register lists only reviewed vendors; secrets never reach the browser.
- `docs/phase-2-handoff.md` exists; Phase 3 / pilot blockers are recorded.
- An approved foundation release is tagged **only after** closed readiness review (2.12).

### Stop conditions (halt and escalate)

Stop Phase 2 implementation and escalate to humans if:

- A change would invent statutory membership, board-binding authority, or approved legal terms without updating the counsel disposition table.
- A public-demo deployment can connect to a production participant datastore.
- A work package proposes installing a vendor not marked **approved** in the permitted-services register.
- Public signup, recruitment, donations, live Pol.is, AI APIs, or native apps are introduced.
- Tests are weakened to hide authorization, migration, or privacy failures.
- Production participant data appears in prompts, fixtures, logs, screenshots, or recordings.

---

## 9. Work packages

### Work package 2.1 — Establish the Phase 2 contract

**Status:** Complete (documentation contract).

1. Create `docs/phase-2-plan.md` (this file).
2. Define Phase 2 as an invite-only foundation—not a public launch or pilot.
3. Preserve the tagged Phase 1 synthetic demonstration as a separately deployable mode.
4. Create a decision register mapping each Phase 2 feature to `open-questions.md` and `legal-questions.md`.
5. Record counsel’s disposition, or an explicit blocking status, for the gates in §7.
6. Define public, account-private, staff-restricted, security-restricted, and never-collected data classes.
7. Define Phase 2 exclusions (§3).
8. Update `AGENTS.md` so it no longer prohibits all real authentication forever, but permits only specifically approved services and data flows—and keeps auth/DB installs blocked until 2.2.
9. Add a Phase 2 definition of done and stop conditions (§8).

**Acceptance criteria:**

- No product copy calls an account holder a statutory member without counsel approval.
- No engineering choice silently resolves authority, retention, verification, or privacy questions.
- Fable can identify exactly which external services are permitted (currently: none).
- The public Phase 1 demo remains synthetic and operational.

---

### Work package 2.2 — Approve the production architecture

**Status:** Complete (ADRs, secrets/ops policy, adapter interfaces). Next: **2.3** after human approval.

1. Document the public-demo, development, test, staging, and eventual production environments.
2. Select the database and authentication approach through ADRs.
3. Define adapter interfaces for authentication, persistence, email delivery, verification, and audit publication.
4. Define how identity/account data will remain separated from future granular consultation data.
5. Create a secrets-management and environment-variable policy.
6. Document vendor data processing, retention, deletion, region, export, and breach-notification considerations for review.
7. Define backup, restore, migration, and rollback strategies.
8. Produce a system/data-flow diagram and update the threat model.
9. Decide how invite-only access is enforced independently of authentication.
10. Update the permitted-services register when a vendor is approved for **gated** environments (install still deferred to the authorizing implementation package).

**Acceptance criteria:**

- No secrets or privileged database credentials reach the browser.
- A public-demo deployment cannot connect to the production participant datastore.
- Vendor-specific code stays behind an identified adapter.
- The architecture does not require joining real identity records to public opinion records.

**Prerequisite:** 2.1 complete. **Install gate:** npm dependencies for DB/auth/email land only in 2.3+ packages that the register authorizes—not in public-demo builds.

---

### Work package 2.3 — Build the production data foundation

**Status:** Complete for local/ephemeral PostgreSQL technology (including migration-tracked immutability/relationship constraints). Managed host for staging/production remains blocked.

1. Add migration tooling and a reproducible local database.
2. Model accounts, profiles, invitations, role assignments, document versions, assent records, verification cases, verification assertions, and audit events.
3. Separate human identity from platform account and institutional role.
4. Represent Deliberation Council and Policy Council appointments independently.
5. Add lifecycle states, timestamps, provenance, and revocation fields.
6. Add database uniqueness, foreign-key, and state-transition constraints.
7. Prohibit updates or deletion of immutable assent and audit records through normal application permissions.
8. Create synthetic development seeds that cannot be confused with real people.
9. Add migration, rollback, constraint, and relationship tests.

**Acceptance criteria:**

- A clean database can be created entirely from migrations.
- Invalid authority, role, assent, and council relationships are rejected.
- Tests never require production credentials or production data.
- Migration history contains no personal information.

---

### Work package 2.4 — Implement authentication and account lifecycle

**Status:** Complete for local/ephemeral gated auth (Auth.js + invite gate + synthetic E2E), including transactional invite/challenge claims and explicit audit `synthetic` classification. Production email vendor still requires ADR addendum.

**Account-state sequence (binding):**

1. **2.4** may create authenticated sessions only for accounts in `invited` → `pending_onboarding` (or equivalent). Contact-channel ownership may be verified in 2.4 without granting `active`.
2. **E2E and local fixtures** use **synthetic** accounts only; they must be unmistakably non-person data.
3. **No real participant** becomes `active` until applicable **2.6** published documents are assented, **2.7** verification requirements for that account’s intended capabilities are satisfied, and **2.8** onboarding gates complete the transition to `active`.
4. Production activation logic that flips `pending_onboarding` → `active` is owned by **2.8** (2.4 must not expose a shortcut).

1. Implement invite acceptance, sign-in, sign-out, session renewal, and account recovery.
2. Require verified contact-channel ownership before leaving `invited` for `pending_onboarding`.
3. Keep public self-registration disabled.
4. Add secure, expiring, single-use invitations.
5. Add session revocation and “sign out everywhere.”
6. Define account states: `invited`, `pending_onboarding`, `active`, `suspended`, `closed`, `anonymization-pending`. Do **not** set `active` for real participants in this package.
7. Implement server-side route protection (including denying institutional capabilities to `pending_onboarding`).
8. Add rate limiting and abuse controls for authentication endpoints.
9. Audit security-relevant account events without logging credentials or tokens.
10. Add E2E tests for successful and failed lifecycle paths using synthetic accounts only.

**Acceptance criteria:**

- Knowing a protected URL is insufficient to access it.
- Disabled, revoked, or `pending_onboarding` accounts cannot exercise `active`-only capabilities.
- Authentication logs contain no secrets, recovery tokens, or verification artifacts.
- Public signup remains impossible.
- No 2.4 path sets a real participant account to `active`.

---

### Work package 2.5 — Implement authorization and institutional roles

**Status:** Complete for server-enforced capability matrix (`docs/capability-matrix.md`). Counsel gates on authority claims remain blocking.

1. Create a written capability matrix before writing authorization code.
2. Distinguish account status, platform permissions, and institutional authority.
3. Model participant, reviewer, moderator, council-seat, administrator, and auditor capabilities separately.
4. Keep Deliberation and Policy Council appointments separate even when held by one person.
5. Enforce permissions on the server for every protected action.
6. Deny access by default.
7. Require elevated authorization and reason capture for role changes.
8. Prevent administrators from granting themselves protected institutional authority silently.
9. Add positive and negative authorization tests for every capability.

**Acceptance criteria:**

- Hiding a button is never the only authorization control.
- A Deliberation Council role does not imply a Policy Council role.
- Role changes are attributable and auditable.
- Tests demonstrate that every role is denied actions outside its capabilities.

---

### Work package 2.6 — Add versioned documents and assent

1. Model conduct terms, participation terms, privacy notices, and any legally distinct consent separately.
2. Support draft, counsel-reviewed, published, superseded, and withdrawn document states.
3. Prevent assent to draft or superseded versions.
4. Present the complete applicable document before assent.
5. Record account, document ID, immutable version/hash, timestamp, method, and required notices.
6. Support re-assent when a change requires it.
7. Preserve prior assent records without treating them as current.
8. Let account holders view and download their assent history.
9. Define what happens when assent is declined or withdrawn.
10. Avoid describing every privacy processing basis as “consent” unless counsel approves that characterization.

**Acceptance criteria:**

- Every active account can be mapped to the exact applicable document versions.
- Published document content cannot be changed in place.
- Withdrawal does not silently erase records that must be retained.
- No placeholder marked “not legally reviewed” can become an active assent document.

---

### Work package 2.7 — Implement the verification ladder

1. Define configurable assurance levels without assuming government ID is required.
2. Keep bot resistance, contact continuity, uniqueness, eligibility, residency, and legal identity as distinct assertions.
3. Map each protected role or action to the minimum required assurance.
4. Collect the minimum data needed for each assertion.
5. Store verification status separately from raw verification artifacts.
6. Make raw-artifact retention short-lived or avoid storage when possible.
7. Implement reviewer assignment, approval, denial, expiration, and appeal states.
8. Require structured reasons for reviewer decisions.
9. Prevent verification status from appearing in public consultation output.
10. Add tests for expiration, revocation, conflicting assertions, and unauthorized reviewer access.

**Acceptance criteria:**

- The ladder cannot be presented as proof of ideology, credibility, or policy expertise.
- Higher assurance is required only for documented higher-impact actions.
- Public records never expose verification artifacts.
- An account cannot review its own verification case.

---

### Work package 2.8 — Build invite-only onboarding

1. Replace the join preview only in the gated Phase 2 environment.
2. Implement invitation, eligibility assertions, document review, assent, applicable verification steps, and the **only** production transition from `pending_onboarding` → `active`.
3. Show progress and explain why each item is requested.
4. Preserve neutral “community participant” or “account holder” language until counsel settles membership.
5. Provide save/resume and safe expiration behavior.
6. Prevent `active` until required 2.6 assent and 2.7 verification gates for that account pass.
7. Provide accessible error, recovery, and declined-assent states.
8. Add staff views for invitation and onboarding status without exposing unnecessary data.
9. Keep public recruitment calls to action disabled.
10. Test keyboard, mobile, screen-reader, refresh, back-navigation, and expired-link behavior.

**Acceptance criteria:**

- An uninvited visitor cannot begin enrollment.
- No step promises statutory membership or institutional voting authority.
- Required notices and assent versions are traceable.
- Sensitive information never appears in URLs, analytics, or client logs.
- Real participants reach `active` only through this package’s gate checks.

---

### Work package 2.9 — Build the audit ledger

1. Define a registry of auditable events and their schemas.
2. Separate private event payloads from publishable summaries.
3. Record actor, role, action, target, timestamp, request correlation, and reason where applicable.
4. Make ordinary application roles unable to update or delete audit rows.
5. Audit authentication, role, assent, verification, and administrative actions.
6. Add redaction rules for public summaries.
7. Build restricted audit search for authorized reviewers.
8. Extend the public transparency feed only with explicitly approved event projections.
9. Add continuity and tamper-detection checks without claiming the ledger is absolutely tamper-proof.
10. Test that prohibited payload fields never reach the public feed.

**Acceptance criteria:**

- Every sensitive institutional action is attributable.
- Public transparency does not expose account identifiers, contact details, verification artifacts, or political-opinion histories.
- Audit failures fail closed for high-impact administrative actions.
- Audit records and public summaries cannot contradict one another silently.

---

### Work package 2.10 — Add conversation-scoped pseudonym foundations

1. Define a consultation-participation adapter without integrating live Pol.is.
2. Generate random identifiers per account and conversation.
3. Never derive pseudonyms from email, account ID, or reusable public identifiers.
4. Keep the account-to-pseudonym mapping server-restricted.
5. Prevent public or moderator APIs from reversing the mapping.
6. Define rotation, deletion, export, and incident-access rules.
7. Add purpose-limited issuance and expiration.
8. Record issuance and privileged lookup events in the audit ledger.
9. Use synthetic or closed test conversations only.
10. Add re-identification and cross-conversation-correlation tests.

**Acceptance criteria:**

- The same person cannot be correlated across conversations using public identifiers.
- Consultation providers do not receive unnecessary account information.
- No live consultation or public opinion collection is enabled.
- Privileged mapping access is exceptional, reasoned, and audited.

---

### Work package 2.11 — Add privacy and operational controls

1. Implement account data viewing and export.
2. Implement closure and deletion-request workflows using counsel-approved retention rules.
3. Add configurable retention and expiration jobs.
4. Add restricted legal-hold handling without exposing it publicly.
5. Add structured security logging with sensitive-field redaction.
6. Add CSRF, session, rate-limit, security-header, dependency, and secret-scanning checks.
7. Test backup creation and restoration.
8. Write incident-response and privileged-access procedures.
9. Add administrator dual control for the highest-impact operations where practical.
10. Update the data map and threat model to reflect implemented—not aspirational—controls.

**Acceptance criteria:**

- Data exports cannot contain another account’s records.
- Closure does not silently destroy required audit or assent history.
- Sensitive values are absent from logs and error reports.
- A tested restore can recover the service to a documented point.

---

### Work package 2.12 — Closed readiness review and handoff

1. Run formatting, lint, typecheck, unit, integration, authorization, migration, E2E, and production-build checks.
2. Run accessibility testing across all new account and staff flows.
3. Test every role and denied-action path.
4. Test invitation expiration, session revocation, document replacement, re-assent, verification expiration, and audit publication.
5. Conduct a threat-model review against the implemented system.
6. Review data maps and active documents with counsel.
7. Verify the public demo still operates without production services.
8. Verify no public signup, recruitment, donation, or live consultation path exists.
9. Create `docs/phase-2-handoff.md`.
10. Record unresolved blockers for Phase 3 and the later pilot.
11. Tag the approved foundation release only after all gates pass.

**Acceptance criteria:**

- Counsel-approved documents and role terminology are used wherever real assent or authority is represented.
- Production permissions are server-enforced and regression-tested.
- The public synthetic demonstration and gated account environment are isolated.
- Phase 2 can be demonstrated privately without being mistaken for a public launch.

---

## 10. Operating instructions for agents

When Phase 2 work is active:

1. Read [product-charter.md](./product-charter.md) and **this file**; complete only the human-approved package.
2. Treat the permitted-services register (§4) and counsel gates (§7) as hard constraints.
3. Prefer “account holder” / “community participant” language; never invent statutory membership.
4. After each package: report files changed, commands run, failed checks, and unresolved decisions; stop for approval.

Next package after 2.5 approval: **2.6 — Add versioned documents and assent**.
