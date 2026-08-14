# Phase 1 orchestrator plan — organization-scoped foundation and institutional kernel

**Status:** Binding implementation plan for the Phase 1 subagent. Not a product launch, legal, vendor, or open-enrollment authorization.

**Authorized phase:** Phase 1 only. Do not start Phase 2–6.

**Base:** `origin/main` at `82eaa1183176a4bfd468c29de335bc53554c7d8e` (PR #23 merged). Branch: `v2/phase-1-organization-foundation`.

**Expected open-PR overlap:** PR #22 (`4.5A.1: Report integrity closure`) is still open. Overlap on `src/db/schema.ts`, `drizzle/meta/_journal.json`, Public Input report files, audit registry, and reset manifest is **expected**. Incorporate PR #22 **runtime/schema/tests** as migration `0022` first. Do **not** continue the old Phase 4.5B IA or rewrite `docs/phase-4-plan.md` / `docs/architecture-phase-4.md` as active product authority.

## Canonical reading order (already required)

1. `AGENTS.md`
2. `docs/README.md`
3. `docs/product-charter.md` → `docs/v2/product-charter.md`
4. `docs/v2/governance-state-machine.json`
5. `docs/v2/governance-lifecycle.md`
6. `docs/v2/community-standards.md`
7. `docs/v2/architecture.md`
8. `docs/v2/testing-strategy.md`
9. `docs/v2/ci-pr-workflow.md`
10. `docs/v2/open-decisions.md`
11. `docs/v2/implementation-plan.md` Phase 1
12. Current source, migrations, tests, PR #22, git history for affected paths
13. Next.js 16 App Router docs in `node_modules/next/dist/docs/` (this repo is Next.js 16.3; do not invent Pages Router or deprecated APIs)

## Restated user journeys (Phase 1)

Phase 1 does **not** enable live membership, Commons IA, Public Agenda product UI, Chamber/Council process, or hosted Pol.is. Journeys that must hold:

1. **Public visitor** — still sees the synthetic historical demonstration. Home/About honestly state that Commonhall v2 organization kernel is under construction and that open enrollment, Chamber, organization Council, and hosted Pol.is are **not** operational. Existing home heading `Open-Source Think Tank` remains so current E2E does not break; add a disclosure rather than replacing the demo journey.
2. **Uninvited person** — `/join` remains disabled (invite-only). Do not implement open enrollment.
3. **Gated invited participant** — existing invite/onboarding/assent/privacy flows still work. Community/platform participant still does **not** receive Chamber, Council, moderator, organization-admin, or service-admin authority.
4. **Service administrator** — can still operate platform capabilities (invites, topics, consultations as today). Cannot cast an organization vote, grant themselves an organization appointment, or call organization mutation services without an explicit organization appointment in that organization.
5. **Synthetic isolation operator (tests only)** — two synthetic organizations exist. Guessing the other organization’s IDs cannot read or write its rows at repository, service, or database layers.
6. **Governance kernel (tests/services only)** — a topic governance record can move only through `docs/v2/governance-state-machine.json`. Informal/formal-review states cannot jump to Chamber/Council. Feature flag/kill switch off fails closed.

## Acceptance criteria (Phase 1 exit)

From `docs/v2/implementation-plan.md` and `docs/v2/testing-strategy.md`:

- No organization repository/service has an unscoped default (`listAll` is forbidden).
- Cross-tenant reads/writes fail at service **and** database layers.
- Service administrator cannot cast an organization action.
- State contract tests remain green; domain transition engine matches the JSON contract exactly.
- Existing security/privacy/report-integrity suites pass, including PR #22 closure proofs.
- Public UI remains honest about what is not yet v2 operational.
- Community membership (when later enabled) is not granted here; enrollment stays invite-only.
- Hosted Pol.is stays disabled. Site ID/embed snippet is not clearance.
- Old `council_appointments` / `deliberation_council` / `policy_council` are **not** relabeled as v2 Chamber/Council authority.
- Alpha accounts are **not** auto-converted to organization community members (V2-19).
- No production threshold, Chamber size, retention window, or matching-input policy is invented.

## Inventory (current single-institution assumptions)

Treat this as the Phase 1 discovery record. Do not mass-migrate these in Phase 1; add v2 schema **alongside** and adapt.

| Area | Current files | Single-institution assumption | Phase 1 treatment |
| --- | --- | --- | --- |
| Accounts/roles | `src/db/schema.ts` `accounts`, `role_assignments`; `src/lib/authz/*` | Global platform roles | Keep. Add org membership/appointments as separate principals. |
| Legacy councils | `council_appointments`, `COUNCIL_ROLES`, `institutional.council_*` | One deliberation + one policy council | Keep as **legacy fixtures**. Adapter must not map them to v2 Chamber/Council authority. |
| Topics | `topics` + workflow `draft/open_for_submissions/under_review/paused/archived` | No `organization_id`; global slug uniqueness | Keep. New `topic_governance_records` may optionally link `legacy_topic_id`. Do not rewrite `topics.workflow_state` into v2 states. |
| Public Input | `public_input_*`; one current conversation per topic | Topic-scoped, not org-scoped | Preserve uniqueness and PR #22 integrity. Do not enable live provider. |
| Audit | `audit_events` continuity hash | No organization column in digest | Do **not** change `computeContinuityDigest` fields. Put org context in `privatePayload` (hashed) plus optional nullable query columns that are **not** added to the digest. |
| Reset | `src/lib/operator/alpha-reset-manifest.ts` v`4.4.1`, 43 tables | Must classify every `pgTable` | Bump manifest after new tables. |
| Routes | `/idea-commons`, `/formal-topics`, `/agenda`, `/deliberation`, `/decisions`, `/join` | Old think-tank IA | Do not replace. Honesty copy only. |
| Join tests | `e2e/join.spec.ts` expects disabled enrollment | Invite-only | Preserve. |
| Seeds | `src/db/seeds/synthetic.ts`, `src/fixtures/catalog.ts` | One synthetic institution | Add two synthetic orgs for isolation; do not convert catalog people into v2 members as a product claim. |

## Exact files

### New files

- `docs/v2/phase-1-inventory.md` — short inventory table (can summarize this plan; keep factual).
- `drizzle/0022_public_input_report_integrity_closure.sql` — from PR #22 (runtime only).
- `drizzle/0023_organization_kernel.sql` — organizations + governance kernel.
- `src/lib/v2/flags.ts` + `src/lib/v2/flags.test.ts`
- `src/lib/organizations/ids.ts` — opaque public IDs (no sequential/guessable org numbers in public DTOs).
- `src/lib/organizations/constitutional-floor.ts` + `.test.ts`
- `src/lib/organizations/types.ts`
- `src/lib/organizations/repository.ts` — **requires** `organizationId` on every read/write.
- `src/lib/organizations/membership-repository.ts`
- `src/lib/organizations/appointment-repository.ts`
- `src/lib/organizations/config-repository.ts`
- `src/lib/organizations/service.ts` + `service.test.ts`
- `src/lib/organizations/appointments-service.ts` + tests (no self-grant; service admin denied).
- `src/lib/organizations/isolation.test.ts` (PGlite) and `src/lib/organizations/isolation.pg.test.ts` (Postgres).
- `src/lib/governance/contract.ts` — load/parse JSON; freeze allowed states/actions.
- `src/lib/governance/machine.ts` + `machine.test.ts` — pure transition engine.
- `src/lib/governance/repository.ts` — org-scoped governance records/events.
- `src/lib/governance/service.ts` + `service.test.ts`
- `src/lib/governance/legacy-adapter.ts` + `legacy-adapter.test.ts`
- `src/lib/authz/organization-context.ts` + tests
- `src/db/seeds/v2-organizations.ts` — two synthetic orgs, adversarial IDs.
- `src/lib/organizations/public-projection.ts` + tests (allowlist only).

### Current files to edit (bounded)

- `src/db/schema.ts` — PR #22 columns **and** new org/governance tables.
- `drizzle/meta/_journal.json`
- `src/lib/authz/types.ts`, `load-principal.ts`, `authorize.ts` — extend principal; add org-scoped capabilities; **do not** grant them from platform `administrator` or community participant.
- `src/lib/authz/authorize.test.ts`, `authorize-capability.test.ts`, new `organization-authority.test.ts`
- `src/lib/audit/registry.ts` — register org/governance actions; public projectors must not leak account IDs, XIDs, provider refs, exact location, or ideology.
- `src/lib/operator/alpha-reset-manifest.ts`, `src/lib/operator/alpha-reset.test.ts`
- `docs/alpha-reset-classification.md` — classify new tables; bump manifest version to `v2.1.0`.
- `src/db/seeds/synthetic.ts` — call v2 org seed **after** foundation seed; keep existing accounts.
- `package.json` — `test:pg:reports` (from PR #22) and `test:pg:organizations`.
- `.github/workflows/ci.yml` — add `npm run test:pg:organizations` in postgres job (keep `test:pg:reports --if-present` or the new explicit script).
- `src/app/page.tsx`, `src/app/about/page.tsx` — honesty disclosures; do not remove existing E2E headings.
- `e2e/home.spec.ts`, `e2e/about.spec.ts` — assert new honesty copy **in addition to** existing assertions.
- `docs/v2/open-decisions.md` — record Phase 1 fail-closed postures; do not settle numeric values.
- `docs/capability-matrix.md` — add v2 org capabilities as **not implied** by platform admin; mark live Chamber/Council/enrollment disabled.
- PR #22 report files listed in `git diff origin/main...origin/cursor/4.5a1-report-integrity-closure-60e1`.

### Do not edit / do not build

- Open enrollment, `/commons` IA, `/agenda` topic tabs, Pol.is embed, Chamber/Council public process, org admin portal, federation protocol, production email/analytics vendors.
- Do not delete the 123 existing tests or weaken join/invite-disabled assertions.
- Do not force-push; do not push to `main`.

## Schema (migration 0023)

Hand-write SQL (this repo’s later migrations are SQL + journal, not full snapshots). Follow `0021` breakpoint style. Include rollback comments at the top.

### Enums

- `organization_service_status`: `proposed`, `seeded_synthetic`, `disabled` (no production-active value).
- `organization_config_status`: `draft`, `published`, `superseded`.
- `organization_membership_status`: `assigned`, `active`, `suspended`, `closed`, `appeal_pending`.
- `organization_membership_event_kind`: `assignment`, `activation`, `transfer`, `suspension`, `closure`, `correction`, `appeal_opened`, `appeal_resolved`.
- `organization_appointment_kind`: `chamber_member`, `chamber_clerk`, `council_member`, `council_clerk`, `moderator`, `organization_admin`.
- `appointment_conflict_kind`: `conflict`, `recusal`.
- `actor_principal_kind`: `service_operator`, `organization_officer`, `community_member`, `system`.
- `audit_projection_class`: `public`, `protected`.
- `topic_governance_state`: **exactly** the 16 state IDs from the JSON contract.
- `topic_governance_action`: **exactly** the transition `action` strings from the JSON contract.

### Tables (every org-owned table has `organization_id`)

1. `organizations` — `id`, `public_id` unique opaque, `slug` unique, `display_name`, `service_status`, `synthetic`, timestamps. Checks: nonblank slug/name. No incorporation/tax columns.
2. `organization_service_areas` — `organization_id`, `region_code` (coarse, e.g. `US-TN`; **not** lat/long, street, or exact private location), unique `(organization_id, region_code)`.
3. `organization_config_versions` — `organization_id`, `version` int > 0, unique `(organization_id, version)`, `constitutional_floor_version`, `config` jsonb, `status`, `published_at`, `published_by_account_id`, `synthetic`. Live outcome keys may be absent; presence of `hostedPolisEnabled: true` must be rejected in the service (DB check: `config->>'hostedPolisEnabled' IS DISTINCT FROM 'true'`).
4. `organization_memberships` — `organization_id`, `account_id`, `status`, `is_primary`, `assigned_at`, `synthetic`. Partial unique active `(organization_id, account_id)` where not closed. Partial unique one primary per account where `is_primary` and status in (`assigned`,`active`).
5. `organization_membership_events` — append-only; immutability trigger; includes `organization_id`, `membership_id`, `account_id`, `event_kind`, `actor_principal_kind`, `actor_account_id`, `reason`, `rule_version`, `at`, `synthetic`.
6. `organization_appointments` — independent rows per kind; `term_starts_at` not null; `term_ends_at` nullable; `issued_by_account_id` **must be distinct from** `account_id` (CHECK); `issued_by_principal_kind`; partial unique active `(organization_id, account_id, appointment_kind)` where `revoked_at IS NULL`.
7. `appointment_conflicts_and_recusals` — `organization_id`, `appointment_id`, `account_id`, `kind`, optional `topic_governance_record_id` (not a legacy topic id as authority), `reason`, `at`. Composite/trigger: appointment’s `organization_id` must match.
8. `topic_governance_records` — `organization_id`, `public_id` opaque unique per org, `state`, `config_version_id`, `retention_deadline_at` (nullable; captured on entry to disputed/inconclusive/council_declined — **do not hard-code a production window**; null means expiration worker is disabled, which is correct while V2-08 is open), optional `legacy_topic_id` FK to `topics` (adapter only), optional `predecessor_record_id` same-org FK, `synthetic`. Unique `(organization_id, public_id)`.
9. `topic_governance_events` — append-only immutability trigger; `from_state`, `to_state`, `action`, `actor_principal_kind`, `actor_account_id`, `reason`, `criteria_trace` jsonb, `metrics_snapshot` jsonb, `config_version_id`, `rule_version`, `at`. Service enforces JSON reason/criteria/metrics flags; tests cover every `reasonRequired` / `criteriaTraceRequired` / `metricsSnapshotRequired` / `verdictRequired` transition.

### Cross-organization database protections

- Foreign keys between org-owned rows must include `organization_id` (composite FK) **or** a trigger that rejects mismatched `organization_id`. Prefer composite FKs where Drizzle/Postgres allows (`FOREIGN KEY (organization_id, parent_id) REFERENCES parent (organization_id, id)`).
- No default `organization_id`. Inserts without it fail.
- Direct SQL tests: inserting a membership/appointment/governance event with org A’s parent id and org B’s `organization_id` must fail.

### Audit columns (optional, not in continuity digest)

Add nullable `organization_id`, `actor_principal_kind`, `capability`, `projection_class` to `audit_events` for queryability. **Do not** add them to `computeContinuityDigest`. New org actions still hash org **public** id inside `privatePayload` via the registry schema.

## Authority matrix and abuse cases

| Actor | Can | Must fail |
| --- | --- | --- |
| Anonymous | Public demo pages | Any org mutation; any membership write |
| Community/platform `participant` without org appointment | Existing participant capabilities | `organization.appointment.grant`, Chamber/Council kinds, moderation org appointment, org config publish, governance `qualify` |
| Platform `administrator` (service) | Existing platform admin capabilities | Organization mutations, org votes, self-appointment, treating `roles.grant_council` as v2 Chamber/Council |
| Org `organization_admin` of org A | Appoint others in org A (not self); publish org A config within constitutional floor | Org B reads/writes; self-grant; disable constitutional keys; enable hosted Pol.is |
| Org `moderator` of org A | Governance transitions whose JSON `actor` is `moderator` for org A records | Qualify own proposal (`actor_account_id` ≠ author); ideology/agreement fields (must not exist); skip criteria trace |
| Chamber/Council clerk/member appointments | Persist as rows in Phase 1 | Live deliberation UI; publishing verdicts in product; inferred from the other seat |
| Service operator reset | Wipe classified alpha tables | Claim remote Pol.is deletion |

Capabilities to add (deny by default; require matching org appointment; **never** mapped from platform admin):

- `organization.membership.read`
- `organization.appointment.grant`
- `organization.appointment.revoke`
- `organization.config.publish`
- `organization.governance.transition`

`authorizeOrganization(principal, organizationId, capability)` is the only path. Hidden UI, URL, or client state is not authorization.

Keep legacy `roles.grant_council` working for old seats, with tests that a granted `deliberation_council` seat does **not** create `organization_appointments` and does **not** satisfy `organization.governance.transition`.

## Governance domain

`machine.ts` must import the JSON contract (copy into `src/lib/governance/governance-state-machine.json` **or** read `docs/v2/governance-state-machine.json` in tests and keep a typed in-code mirror generated/checked by contract tests). Prefer: load JSON in tests from docs path; keep a TypeScript const of states/actions that a contract test asserts is a deep subset/equal to the JSON file so docs remain executable law.

Rules:

- Unknown action/from/to → fail closed.
- `reasonRequired` / `criteriaTraceRequired` / `metricsSnapshotRequired` / `verdictRequired` / `appealable` honored.
- Terminal states have no outgoing transitions.
- No informal/formal_review → Chamber/Council shortcut.
- Only `community_accepted` → `chamber_queued`.
- Successor/disqualified topics: new `topic_governance_records.id` and new provider entity **when** a provider is attached; Phase 1 must refuse reusing `legacy_topic_id` as the successor identity and refuse copying a provider conversation id onto a new record.
- Feature flag `v2GovernanceKernel` false → service refuses writes.
- Kill switch `COMMONHALL_V2_KERNEL=off` → same.

Legacy adapter (read-only characterization):

- Old topic `draft` / unpublished → **not** a v2 public agenda topic.
- Old `council_appointments` → `{ v2Authority: false, legacySeat: true }`.
- Never insert governance records automatically from production-looking alpha data. Synthetic seed may create **separate** v2 records labeled synthetic, not by relabeling old seats.

## Constitutional floor (no invented production numbers)

`CONSTITUTIONAL_FLOOR_VERSION = "commonhall-constitutional-floor@1.0.0"`.

Required config keys (booleans that must be `true`, except hosted Pol.is which must be `false`):

- `communityStandardsRequired`
- `viewpointNeutralModeration`
- `publicRollCallRequired`
- `appealsRequired`
- `recusalRequired`
- `privacyFloor.rawConsultationPublic === false`
- `privacyFloor.individualRecordsPublic === false`
- `noSelfElevation`
- `tenantIsolation`
- `hostedPolisEnabled === false`

Optional keys (`consultationThresholds`, `retention`, `chamber`, `council`) may exist **only** if `synthetic === true` on the config version **and** are ignored by any live calculator (there is no live calculator in Phase 1). Publishing a non-synthetic config that includes numeric production defaults must fail with an open-decision reference (V2-07/08/09/10).

## Feature flags / kill switches

`src/lib/v2/flags.ts` reads env with fail-closed defaults:

| Flag | Default | Phase 1 |
| --- | --- | --- |
| `COMMONHALL_V2_KERNEL` | `on` in gated tests; readable | Kernel writes allowed only when `on` **and** `APP_MODE=gated` |
| `COMMONHALL_V2_OPEN_ENROLLMENT` | `off` | Must stay off |
| `COMMONHALL_V2_HOSTED_POLIS` | `off` | Must stay off |
| `COMMONHALL_V2_CHAMBER_LIVE` | `off` | Must stay off |
| `COMMONHALL_V2_COUNCIL_LIVE` | `off` | Must stay off |
| `COMMONHALL_V2_ELEVATED_PORTAL` | `off` | Must stay off |

Public-demo mode never constructs org mutation clients (same pattern as `assertEnvironmentSafe`).

## Privacy / security / moderation / legal / a11y / operational risks

- **Privacy:** public org DTO allowlist: `publicId`, `slug`, `displayName`, `serviceStatus`, coarse `regionCodes`. Never account IDs, memberships of named people, provider mappings, staff notes, exact location, ideology.
- **Logs:** institutional event ids and reason codes only.
- **Moderation:** no agreement/ideology field on qualification/governance APIs.
- **Legal language:** “Commonhall v2” working name; community membership is not nonprofit/statutory membership; no incorporation/tax/production-readiness claims. Keep existing About disclaimers.
- **A11y:** new disclosures use `DisclosureNotice`; keyboard/semantic aside already exists. Do not add unlabeled live regions. Timezone-aware dates if any new timestamps are shown (prefer not showing new timestamps on public home).
- **Ops:** reset/backup/seed updated; rollback SQL documented; local reset still must not claim remote provider deletion.
- **PR #22:** preserve exact-count, complementary suppression, no publish when reimport required, finding immutability.

## Tests (required)

### Contract

- Existing `tests/contracts/v2-governance-contract.test.mjs` stays green.
- Add assertion that TypeScript governance action/state unions match the JSON file.

### Unit/domain

- Every JSON transition accepted with required fields.
- Every illegal transition denied (informal → chamber, missing reason, service admin as chamber, etc.).
- Constitutional floor rejects hosted Pol.is and missing neutrality keys.
- Flags fail closed.
- Legacy adapter does not mint v2 authority.
- Public projection allowlist.

### Database

- PGlite: schema checks, self-appointment CHECK, composite FK mismatch, unscoped repo throws.
- Postgres `isolation.pg.test.ts`: two orgs, adversarial IDs, cross-tenant SQL and service denies; rollback of 0023 on disposable DB (`OSTT_PG_ADMIN_URL` pattern from invite tests).
- Report integrity `report-integrity.pg.test.ts` from PR #22.

### Service/API

- Service admin cannot `organization.appointment.grant` / governance transition / org vote.
- Org A admin cannot mutate org B.
- Member of org A without appointment cannot qualify.
- Moderator cannot decide own proposal.
- Kernel kill switch denies writes.

### Component / E2E / a11y

- Home/About show Commonhall v2 not-operational disclosure; axe still clean.
- Join still disabled.
- Existing public and gated E2E remain green.

### Security/privacy

- Cross-tenant matrix.
- Public DTO/log fixtures contain no account IDs, XIDs, provider refs, exact coordinates.

## Seeds / reset / backup

- Seed orgs: `org-ostt-synth-alpha` and `org-ostt-synth-beta` with distinct slugs and coarse regions. Adversarial: also try using org A’s internal id as org B’s public id in tests.
- Do **not** attach legacy `council_appointments` to these orgs.
- Optional: one synthetic `topic_governance_records` row in `informal_draft` for org alpha, synthetic-only.
- Reset: new tables class `reset` except maybe none retained. Config versions are reset (synthetic). Regenerated: none required unless a singleton is needed (prefer none).
- `DELETE_ORDER` children-first: recusals → governance events → governance records → appointments → membership events → memberships → config versions → service areas → organizations; then existing order.
- Immutability triggers for membership events and governance events added to `IMMUTABLE_DELETE_TRIGGERS`.
- Backup smoke must still pass.

## PR #22 incorporation procedure

1. `git checkout origin/cursor/4.5a1-report-integrity-closure-60e1 --` the runtime files (not `docs/phase-4-plan.md`, `docs/architecture-phase-4.md`).
2. Allowed historical ADR touch: `docs/decisions/0018-*.md`, `0019-*.md`, `0021-*.md` **only if** they document integrity behavior still operational. Do not revive 4.5B package sequence.
3. Resolve conflicts with later org schema edits on `schema.ts` / journal / reset manifest.
4. Keep `test:pg:reports`.

## Commit sequence

1. `fix(public-input): preserve 4.5A.1 report-integrity closure as v2 prerequisite`
2. `feat(v2): add organization schema, constitutional floor, and isolation constraints`
3. `feat(v2): separate service and organization authority in authz/audit`
4. `feat(v2): add governance state-machine kernel and legacy adapters`
5. `test(v2): organization isolation, authority matrix, and kernel flags`
6. `docs(v2): Phase 1 honesty copy, reset classification, and open-decision postures`

Migrations and their tests belong in the same commit as the schema they introduce (commits 1 and 2).

## PR evidence the subagent must leave for the orchestrator

- Changed file list
- Migration/backfill/rollback notes
- Commands run and results
- Unexpected conflicts
- Open decisions still blocking
- Disabled features
- Confirmation no production participant data was used
- Confirmation only Phase 1 was implemented

## Subagent stop conditions

Stop and report to the orchestrator (do not silently invent) if:

- Canonical JSON and narrative conflict.
- An open decision would require a production numeric default to proceed.
- Unexpected overlap beyond PR #22.
- Existing security/privacy tests can only pass by weakening them.
- Next.js 16 APIs in `node_modules/next/dist/docs/` forbid the chosen UI pattern.
