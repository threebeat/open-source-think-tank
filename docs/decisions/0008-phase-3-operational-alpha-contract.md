# ADR 0008 — Phase 3 operational alpha contract

**Status:** Accepted (product/engineering decision)  
**Date:** 2026-08-11  
**Package:** 3.1  
**Related:** [phase-3-plan.md](../phase-3-plan.md), [architecture-phase-3.md](../architecture-phase-3.md), [0006-phase-3-two-lane-sequencing.md](./0006-phase-3-two-lane-sequencing.md), [0007-alpha-test-interim-council-dispositions.md](./0007-alpha-test-interim-council-dispositions.md)

This ADR is a **product/engineering decision**. It is **not** a claim of new legal authority, statutory membership settlement, or external-service approval beyond the existing Phase 2 permitted-services register and alpha-test interim council scopes in ADR 0007.

## Context

Phase 2 delivered an invite-only foundation (accounts, roles, assent, verification, audit, demo/gated isolation). Phase 3 must become an **operational multi-user alpha-test system**, not a single-user experiment and not merely another synthetic demo. Simultaneously:

- Public-demo mode must remain fixture-backed and separately deployable.
- Alpha users and topic discussions must remain **fully resettable** and must not become permanent production history.
- Email is still **capture-only**; real invitation issuance and first-administrator bootstrap are missing and must be solved without pretending a vendor is approved.
- Staff duties may be concentrated in the project owner during the alpha, but capability checks and audit records must remain intact.

## Decision

1. **Phase 3 targets an operational, invite-only, multi-user alpha-test system** built on PostgreSQL 16 + Drizzle, Auth.js, and server-enforced capabilities in one Next.js App Router repository.
2. **The public demo remains synthetic and isolated.** Public-demo must never construct the gated database or authentication runtime. Gated services/repositories must not use the synthetic fixture catalog for mutations.
3. **The first operational vertical slice** is packages **3.2–3.6**: durable model → capabilities/bootstrap/invites → topic authoring → participant claim/source submission → evidence review queue. Anonymous publication of gated projections is **3.10**.
4. **Staff duty concentration** in the project owner is allowed during the alpha **while** every privileged action still passes `authorizeCapability` and appends an audit event naming the actual capability and actor. Administrator fallback for reviewer/moderator operations follows existing Phase 2 patterns and does **not** grant participant voting rights or council seats.
5. **Alpha data is resettable** and does not become permanent production history. Retained outputs are the product and the post-alpha report (ADR 0007 / OQ17).
6. **Deferred polish/scale requirements** are recorded in the architecture deferred register and are **not** treated as complete.
7. **Initial slice constraints:** store source URLs and submitter metadata only (no fetch/scrape/preview/download); no file uploads, rich-text dependencies, AI APIs, analytics, payments, live Pol.is, notifications, or new external services; evidence-quality status stays independent from submission workflow, popularity, and later consultation consensus; revisions are preserved under withdraw/reject/moderate.
8. **Operational carryovers that 3.3 must solve:** audited gated operator bootstrap for the first administrator; invitation issuance with hashed storage; until an email provider is approved, support operator-delivered single-use links. Raw tokens are shown once, never persisted unhashed, never written to application logs, and never exposed in public-demo mode.
9. **Deployment vendors remain separate decisions:** managed PostgreSQL and production email are not selected or installed by this ADR or by package 3.1.

## Consequences

- Agents treat [phase-3-plan.md](../phase-3-plan.md) as the active Phase 3 work-package source.
- Implementing packages must extend the capability matrix and audit registry rather than inventing parallel authz.
- Documentation must not claim Phase 3 runtime features exist before their packages land.
- Owner-deferred items may slip without blocking the definition of the vertical slice, but core isolation, authz, audit, integrity, and reset rules must not be weakened to compensate.

## Confirmation

Recorded as the Work Package 3.1 operational contract for Phase 3 engineering (2026-08-11).
