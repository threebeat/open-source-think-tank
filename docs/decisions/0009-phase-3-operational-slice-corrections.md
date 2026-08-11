# ADR 0009 — Phase 3 operational-slice corrections

**Status:** Accepted (product/engineering decision)  
**Date:** 2026-08-11  
**Package:** 3.1.1  
**Amends:** [0008-phase-3-operational-alpha-contract.md](./0008-phase-3-operational-alpha-contract.md) (only the points below)  
**Related:** [phase-3-plan.md](../phase-3-plan.md), [architecture-phase-3.md](../architecture-phase-3.md)

This ADR is a **product/engineering decision**. It does not select vendors, invent legal authority, or rewrite ADR 0008 wholesale.

## Context

Work Package 3.1 locked the Phase 3 operational alpha contract. Review before schema work (3.2) found several ambiguities that would force implementers to invent answers:

- Topic “published” was modeled as a workflow state, so pausing submissions could be misread as unpublishing.
- Moderation treated `restored` as a stored visibility state rather than an action back to `visible`.
- Claim workflow decisions were folded into `evidence.review`.
- Supporting/counterevidence linking and visitor-visible publication were deferred past the first vertical slice in ways that left 3.2–3.6 without a demonstrable public result.

## Decision (amendments only)

1. **Separate topic operational workflow from publication status.**
   - **Operational workflow:** `draft`, `open_for_submissions`, `under_review`, `paused`, `archived`.
   - **Publication status:** `unpublished` or `published`.
   - Pausing (or reopening) submissions **must not** change publication status. An already published topic may remain published while `paused`.

2. **Moderation visibility storage** is only `visible`, `held`, or `hidden`. **Restoration** is an action that transitions `held`/`hidden` → `visible` and emits `moderation.submission_restored`. Do not persist a distinct `restored` enum value.

3. **Add planned `claims.review`** for claim workflow decisions (`changes_requested` / `accepted` / `rejected`). Keep **`evidence.review`** for evidence submission workflow decisions and independent evidence-quality decisions.

4. **Basic supporting/counterevidence relationship** belongs in **3.2** (schema) and **3.5** (submit path). Package **3.7** owns richer linking, comparison UX, and immutable revision history—not the initial relationship column/table.

5. **Minimal database-backed publication path lands at the end of 3.6:** an administrator publishes a reviewed topic; a visitor sees the topic, accepted visible claims/sources, quality labels, and public review explanations. Package **3.10** completes and hardens the public interface (revision, disclosure, moderation, and presentation depth)—it is not the first time a visitor can see a gated published topic.

6. **Real off-device multi-user alpha** requires an **approved reachable gated deployment** and **persistent PostgreSQL**. This ADR does **not** select a managed host or email vendor; those remain blocked pending permitted-services addenda.

## Unchanged from ADR 0008

- Dual-mode isolation (public-demo fixtures vs gated DB/auth).
- First vertical slice remains packages **3.2–3.6** (now including minimal visitor-visible publish).
- Capability checks, CSRF, Zod, transactions, and audit remain mandatory.
- Alpha data remains fully resettable.
- No remote source fetch, file uploads, AI/analytics/payments/live Pol.is in the initial slice.
- Staff duty concentration may remain with the project owner while recording actual capability and actor.

## Consequences

- [phase-3-plan.md](../phase-3-plan.md) and [architecture-phase-3.md](../architecture-phase-3.md) must reflect these corrections before 3.2 schema design.
- Implementers must model `publication_status` independently from `workflow_state`.
- Public projection filters use visibility ∈ {`visible`} (after restore action), not a `restored` state.

## Confirmation

Recorded as Work Package 3.1.1 Checkpoint 1 (2026-08-11).
