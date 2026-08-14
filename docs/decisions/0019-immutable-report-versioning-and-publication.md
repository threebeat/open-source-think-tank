# ADR 0019 — Immutable report versioning and publication

**Status:** Accepted for Phase 4.4 engineering contract  
**Date:** 2026-08-13  
**Related:** [phase-4-plan.md](../phase-4-plan.md), [architecture-phase-4.md](../architecture-phase-4.md), [ADR 0018](./0018-aggregate-only-canonical-import-format.md), [ADR 0020](./0020-public-input-moderation-versus-provider-moderation.md), [ADR 0021](./0021-complementary-small-cell-suppression.md)

## Context

Imported aggregates must be auditable. Editing a published report in place would erase provenance, enable silent metric changes, and blur the line between import validation and institutional publication.

## Decision

1. Each successful validation produces an **immutable report version** (`public_input_reports` plus child `public_input_report_groups` / `public_input_report_findings`). Content rows are not updated after create; corrections require a **new import version**.
2. Report lifecycle states are independent of conversation workflow: at minimum `imported` → `under_review` → `published` | `rejected` (exact enum in implementation). Publication does **not** transition conversation lifecycle or provider availability.
3. **Publication** projects an allowlisted public DTO only (same forbidden-key rules as Phase 4.1–4.2). Suppressed cells use complementary small-cell suppression ([ADR 0021](./0021-complementary-small-cell-suppression.md)); suppressed shares are `null`, never coerced to `0`.
4. At most one **current published** report per conversation (or per topic’s current conversation — implementation chooses one explicit rule and documents it). Superseded published versions remain readable as historical institutional records where the product surfaces history.
5. Capabilities:
   - `consultations.reports.review` — move imported versions through review / rejection with substantive reason
   - `consultations.reports.publish` — publish or supersede the public projection
6. Self-dealing provenance: actors who import may review only with explicit recorded provenance; publication audits must record actor role, timestamp, method/import versions, and conflicts. Import success never auto-publishes.
7. Public route (planned): published reports are addressable under the Formal Topic surface (e.g. `/formal-topics/[slug]/report` or an allowlisted `section=report`) without exposing `providerConversationRef`, import blob storage paths, or staff-only moderation detail.
8. Alpha reset classifies report tables as **reset** (local wipe only; never claims remote provider deletion).
9. This ADR does **not** authorize live Pol.is or treat published aggregates as agenda qualification or evidence-quality decisions.

## Consequences

- Institutions can correct mistakes by versioning, not silent overwrite.
- Visitors see only published allowlisted projections; staff retain immutable provenance.
- Report publication remains a separate human decision from import validation and from agenda qualification (4.5).
