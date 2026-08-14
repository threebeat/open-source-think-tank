# ADR 0018 — Aggregate-only canonical import format

**Status:** Accepted for Phase 4.4 engineering contract  
**Date:** 2026-08-13  
**Related:** [phase-4-plan.md](../phase-4-plan.md), [architecture-phase-4.md](../architecture-phase-4.md), [ADR 0012](./0012-public-input-provider-boundary.md), [ADR 0019](./0019-immutable-report-versioning-and-publication.md), [ADR 0021](./0021-complementary-small-cell-suppression.md), OQ27, OQ29, OQ35

## Context

Phase 4.3 landed the institutional conversation lifecycle without report ingest. Phase 4.4 must accept consultation outcomes into the gated alpha without importing raw provider exports, participant vote matrices, or identity-linking fields — and without authorizing live Pol.is.

## Decision

1. Define a **canonical aggregate-only import descriptor** (versioned schema) as the only accepted ingest payload for Public Input reports.
2. Allowed content is limited to allowlisted aggregates already named in the Phase 4 privacy contract: participation/comment/vote totals; neutrally labeled opinion groups with **exact integer `participantCount`**; cross-group agreement / meaningful disagreement findings; sufficiency and representation limitation text; method version; import provenance timestamps; optional immutable `aggregateModerationDisclosure`.
3. **Rejected at validation (fail closed):** per-person vote rows; vote matrices; individual group membership maps; provider participant IDs; account IDs; `xid` / identity-linking fields; raw provider URLs/tokens; secret-bearing admin/report links; nested objects carrying forbidden keys (recursive walk); float `share` as the sole group size input; partitions whose counts do not sum to `participationCount`; duplicate normalized group labels.
4. Raw provider exports remain **protected data** and are **out of scope** for 4.4/4.5A ingest. Operators must transform (or refuse) vendor dumps outside the application until a later package explicitly authorizes protected-export handling with retention rules (OQ29).
5. Import validation is an **independent axis** from conversation lifecycle, provider availability, report publication, evidence quality, and agenda qualification. A valid import does not open/close a conversation, mark a provider available, publish a report, set evidence quality, or qualify an agenda item.
6. Persist validated imports under gated tables: `public_input_report_imports`, with derived `public_input_reports`, `public_input_report_groups`, and `public_input_report_findings` created only after validation succeeds. Persist `publicTitle` **only** from the validated payload (it is part of the canonical hash).
7. Capability: `consultations.reports.import` (administrator). Public-demo never performs ingest; synthetic reports remain fixture-backed.
8. This ADR does **not** authorize live Pol.is, provider credentials, network clients, iframe UI, or counsel clearance.

### Amendment — Phase 4.5A (2026-08-14)

Schema version **`public-input-aggregate-import@1.1`** replaces float-share group sizing with exact `participantCount`. Outer request `publicTitle` is ignored. Optional `aggregateModerationDisclosure` may be included in the hashed payload; when absent, public DTOs omit moderation disclosure entirely.

## Consequences

- Staff can engineer versioned aggregate ingest while live activation stays fail-closed.
- Schema drift / malicious payloads fail validation without writing public projections.
- Future vendor export automation requires a separate authorization and must still map into this aggregate-only canonical form before institutional storage.
