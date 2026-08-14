# ADR 0021 — Complementary small-cell suppression

**Status:** Accepted for Phase 4.4 engineering contract  
**Date:** 2026-08-13  
**Related:** [phase-4-plan.md](../phase-4-plan.md), [architecture-phase-4.md](../architecture-phase-4.md), [ADR 0018](./0018-aggregate-only-canonical-import-format.md), [ADR 0019](./0019-immutable-report-versioning-and-publication.md), OQ27, OQ35

## Context

Phase 4.2 already forbids rendering a suppressed opinion-group share as `0%`. When only one small cell is suppressed in a closed set of group shares (or other complementary percentages), observers can often **reconstruct** the suppressed value from totals and the remaining reported shares. Simple per-cell suppression is therefore insufficient against differencing / reconstruction attacks.

## Decision

1. Public report projections apply **complementary small-cell suppression**: if suppressing a cell would allow reconstruction of a protected small cell from reported siblings and known totals, suppress the **minimum complementary set** required to block that reconstruction.
2. Suppressed cells always use `status: "suppressed"` with `share: null` (never coerce to `0` or omit silently without status).
3. **Exact integer `participantCount`** is the suppression input. Never infer cell size via `Math.round(share × participationCount)`. Display shares are derived from exact counts ÷ participation. Policy version: `4.5.1-exact-count-complementary`.
4. Synthetic public-demo keeps the provisional threshold of **5** for engineering and education. That number is **not** a production privacy decision.
5. Production threshold remains open: privacy review (**OQ27**) plus explicit owner approval of the numeric production threshold (**OQ35**) before gated published reports use any non-provisional value. Exact-count / partition privacy rule confirmation remains **OQ36**.
6. Suppression runs at **projection time** for public DTOs (and must be re-checked on publish). Stored import rows may retain pre-suppression aggregate inputs as protected/staff data under gated access — never as public DTO fields.
7. Differencing across **report versions** must not re-expose a previously suppressed cell: publication/review UX and public history views apply suppression consistently (including complementary rules) to each version’s public projection.
8. This ADR does **not** settle the production threshold, authorize live Pol.is, or weaken forbidden-key / aggregate-only rules.

### Amendment — Phase 4.5A (2026-08-14)

Replaces share-rounding inference with exact counts (owner-review P0). Import schema `@1.1` validates partition consistency before storage.

## Consequences

- Reconstruction via “100% − sum(reported)” is treated as a first-class threat in 4.4 engineering.
- Demo and gated alpha can ship complementary suppression mechanics while privacy/owner threshold gates remain unresolved.
- Weakening complementary suppression to make a chart “add to 100%” is a stop condition.
