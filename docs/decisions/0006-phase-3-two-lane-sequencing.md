# ADR 0006 — Phase 3 two-lane sequencing (project-owner scope)

**Status:** Drafted for project-owner confirmation (this readiness-hardening pass).  
**Date:** 2026-08-10  
**Not counsel clearance.** Owner risk acceptance / sequencing approval must never be recorded as counsel `cleared` in [phase-2-plan.md](../phase-2-plan.md) §7 or `src/lib/counsel/dispositions.ts`.

## Context

Phase 2.12 engineering is largely implemented, but readiness for a foundation tag and real launch remains blocked on counsel dispositions, Docker/PG16 CI confirmation on the tag candidate, and related stop conditions. Agents and docs previously contradicted each other on whether Phase 3 work may begin.

## Decision (two-lane rule)

| Lane | Allowed? | Scope |
| --- | --- | --- |
| **Lane A — Phase 3 synthetic / closed engineering** | Yes, once the project owner confirms this ADR | Synthetic fixtures, adapters, docs, and closed-environment design under existing permits; no real participant data; no new vendors outside the permitted-services register |
| **Lane B — Phase 2 readiness / tag / real activation** | **Blocked** until 2.12 readiness criteria and counsel gates clear | Foundation tag, public launch posture, real (non-synthetic) `active` accounts, production participant data |

## Consequences

- Agents may start Phase 3 *synthetic/closed* packages after owner confirmation of this ADR, without inventing counsel answers.
- Agents must **not** tag `phase-2-foundation`, clear counsel rows, or activate real accounts under this ADR alone.
- Handoff and plan wording must keep Lane B blockers explicit.

## Confirmation

Project-owner confirmation is recorded by approving/merging the readiness-hardening change that introduces this ADR (or a follow-up note with name/date). Until then, treat the rule as the drafted reconciliation target already reflected in [phase-2-handoff.md](../phase-2-handoff.md).
