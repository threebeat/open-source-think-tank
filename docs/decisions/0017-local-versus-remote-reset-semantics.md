# ADR 0017 — Local versus remote reset semantics for Public Input

**Status:** Accepted for Phase 4.3 engineering contract (amended Phase 4.4)  
**Date:** 2026-08-13  
**Related:** [alpha-reset-classification.md](../alpha-reset-classification.md), [alpha-reset-runbook.md](../alpha-reset-runbook.md), [ADR 0014](./0014-institutional-conversation-lifecycle.md), [ADR 0018](./0018-aggregate-only-canonical-import-format.md), OQ29, activation gate `remote_alpha_reset_verified`

## Context

Phase 4.3 adds gated `public_input_conversations` and transition history to the alpha reset surface. Operators must not confuse deleting local institutional rows with deleting data held by a remote consultation provider (especially once live Pol.is exists).

## Decision

1. Classify `public_input_conversations` and `public_input_conversation_transitions` as **reset** in the alpha-reset manifest (local database wipe).
2. The operator reset ceremony performs **local** deletes only. It does not call Pol.is or any remote admin/export API.
3. Success of local reset must **never** be described as remote conversation, vote, cookie, or export deletion.
4. `providerConversationRef` values wiped locally remain protected opaque references while present; they are never logged or placed in public DTOs.
5. Verified remote retention/deletion/export handling remains open (OQ29) and is activation gate `remote_alpha_reset_verified` — unresolved in 4.3.
6. Until that gate clears, assume remote provider data may persist after local wipe if a live mapping ever existed.

### Phase 4.4 amendment

Classify Phase 4.4 report/moderation tables as **reset** as well: `public_input_report_imports`, `public_input_reports`, `public_input_report_groups`, `public_input_report_findings`, `public_input_report_moderation_actions`, and `public_input_provider_moderation_records`. Local wipe of these rows still does **not** delete remote provider conversations, votes, cookies, or vendor-side exports.

## Consequences

- Alpha reset stays honest about what it controls (this PostgreSQL database).
- Live activation cannot proceed on a false belief that local wipe equals vendor wipe.
- Runbook and classification docs carry the same “never claim remote deletion” language.
- Aggregate import engineering does not weaken the local≠remote rule.
