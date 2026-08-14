# ADR 0019 — Immutable report versioning and publication

**Status:** Accepted for Phase 4.4 engineering contract  
**Date:** 2026-08-13  
**Related:** [phase-4-plan.md](../phase-4-plan.md), [architecture-phase-4.md](../architecture-phase-4.md), [ADR 0018](./0018-aggregate-only-canonical-import-format.md), [ADR 0020](./0020-public-input-moderation-versus-provider-moderation.md), [ADR 0021](./0021-complementary-small-cell-suppression.md)

## Context

Imported aggregates must be auditable. Editing a published report in place would erase provenance, enable silent metric changes, and blur the line between import validation and institutional publication.

## Decision

1. Each successful validation produces an **immutable report version** (`public_input_reports` plus child `public_input_report_groups` / `public_input_report_findings`). Content rows are not updated after create; corrections require a **new import version**.
2. Report lifecycle states are independent of conversation workflow: at minimum `imported` → `under_review` → `published` | `rejected` (exact enum in implementation). Publication does **not** transition conversation lifecycle or provider availability.
3. **Finding publication eligibility** (`include` / `withhold` / `supersede`) may change **only** while the parent report is `under_review`, and only with an expected concurrency version. Database triggers enforce content immutability and reject post-publication status changes. Changing a published public projection in place is forbidden.
4. **Publication** projects an allowlisted public DTO only (same forbidden-key rules as Phase 4.1–4.2). Suppressed cells use complementary small-cell suppression ([ADR 0021](./0021-complementary-small-cell-suppression.md)); suppressed shares are `null`, never coerced to `0`.
5. At most one **current published** report per **conversation**. For topic-level public projection, select the latest published report belonging to the topic’s **current** consultation designation — never an unordered pick among historical conversations’ `is_latest_published` rows. Historical published reports remain institutional records for later Records surfaces.
6. Capabilities:
   - `consultations.reports.review` — move imported versions through review / rejection with substantive reason; finding eligibility decisions under the lock above
   - `consultations.reports.publish` — publish or supersede the public projection
7. Self-dealing provenance: actors who import may review only with explicit recorded provenance; publication audits must record actor role, timestamp, method/import versions, and conflicts. Import success never auto-publishes. Concurrent imports for one conversation are serialized.
8. Public route: published reports are addressable under the Formal Topic surface (`/formal-topics/[slug]/consultation/report`) without exposing `providerConversationRef`, import blob storage paths, or staff-only moderation detail. Operational unavailability must not be disguised as not-found.
9. Alpha reset classifies report tables as **reset** (local wipe only; never claims remote provider deletion).
10. This ADR does **not** authorize live Pol.is or treat published aggregates as agenda qualification or evidence-quality decisions.

### Amendment — Phase 4.5A (2026-08-14)

Closes owner-review P0/P1 defects: finding lock + concurrency, current-consultation selection, serialized imports, title-in-hash alignment with ADR 0018 `@1.1`, and unavailable vs not-found on the public report route.

## Consequences

- Institutions can correct mistakes by versioning, not silent overwrite.
- Visitors see only published allowlisted projections; staff retain immutable provenance.
- Report publication remains a separate human decision from import validation and from agenda qualification (4.5).
