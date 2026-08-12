# Data map (Phase 2+ planning)

**Status:** Planning aid only. Phase 1 stores no production participant data. Local demo state is synthetic practice votes and presentation-step preferences in `sessionStorage`.

Nothing here is a privacy policy, retention schedule, or legal basis determination. Counsel must review before real collection. See [legal-questions.md](./legal-questions.md) and [open-questions.md](./open-questions.md).

## Phase 1 (current)

| Data | Why present | Visibility | Retention | Notes |
| --- | --- | --- | --- | --- |
| Static fixtures (people, evidence, votes, decisions) | Demonstrate the institutional journey | Public in the repository and UI | Repository lifetime | Unmistakably synthetic |
| Consultation practice votes | Let visitors try Agree / Disagree / Pass | Local browser only | Cleared by Reset or storage clear | Keyed by synthetic topic id |
| Guided-demo step + presenter-notes flag | Presentation continuity | Local browser + optional `?step=` / `?demoStep=` | Session | No personal information |

## Later phases may collect (proposed categories)

| Category | Why | Proposed visibility | Proposed retention posture | Unresolved legal basis |
| --- | --- | --- | --- | --- |
| Account identifiers | Sign-in, role assignment | Account holder; limited staff | Account lifetime + short post-closure window | Membership vs program participation; retention under TN/federal rules |
| Contact channels | Notices, appeals, verification | Private by default | Minimize; delete when no longer needed | Notice/assent; marketing vs transactional |
| Eligibility / residency assertions | Pilot geography, representation diagnostics | Internal + aggregate public | Bound to verification purpose | What proof is required; who may see it |
| Identity-assurance artifacts | Higher ladder steps only when justified | Strictly limited staff; never public opinion join | Short-lived where possible; never in prompts/logs | Whether documents are required for any role |
| Conduct / privacy assent records | Versioned assent | Account holder + compliance staff | Long enough to prove assent version | Electronic assent form; retention vs deletion rights |
| Consultation statements and votes | Open consultation | Public aggregates; granular opinion histories protected | Purpose-limited; political-opinion sensitivity | Political-opinion data classification |
| Pseudonymous consultation ids | Closed-test consultation linkage without public identity (registry + map; no live Pol.is) | Security-restricted map; providers see opaque id only; privileged reverse = auditor/admin + reason + audit | Conversation-scoped TTL; retention job may soft-delete expired (skips legal holds) | Re-identification risk; own maps included in account export |
| Legal holds | Preserve subjects from closure/purge during incidents | Staff-restricted only; never public | Until released by administrator (dual-control claim required for release) | Counsel scope of holds |
| Closure / deletion requests | Account-holder exit workflow | Account holder + administrators | Closure retains assent/audit; anonymization of real accounts blocked while counsel gates blocking | Deletion rights unsettled (OQ15) |
| Evidence submissions and claims | Topic briefs and review | Public with conflict/moderation labels | Long-lived public record with revision history | Copyright, defamation, moderation |
| Topic geography classification (3.5) | Tennessee statewide/county taxonomy for topic content | Public labels when topic is published/demo fixtures | With topic record | Not eligibility/residency/voting; FIPS checked-in locally |
| Claim/evidence review rows + public rationales (3.6) | Human workflow/quality decisions | Public rationales may appear on published projection and owner submission views; private notes staff-only | Append-only with topic/claim/evidence | Quality ≠ claim truth; independent of popularity/consensus |
| Topic publication stamp (3.6) | `publication_status`, `published_at`, `published_by_account_id` | Published projection shows timestamp; publisher account id never public | With topic record | Independent of operational workflow pause/archive |
| Gated public projection DTO (3.6) | Anonymous visitor allowlist | Public only when published | Derived read model | No account/reviewer IDs, private notes, private disclosure, raw audit |
| Content revisions (3.7) | Editing account holder writes append-only history on post-submit content edits | **Owner** full before/after DTOs; **staff with `claims.review` / `evidence.review`** full subject history; **public** summary-only on published included rows (count, timestamps, field labels) | Resettable with alpha wipe (with claims/evidence) | Public summary never includes historic bodies, source URLs, editor account IDs, or revision row IDs |
| Public-demo discovery query state | Shareable advanced search filters | Local URL only; no accounts | Ephemeral browser | Never used for gated draft search (3.11) |
| Conflict disclosures (3.5/3.8) | Participant integrity on claim/evidence subjects | **Public:** summary on included published content; **Owner / matching reviewer:** summary + private detail for exact subject; **Moderator-only:** summary only | Resettable with alpha wipe; one current row per subject | Private detail never in anonymous DTOs, URLs, logs, or audit payloads |
| Moderation actions (3.8) | Hold/hide/restore-to-visible institutional history | **Staff:** full action history including private notes; **Public:** allowlisted withhold/restore notices (action + public rationale + date only) | Append-only within alpha dataset; wiped on alpha reset | Never hard-delete content; restore writes stored `visible`, not a `restored` state |
| Public-demo workflow preview fixtures (3.8) | Phone visual parity for 3.5–3.8 | Synthetic only; local URL `view`/`state` | Ephemeral browser | Never imports gated DB/auth/moderation services |
| Agenda calculation inputs/outputs | Reproducible thresholds | Public traces and method versions | Snapshot + code version retained | Algorithm accountability vs personal data |
| Deliberation and decision records | Institutional memory | Public observation + published decisions | Long-lived public record | Board authority overlays |
| Audit events | Tamper-evident institutional action | Public feed of actions (not private payloads) | Append-only with legal hold exceptions | What actor detail is published |
| Invitation issuance records | Invite-only enrollment (3.3) | Staff-restricted; contact redacted in lists; token **hash** only at rest | Alpha-resettable with accounts | Raw tokens shown once; never in public audit |
| Operator bootstrap state / `operator_bootstrap` verification provenance | First-administrator ceremony (3.3) | Staff/operator only; not public projections | Cleared on alpha reset | Not independent third-party verification (OQ21) |
| Moderation / safety reports | Abuse response | Restricted staff | Incident-driven | Staff abuse, doxxing response |
| Donation / payment records | If fundraising begins | Finance staff; not in deliberation UI | Tax and charity rules | Multistate solicitation; separate systems |

## Hard Phase 1 boundaries (must remain true)

- No production participant data in prompts, fixtures, logs, screenshots, or test recordings.
- No secret or API key in the repository.
- No form transmits enrollment, assent, verification, or donation data.
- Evidence quality stays separate from popularity; algorithm output stays separate from human institutional decisions.
