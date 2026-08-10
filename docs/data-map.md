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
| Pseudonymous consultation ids | Closed-test consultation linkage without public identity (2.10 map table; no live Pol.is) | Security-restricted map; providers see opaque id only; privileged reverse = auditor/admin + reason + audit | Conversation-scoped TTL; rotation/deletion rules recorded in code | Re-identification risk; export of own maps deferred to 2.11 |
| Evidence submissions and claims | Topic briefs and review | Public with conflict/moderation labels | Long-lived public record with revision history | Copyright, defamation, moderation |
| Conflict disclosures | Deliberation / Policy Council integrity | Public summaries; private detail unpublished | Term of service + appeal window | What must be public vs redacted |
| Agenda calculation inputs/outputs | Reproducible thresholds | Public traces and method versions | Snapshot + code version retained | Algorithm accountability vs personal data |
| Deliberation and decision records | Institutional memory | Public observation + published decisions | Long-lived public record | Board authority overlays |
| Audit events | Tamper-evident institutional action | Public feed of actions (not private payloads) | Append-only with legal hold exceptions | What actor detail is published |
| Moderation / safety reports | Abuse response | Restricted staff | Incident-driven | Staff abuse, doxxing response |
| Donation / payment records | If fundraising begins | Finance staff; not in deliberation UI | Tax and charity rules | Multistate solicitation; separate systems |

## Hard Phase 1 boundaries (must remain true)

- No production participant data in prompts, fixtures, logs, screenshots, or test recordings.
- No secret or API key in the repository.
- No form transmits enrollment, assent, verification, or donation data.
- Evidence quality stays separate from popularity; algorithm output stays separate from human institutional decisions.
