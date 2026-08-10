# Verification ladder (Work Package 2.7)

**Status:** Engineering contract for the gated foundation.  
**Not counsel clearance:** Eligibility, residency, political-opinion separation, and legal-identity production claims remain blocking in [phase-2-plan.md](./phase-2-plan.md) §7 (LQ10–14).

## Principles

1. The ladder is **not** proof of ideology, credibility, or policy expertise.
2. Government ID / `legal_identity` is **optional** and only mapped for documented higher-impact actions.
3. Bot resistance, contact continuity, uniqueness, eligibility, residency, and legal identity stay **distinct** assertion kinds.
4. **Status** is stored separately from raw artifacts. Phase 2 prefers **no raw artifact bytes**; short-lived hold metadata may record purpose + expiry only.
5. Public consultation projections must never include verification status or artifacts (`toPublicConsultationSafeProjection`).
6. An account **cannot** review its own verification case (application + database checks).

## Assurance levels

| Level | Required kinds |
| --- | --- |
| L0_none | — |
| L1_bot_resistance | bot_resistance |
| L2_contact_continuity | bot_resistance, contact_continuity |
| L3_uniqueness | … + uniqueness |
| L4_eligibility | … + eligibility |
| L5_residency | … + residency |
| L6_legal_identity | … + legal_identity |

Source of truth: `src/lib/verification/ladder.ts`.

## Capability → minimum assurance

| Capability | Minimum level | Notes |
| --- | --- | --- |
| `institutional.vote` | L3_uniqueness | Does **not** require legal_identity by default |
| `institutional.council_*` / `institutional.publish_decision` | L4_eligibility | Higher-impact institutional seats |
| `documents.publish` / role grants/revokes / `moderation.act` | L3_uniqueness | Staff/admin impact |
| `verification.review_case` / `audit.read_restricted` | L2_contact_continuity | Staff continuity |

Protected actions must call `authorizeCapability` (role/lifecycle **and** `evaluateAssurance`). Production activation into `active` is owned by package **2.8** and requires published-document assent plus L3 + eligibility approvals.

## Artifact pointers

- Server-minted scheme only: `ostt:vhold:<holdId>`
- After purge: tombstone `ostt:purged:<holdId>`; payload row cleared (`deleted_at`)
- Client-supplied URLs, JWTs, raw payloads, or arbitrary pointers are rejected
- Retention metadata (`purpose`, `retention_policy`, `expires_at`) is required whenever a payload exists

## Reviewer workflow

States: `pending` → `approved` | `denied`; `approved` → `expired` | `revoked`; `denied` | `revoked` → `appealed` → re-decision.

- Reviewer assignment and decisions require `verification.review_case`.
- Terminal decisions require a structured non-empty reason and `decided_at`.
- At most one `pending` / `approved` / `appealed` case per account + kind.

## Surfaces

| Surface | Contents |
| --- | --- |
| `/account/verification` | Account-private status only |
| `GET /api/verification/status` | Status + ladder description |
| `POST /api/verification/review` | Staff assign / approve / deny / revoke |
