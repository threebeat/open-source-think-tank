# Capability matrix (Work Packages 2.5 + 3.3)

**Status:** Engineering authorization contract for the gated foundation. Phase 3.3 capabilities, invitation issuance, and first-administrator bootstrap are implemented. Topic authoring UI begins in 3.4.  
**Not legal authority:** Council and administrator capabilities do not invent board-binding or statutory membership powers (counsel gates in [phase-2-plan.md](./phase-2-plan.md) §7 remain blocking).

Three independent axes must all allow an action:

| Axis | Source | Notes |
| --- | --- | --- |
| **Account lifecycle** | `accounts.lifecycle_state` | `pending_onboarding` / `invited` / `suspended` / `closed` cannot exercise institutional `active`-only capabilities |
| **Platform role** | `role_assignments` (non-revoked) | `participant`, `reviewer`, `moderator`, `administrator`, `auditor` |
| **Institutional seat** | `council_appointments` (non-revoked) | `deliberation_council` and `policy_council` are **never** inferred from each other |

Default decision: **deny**.

## Capabilities

| Capability | Lifecycle | Platform role | Institutional seat | Notes |
| --- | --- | --- | --- | --- |
| `account.read_own` | invited, pending_onboarding, active | any / none | — | Authenticated session required |
| `account.sign_out` | invited, pending_onboarding, active | any / none | — | Session holder |
| `account.revoke_all_sessions` | invited, pending_onboarding, active | any / none | — | Session holder; self only |
| `invite.accept` | anonymous → invited | — | — | Invite gate (2.4); not a logged-in capability |
| `roles.grant_platform` | active | administrator | — | Requires non-empty reason; cannot grant `administrator` to self |
| `roles.revoke_platform` | active | administrator | — | Requires reason; conditional claim; cannot self-revoke administrator; cannot revoke last administrator or last auditor |
| `roles.grant_council` | active | administrator | — | Requires reason; **actor ≠ subject**; deliberation/policy chosen explicitly |
| `roles.revoke_council` | active | administrator | — | Requires reason; conditional claim; **actor ≠ subject** |
| `verification.review_case` | active | reviewer or administrator | — | No raw artifact access in Phase 2; see also assurance map in `docs/verification-ladder.md` |
| `onboarding.staff_read` | active | reviewer or administrator | — | Redacted invitation/onboarding queues only (2.8) |
| `moderation.act` | active | moderator or administrator | — | Placeholder action surface for 2.5 tests |
| `audit.read_restricted` | active | auditor or administrator | — | Staff-restricted ledger read |
| `pseudonym.privileged_lookup` | active | auditor or administrator | — | Exceptional reverse map; reason + audit required; **not** moderators (2.10) |
| `account.export_own` | invited, pending_onboarding, active | any / none | — | Own-account export only (2.11) |
| `account.request_closure` | invited, pending_onboarding, active | any / none | — | Self closure/deletion request (2.11) |
| `privacy.manage_legal_hold` | active | administrator | — | Staff-restricted holds; never public (2.11) |
| `privacy.execute_closure` | active | administrator | — | Closure retains assent/audit (2.11) |
| `privacy.dual_control_request` | active | administrator | — | Request second-admin approval (2.11) |
| `privacy.dual_control_approve` | active | administrator | — | Approver ≠ requester (2.11) |
| `documents.publish` | active | administrator | — | Draft → counsel_reviewed → published only; synthetic derived from actor |
| `institutional.vote` | **active only** | **participant only** | — | Administrator does **not** imply participant/voting rights |
| `institutional.council_deliberation` | **active only** | — | deliberation_council | Does **not** imply policy council |
| `institutional.council_policy` | **active only** | — | policy_council | Does **not** imply deliberation council |
| `institutional.publish_decision` | **active only** | — | policy_council | Recommendation publication only; not board adoption |
| `topics.create` | active | administrator | — | Creates draft topic (`publication_status = unpublished`) — 3.3+ |
| `topics.update` | active | administrator | — | Edit draft/meta; not a substitute for publish |
| `topics.open` | active | administrator | — | → `open_for_submissions` |
| `topics.publish` | active | administrator | — | Sets `publication_status = published` (independent of pause); readiness in 3.6 |
| `topics.pause` | active | administrator | — | Operational pause; **does not** change publication status |
| `topics.archive` | active | administrator | — | → `archived`; reason required |
| `claims.submit` | active | participant | — | Create/submit own claims |
| `claims.edit_own` | active | participant | own (service checks) | Authz establishes eligibility only; ownership verified in transaction; also authorizes **owner** claim revision-history reads (3.7) |
| `claims.withdraw_own` | active | participant | own (service checks) | History retained |
| `claims.review` | active | reviewer or administrator | — | Claim workflow decisions (3.6 queues/services); also authorizes **staff** claim subject revision history (3.7) |
| `evidence.submit` | active | participant | — | Source URL + metadata only |
| `evidence.edit_own` | active | participant | own (service checks) | No remote fetch; also authorizes **owner** evidence revision-history reads (3.7) |
| `evidence.withdraw_own` | active | participant | own (service checks) | History retained |
| `evidence.review` | active | reviewer or administrator | — | Workflow + independent quality decisions (3.6); also authorizes **staff** evidence subject revision history (3.7) |
| `conflicts.disclose_own` | active | participant | own (service checks) | Required on submit (3.5) and own disclosure create/update (3.8); does **not** grant staff private-detail reads |
| `moderation.review_submission` | active | moderator or administrator | — | Visibility hold/hide/restore-to-visible with required public rationale (3.8); does **not** grant disclosure private-detail access or pseudonym reverse-map; private-detail still requires matching `claims.review` / `evidence.review` |
| `workspace.search` | active | participant, reviewer, moderator, or administrator | — | Gated workspace metadata search (3.11); L3 uniqueness; auditor-only `audit.read_restricted` does **not** grant this; audience rules in architecture §5 / phase-3-plan 3.11 |
| `topics.export_staff` | active | reviewer or administrator | — | Staff topic-package export (3.11); L3 uniqueness; allowlisted projector; no private notes/disclosure detail/account IDs |
| `invites.issue` | active | administrator | — | Hashed token at rest; raw link returned once; never public-demo |
| `consultations.create` | active | administrator | — | Create current Public Input conversation for a topic (4.3); gated only; not live Pol.is |
| `consultations.transition` | active | administrator | — | Forward + recovery lifecycle transitions (4.3); reason required for close/archive/recovery |
| `consultations.manage_provider_mapping` | active | administrator | — | Attach/rotate/remove opaque provider refs; operational kinds `none`/`fixture` only (4.3) |
| `consultations.set_availability` | active | administrator | — | Set provider availability independently of institutional workflow (4.3) |
| `consultations.reports.import` | active (4.4) | administrator | — | Validate + store aggregate-only canonical import → immutable report version; gated only; not live Pol.is; not raw-export ingest |
| `consultations.reports.review` | active (4.4) | administrator | — | Review / reject imported report versions with substantive reason; does not auto-publish |
| `consultations.reports.publish` | active (4.4) | administrator | — | Publish or supersede allowlisted public report projection; never leaks `providerConversationRef` |
| `consultations.moderation.record` | active (4.4) | moderator or administrator | — | Append institutional Public Input moderation / finding-eligibility actions with required reason; does **not** grant agenda promotion, metric edits, or live provider admin API |

### Phase 4.1–4.4 authority notes (public-demo / pre-deliberation / consultation ops)

Phase 4.1–4.4 do **not** authorize live Pol.is. Pre-deliberation product rules (see [ADR 0010](./decisions/0010-computational-democracy-pipeline.md), [ADR 0012](./decisions/0012-public-input-provider-boundary.md), [ADR 0014](./decisions/0014-institutional-conversation-lifecycle.md), [ADR 0018](./decisions/0018-aggregate-only-canonical-import-format.md)–[0021](./decisions/0021-complementary-small-cell-suppression.md)):

- Moderators may perform safety/relevance/duplication/formatting/process interventions with a recorded reason.
- Moderators, administrators, board members, and ordinary participants **cannot** assign agenda priority, privately promote proposals, directly promote pre-deliberation topics, alter consultation metrics, or receive elevated badges/ranking advantages on ordinary Idea Commons contributions.
- Formal Topic Pipeline entry is criteria-based and auditable — never a preference shortcut.
- Phase **4.3** adds gated administrator capabilities `consultations.create`, `consultations.transition`, `consultations.manage_provider_mapping`, and `consultations.set_availability` for the institutional lifecycle (`none`/`fixture` only). These are **not** live-provider install authorization.
- Phase **4.4** adds `consultations.reports.import`, `consultations.reports.review`, `consultations.reports.publish`, and `consultations.moderation.record` for aggregate ingest and moderation engineering. These are **not** live-provider install authorization and do **not** authorize raw provider-export retention as first-class ingest.
- Independent axes (lifecycle, availability, provider moderation, finding eligibility, import validation, report publication, evidence quality, agenda qualification) must not be collapsed by capability grants.
- Live consultation provider activation remains blocked until the activation checklist, permitted-services register addendum, vendor/privacy gates, and owner `ENABLE LIVE POLIS…` authorization clear.
- Canonical topic sections (including public report) are public navigation states, not new institutional capabilities beyond the gated caps above.

### Operator actions (not account capabilities)

| Action | Actor | Notes |
| --- | --- | --- |
| `operator.bootstrap_administrator` | Environment operator (`OPERATOR_BOOTSTRAP_SECRET` + `OPERATOR_LABEL`) | First-administrator ceremony only; not exercised by a normal authenticated principal; never public-demo; see [phase-3-plan.md](./phase-3-plan.md) bootstrap ceremony |
| `alpha.reset_executed` (audit action; not a browser capability) | Environment operator (`OPERATOR_RESET_SECRET` + `OPERATOR_LABEL` + fingerprint confirm) | Gated CLI only; dry-run default; never public-demo; never HTTP; see [alpha-reset-runbook.md](./alpha-reset-runbook.md) |

## Self-elevation rules

1. An administrator **must not** grant themselves `deliberation_council` or `policy_council` appointments.
2. An administrator **must not** grant themselves the `administrator` platform role (no-op / silent self-grant forbidden).
3. Role and seat changes require a recorded `reason` and appear in the audit ledger with correct `synthetic` classification: an event is synthetic only when **every** involved account (actor and subject) is synthetic.
4. Platform roles are never inferred from each other (administrator ≠ participant).

## Enforcement

- UI hiding is never sufficient; every protected route/action calls `authorizeCapability(...)` (role + assurance) on the server.
- Probe routes under `/api/authz/*` exist for automated positive/negative tests.
- Public-demo mode exposes no authorization APIs (404).
