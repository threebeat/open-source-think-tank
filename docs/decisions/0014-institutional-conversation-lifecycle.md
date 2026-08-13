# ADR 0014 — Institutional Public Input conversation lifecycle

**Status:** Accepted for Phase 4.3 engineering contract  
**Date:** 2026-08-13  
**Related:** [phase-4-plan.md](../phase-4-plan.md), [architecture-phase-4.md](../architecture-phase-4.md), [ADR 0012](./0012-public-input-provider-boundary.md), [ADR 0016](./0016-provider-embed-activation-exact-origin.md), [ADR 0017](./0017-local-versus-remote-reset-semantics.md)

## Context

Phase 4.2 established a provider-neutral adapter without a durable gated conversation registry. Phase 4.3 needs institutional lifecycle, audit, and outage semantics for Public Input without authorizing a live Pol.is install.

## Decision

1. Persist conversations in `public_input_conversations` with append-only `public_input_conversation_transitions` (migration `0019`).
2. Institutional workflow states are `draft → ready → open → commenting_closed → voting_closed → closed → archived`, with recovery transitions that require substantive reasons and a distinct audit action.
3. Provider availability (`not_configured|available|degraded|unavailable`) is an **independent** axis from institutional workflow state.
4. Operational `provider_kind` values are **`none` and `fixture` only** (DB CHECK + service). `polis_hosted` / `polis_self_hosted` labels are non-operational forward-compatibility.
5. At most one `current` conversation per topic; historical designation supported for superseded rows.
6. Administrator capabilities: `consultations.create`, `consultations.transition`, `consultations.manage_provider_mapping`, `consultations.set_availability`.
7. Public and staff projections never include `providerConversationRef`; staff may see `hasProviderMapping` only.
8. Domain is gated-only (`assertEnvironmentSafe()`); public-demo cannot create or transition conversations.
9. This ADR does **not** authorize live Pol.is, credentials, network clients, or iframe UI.

## Consequences

- Staff can operate institutional consultation state while embeds remain fail-closed.
- Provider outages update availability without silently inventing institutional closure.
- Live activation still requires the unresolved checklist in `activation.ts` plus a separately authorized package.
