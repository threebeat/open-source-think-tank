# ADR 0013 — Canonical Formal Topic page (Overview / Evidence / Discussions)

**Status:** Accepted for Phase 4.2 (board IA amendment)  
**Date:** 2026-08-13  
**Related:** [phase-4-plan.md](../phase-4-plan.md), [architecture-phase-4.md](../architecture-phase-4.md), [ADR 0011](./0011-idea-commons-formal-pipeline-separation.md)

## Context

Board direction: each formal topic must have one canonical detail page that opens on a concise Overview, with prominent section controls for Overview, Evidence, and Discussions & Proposals. Duplicate “Topics” vs “Formal Topics” primary navigation created ambiguity.

## Decision

1. Canonical public route: `/formal-topics/[slug]`.
2. Allowlisted query parameter only: `section=overview|evidence|discussions` (omitted → overview; unknown/malformed/overlong → overview).
3. Section controls are ordinary links styled as buttons with `aria-current="page"` on the active control (not incomplete ARIA tabs).
4. Legacy redirects (no loops):
   - `/topics` → `/formal-topics`
   - `/topics/[slug]` → `/formal-topics/[slug]` (preserve allowlisted `section`)
   - Evidence-oriented deep links may use `?section=evidence`
   - `?view=public-input-report` → Overview (Public Input block on Overview)
   - `/topics/[slug]/consult` preserved as Public Input participation/stage route
5. Primary nav: **Formal Topics** is the public entry for gate-passed topics; remove duplicate top-level Topics. Workspace authoring routes unchanged.
6. Dual-mode loaders:
   - public-demo: synthetic fixture projections only
   - gated: published allowlisted PostgreSQL projection only; never synthetic fallback by slug
7. Overview is concise (status, independent metrics, evidence summary, next-step panel). Full evidence inventory lives only in Evidence. Discussions & Proposals use typed allowlisted relationships; gated mode shows honest empty/not-yet-operational when schema lacks public relationships.

## Consequences

- Bookmarks and guided demo remain shareable via server-rendered section URLs.
- Free text, provider IDs, opinion data, and raw URLs must never enter query parameters.
- Idea Commons stays informal; reciprocal links appear only when a public relationship exists.
