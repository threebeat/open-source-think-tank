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
| `conflicts.disclose_own` | active | participant | own (service checks) | Required on submit path in 3.5 |
| `moderation.review_submission` | active | moderator or administrator | — | Visibility hold/hide/restore-to-visible; moderators do **not** get pseudonym reverse-map |
| `invites.issue` | active | administrator | — | Hashed token at rest; raw link returned once; never public-demo |

### Operator actions (not account capabilities)

| Action | Actor | Notes |
| --- | --- | --- |
| `operator.bootstrap_administrator` | Environment operator (`OPERATOR_BOOTSTRAP_SECRET` + `OPERATOR_LABEL`) | First-administrator ceremony only; not exercised by a normal authenticated principal; never public-demo; see [phase-3-plan.md](./phase-3-plan.md) bootstrap ceremony |

## Self-elevation rules

1. An administrator **must not** grant themselves `deliberation_council` or `policy_council` appointments.
2. An administrator **must not** grant themselves the `administrator` platform role (no-op / silent self-grant forbidden).
3. Role and seat changes require a recorded `reason` and appear in the audit ledger with correct `synthetic` classification: an event is synthetic only when **every** involved account (actor and subject) is synthetic.
4. Platform roles are never inferred from each other (administrator ≠ participant).

## Enforcement

- UI hiding is never sufficient; every protected route/action calls `authorizeCapability(...)` (role + assurance) on the server.
- Probe routes under `/api/authz/*` exist for automated positive/negative tests.
- Public-demo mode exposes no authorization APIs (404).
