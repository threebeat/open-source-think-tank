# Commonhall v2 — Council delivery overview

**Status:** Pre-alpha implementation pending human review. This file is a Council-readable summary of what shipped in Phases 1–6. It does **not** replace the [product charter](./product-charter.md). It is not legal, tax, trademark, vendor, or production-launch clearance.

**Date:** 2026-08-14

No production participant data entered this document, fixtures, screenshots, or development artifacts.

## A. What Commonhall is now

**Commonhall v2** is a working name for a proposed computational-democracy digital town hall. Open community participation, structured consultation, a public Chamber, an organization Council, and versioned records are separate powers. Algorithms organize and apply published rules; named humans and bodies make institutional decisions.

Community membership means membership in a participating organization’s Commonhall community. It is **not** nonprofit membership, statutory membership, government standing, or a Chamber/Council/moderator/organization-admin/service-admin seat.

This pre-alpha is a gated demonstration with synthetic catalog data and open local enrollment. It is not a live town hall, not a live Pol.is consultation, and not production-ready.

## B. How to run

### Public-demo (no database)

```bash
export APP_MODE=public-demo
npm install
npx next dev
```

Unauthenticated visitors see `/`, `/demo`, `/join` (explanation only; account creation fails closed), and `/auth/**`. Product routes redirect to `/`. No Postgres. No Auth.js session store. No enrollment writes.

### Gated pre-alpha (Postgres)

```bash
export APP_MODE=gated
export DATABASE_URL="postgres://ostt:ostt@127.0.0.1:54329/ostt_dev"
# AUTH_SECRET must be a non-production local value. Do not use production secrets.
npm install
npm run db:up
npm run db:migrate
npm run db:seed
npx next dev
```

Gated mode offers open enrollment (identifier + password), the member halls, and the synthetic catalog.

### Flags (fail-closed; not production settlements)

| Flag | Default in gated | Effect |
| --- | --- | --- |
| `COMMONHALL_SYNTHETIC_SEED` | on | `off` hides `synthetic=true` catalog rows from member DTOs. Does not delete rows. |
| `COMMONHALL_V2_OPEN_ENROLLMENT` | on | `off` kills new account creation. Always off in public-demo. |
| `COMMONHALL_V2_KERNEL` | on | `off` refuses organization/governance writes. Always off in public-demo. |
| Hosted Pol.is | impossible | `isHostedPolisEnabled()` is always false. Env cannot enable it. |
| Live Chamber/Council | impossible | `COMMONHALL_V2_CHAMBER_LIVE` / production live Council cannot enable a live process. |

### Tests and CI

```bash
npx vitest run
npm run test:pg:organizations
npm run test:pg:enrollment
npm run test:pg:commons
npm run test:pg:agenda
npm run test:pg:chamber
npm run test:pg:alpha-reset
npm run test:pg:reports
npx playwright test --project=chromium
npx playwright test e2e/enrollment.gated.spec.ts e2e/commons.gated.spec.ts e2e/agenda.gated.spec.ts e2e/chamber-council.gated.spec.ts --config=playwright.gated.config.ts
```

The stable required check is `CI / required`. See [ci-pr-workflow.md](./ci-pr-workflow.md).

## C. What a visitor and a member can do

**Visitor (no account):** landing (`/`), synthetic process tour (`/demo`), join explanation or gated enrollment (`/join`), sign-in (`/auth/sign-in`). Staff/bootstrap invite remains at `/auth/accept`. Product halls require an account (V2-21 pre-alpha).

**Member (signed in):** Commons posts and proposals; Public Agenda topic tabs and in-house agree/disagree/pass on synthetic statements; observe Chamber, Council, and Records for seeded topics such as sidewalk repair. Community enrollment never grants Chamber, Council, moderator, organization-admin, or service-admin capability.

**Elevated seats:** synthetic, appointment-only, time-bounded, non-self-grantable. Informal topics cannot jump to Chamber or Council.

**Staff tools:** `/workspace` and `/staff` remain account-gated operational tools. They are not in public or member primary navigation.

## D. Architecture map

- Organization tenancy: every organization-owned row is `organization_id`-scoped. Cross-tenant access is denied in services and database constraints.
- Governance kernel: [governance-state-machine.json](./governance-state-machine.json) is executable law. Informal cannot skip to Public Agenda, Chamber, or Council.
- Dual `APP_MODE`: public-demo is database-free; gated uses Postgres.
- Member route group: `/commons`, `/agenda`, `/chamber`, `/council`, `/records`, `/account`.
- Account gate: `src/proxy.ts` (Next.js 16 network file) plus `authenticatedLegacyRedirect`. The URL is never authorization.
- Fixture consultation: no `https://pol.is/embed.js` load; in-house positions write only to `member_statement_positions`.
- Chamber/Council sessions: complete roll calls (`yes | no | abstain | recused | absent`); reason rules match the JSON contract.

Legacy think-tank routes are redirect-only:

| Old path | Destination |
| --- | --- |
| `/idea-commons`, `/idea-commons/[id]` | `/commons` |
| `/formal-topics` | `/agenda` |
| `/formal-topics/[slug]` and nested consultation/report | `/agenda/topics/[slug]` |
| `/deliberation/[slug]` | `/chamber/topics/[slug]` |
| `/decisions/[slug]` | `/council/topics/[slug]` |
| `/transparency` | `/records` |
| `/actions/[slug]` | `/records/topics/[slug]` |
| `/process`, `/demo/workflow` | `/demo` |
| `/topics`, `/topics/[slug]`, `/topics/[slug]/consult` | `/agenda` / `/agenda/topics/[slug]` |
| `/about` | `/` |

Unauthenticated product and legacy URLs still hit the proxy first: public-demo → `/`; gated → `/auth/sign-in`. `/demo/workflow` is allowed through as `/demo/**` and then thin-redirects to `/demo`.

## E. Synthetic data and reset

The synthetic catalog fills Commons, Agenda, Chamber, Council, and Records in gated mode. Set `COMMONHALL_SYNTHETIC_SEED=off` to hide those catalog rows from member list/detail DTOs. Member-created posts are not catalog rows and remain visible.

Operator reset is the pre-alpha → alpha wipe. See [alpha-reset-runbook.md](../alpha-reset-runbook.md). Manifest `v2.5.0` classifies every `pgTable` (currently 62). Dry-run, then execute on a **disposable** gated database. After wipe:

- identity, membership, Commons, Agenda positions, Chamber/Council sessions, topics, and Public Input rows are empty;
- operational assent documents and retention defaults are regenerated;
- `npm run db:seed` may restore the synthetic catalog for another drill;
- **local reset never claims remote Pol.is deletion.**

## F. Vendor and legal holds (OPEN — do not mark done)

Owner is unknown unless a later ADR records one. Pre-alpha engineering postures are **not** settlements.

| ID | Hold | Pre-alpha posture | What is blocked until settled |
| --- | --- | --- | --- |
| V2-01 | Name/trademark/domain | **OPEN.** Working name Commonhall v2; UI may say Commonhall | Dropping “v2”, public branding spend |
| V2-02 | Legal meaning of membership / counsel terms for community standards | **OPEN.** Service membership copy only | Final terms, counsel-cleared standards |
| V2-03 | Nonprofit/service-steward emergency authority | **OPEN.** Narrow technical/abuse only; no organization vote | Production service terms |
| V2-04 | Production matching | **OPEN.** Assign to synthetic primary org with explanation | Automatic regional assignment |
| V2-05 | Transfer / overlapping orgs | **OPEN.** One primary; no dual voting | Regional expansion |
| V2-06 | Qualification capacity | **OPEN.** Charter floor; kernel submit only | Formal submission launch at scale |
| V2-07 | Consultation thresholds | **OPEN.** Synthetic fixture snapshots only | Live outcome calculation |
| V2-08 | Retention window | **OPEN.** Nullable deadline; worker off | Expiration worker |
| V2-09 | Chamber size/quorum/appointments | **OPEN.** Fixture roster only | Live Chamber appointments |
| V2-10 | Council cadence/quorum | **OPEN.** Fixture playback only | Live Council agenda |
| V2-11 | Hosted vs self-hosted Pol.is + DPA | **OPEN.** Hosted embed impossible | Live embed |
| V2-12 | Pol.is CSP / consent UX | **OPEN.** Exact-origin; no script loaded | Live embed |
| V2-13 | Provider retention/deletion/incident | **OPEN.** No remote deletion claim | Live embed |
| V2-14 | Production reporting floor | **OPEN.** Provisional synthetic-only | Live aggregate publication |
| V2-15 | Aggregate map | **OPEN.** No map product | Public map |
| V2-16 | Dishonorable public metadata | **OPEN.** Protected | Public moderation report |
| V2-17 | Federation | **OPEN.** Out of scope | Cross-instance exchange |
| V2-18 | Email, hosted DB, analytics vendors | **OPEN.** None | Production deployment, mail |
| V2-19 | Existing alpha-account migration | **OPEN.** No auto-convert | Open enrollment rollout onto old accounts |
| V2-20 | Representation claims | **OPEN.** No population mandate | Public impact language |
| V2-21 | Unauthenticated product-surface | **OPEN.** Pre-alpha account gate | Production public-observer Agenda/Chamber/Council without login |
| V2-22 | Enrollment verification / recovery | **OPEN.** Identifier + password; no email | Email verification, password recovery by mail |
| V2-23 | Bot / abuse vendor | **OPEN.** In-process rate limit, honeypot, min fill, duplicate identifier | Distributed bot service |

Operational documents still in force until a v2 replacement is accepted: [threat-model.md](../threat-model.md), [incident-response.md](../incident-response.md), [secrets-and-operations.md](../secrets-and-operations.md), [data-map.md](../data-map.md), [alpha-reset-runbook.md](../alpha-reset-runbook.md), [alpha-reset-classification.md](../alpha-reset-classification.md), [capability-matrix.md](../capability-matrix.md), [public-input-provider-assessment.md](../public-input-provider-assessment.md).

## G. Explicit non-claims

This pre-alpha is:

- **not** incorporated;
- **not** tax-exempt;
- **not** counsel-cleared;
- **not** production-ready;
- **not** a live Pol.is consultation;
- **not** statutory membership, government authority, or a population mandate;
- **not** a claim that “Commonhall” is a cleared trademark.

Phases 2–6 are implemented pending human review. Do not merge to production activation without Council sign-off.

Synthetic public-demo screenshots (no participant data): [screenshots/](./screenshots/).
