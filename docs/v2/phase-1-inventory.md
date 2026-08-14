# Phase 1 inventory — organization-scoped foundation

**Status:** Discovery record for Commonhall v2 Phase 1. Not a migration of live product IA.

Phase 1 adds organization tenancy **alongside** the existing single-institution schema. It does not mass-migrate topics, Public Input, or legacy council seats.

| Area | Current files | Single-institution assumption | Phase 1 treatment |
| --- | --- | --- | --- |
| Accounts/roles | `src/db/schema.ts` `accounts`, `role_assignments`; `src/lib/authz/*` | Global platform roles | Kept. Organization memberships/appointments are separate principals. |
| Legacy councils | `council_appointments`, `COUNCIL_ROLES` | One deliberation + one policy council | Kept as **legacy fixtures**. Adapter returns `{ v2Authority: false, legacySeat: true }`. |
| Topics | `topics` workflow states | No `organization_id`; global slug uniqueness | Kept. `topic_governance_records` may optionally link `legacy_topic_id`. Workflow states are not rewritten into v2 states. |
| Public Input | `public_input_*` | Topic-scoped, not org-scoped | Preserved, including drizzle `0022` report-integrity closure. Hosted Pol.is remains disabled. |
| Audit | `audit_events` continuity hash | No organization column in digest | `computeContinuityDigest` field set unchanged. Org **public** id is hashed inside `privatePayload`. Nullable query columns are not digested. |
| Reset | `alpha-reset-manifest.ts` | Must classify every `pgTable` | Manifest `v2.1.0`; nine new tables classified `reset`. |
| Routes | `/idea-commons`, `/formal-topics`, `/agenda`, `/deliberation`, `/decisions`, `/join` | Old think-tank IA | Honesty copy only. Join remains disabled. |
| Seeds | `src/db/seeds/synthetic.ts` | One synthetic institution | Two synthetic orgs (`org-ostt-synth-alpha`, `org-ostt-synth-beta`). Alpha accounts are not converted to v2 community members. |

## New tables (all `reset`)

`organizations`, `organization_service_areas`, `organization_config_versions`, `organization_memberships`, `organization_membership_events`, `organization_appointments`, `appointment_conflicts_and_recusals`, `topic_governance_records`, `topic_governance_events`.

## Still disabled

Open enrollment, Commons IA, Public Agenda product UI, live Chamber/Council process, hosted Pol.is, elevated organization portal, federation, production numeric thresholds (V2-07–V2-10).
