# ADR 0010 — Computational democracy pipeline

**Status:** Accepted (product/engineering decision)  
**Date:** 2026-08-13  
**Package:** 4.1  
**Related:** [phase-4-plan.md](../phase-4-plan.md), [architecture-phase-4.md](../architecture-phase-4.md), [0011-idea-commons-formal-pipeline-separation.md](./0011-idea-commons-formal-pipeline-separation.md), [0008-phase-3-operational-alpha-contract.md](./0008-phase-3-operational-alpha-contract.md)

This ADR is a **product/engineering decision**. It is **not** legal clearance, statutory membership settlement, Pol.is vendor approval, or board-binding authority.

## Context

Phase 3 delivered an invite-only operational alpha for topics, claims, evidence, review, moderation, publication, search/export, and reset. Board direction for Phase 4 requires recentering around a complete democratic journey rather than treating Pol.is as the whole product. Preference, agreement, evidence quality, and institutional decisions must remain visibly separate. Live consultation providers remain unapproved.

## Decision

1. **Phase 4 product shape** is the computational-democracy journey: Idea Commons → qualified proposal → Public Input → transparent agenda qualification → deliberation → policy recommendation → member actions → review/follow-up.
2. **Pol.is is an input** to Public Input when later approved. It never determines evidence quality, agenda truth/importance, or institutional recommendations.
3. **Agenda qualification** uses independent published signals and a versioned trace. No single composite popularity/truth/importance score. Human deferral/override requires public reason, actor role, timestamp, conflicts, and method version.
4. **Moderator limits (pre-deliberation):** safety/relevance/duplication/formatting/process with recorded reasons only; no private promotion; no agenda priority assignment; ordinary contributions use ordinary participant UI without elevated badges.
5. **Deliberation and policy bodies** have distinct authority once formal deliberation begins; governing-board adoption remains counsel-gated / unresolved.
6. **Public Input privacy:** public surfaces receive allowlisted aggregate projections only; raw provider exports are protected; small-cell suppression is required (demo provisional threshold 5; production threshold privacy-gated); `xid`/identity-linking forbidden until approved.
7. **4.1 ships synthetic fixtures and demo UX only** — no live Pol.is install, no provider network calls from public-demo, no new forbidden vendors.
8. **Member action opportunities** may recommend civic actions from explicit geography/interests and published relationships to recommendations — never from individual votes, inferred ideology, or hidden profiles.
9. **Later packages (4.2–4.8)** implement vendor verification, embed lifecycle, moderation/ingest, qualification services, drafting bridges, actions hardening, and handoff — each stopped for owner approval.

## Consequences

- Agents treat [phase-4-plan.md](../phase-4-plan.md) as the active Phase 4 work-package source.
- Public-demo guided journey must prioritize the complete path over the snapshot explorer.
- Phase 5 agenda-laboratory work cannot erase these constraints.
- Permitted-services register must gain an explicit Pol.is addendum before 4.2+ install.

## Confirmation

Recorded as the Work Package 4.1 computational-democracy contract (2026-08-13).
