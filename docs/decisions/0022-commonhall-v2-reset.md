# ADR 0022 — Commonhall v2 computational-democracy reset

**Status:** Proposed and authorized as the v2 implementation direction. Supersedes Phase 1–4 product scope and the unstarted Phase 4.5B+ sequence. Does not erase historical records or waive unresolved legal/vendor/privacy gates.

## Context

The project’s aim has changed from demonstrating an open-source think tank to building a computational-democracy digital town hall. The existing system contains valuable security, privacy, evidence, audit, account, and aggregate-consultation foundations, but its invite-only and single-institution authority model cannot express open community growth, independent organizations, a formal/informal Commons, the Public Agenda lifecycle, a separate Chamber, or organization Council control.

Continuing to add Phase 4 subpackages would preserve vocabulary and boundaries that the Council no longer intends. A clean application restart would discard hard-won privacy and integrity work.

## Decision

Adopt **Commonhall v2** as the working product name and evolve the repository through the six phases in `docs/v2/implementation-plan.md`.

Canonical product behavior is now defined by:

- `docs/product-charter.md`;
- `docs/v2/governance-state-machine.json`;
- the remaining documents indexed under “Active Commonhall v2 contract” in `docs/README.md`; and
- phase-specific ADRs accepted after this one.

Historical Phase 1–4 documents and ADRs remain evidence of existing behavior. Their security/privacy constraints carry forward until safely superseded; their institutional roles, route map, package order, and product language do not authorize v2 work.

The old Phase 4.5B+ sequence is canceled. The Phase 4.5A/4.5A.1 report-integrity work remains a required technical foundation and must be preserved or completed before live consultation.

## Consequences

- Open community enrollment precedes elevated membership.
- Organization tenancy and authority precede multi-organization rollout.
- Formal/informal Commons, Public Agenda, Chamber, Council Agenda, and Records become first-class product areas.
- Organization Councils, not the service nonprofit, issue organization recommendations.
- Pol.is remains an input through a protected aggregate boundary; raw/individual data is not public.
- Every implementation phase uses a dedicated branch, subagent, PR, test evidence, and human approval.
- Existing tests are classified and migrated rather than deleted wholesale.
- The working name requires later legal/trademark/domain review.

## Rejected alternatives

1. **Continue Phase 4.5B unchanged** — rejected because it lacks the new membership, organization, Chamber, and authority model.
2. **Rewrite the application from scratch** — rejected because it discards proven security, privacy, audit, evidence, reset, and report-integrity work.
3. **Enable the supplied embed immediately** — rejected as a production default because a public site identifier does not resolve vendor, CSP, consent, deletion, retention, incident, or small-cell decisions.
4. **Use one generic council role** — rejected because Chamber and Council have distinct appointment, deliberation, verdict, and transparency duties.

