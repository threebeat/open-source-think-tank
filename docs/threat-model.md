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
| Cross-account export leakage | Own-account export aborts on structured foreign ownership fields **and** if another `account-*` id appears in serialization (2.11/3.11) |
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
| Remote evidence fetch / scrape (3.5/3.9) | Shared `https:` source-URL policy with host denylist (literal classification only); no DNS, no server or browser fetch of source URLs |
| Private disclosure leakage (3.5/3.8) | One current disclosure per claim/evidence; private_detail only in owner + matching reviewer DTOs; never in moderator-only, anonymous projection, audit payloads, URLs, or CSS-hidden client props |
| Uneven / unauthorized moderation (3.8) | `moderation.review_submission` only; participant denied; expected-state transitions; append-only `moderation_actions` + audits; no hard-delete |
| Hidden-content leakage via notices (3.8) | Public withhold notices allowlist action/rationale/date only — no held title/body/URL, internal IDs, account IDs, or private notes |
| Stale moderation/disclosure writers (3.8/3.9) | SQL expected visibility/`updated_at` (ms) conditions on the write; concurrent same-token writers: one success, one conflict; losers create no partial rows/audits |
| Moderation/disclosure audit rollback (3.8) | Action-history or audit failure rolls back visibility/disclosure update in the same transaction |
| Demo/gated import confusion (3.8) | `/demo/workflow` is fixture-only; workspace moderation/disclosure APIs 404 in public-demo before gated imports; no fake operational admin console |
| Geography-as-eligibility confusion (3.5) | Documented classification-only fields; no capability grants from FIPS; alpha still has no geographic eligibility rule |
| Public-demo proposed-topic bleed (3.5) | `discoveryState` fixture field; default listing excludes proposed; not reused for gated unpublished rows |
| Staff review / private notes leakage (3.6) | Private notes staff-only on review DTOs; never in public projection, participant views, audit summaries, or URL state |
| Unpublished gated topic enumeration (3.6) | Repository filter `publication_status=published` + projection rejects non-publishable rows; missing/unpublished → generic 404; metadata indistinguishability |
| False 404 / empty-catalog disguise on read failure (3.10) | Gated list/detail distinguish `AdapterResult` failures (sanitized unavailable UI) from missing/unpublished (`null` → 404) and genuine empty published catalogs |
| Quality-rejected evidence as publishable (3.10) | Readiness + projection require quality `accepted`/`limited`/`disputed`; `pending`/`rejected` never satisfy readiness or appear as included sources; no auto-unpublish |
| Empty published topic inconsistency (3.10) | Published topics stay addressable with a safe empty shell when no claim/evidence is currently eligible; moderation does not silently unpublish |
| Workflow/quality/publication confusion (3.6) | Independent axes in schema, services, UI copy; publish preserves operational workflow; pause does not unpublish |
| Stale concurrent review/publish races (3.6) | Expected-state updates; one winner; audit failure rolls back review/state/publication together |
| Revision tampering or silent deletion (3.7) | `content_revisions` immutable trigger rejects UPDATE/DELETE; withdraw/reject/hide retain history |
| Historic-body leakage in public projection (3.7) | Public allowlist is summary-only (count, timestamps, field labels); never historic snapshot bodies, URLs, editor IDs, or revision row IDs |
| Cross-account revision history reads (3.7) | Owner history requires `*.edit_own` + ownership; staff history requires `claims.review` / `evidence.review`; no broad history capability |
| Cross-topic link / revision confusion (3.7) | Same-topic composite FKs on `claim_evidence_links` and `content_revisions`; comparison UX uses existing supporting/counterevidence links only |
| Reviews predating revised content (3.7) | Chronology notice in owner/staff history UI; 3.7 does **not** auto-reset evidence quality or invent a new publish blocker (see OQ22) |
| Bootstrap disguised as independent review | `decision_source = operator_bootstrap` + null `reviewer_account_id` + operator label; dedicated audit actions |
| Mutation abuse / oversized bodies (3.9) | 32 KiB bounded JSON (`413`); per-family account + optional trusted-origin rate limits (`429`); no denial-side domain/audit writes; opaque security-log refs only |
| Closure-request CSRF / abuse (2.12 post-merge) | Shared `csrfDeniedResponse` is `no-store`; closure POST uses `gateAuthenticatedMutation` with dedicated `privacy_request` family; unexpected TX failures map to stable public errors (detail only in redacted security logs) |
| Source URL SSRF via stored links (3.9) | Reject private/local/metadata hosts and non-https schemes at validate/publish/projection; anchors use `noopener noreferrer` + `referrerPolicy=no-referrer`; no remote fetch |
| Demo practice mistaken for gated intake (3.9) | Topic-recommendation labeled interaction prototype; sessionStorage only; zero workspace API calls; snapshot explorer secondary |
| Cross-participant draft search leakage (3.11) | `workspace.search` SQL ACL by role/ownership; participant hits only own claims/evidence; auditor-only denied; DTOs forbid account IDs/private notes |
| Staff export over-disclosure (3.11) | Allowlisted topic projector; omit account IDs, contacts, verification, invites, pseudonyms, raw audit, private disclosure, private notes; audit event stores counts only |
| Search/export in public-demo (3.11) | Generic 404 before gated DB/auth imports; zero gated persistence calls on demo path |
| Remote fetch via export/search (3.11) | Source URLs revalidated locally only; never fetched during export or search |
| Unbounded workspace search load (3.12) | SQL `COUNT` + `ORDER BY` + `LIMIT`/`OFFSET`; page ≤100; pageSize ≤50; no load-all-then-slice |
| Multi-role search href confusion (3.12) | Internal admission class picks href; owner drafts → owner surfaces even for staff multi-role principals; class never in DTOs |
| Thrown search/export exception leakage (3.12) | Sanitized `WORKSPACE_SEARCH_UNAVAILABLE` / `ACCOUNT_EXPORT_UNAVAILABLE` / `STAFF_EXPORT_UNAVAILABLE`; no SQL/config/IDs/stacks |
| Accidental alpha wipe / wrong DB (3.12) | Dry-run default; fingerprint confirm; refuse `ostt_dev` in smoke; advisory lock; transactional deletes; no public reset route; metadata-only receipt |
| Idea Commons mistaken for formal topics (4.1) | Distinct routes/copy; informal banners; Formal Pipeline gate disclosures |
| Preference-based pre-deliberation promotion (4.1) | Authority helpers forbid private promotion / agenda priority / elevated badges; tests assert |
| Public Input re-identification (4.1) | Allowlisted aggregate DTOs only; small-cell suppression; forbid xid/provider IDs/vote rows in public surfaces |
| Civic-action profiling (4.1) | Member actions use explicit fixture geography/interests; ban vote/ideology personalization |
| Live Pol.is from public-demo (4.1) | No provider client/network calls; synthetic fixtures only until 4.2+ register approval |

## Explicit non-goals for Phase 1 / Phase 2 public-demo / Phase 4.1

- Production authentication on the public demo
- Live Pol.is install or undocumented provider features in 4.1
- Penetration-test certification as a Phase 2 exit criterion (review in 2.12)
- Claiming statistical representation of any population
- Treating owner risk acceptance as counsel clearance
