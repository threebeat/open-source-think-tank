# ADR 0003 — PostgreSQL with Drizzle ORM

- **Status:** Accepted for Phase 2 gated environments (Work Package 2.2)
- **Date:** 2026-08-09
- **Context:** [phase-2-plan.md](../phase-2-plan.md), [0002-environments-and-demo-isolation.md](./0002-environments-and-demo-isolation.md)

## Context

Phase 2 needs a reproducible relational store for accounts, invitations, role assignments, document versions, assent records, verification cases, and audit events, with migrations and strong constraints. Public-demo mode must not use this store.

## Decision

1. Use **PostgreSQL** as the system of record for gated environments.
2. Use **Drizzle ORM** and **Drizzle Kit** migrations for TypeScript-first schema and reproducible history.
3. Access the database only through a **`PersistenceAdapter`** (and narrowly scoped repositories). Application routes must not import a vendor client directly outside the adapter boundary.
4. Keep **identity/account tables** in the primary app schema; keep **future consultation opinion matrices and account↔pseudonym maps** in separated schemas or tables with stricter access (no join required for public reads).
5. Install Drizzle/PostgreSQL drivers in **Work Package 2.3**, not in public-demo dependency paths if avoidable (gated `package` scripts / optional peer usage is acceptable; demo CI must run without `DATABASE_URL`).

## Consequences

- SQL migrations are reviewable and testable.
- Teams get type-safe queries without abandoning SQL.
- Operational burden of running Postgres locally and in CI.
- Rollback strategy: forward-fix migrations preferred; restore from backup for destructive failure (see [secrets-and-operations.md](../secrets-and-operations.md)).
