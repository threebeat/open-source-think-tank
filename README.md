# Commonhall v2

Commonhall is a proposed open-source computational-democracy platform: a digital town hall that connects open community discussion, structured consultation, public Chamber deliberation, organization Council decisions, and auditable recommendations.

**v2 is a working implementation name.** It is not a claim of trademark clearance, incorporation, tax status, legal review, representative sampling, or production readiness.

## Current repository state

The application still implements the earlier Open-Source Think Tank Phase 1–4 model. This branch resets the product contract, agent guidance, governance test contract, and CI/PR process; it deliberately does not pretend the v2 application already exists.

The migration preserves useful foundations: Next.js/TypeScript, PostgreSQL/Drizzle, Auth.js, evidence/revisions, privacy/audit, reset operations, server capabilities, synthetic public demo isolation, and aggregate-only Public Input reporting. It replaces invite-only, single-institution, and old council/route assumptions through six reviewed implementation phases.

## Read first

1. [Active product charter](docs/product-charter.md)
2. [Documentation map](docs/README.md)
3. [Machine-readable governance state contract](docs/v2/governance-state-machine.json)
4. [Architecture](docs/v2/architecture.md)
5. [Six-phase implementation plan](docs/v2/implementation-plan.md)
6. [Cursor cloud-agent prompt](docs/v2/cursor-cloud-agent-prompt.md)

Historical Phase 1–4 documents remain migration evidence, not active product authority. See [ADR 0022](docs/decisions/0022-commonhall-v2-reset.md).

## Product model

- **Commons:** formal categories first; then a visible unreviewed-content disclaimer and informal discussion/proposals.
- **Public Agenda:** qualified topics begin in consultation and remain public through accepted/disputed/inconclusive retention and Chamber activity.
- **Chamber:** organization-appointed members deliberate publicly and publish an accepted or disputed verdict with a complete roll call.
- **Council Agenda:** an organization Council accepts/declines Chamber topics under explicit reason rules, deliberates publicly, and publishes recommendations.
- **Records:** topic history, rule versions, qualification traces, consultation insights, schedules, rosters, votes, abstentions, recusals, rationales, and lineage.
- **Membership:** open regular community enrollment first; organization-approved elevated appointments later. Service roles never imply organization authority.
- **Organizations:** independent configuration within service-wide ethics, privacy, accessibility, due-process, transparency, and isolation floors.

Preference, cross-group agreement, evidence quality, community outcome, Chamber verdict, and Council recommendation remain separate signals.

## Pol.is boundary

The provided hosted Pol.is embed is a candidate integration for qualified-topic consultation. Commonhall will load it only behind explicit activation, exact-origin/CSP controls, organization feature flags, and resolved privacy/vendor/retention gates.

Public output is aggregate insight only. No raw votes, individual response histories, XIDs, provider mappings, or person-level map points may appear in Commonhall public data. Post-close insights are published for accepted, disputed, and inconclusive consultations. A successor topic always receives a new topic and provider entity.

## Six implementation phases

1. Organization-scoped foundation and institutional state kernel
2. Open community membership, profiles, moderation, and two-part Commons
3. Public Agenda, canonical topic pages, and guarded Pol.is integration
4. Chamber, Council Agenda, recommendations, and public transparency
5. Organization administration, elevated membership, and multi-organization readiness
6. Migration, new demo, legacy retirement, and launch evidence

Each phase uses a dedicated subagent, branch, draft PR, test evidence, and human approval before the next begins.

## Development baseline

The current application requires Node.js 22 and npm 10+. Until phase implementation updates the scripts:

```bash
npm ci
npm run lint
npm run typecheck
npm test
APP_MODE=public-demo npm run build
```

Run the v2 governance contract without installing dependencies:

```bash
node --test tests/contracts/v2-governance-contract.test.mjs
```

PostgreSQL and gated E2E commands remain documented in the historical operational references and CI workflow. Use disposable databases only.

## GitHub workflow

Agents branch from current `main` as `v2/phase-<n>-<scope>`, open a draft PR to `main`, and wait for `CI / required`. CI stays read-only; the cloud-agent GitHub identity creates the branch/PR. Never push directly to `main`, force-push shared history, or begin the next phase without human approval.

See [CI and PR workflow](docs/v2/ci-pr-workflow.md) and [.github/pull_request_template.md](.github/pull_request_template.md).

