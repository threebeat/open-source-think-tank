# ADR 0012 — Public Input provider-neutral adapter boundary

**Status:** Accepted for Phase 4.2 engineering contract (amended Phase 4.3)  
**Date:** 2026-08-13  
**Related:** [phase-4-plan.md](../phase-4-plan.md), [public-input-provider-assessment.md](../public-input-provider-assessment.md), [ADR 0010](./0010-computational-democracy-pipeline.md), [ADR 0013](./0013-canonical-formal-topic-page.md), [ADR 0014](./0014-institutional-conversation-lifecycle.md), [ADR 0016](./0016-provider-embed-activation-exact-origin.md)

## Context

Phase 4.1 shipped synthetic Public Input aggregate reports only. Phase 4.2 must establish a provider-neutral boundary so a future hosted or self-hosted Pol.is (or no-provider) path cannot leak credentials, identity linkage, or raw provider URLs into public projections — without authorizing a live install.

## Decision

1. Institutional topic IDs remain the source of truth. Provider conversation IDs live only in a separate opaque mapping type (`OpaqueConversationRef` / protected `providerConversationRef`), never as columns on topics, claims, or evidence.
2. Implementations live under `src/lib/public-input/provider/`:
   - `FixturePublicInputAdapter` — synthetic public-demo behavior; `networkCallsAllowed: false`
   - `NoProviderPublicInputAdapter` — fail-closed with stable `PUBLIC_INPUT_PROVIDER_UNAVAILABLE`
   - No live `PolisAdapter` / SDK / network client in 4.2–4.3
3. Capability manifests may name Pol.is surfaces; they are **not** a call contract. Classifications follow the dated assessment.
4. Any embed descriptor must require HTTPS, an exact host allowlist, no credentials in URLs, no arbitrary query forwarding, and a documented restrictive iframe policy. Phase **4.3** lands exact-origin validation and fail-closed `buildEmbedUrl` with **no iframe UI** ([ADR 0016](./0016-provider-embed-activation-exact-origin.md)).
5. This ADR and the assessment **do not** authorize a live embed, credentials, xid, or permitted-services register install.

### Phase 4.3 amendment

Package **4.3** landed the gated institutional conversation lifecycle ([ADR 0014](./0014-institutional-conversation-lifecycle.md)) and a disabled embed activation shell. Operational provider kinds remain **`none` / `fixture` only**. **Live Pol.is remains FAIL-CLOSED** — every activation gate ships `unresolved`. Engineering readiness is not live activation.

## Consequences

- Public-demo and gated Overview/Evidence continue when the provider is unavailable.
- Adding a live network client requires a new package authorization, register addendum, resolved activation gates, and owner language equivalent to `ENABLE LIVE POLIS FOR GATED ALPHA`.
- Unknown vendor answers remain explicit LIVE blockers (OQ26–OQ29, OQ33).
