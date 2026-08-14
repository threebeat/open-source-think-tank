# ADR 0020 — Public Input moderation versus provider moderation

**Status:** Accepted for Phase 4.4 engineering contract  
**Date:** 2026-08-13  
**Related:** [phase-4-plan.md](../phase-4-plan.md), [architecture-phase-4.md](../architecture-phase-4.md), [ADR 0014](./0014-institutional-conversation-lifecycle.md), [ADR 0018](./0018-aggregate-only-canonical-import-format.md), [ADR 0019](./0019-immutable-report-versioning-and-publication.md), [capability-matrix.md](../capability-matrix.md)

## Context

Provider platforms (e.g. Pol.is when live) may moderate comments on their side. Institutions also need their own reasoned moderation and finding-publication decisions. Collapsing these into one axis would hide who acted, invite preference-based agenda influence, or imply that provider moderation equals institutional endorsement.

## Decision

1. Treat **provider-side comment moderation** and **institutional Public Input moderation / finding publication eligibility** as **independent axes**.
2. Persist provider-originated moderation signals (when supplied via aggregate import or staff recording) in `public_input_provider_moderation_records` as **observational provenance** — not as agenda priority, evidence quality, or automatic publication blockers beyond explicitly documented safety rules.
3. Persist institutional actions in `public_input_report_moderation_actions` (append-only), each requiring a **substantive public or staff reason**, actor role, timestamp, and subject reference (finding / group label / report version as applicable).
4. Capability: `consultations.moderation.record` (moderator or administrator) records institutional moderation / eligibility decisions. This does **not** grant agenda promotion, consultation-metric edits, or live provider admin API access.
5. Institutional **finding publication eligibility** (whether a cross-group agreement / disagreement finding may appear in the public report projection) is separate from:
   - conversation lifecycle state
   - provider availability
   - provider-side comment moderation status
   - report import validation success
   - report publication state
   - evidence quality (research review)
   - agenda qualification (package 4.5)
6. Moderators **cannot** alter imported consultation metrics, invent group shares, or privately promote pre-deliberation topics. Ordinary moderator contributions remain on the participant interface with no elevated ranking.
7. Until live Pol.is is authorized, provider moderation records may be populated only from **fixture** paths or staff-entered observational notes tied to aggregate imports — never from a live provider admin API.
8. This ADR does **not** authorize live Pol.is, dual-control policy invention, or appeal-process finality.

## Consequences

- Reviewers can see whether a comment/finding was moderated by a provider versus by institutional staff.
- Safety process stays visible without becoming a hidden agenda lever.
- Future live-provider sync (if ever authorized) must map into these separate tables rather than overwriting institutional decisions.
