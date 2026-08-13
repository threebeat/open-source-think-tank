# ADR 0016 — Provider embed activation readiness with exact-origin policy

**Status:** Accepted for Phase 4.3 engineering contract  
**Date:** 2026-08-13  
**Related:** [phase-4-plan.md](../phase-4-plan.md), [public-input-provider-assessment.md](../public-input-provider-assessment.md), [ADR 0012](./0012-public-input-provider-boundary.md), [ADR 0014](./0014-institutional-conversation-lifecycle.md), OQ33, `src/lib/public-input/lifecycle/activation.ts`, `embed-url.ts`

## Context

Official Pol.is embeds require third-party JavaScript and an iframe. Phase 4.3 must prepare a fail-closed construction path without enabling live embeds, credentials, or UI wiring.

## Decision

1. Embed URL construction lives in the domain layer only (`buildEmbedUrl`). No iframe component, no script tag, and no network call in 4.3.
2. Origins are validated with an **exact** allowlist (`https://pol.is` for the production path). Hostname suffix / `endsWith` matching is forbidden.
3. Origins must be HTTPS (localhost only under explicit `OSTT_ALLOW_LOCALHOST_EMBED_ORIGIN=1` and non-production `NODE_ENV`).
4. Credential-bearing, token-bearing, or query-string origins are rejected.
5. Conversation refs must match a narrow opaque token shape; URL-like values and forbidden substrings (including `xid`, `token`, `session`) are rejected.
6. Live provider kinds (`polis_hosted`, `polis_self_hosted`) never construct URLs (`LIVE_PROVIDER_KIND_FORBIDDEN`).
7. After input validation, construction still fails with `EMBED_ACTIVATION_GATES_UNRESOLVED` unless every entry in `LIVE_PUBLIC_INPUT_ACTIVATION_GATES` is `resolved`. Phase 4.3 ships all 13 gates as `unresolved`; there is no env var, DB row, or admin toggle to flip them.
8. Completing 4.3 engineering is **not** live activation. Owner language equivalent to `ENABLE LIVE POLIS FOR GATED ALPHA` plus register/counsel gates remains required in a future authorized package.

## Consequences

- Callers can distinguish invalid inputs from “activation not authorized.”
- CSP / third-party JS / iframe UI acceptance remains an open LIVE blocker (OQ33).
- A future live package can keep the same exact-origin validator and resolve gates explicitly — not silently.
