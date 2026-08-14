# Phase 6 orchestrator plan — legacy retirement, test rewrite, reset, final overview

**Status:** Binding. Phase 5 PR exists (#28). Implement Phase 6 only.

**Authorized phase:** Phase 6 — delivery of Commonhall pre-alpha. Do not invent production thresholds, enable hosted Pol.is, add email vendors, or merge to `main`.

**Base:** Stack on `v2/phase-5-chamber-council` at `db9713d` (PR #28). Do **not** branch from `main` (Phase 1 only). Branch name: `v2/phase-6-legacy-retirement`.

**Open PR stack (do not merge):** #25 Phase 2, #26 Phase 3, #27 Phase 4, #28 Phase 5. PR #22 report integrity is already in `main` via Phase 1.

## Canonical reading order

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
11. `docs/v2/implementation-plan.md` Phase 6
12. This file
13. Next.js 16 App Router docs in `node_modules/next/dist/docs/` (network file is `src/proxy.ts`, not `middleware.ts`)
14. Current member product: `src/app/(member)/**`, `src/app/page.tsx`, `src/app/demo/page.tsx`, `src/lib/auth/account-gate.ts`, `src/lib/navigation.ts`, reset manifest, e2e suite

## Council product goals this phase must finish

- Commonhall is the only public product. Main page is demo **or** sign-in.
- Unauthenticated visitors cannot use product pages (V2-21 pre-alpha).
- Signed-in members post, deliberate on synthetic topics, and walk Commons → Agenda → Chamber → Council → Records.
- Synthetic catalog is disableable (`COMMONHALL_SYNTHETIC_SEED=off`).
- Operator reset is the pre-alpha → alpha wipe.
- Legacy think-tank routes and duplicate handlers are gone (thin redirects only).
- Test suite matches Commonhall architecture.
- `docs/v2/final_overview.md` is the Council-readable delivery file, including every vendor/legal hold.

## User journeys

1. **Visitor** — `/` offers Tour the demo, Create an account, Sign in. `/demo` walks the full process with honest fixture copy. `/idea-commons`, `/formal-topics`, `/deliberation`, `/decisions`, `/process`, `/topics`, `/transparency`, `/actions` do not render old think-tank pages.
2. **New member** — enrolls, signs in, creates a Commons post, opens Agenda synthetic topics, records agree/disagree/pass, observes Chamber/Council/Records for sidewalk-repair.
3. **Operator** — dry-run then execute alpha reset on a disposable gated database; synthetic seed can be omitted on next boot.
4. **Council reader** — opens `docs/v2/final_overview.md` and sees what shipped, how to run it, and what must wait for vendors/counsel.

## Known CI failures to fix first (do not weaken)

These already fail on PR #26/#27 and will fail Phase 5/6 until fixed:

1. **Gated Playwright strict-mode** — `getByRole("heading", { name: "Commons" })` matches `Commons`, `Formal Commons`, and `Informal Commons`. Use `{ name: "Commons", exact: true }` in:
   - `e2e/commons.gated.spec.ts` (two places)
   - `e2e/enrollment.gated.spec.ts`
   - `e2e/public-interface.gated.spec.ts`
   - `e2e/revisions-comparison.gated.spec.ts`
2. **Postgres org rollback** — `src/lib/organizations/isolation.pg.test.ts` “rolls back migration 0023” fails: `cannot drop table topic_governance_records because other objects depend on it` (0025 Commons FK `topic_governance_record_id`, plus 0026/0027 dependents). Before `ROLLBACK_0023`, run the later rollback SQL already defined in:
   - `src/lib/bodies/isolation.pg.test.ts` `ROLLBACK_0027`
   - `src/lib/agenda/isolation.pg.test.ts` `ROLLBACK_0026`
   - `src/lib/commons/isolation.pg.test.ts` `ROLLBACK_0025`
   Order: 0027 → 0026 → 0025 → 0023. Extract shared rollback snippets if needed; do not drop 0023 tables while dependents exist. Keep a positive assertion that `organizations` is gone after the chain.

Do not skip or delete those tests.

## 1. Retire leftover think-tank product IA

### Delete page implementations (replace with thin redirect-only routes)

Replace these `page.tsx` trees with a server `redirect()` to the Commonhall equivalent (no old UI, no duplicate loaders). Prefer `permanentRedirect` / 308 where Next 16 supports it; otherwise `redirect()` plus tests that the destination is the Commonhall surface.

| Old path | Destination |
| --- | --- |
| `/idea-commons`, `/idea-commons/[id]` | `/commons` |
| `/formal-topics`, `/formal-topics/[slug]`, consultation + report nested pages | `/agenda` or `/agenda/topics/[slug]` when slug maps; else `/commons` |
| `/deliberation/[slug]` | `/chamber/topics/[slug]` if chamber topic exists, else `/chamber` |
| `/decisions/[slug]` | `/council/topics/[slug]` if exists, else `/council` |
| `/transparency` | `/records` |
| `/actions/[slug]` | `/records/topics/[slug]` if exists, else `/records` |
| `/process` | `/demo` |
| `/topics`, `/topics/[slug]`, `/topics/[slug]/consult` | `/agenda` / `/agenda/topics/[slug]` |
| `/demo/workflow` | `/demo` |
| `/about` | `/` (already gated; keep thin redirect) |

Unauthenticated requests still hit `src/proxy.ts` first: public-demo → `/`; gated → `/auth/sign-in`. Authenticated legacy map in `authenticatedLegacyRedirect` must remain consistent with the table above. After pages are redirect-only, keep the gate map; do not serve old components.

### Delete duplicate UI modules once nothing imports them

Safe to delete **if** no remaining route/workspace import:

- `src/features/idea-commons/**`
- `src/features/demo/GuidedDemo.tsx`, `demo-steps.ts`, `demo-query.ts` (keep only if ProcessTour still needs them; otherwise delete and keep `ProcessTour`)
- `src/features/deliberation/DeliberationObserver.tsx` and related public observer UI
- `src/features/decisions/DecisionRecord.tsx` public UI
- `src/features/transparency/TransparencyCenter.tsx`
- `src/app/process/page.tsx` content (`process-steps.ts` / `process-content.ts` if unused)
- Public `CanonicalTopicPage` used only by `/formal-topics`

**Keep** (still used by gated workspace / Public Input integrity):

- `src/app/workspace/**` and `src/app/api/workspace/**` (account-gated staff tools; not public IA)
- `src/app/staff/**`
- Report-integrity, evidence, revision, moderation services
- Fixture providers and `no-provider`
- Auth invite bootstrap (`/auth/accept`)

Do not expose workspace/staff in public or member primary nav.

### Copy / demo

Update `src/components/demo/ProcessTour.tsx` so it no longer says posting or Chamber/Council “open in a later phase.” Describe the shipped pre-alpha: members can post and walk synthetic topics; hosted Pol.is remains unavailable; not statutory membership.

Public nav stays Demo / Create account / Sign in. Member nav stays Commons / Agenda / Chamber / Council / Records / Account.

## 2. Rewrite the active test suite

### Public e2e (must not require old headings)

Rewrite or replace:

- `e2e/journey.spec.ts` — keep unauthenticated gate; old paths may remain as **redirect targets**, not page content assertions
- `e2e/demo.spec.ts` — ProcessTour (already Commonhall)
- `e2e/topics.spec.ts`, `e2e/deliberation.spec.ts`, `e2e/decisions.spec.ts`, `e2e/consult.spec.ts`, `e2e/canonical-topic.spec.ts`, `e2e/agenda.spec.ts` (public), `e2e/public-input-report.spec.ts`, `e2e/evidence-disclosure.spec.ts`, `e2e/demo-workflow.spec.ts`, `e2e/comparison.public-demo.spec.ts`

New public assertions:

- Landing + demo + join/sign-in only
- Old think-tank URLs redirect (landing in public-demo; sign-in in gated)
- No `pol.is` network
- Axe on `/` and `/demo`

### Gated e2e

Keep and modernize:

- `e2e/enrollment.gated.spec.ts`
- `e2e/commons.gated.spec.ts`
- `e2e/agenda.gated.spec.ts`
- `e2e/chamber-council.gated.spec.ts`
- Privacy, a11y, auth-lifecycle

Retire or retarget tests that still `goto("/formal-topics/...")` expecting old topic UI (`consultation-reports.gated.spec.ts`, `moderation-disclosure.gated.spec.ts`, `review-publish.gated.spec.ts`, `topics-authoring.gated.spec.ts`) onto **workspace** URLs if the staff tool still exists, or delete the public-IA assertion after a workspace equivalent is proven.

Add one **member walkthrough** spec if missing: enroll → post → agenda position → chamber/council/records sidewalk-repair.

### Unit

- Delete tests that assert Idea Commons / Formal Topics **product** headings as the public contract (`src/features/formal-topics/*.test.ts` public hrefs, `GuidedDemo.test.tsx`, `DecisionRecord.test.tsx` public routes) **after** replacements are green.
- Keep governance kernel, isolation, enrollment abuse, report-integrity, reset completeness.
- Update `src/lib/auth/account-gate.test.ts` destinations if the redirect table changes.
- `src/app/api/workspace/review/route.test.ts` currently asserts `src/app/formal-topics/page.tsx` contains a redirect — update to the Phase 6 redirect-only file or to workspace.

Do not mass-search/replace “Idea Commons” in historical `docs/` or ADR 0001–0021.

## 3. Reset, synthetic seed, runbook

- Confirm `assertManifestComplete` still covers every `pgTable` (currently 62, manifest `v2.5.0`). If Phase 6 adds no tables, do not bump the version without a schema change.
- Update `docs/alpha-reset-runbook.md` audience from “invite-only alpha” to “gated Commonhall pre-alpha”: open enrollment + synthetic seed; wipe before alpha.
- Document:
  - `COMMONHALL_SYNTHETIC_SEED` default on in gated, off hides synthetic catalog from member DTOs
  - `COMMONHALL_V2_OPEN_ENROLLMENT`
  - `COMMONHALL_V2_KERNEL`
  - Hosted Pol.is cannot be enabled
- Local reset still never claims remote Pol.is deletion.

## 4. `docs/v2/final_overview.md` (required Council file)

Write for humans on the Council. Plain language. No production-readiness claim. Include:

### A. What Commonhall is now

Working-name Commonhall v2. Proposed digital town hall. Community membership ≠ nonprofit/statutory/government standing.

### B. How to run

- Public-demo: `APP_MODE=public-demo`, no database; landing + demo only
- Gated: `APP_MODE=gated` + Postgres; enroll, member product, synthetic seed
- Commands: install, `db:up`, migrate, seed, `next dev`, targeted tests, `CI / required`

### C. What a visitor and a member can do

- Visitor: `/`, `/demo`, `/join`, `/auth/sign-in`
- Member: Commons posts, Agenda positions, observe Chamber/Council/Records
- Elevated seats remain appointment-only (synthetic seed)

### D. Architecture map

Organization tenancy, kernel JSON as law, dual APP_MODE, member route group, account gate, fixture consultation, in-house positions, Chamber/Council sessions.

### E. Synthetic data and reset

How to disable the catalog; operator reset ceremony; what is wiped; what is regenerated.

### F. Vendor and legal holds (do not mark done)

Every row must say **open**, owner unknown unless already recorded, and what is blocked:

| ID | Hold | Pre-alpha posture | What is blocked until settled |
| --- | --- | --- | --- |
| V2-01 | Name/trademark/domain | Working name Commonhall v2 | Dropping “v2”, public branding spend |
| V2-02 | Legal meaning of membership / counsel terms for community standards | Service membership copy only | Final terms, counsel-cleared standards |
| V2-03 | Nonprofit/service-steward emergency authority | Narrow technical/abuse only | Production service terms |
| V2-04 | Production matching | Assign to synthetic primary org with explanation | Automatic regional assignment |
| V2-05 | Transfer / overlapping orgs | One primary; no dual voting | Regional expansion |
| V2-06 | Qualification capacity | Charter floor; kernel submit only | Formal submission launch at scale |
| V2-07 | Consultation thresholds | Synthetic fixture snapshots only | Live outcome calculation |
| V2-08 | Retention window | Nullable deadline; worker off | Expiration worker |
| V2-09 | Chamber size/quorum/appointments | Fixture roster only | Live Chamber appointments |
| V2-10 | Council cadence/quorum | Fixture playback only | Live Council agenda |
| V2-11 | Hosted vs self-hosted Pol.is + DPA | Hosted embed impossible | Live embed |
| V2-12 | Pol.is CSP / consent UX | Exact-origin; no script | Live embed |
| V2-13 | Provider retention/deletion/incident | No remote deletion claim | Live embed |
| V2-14 | Production reporting floor | Provisional synthetic-only | Live aggregate publication |
| V2-15 | Aggregate map | No map product | Public map |
| V2-16 | Dishonorable public metadata | Protected | Public moderation report |
| V2-17 | Federation | Out of scope | Cross-instance exchange |
| V2-18 | Email, hosted DB, analytics vendors | None | Production deployment, mail |
| V2-19 | Existing alpha-account migration | No auto-convert | Open enrollment rollout onto old accounts |
| V2-20 | Representation claims | No population mandate | Public impact language |
| V2-21 | Unauthenticated product-surface | Pre-alpha account gate | Production public-observer Agenda/Chamber/Council without login |
| V2-22 | Enrollment verification / recovery | Identifier + password; no email | Email verification, password recovery by mail |
| V2-23 | Bot / abuse vendor | In-process rate limit, honeypot, min fill, duplicate identifier | Distributed bot service |

Also list operational docs still in force: threat-model, incident-response, secrets, data-map, reset, capability-matrix, provider-assessment.

### G. Explicit non-claims

Not incorporated, not tax-exempt, not counsel-cleared, not production-ready, not a live Pol.is consultation, not statutory membership.

Link this file from `docs/README.md` as the Council delivery overview (after the canonical contract list, not replacing the charter).

## 5. Docs contract updates

- `docs/v2/architecture.md` §7: legacy duplicates removed; list only Commonhall routes + thin redirects.
- `docs/v2/testing-strategy.md` Phase 6 suite: mark complete criteria.
- `docs/v2/open-decisions.md`: Phase 6 fail-closed postures (not settlements).
- `docs/v2/implementation-plan.md` Phase 6 status: implemented pending human review (do not claim merged).
- Historical Phase 1–4 docs stay historical.

## Tests the agent must run

```text
npx vitest run
npm run test:pg:organizations
npm run test:pg:enrollment
npm run test:pg:commons
npm run test:pg:agenda
npm run test:pg:chamber
npm run test:pg:alpha-reset
npm run test:pg:reports
npx playwright test --project=chromium
npx playwright test e2e/enrollment.gated.spec.ts e2e/commons.gated.spec.ts e2e/agenda.gated.spec.ts e2e/chamber-council.gated.spec.ts --project=gated-chromium
```

If Docker/Postgres is unavailable locally, still fix the heading locators and rollback composition, and state that `CI / required` is the source of truth.

## Commit sequence

1. `test(v2): exact Commons heading locators and 0023 rollback chain`
2. `refactor(v2): replace think-tank pages with Commonhall redirects`
3. `chore(v2): remove unused think-tank UI modules`
4. `test(v2): rewrite public and gated suites for Commonhall IA`
5. `docs(v2): reset runbook, architecture routes, and Council final_overview`

Push `v2/phase-6-legacy-retirement`. Write the PR body to `/tmp/phase-6-pr-body.md` using `.github/pull_request_template.md`. **Do not** run `gh pr create` or ManagePullRequest (unavailable / orchestrator-owned). Do not merge. Do not start another phase.

## Out of scope

- Enabling hosted Pol.is or any `pol.is/embed.js` load
- Email verification, SMTP, identity vendors, analytics
- Production numeric thresholds
- Claiming counsel clearance or production readiness
- Deleting historical ADR/docs
- Weakening isolation, privacy, CSRF, origin, or report-integrity tests
- Removing workspace/staff APIs that still enforce capability checks

## Git rules for this subagent

- Create/use `v2/phase-6-legacy-retirement` from `origin/v2/phase-5-chamber-council` (or continue that branch if already checked out).
- Never push `main`. Never force-push.
- Reviewable commits. `git push -u origin v2/phase-6-legacy-retirement`
- No production participant data in prompts, fixtures, logs, screenshots, or the repo.
