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

1. `APP_MODE=public-demo` (or equivalent) **disables** persistence and auth adapters; routes use fixtures.
2. Gated modes require explicit `DATABASE_URL` and auth secrets; public-demo builds **fail closed** if those variables are present and `APP_MODE=public-demo` (misconfiguration).
3. Separate deployment projects / env var sets for public-demo vs gated apps; no shared production database credentials with the demo project.
4. Invite-only enforcement is independent of authentication success (ADR 0005).

## Consequences

- Two deployable surfaces from one repository.
- Slightly more CI matrix complexity (demo build without DB; gated build with DB).
- Prevents accidental coupling of synthetic UI to real accounts.
