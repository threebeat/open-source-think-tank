# Phase 2 handoff

**Status:** Implementation complete; readiness blocked on counsel return (gated E2E now green).

Engineering packages **2.1–2.12 implementation** are in place. Gated E2E including account/staff axe has passed. **Work package 2.12 is still not complete for the foundation tag** until readiness counsel dispositions are returned and recorded. Phase 3 engineering may proceed under blocking constraints; **real launch and the Phase 2 foundation tag remain stopped**.

**Baseline:** Phase 1 tag [`phase-1-demonstration`](https://github.com/threebeat/open-source-think-tank/releases/tag/phase-1-demonstration) at `33ff0cc`.  
**Plan:** [phase-2-plan.md](./phase-2-plan.md).  
**Counsel packet:** [counsel-review-packet-2.12.md](./counsel-review-packet-2.12.md).

## Readiness blockers (stop tag / real launch; do not stop Phase 3 engineering)

| Blocker | Status | Required evidence |
| --- | --- | --- |
| Gated E2E on Node 22 | **Cleared (local run)** — see run record below | Green gated suite including `e2e/a11y.gated.spec.ts` |
| Account/staff axe coverage | **Cleared** with gated suite | Same run |
| Counsel dispositions for readiness topics | **Packet issued; all gates still blocking** | Returned dispositions in plan §7 **and** `src/lib/counsel/dispositions.ts` (`readinessCounselAllowsFoundationTag() === true`) |
| GitHub status checks | **Workflow added** — `.github/workflows/ci.yml`; enable as required checks after first remote green run | Branch protection requiring CI |
| Managed Postgres / production email | **Blocked** pending vendor addenda | Permitted-services register |
| Foundation release tag | **Not created** | Only after readiness counsel gates non-blocking + human approval |

## Gated suite run record

| Field | Value |
| --- | --- |
| Date | 2026-08-10 (local Windows, evening) |
| Node | v22.17.0 (`.nvmrc` = 22) |
| Docker Desktop | Installed (4.86.0) but **engine unable to start** — WSL not installed (`wsl --status` reports missing). CLI at `%LocalAppData%\Programs\DockerDesktop\resources\bin` |
| Postgres used | Local **PostgreSQL 17** service (`postgresql-x64-17` Running) on `127.0.0.1:5432`, database `ostt_dev`, role `ostt` — equivalent gated DB for this readiness run (compose on `:54329` not used because Docker engine down) |
| Working tree note | Suite run against uncommitted readiness fixes (lifecycle same-state active, frank invite, workers:1, a11y helpers). Record commit SHA after those land on the tag candidate. |
| Commands | `node scripts/gated-e2e-prepare.mjs` → `npm run build` → `npx playwright test -c playwright.gated.config.ts` with `APP_MODE=gated`, `DATABASE_URL=postgres://ostt:ostt@127.0.0.1:5432/ostt_dev`, synthetic `AUTH_SECRET` / `AUTH_E2E_CAPTURE=1` |
| Result | **9 passed / 0 failed** (15.0s, 1 worker) |
| Specs covered | `a11y.gated.spec.ts` (account privacy/onboarding/assent axe + staff onboarding axe), `auth-lifecycle.gated.spec.ts`, `onboarding.gated.spec.ts` (keyboard + axe, declined assent, mobile viewport) |
| CI path | `.github/workflows/ci.yml` job `e2e-gated` still expected to use Docker Compose on GitHub-hosted runners |

### Follow-ups recommended (not tag blockers if counsel returns)

1. Install WSL2 (`wsl --install`, reboot) so Docker Desktop engine starts; then prefer `npm run test:e2e:gated` with compose.
2. Push CI workflow and require status checks on `main`.
3. After counsel dispositions land, re-run gated suite on the tag commit and refresh the SHA in this table.

## Counsel review record

| Topic | Gate id | Disposition status | Source |
| --- | --- | --- | --- |
| Data map and retention schedule | `data_map_retention` | blocking | [counsel-review-packet-2.12.md](./counsel-review-packet-2.12.md) |
| Electronic assent documents | `electronic_assent` | blocking | same |
| Account-holder vs statutory-member terminology | `statutory_membership` | blocking | same |
| Eligibility and geographic assertions | `eligibility_geography` | blocking | same |
| Council and board authority | `account_council_authority` | blocking | same |
| Separation of verification and political-opinion data | `political_opinion_verification` | blocking | same |
| Formation / fiscal sponsorship (readiness framing) | `formation_fiscal` | blocking | same |

Full provenance columns: [phase-2-plan.md](./phase-2-plan.md) §7 and `src/lib/counsel/dispositions.ts`.  
**No clearance invented.** Owner risk acceptance ≠ `cleared`.

## What Phase 2 implementation delivered

| Package | Outcome |
| --- | --- |
| 2.1–2.2 | Contract, ADRs, `APP_MODE` public-demo vs gated isolation |
| 2.3 | Drizzle/Postgres schema + synthetic seed (ephemeral/local; managed host still blocked) |
| 2.4 | Auth.js invite/challenge lifecycle to `pending_onboarding` (+ synthetic staff fixture; active same-state sign-in allowed) |
| 2.5 | Server-enforced capabilities and role grants |
| 2.6 | Versioned assent with provisional / not-legally-reviewed posture |
| 2.7 | Verification ladder scaffolding (no identity-vendor SDK) |
| 2.8 | Invite-only onboarding; real `active` blocked by counsel gates |
| 2.9 | Append-only institutional audit ledger + public projections |
| 2.10 | Conversation-scoped pseudonyms (registry; no live Pol.is) |
| 2.11 | Export, closure, legal holds, retention job, dual-control, security headers/CSRF |
| 2.12 (impl) | Hardening, handoff, CI, counsel packet, **gated E2E green locally** |

## Checks last run

| Check | Result |
| --- | --- |
| Gated Playwright + account/staff axe | **Pass — 9/9** (2026-08-10 local) |
| Auth lifecycle unit tests (incl. active same-state) | Pass |
| Counsel disposition unit tests | Pass (still blocking readiness tag helper) |
| CI workflow | Added — awaiting first remote green run |
| Counsel readiness gates | **Outstanding** |

## Isolation and non-launch posture

- Public-demo defaults when `APP_MODE` unset; gated secrets fail closed.
- No public signup, recruitment, donation, or live consultation path.
- Role language: “account holder” / “community participant”; no statutory membership claims.
- Assent documents remain provisional while `electronic_assent` is **blocking**.

## Phase 3 / pilot blockers (unresolved)

Phase 3 engineering may start; do not invent answers. See [open-questions.md](./open-questions.md), [legal-questions.md](./legal-questions.md), plan §7.

1. All readiness counsel gates still **blocking** pending counsel return.
2. Real account activation forbidden until activation counsel gates clear/conditionally clear.
3. Managed Postgres host and production email vendors blocked pending addenda.
4. Payments, analytics, AI APIs, live Pol.is, identity-verification SDKs forbidden until register approval.
5. Production backup/PITR after host approval (PGlite drill insufficient).
6. Penetration test / formal security review before pilot.
7. Docker Desktop + WSL2 preferred for compose-based gated runs on this machine.

## Tagging rule (foundation tag **not** created)

Create a Phase 2 foundation tag **only after all** of the following:

1. Gated E2E green (satisfied locally 2026-08-10; reconfirm on the tag commit).
2. Counsel dispositions for readiness gates recorded as `cleared` or `conditionally_cleared` (with scope/conditions) in plan §7 and `dispositions.ts`, such that `readinessCounselAllowsFoundationTag()` is true.
3. Human approval that remaining items are Phase 3 / pilot blockers.
4. Explicit move of 2.12 status from readiness-blocked to complete in [phase-2-plan.md](./phase-2-plan.md).

Suggested tag name when approved: `phase-2-foundation`.

## Commands

```bash
npm ci
npm run lint
npm run typecheck
npm test
npm run build
npm run security:check
npm run backup:smoke
npx playwright install --with-deps
npx playwright test
# Prefer Docker Compose when the engine is healthy:
npm run test:e2e:gated
# Local Postgres fallback (this readiness run):
# DATABASE_URL=postgres://ostt:ostt@127.0.0.1:5432/ostt_dev APP_MODE=gated \
#   AUTH_SECRET=ostt-synth-auth-secret-e2e-not-production AUTH_E2E_CAPTURE=1 \
#   node scripts/gated-e2e-prepare.mjs && npm run build && \
#   npx playwright test -c playwright.gated.config.ts
```

## Related docs

- [phase-2-plan.md](./phase-2-plan.md)
- [counsel-review-packet-2.12.md](./counsel-review-packet-2.12.md)
- [phase-1-handoff.md](./phase-1-handoff.md)
- [secrets-and-operations.md](./secrets-and-operations.md)
- [incident-response.md](./incident-response.md)
- [data-map.md](./data-map.md)
- [threat-model.md](./threat-model.md)
