# ADR 0006 — Phase 3 two-lane sequencing (project-owner scope)

**Status:** Confirmed by project owner (2026-08-10), alongside interim council dispositions in [ADR 0007](./0007-alpha-test-interim-council-dispositions.md).  
**Date:** 2026-08-10  
**Not counsel clearance by itself.** Sequencing approval is separate from §7 disposition rows; those rows are updated only via a recorded counsel / interim-council public summary (ADR 0007).

## Context

Phase 2.12 engineering is largely implemented, but readiness for a foundation tag and real launch remains blocked on counsel dispositions, Docker/PG16 CI confirmation on the tag candidate, and related stop conditions. Agents and docs previously contradicted each other on whether Phase 3 work may begin.

## Decision (two-lane rule)

| Lane | Allowed? | Scope |
| --- | --- | --- |
| **Lane A — Phase 3 synthetic / closed engineering** | Yes, once the project owner confirms this ADR | Synthetic fixtures, adapters, docs, and closed-environment design under existing permits; no real participant data; no new vendors outside the permitted-services register |
| **Lane B — Phase 2 readiness / tag / alpha-test activation** | **Authorized** for alpha-test scopes after ADR 0007 + gated E2E evidence | Foundation tag and invite-only alpha-test `active` accounts under resettable-data rules; not a public launch |

## Consequences

- Agents may start Phase 3 *synthetic/closed* packages under this ADR.
- Foundation tag and alpha-test real activation follow [ADR 0007](./0007-alpha-test-interim-council-dispositions.md) scopes plus engineering gates — not this ADR alone.
- Handoff must keep resettable-data and post-alpha report obligations explicit.

## Confirmation

Project-owner confirmation recorded 2026-08-10 with the interim council disposition return (ADR 0007) and foundation-tag authorization.
