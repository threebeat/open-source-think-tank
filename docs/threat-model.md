# Threat model (Phase 1 → pilot)

**Status:** Living design threat model. Phase 1 remains a static synthetic demonstration. Phase 2 architecture (Work Package 2.2) adds a **gated** invite-only plane; see [architecture-phase-2.md](./architecture-phase-2.md) and [phase-2-plan.md](./phase-2-plan.md).

Threats below are intentional planning targets, not claims that every control is already implemented in production.

## Assets

- Trust in evidence quality labels vs popularity
- Integrity of agenda thresholds and published calculation traces
- Legitimacy of deliberation and Policy Council recommendations
- Privacy of identity-assurance and granular political-opinion data
- Public decision and minority-report records
- Moderator and administrator privilege boundaries

## Threats and Phase 1 posture

### Sybil accounts

Many fake participants distort consultations or council selection.

- **Phase 1:** No real accounts; consultation practice votes are local only.
- **Later:** Verification ladder, rate limits, conversation-scoped pseudonyms, detection of coordinated enrollment. Exact assurance levels remain open.

### Brigading / coordinated voting

Organized campaigns flood statements or votes.

- **Phase 1:** Sealed synthetic report is fixture data; practice votes do not personalize the sealed report.
- **Later:** Cross-group metrics, salience checks, moderation, shadow-mode algorithms, published overrides when humans intervene.

### Doxxing and harassment

Publication of private contact, location, or identity details.

- **Phase 1:** Synthetic names only; public redaction placeholder demonstrates omission of private contact channels.
- **Later:** Strict public/private classes, redaction workflow, incident response, no private payloads in public audit summaries.

### Moderator bias

Uneven statement or evidence moderation changes outcomes.

- **Phase 1:** Moderation is not live; evidence-review states are fixture-authored and labeled.
- **Phase 2 (partial):** Dual-control claim is enforced for legal-hold release and account closure; staff audit events append to the institutional ledger.
- **Later:** Dual control for moderation and other sensitive actions; appeal paths; published moderation reasons.

### Administrator abuse

Staff alter fixtures, thresholds, or decision records without visibility.

- **Phase 1:** Catalog is code-reviewed; validation rejects inconsistent decision/deliberation links.
- **Later:** Append-only audit, role separation, reproducible algorithm snapshots, board-visible override notices.

### Re-identification

Linking pseudonymous consultation behavior to real persons.

- **Phase 1:** No real opinion histories.
- **Later:** Minimize join keys, separate identity store from opinion store, aggregate-first public reports, counsel review before any research release.

### Data breach

Exfiltration of accounts, verification artifacts, or opinion matrices.

- **Phase 1:** No production datastore; local storage is non-sensitive demo state.
- **Later:** Encryption in transit/at rest, least privilege, retention limits, breach playbooks, no secrets in client bundles.

### Algorithm gaming

Participants or operators optimize for threshold metrics rather than honest consultation.

- **Phase 1:** UI states that thresholds are separate and that there is no combined truth score.
- **Later:** Shadow-mode algorithms, parameter publication, adversarial review of metrics, human review that can defer without inventing a popularity override.

## Phase 2 architecture posture (after 2.2 ADRs)

Controls below are **implemented** through 2.11 unless noted as still blocked.

| Threat | Phase 2 design response |
| --- | --- |
| Demo ↔ production data bleed | Separate `APP_MODE`; public-demo adapters refuse DB/auth; gated secrets forbidden on demo deploys ([ADR 0002](./decisions/0002-environments-and-demo-isolation.md)) |
| Auth without invite | Invitation table + server checks independent of Auth.js ([ADR 0005](./decisions/0005-invite-gate-independent-of-auth.md)) |
| Auth mistaken for activation | Lifecycle `pending_onboarding` until 2.6–2.8 gates; no real `active` in 2.4 |
| Identity joined to public opinion | Separate stores; consultation adapter forbidden in Phase 2; closed-test pseudonym map security-restricted (2.10) |
| Secret leakage to browser | No `NEXT_PUBLIC_` secrets; adapter boundary; security headers + CSRF middleware; [secrets-and-operations.md](./secrets-and-operations.md) |
| Raw account ids in ops logs | `securityLog` uses keyed `subjectRef` / recursive identifier redaction; closure success logged only after commit |
| Audit tampering by ordinary roles | Append-only ledger; continuity digests over institutional fields; public projections allowlisted (2.9) |
| Cross-account export leakage | Own-account export aborts if another `account-*` id appears (2.11) |
| Silent destruction on closure | Closure retains assent/audit; legal holds block closure/purge (2.11) |
| Single-admin high-impact mistakes | Dual-control request/approve/claim for hold release and closure; execution consumes an approved unexpired matching request in the same transaction; self-approve denied ([incident-response.md](./incident-response.md)) |
| Email / DB vendor abuse | DPA/region/retention checklist before production keys; managed DB host still blocked pending addendum |
| Operator secret / bootstrap race (3.3) | `OPERATOR_BOOTSTRAP_SECRET` env-only (never CLI argv); timing-safe compare helper; singleton `operator_bootstrap_state` `FOR UPDATE`; refuse after completion |
| Invitation token replay / leakage (3.3) | Hash at rest; single-use accept; one-time raw link display; no-store responses; forbidSecrets on audit; public-demo 404 for issuance |
| Concurrent same-contact invite race (3.4 follow-up) | Partial unique index on pending participant contact; revoke-and-reissue; safe conflict on uniqueness race |
| Invitation CSRF bypass on staff POST (3.4 follow-up) | Explicit `assertCsrfSafe` on mutating invitations route in addition to proxy |
| Draft topic leakage / slug enumeration (3.4) | Authoring behind `topics.create`; public-demo workspace 404; public `/topics` remain fixtures; safe slug conflict messages |
| Stale topic transitions / lost updates (3.4) | Expected-state workflow/`updatedAt` checks; conflict without audit emit |
| Topic mutation without audit (3.4) | Single transaction: mutate then append; audit failure rolls back |
| Cross-participant draft enumeration / mutation (3.5) | Own-submission lists/detail only; ownership re-checked server-side; public-demo workspace 404 |
| Remote evidence fetch / scrape (3.5) | Syntax-only URL validation (`http:`/`https:`); no server or browser fetch of source URLs |
| Private disclosure leakage (3.5) | Disclosure attaches to claim only; private_detail never in public projections or audit private payloads |
| Geography-as-eligibility confusion (3.5) | Documented classification-only fields; no capability grants from FIPS; alpha still has no geographic eligibility rule |
| Public-demo proposed-topic bleed (3.5) | `discoveryState` fixture field; default listing excludes proposed; not reused for gated unpublished rows |
| Bootstrap disguised as independent review | `decision_source = operator_bootstrap` + null `reviewer_account_id` + operator label; dedicated audit actions |

## Explicit non-goals for Phase 1 / Phase 2 public-demo

- Production authentication on the public demo
- Live Pol.is threat integration
- Penetration-test certification as a Phase 2 exit criterion (review in 2.12)
- Claiming statistical representation of any population
- Treating owner risk acceptance as counsel clearance
