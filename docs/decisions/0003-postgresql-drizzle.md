# ADR 0003 — PostgreSQL with Drizzle ORM

- **Status:** Accepted for Phase 2 local/ephemeral gated work (Work Package 2.2; implemented in 2.3)
- **Date:** 2026-08-09
- **Context:** [phase-2-plan.md](../phase-2-plan.md), [0002-environments-and-demo-isolation.md](./0002-environments-and-demo-isolation.md)

## Context

Phase 2 needs a reproducible relational store for accounts, invitations, role assignments, document versions, assent records, verification cases, and audit events, with migrations and strong constraints. Public-demo mode must not use this store. Approving a **database technology** must not silently approve a **managed hosting vendor** for staging/production data processing.

## Decision

1. Use **PostgreSQL** as the persistence **technology** for local development and ephemeral CI/test databases.
2. Use **Drizzle ORM** and **Drizzle Kit** migrations for TypeScript-first schema and reproducible history.
3. Access the database only through a **`PersistenceAdapter`**. `withTransaction` must pass a **`TransactionContext`** containing a transaction-scoped `executor` into the callback so repositories cannot accidentally use the pool.
4. Keep **identity/account tables** in the primary app schema; keep **future consultation opinion matrices and account↔pseudonym maps** in separate schemas or tables with stricter access (no join required for public reads).
5. Install Drizzle drivers in **Work Package 2.3**. Ephemeral tests may use PGlite (Postgres-compatible) without a managed host.
6. A **managed PostgreSQL host** (Neon, RDS, Cloud SQL, etc.) for staging/production remains **blocked** until a vendor addendum records DPA, region, retention, export, and breach terms. Work Package 2.3 does **not** authorize production data processing by an arbitrary host.

## Consequences

- SQL migrations are reviewable and testable locally.
- Staging/production deploys wait on an explicit host decision.
- Rollback strategy: forward-fix migrations preferred; restore from backup for destructive failure once a host is approved (see [secrets-and-operations.md](../secrets-and-operations.md)).
