# ADR 0001 — Static Demonstration First

- **Status:** Accepted for Phase 1
- **Date:** 2026-08-08
- **Context:** [product-charter.md](../product-charter.md)

## Context

Phase 1 must produce a runnable, mobile-responsive browser demonstration of the institutional journey (join preview → topic/evidence → consultation → agenda → deliberation → decision → transparency) using synthetic data only. It must be reviewable by lawyers, designers, prospective board members, developers, and early funders without requiring production infrastructure.

Constraints from the build plan:

- Single application repository (no microservices or monorepo for Phase 1)
- Next.js App Router, TypeScript, Tailwind CSS, small set of shadcn/ui components
- No database, auth provider, Pol.is server, identity SDK, analytics, payments, or AI APIs
- No secrets or API keys
- Domain logic must stay understandable and independent from React where practical

## Decision

For Phase 1:

1. Use **static TypeScript fixtures** as the sole source of people, topics, evidence, consultation results, agenda items, deliberations, and decisions.
2. Keep interactive demo state **client-side only** (in-memory and/or session storage), never as a backend of record.
3. Keep **domain types and selectors independent from React components**.
4. Place future external services behind **interfaces or adapters** without implementing those services in Phase 1.
5. Mark fixtures as synthetic and avoid any form that transmits real membership, consent, verification, or donation data.

## Consequences

**Enables**

- Clone-and-run demonstration with no environment variables
- Coherent end-to-end synthetic scenario across routes
- Clear boundary for later phases (real accounts, Pol.is embeds, agenda engine, councils)

**Accepts**

- No multi-user persistence or real verification in Phase 1
- Consultation “voting” does not leave the browser
- Agenda and opinion-mapping outputs are fixed or locally simulated, not production algorithms

**Deferred (not part of this ADR’s Phase 1 scope)**

- Real authentication, consent versioning, and audit backends (Phase 2+)
- Live evidence workflow and moderation staffing (Phase 3+)
- Hosted Pol.is integration (Phase 4+)
- Reproducible production agenda engine and shadow mode (Phase 5+)
- Binding deliberation/decision systems defined by governing documents (Phase 6+)
- Native mobile application (Phase 8)

## Related unresolved questions

- Membership and board authority remain legal/product open items; see [legal-questions.md](../legal-questions.md) and [open-questions.md](../open-questions.md).
- This ADR does not decide licenses, entity formation, or data-retention law.
