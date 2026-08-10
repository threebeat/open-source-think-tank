# Capability matrix (Work Package 2.5)

**Status:** Engineering authorization contract for the gated foundation.  
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
| `moderation.act` | active | moderator or administrator | — | Placeholder action surface for 2.5 tests |
| `audit.read_restricted` | active | auditor or administrator | — | Staff-restricted ledger read |
| `documents.publish` | active | administrator | — | Draft → counsel_reviewed → published only; synthetic derived from actor |
| `institutional.vote` | **active only** | **participant only** | — | Administrator does **not** imply participant/voting rights |
| `institutional.council_deliberation` | **active only** | — | deliberation_council | Does **not** imply policy council |
| `institutional.council_policy` | **active only** | — | policy_council | Does **not** imply deliberation council |
| `institutional.publish_decision` | **active only** | — | policy_council | Recommendation publication only; not board adoption |

## Self-elevation rules

1. An administrator **must not** grant themselves `deliberation_council` or `policy_council` appointments.
2. An administrator **must not** grant themselves the `administrator` platform role (no-op / silent self-grant forbidden).
3. Role and seat changes require a recorded `reason` and appear in the audit ledger with correct `synthetic` classification: an event is synthetic only when **every** involved account (actor and subject) is synthetic.
4. Platform roles are never inferred from each other (administrator ≠ participant).

## Enforcement

- UI hiding is never sufficient; every protected route/action calls `authorize(...)` on the server.
- Probe routes under `/api/authz/*` exist for automated positive/negative tests.
- Public-demo mode exposes no authorization APIs (404).
