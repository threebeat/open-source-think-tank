# ADR 0002 — Environments and public-demo isolation

- **Status:** Accepted for Phase 2 architecture (Work Package 2.2)
- **Date:** 2026-08-09
- **Context:** [phase-2-plan.md](../phase-2-plan.md)

## Context

Phase 2 adds an invite-only foundation while the tagged Phase 1 synthetic demonstration must remain separately deployable. A public-demo deployment must never reach a production (or staging) participant datastore.

## Decision

### Environments

| Environment | Purpose | Participant DB | Real invites |
| --- | --- | --- | --- |
| **public-demo** | Tagged Phase 1 synthetic walkthrough | **None** — fixtures + client demo state only | No |
| **development** | Local gated foundation work | Local PostgreSQL (synthetic seeds) | Synthetic only |
| **test** | CI / Playwright against gated app | Ephemeral PostgreSQL | Synthetic only |
| **staging** | Closed rehearsal of gated foundation | Isolated staging DB | Invite-only; non-public cohort |
| **production** | Eventual gated production | Production DB | Invite-only after counsel/ops gates |

### Isolation rules

1. `APP_MODE` is resolved by `src/lib/env/app-mode.ts` (unset defaults to **public-demo**).
2. `assertEnvironmentSafe()` runs from Next.js `instrumentation.ts` and before any DB client construction; **public-demo fails closed** if gated secrets (`DATABASE_URL`, `AUTH_SECRET`, …) are present.
3. Gated modes require explicit `DATABASE_URL`; persistence/auth adapters stay disabled in public-demo.
4. Separate deployment projects / env var sets for public-demo vs gated apps; no shared production database credentials with the demo project.
5. Invite-only enforcement is independent of authentication success (ADR 0005).
6. Staging/production **managed database hosts** are not authorized by the PostgreSQL technology choice alone (see ADR 0003 / permitted-services register).

## Consequences

- Two deployable surfaces from one repository.
- Slightly more CI matrix complexity (demo build without DB; gated build with DB).
- Prevents accidental coupling of synthetic UI to real accounts.
