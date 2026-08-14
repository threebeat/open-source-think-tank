# Phase 4 orchestrator plan — Agenda, fixture consultation, member deliberation

**Status:** Prepared in advance. Start only after the Phase 3 PR exists. Stack on Phase 3 if unmerged.

**Authorized phase:** Phase 4 only. Hosted Pol.is remains disabled (V2-11–13).

## Journeys

1. Signed-in member opens `/agenda`, sees synthetic qualified topics, opens a topic with Overview / Evidence / Discussion / History.
2. Member records agree / disagree / pass on synthetic statements via **in-house** controls (Commonhall tables, not Pol.is). Honest label: not a live Pol.is consultation.
3. Fixture close path can move a seeded topic to community_accepted | disputed | inconclusive using synthetic metrics snapshots and `trustedSystem: true` only from a seed/playback service — never from the member browser claiming to be system.
4. Unauthenticated `/agenda` redirects to sign-in. `/demo` may narrate the agenda without writing positions.
5. No `pol.is` script request in unit, e2e, or network tests.

## Schema (`0026_member_positions.sql`)

- `member_statement_positions`: organization_id, topic_governance_record_id, account_id, statement_public_id, position `agree|disagree|pass`, synthetic, unique (org, record, account, statement). No XID, no provider mapping.
- Optional link from governance record to fixture conversation id (existing public_input tables) without enabling live provider kinds.
- Reset class `reset`. Manifest `v2.4.0`.

## Services / UI

- Agenda list + topic tabs. Evidence list must not sort by consultation popularity.
- Fixture provider remains `none`/`fixture`. Embed component: disclosure, never loads `https://pol.is/embed.js`.
- Flags: `isHostedPolisEnabled()` stays false.

## Tests

- No-network pol.is; origin/CSP fail closed; member position CRUD isolation; evidence order independent; kernel still blocks informal → chamber.
- E2E gated: open synthetic topic, record a position, tabs axe.

## Out of scope

Live embed, production thresholds, Chamber UI, legacy deletion.
