# Phase 5 orchestrator plan — Chamber, Council, Records, synthetic appointments

**Status:** Prepared in advance. Start only after the Phase 4 PR exists.

**Authorized phase:** Phase 5 only.

## Journeys

1. Signed-in member walks a **seeded** topic from closed consultation → Chamber queue/deliberation → accepted or disputed → Council intake (reason rules) → recommendations or decline.
2. Member sees roster, schedule, roll call with explicit yes/no/abstain/recused/absent for every seat. Timezones visible.
3. Community member cannot appoint themselves, cannot vote a Chamber/Council seat they do not hold, cannot skip reason rules via API.
4. Synthetic appointments exist for the primary synthetic org; dual-control/no self-grant remains for any grant API.

## Schema

Prefer existing `organization_appointments`, `topic_governance_records/events`. Add if needed:

- `chamber_sessions`, `chamber_roll_calls`, `council_sessions`, `council_roll_calls`, `chamber_verdict_versions`, `council_recommendation_versions` — all organization-scoped, composite FKs, synthetic flag.
- Complete roll-call publication transactional with roster snapshot.
- Retention deadline nullable (V2-08). Manifest `v2.5.0`.

## Kernel

- Enable Chamber/Council transitions for appointed clerks/members in gated synthetic playback.
- `trustedSystem` only inside seed/playback.
- Council decline of accepted verdict and accept of disputed verdict require reasons (machine tests already exist; wire to service/API).

## UI

- `/chamber`, `/council`, `/records` member routes.
- Accessible tables, captions, row headers, reduced motion.

## Tests

- Reason-rule bypass denied; residency; cross-tenant; member without seat cannot vote; e2e walkthrough of seeded topic; axe on roll-call tables.

## Out of scope

Hosted Pol.is, multi-instance federation, production appointment policy values, full org-admin portal chrome beyond what’s needed to seed appointments.
