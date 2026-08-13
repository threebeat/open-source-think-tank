# Phase 3 handoff — operational invite-only alpha

**Status:** **Phase 3 owner-accepted** (`APPROVE PHASE 3 COMPLETE`, 2026-08-13). Phase 4.1 is active under [phase-4-plan.md](./phase-4-plan.md).  
**Reviewed baseline (PR #16 merge on `main`):** `7254cf5e55cb64426f93f3d7685956655af916ec`  
**Prior 3.12 merge (PR #15):** `33874e8a9ea9d3ddc690dc69de4d015861e41fcb`  
**This document is engineering handoff evidence.** It is **not** production-launch approval, penetration-test certification, legal clearance, counsel disposition, real off-device alpha deployment approval, or live Pol.is authorization.

Related: [phase-3-plan.md](./phase-3-plan.md), [architecture-phase-3.md](./architecture-phase-3.md), [alpha-reset-classification.md](./alpha-reset-classification.md), [alpha-reset-runbook.md](./alpha-reset-runbook.md), [capability-matrix.md](./capability-matrix.md), [open-questions.md](./open-questions.md)

---

## 1. Package status (3.1–3.12 + closure corrections)

| Package | Status |
| --- | --- |
| 3.1 / 3.1.1 | Complete |
| 3.2 | Complete |
| 3.3 | Complete |
| 3.4 | Complete |
| 3.5 | Complete |
| 3.6 | Complete |
| 3.7 | Complete |
| 3.8 | Complete |
| 3.9 | Complete |
| 3.10 | Complete |
| 3.11 | Complete (PR #14) |
| 3.12 | Complete (PR #15) |
| Phase 3 closure corrections | Complete (PR #16) — **not** Work Package 3.13 |

**Owner waivers:** none.  
**Owner acceptance:** `APPROVE PHASE 3 COMPLETE` recorded 2026-08-13; Phase 4.1 authorized to start.

---

## 2. Phase 3 §4 journey → evidence map

| Step | Exact evidence |
| --- | --- |
| First-administrator bootstrap | `npm run phase3:acceptance` steps 1–2; `src/lib/operator/bootstrap.ts`; unit `src/lib/operator/bootstrap.test.ts` |
| Invitation issuance / acceptance | `npm run phase3:acceptance` steps 3–4; `npm run test:pg:invites` (`src/lib/invites/issue.pg.test.ts`); gated E2E `e2e/onboarding.gated.spec.ts`, `e2e/auth-lifecycle.gated.spec.ts` |
| Active participant | `npm run phase3:acceptance` step 4; gated helpers/E2E for UI drills |
| Admin creates/opens topic | `npm run phase3:acceptance` step 5; `e2e/topics-authoring.gated.spec.ts` |
| Participant submits claim/evidence + relationship + limitations + disclosure | `npm run phase3:acceptance` step 6; `e2e/submissions.gated.spec.ts`; `src/lib/submissions/submit.test.ts` |
| Reviewer decisions; quality independent of workflow | `npm run phase3:acceptance` step 7; `e2e/review-publish.gated.spec.ts`; `src/lib/claims/review.test.ts`; `src/lib/evidence/review.ts` |
| Moderator visibility without deleting history | `npm run phase3:acceptance` step 8; `e2e/moderation-disclosure.gated.spec.ts`; `src/lib/moderation/moderation.test.ts` |
| Administrator publishes | `npm run phase3:acceptance` step 9; `e2e/review-publish.gated.spec.ts`; `src/lib/topics/publish.test.ts` |
| Anonymous allowlisted projection | `npm run phase3:acceptance` step 10; `e2e/public-interface.gated.spec.ts`; `src/lib/topics/public-projection.test.ts` |
| Revision + audit explain workflow | `npm run phase3:acceptance` step 11; `e2e/revisions-comparison.gated.spec.ts` (no conditional skip) |
| Operator reset removes alpha data + ops config remains | `npm run phase3:acceptance` steps 12–14; `npm run alpha:reset:smoke` (bootstrap **without** `seedSyntheticFoundation`); `npm run test:pg:alpha-reset` |
| Public-demo isolation | `npm run phase3:acceptance` step 15; public-demo Playwright; unit env fail-closed |

**CI job that must pass these proofs:** `Gated Playwright E2E (Docker Postgres)` steps:

- `PostgreSQL invitation concurrency proof`
- `PostgreSQL alpha-reset concurrency proof`
- `Alpha reset smoke (disposable ostt_alpha_reset only)`
- `Phase 3 acceptance journey (disposable ostt_phase3_acceptance)`
- `Run gated E2E (account/staff axe included)`

Database-free unit job (`Lint, typecheck, unit, security, build`) may skip `*.pg.test.ts` when Postgres is unreachable; that skip is **not** closure evidence.

---

## 3. Closure corrections summary

1. **Post-reset recovery** — `document_versions` classified **regenerated** from `src/lib/operator/operational-assent-documents.ts`. Participant assent rows remain wipeable. Smoke proves bootstrap without synthetic reseeding.
2. **Quiesced reset window** — runbook quiescence contract; transaction-scoped advisory lock + allowlisted table locks; counts inside the protected transaction; lock/statement timeouts fail closed; no post-commit unlock that can report `RESET_FAILED` after a successful wipe.
3. **Receipt provenance** — CLI `receiptProvenance=operational` / `synthetic: false`; smoke explicitly `synthetic_smoke` / `synthetic: true`. New audit chain rooted at the receipt (not continuity with erased ledger).
4. **Mandatory PostgreSQL invitation concurrency** — `npm run test:pg:invites` in Docker CI with `OSTT_REQUIRE_POSTGRES=1` against disposable `ostt_invite_concurrency`.
5. **Revision E2E determinism** — `e2e/revisions-comparison.gated.spec.ts` asserts seeded queue + revision claim; conditional `test.skip` removed.
6. **Connected acceptance journey** — `npm run phase3:acceptance` on `ostt_phase3_acceptance`.

### Migrations / dependencies / vendors

- **Migrations:** none
- **New runtime dependencies:** none
- **Not introduced:** Pol.is, managed PostgreSQL host, production email, analytics, AI APIs, payments, remote source fetching, file uploads, Elasticsearch/search vendors

---

## 4. Deferred register (D1–D16) — still deferred

Living table: [architecture-phase-3.md](./architecture-phase-3.md) §11. **None marked complete by this handoff.** D1–D16 remain deferred and are **not** required for Phase 3 engineering closure.

| ID | Item | Status |
| --- | --- | --- |
| D1 | Managed PostgreSQL host + DPA | Deferred |
| D2 | Production email vendor | Deferred |
| D3 | Dual-control for all moderation/publish | Deferred |
| D4 | File uploads / object storage | Deferred |
| D5 | Remote source fetch / preview / malware scan | Deferred |
| D6 | Rich-text authoring deps | Deferred |
| D7 | Full-text search engine vendor | Deferred (3.11/3.12 use SQL ILIKE) |
| D8 | Notifications beyond invite/auth | Deferred |
| D9 | Pol.is Public Input | **Phase 4** — contract/demo in 4.1; live install deferred to 4.2+ |
| D10 | AI APIs, analytics, payments | Forbidden / deferred |
| D11 | Penetration test / formal security review | Deferred |
| D12 | Manual NVDA sign-off on new workspace UI | Deferred |
| D13 | Distributed rate limiting (OQ14) | Deferred |
| D14 | Public attribution model (OQ18) | Deferred |
| D15 | Post-alpha retention vs wipe for assent/audit report copies (OQ19) | Deferred |
| D16 | Participant visibility into others’ in-flight submissions (OQ20) | Deferred |

Relevant open questions remain open in [open-questions.md](./open-questions.md).

---

## 5. Blockers and known limitations

- Real off-device multi-user alpha still needs an **approved** managed PostgreSQL host (D1) and production email (D2).
- In-process rate limiting is single-instance (D13).
- Public attribution and richer moderation chronology remain unresolved (OQ18 / OQ23).
- Alpha reset wipes alpha assent/audit history; post-alpha report retention is OQ19 / D15.
- Manual NVDA pass not claimed (D12).
- Operational assent catalog bodies are provisional placeholders — not counsel-approved legal language.

---

## 6. Phase 4 entry criteria — status

1. Explicit owner acceptance of Phase 3 engineering closure (`APPROVE PHASE 3 COMPLETE`) — **satisfied 2026-08-13**.
2. Explicit owner decision to start Phase 4.1 institutional contract + synthetic demo — **satisfied** (`START PHASE 4.1`). Live Pol.is install still requires a later vendor register addendum (4.2+).
3. Counsel gates for any production-adjacent data processing remain blocking where marked in phase-2-plan §7.
4. Do not treat alpha reset or handoff evidence as production readiness.

---

## 7. Explicit non-claims

- No production launch approval.
- No penetration-test certification.
- No legal/counsel clearance.
- No real off-device alpha deployment approval.
- Live Pol.is install/call remains unauthorized until Phase 4.2+ vendor clearance.
- No managed PostgreSQL / production email / analytics / AI / payments / remote source fetching / file uploads introduced.
- Phase 3 is owner-accepted; see [phase-4-plan.md](./phase-4-plan.md) for active Phase 4 packages.

---

## 8. Local / CI verification (closure candidate)

| Check | Result |
| --- | --- |
| Baseline `origin/main` | `33874e8a9ea9d3ddc690dc69de4d015861e41fcb` |
| Closure PR | https://github.com/threebeat/open-source-think-tank/pull/16 |
| Candidate head | `b04edebdc6c0e0aff6b8916cd319574ad05705e0` (docs evidence commit atop verified `badaba2924c4413bd1978930b12273ca412f6840`) |
| CI run (verified engineering head `badaba2`) | https://github.com/threebeat/open-source-think-tank/actions/runs/31632944572 — unit **428 passed / 5 skipped**; public E2E **53 passed**; gated job steps invite/reset/acceptance/smoke/E2E green |
| Vercel preview (on `badaba2`) | https://vercel.com/johnmoore2048-7946s-projects/open-source-think-tank/9atWmxM8xDe4vigKk3StPDTg9uHq (Deployment has completed) |
| `npm ci` | pass |
| `npm run lint` | pass (16 pre-existing unused-adapter warnings; 0 errors) |
| `npm run typecheck` | pass |
| `npm test` with local Postgres available | **433 passed**, 0 skipped (includes `*.pg.test.ts`) |
| `npm test` database-free equivalent (unit CI job, no Postgres) | **428 passed**, **5 skipped** (`issue.pg.test.ts` ×1 + `alpha-reset.pg.test.ts` ×4) — not unqualified “433/all passed” |
| `npm run test:pg:invites` | **1 passed** (mandatory; disposable `ostt_invite_concurrency`) |
| `npm run test:pg:alpha-reset` | **4 passed** |
| `npm run phase3:acceptance` | pass (steps 1–15) |
| `npm run security:check` | pass (`npm audit` reports 4 moderate esbuild/drizzle-kit transitive findings; high audit gate passed) |
| `npm run backup:smoke` | pass |
| `npm run alpha:reset:smoke` | pass (includes bootstrap recovery without synthetic reseed) |
| `APP_MODE=public-demo npm run build` | pass |
| Public-demo Playwright | **53 passed** |
| Gated production build | pass |
| Gated Playwright | **37 passed** (includes deterministic revisions E2E; no conditional skip) |
| `git diff --check` | pass |
| Migrations | none |
| Dependency/vendor diff vs `33874e8` | scripts/docs/tests + operator reset hardening + db-up/wait fallbacks only; no new runtime deps |
| Real/shared DB reset | **none** — disposable drills only |
| Sensitive dump committed | **none** |
| UI inspection | No new branded marketing UI; revisions E2E covers phone + desktop + axe on affected review/public surfaces |

**CI evidence (must be green on latest head):**

- Job `Lint, typecheck, unit, security, build`
- Job `Gated Playwright E2E (Docker Postgres)` steps: `PostgreSQL invitation concurrency proof`, `PostgreSQL alpha-reset concurrency proof`, `Alpha reset smoke`, `Phase 3 acceptance journey`, gated E2E
- Job `Public Playwright E2E`
- Vercel preview for the PR

**Intentionally deferred manual evidence:** D12 NVDA sign-off; D11 penetration test; real off-device alpha deployment.
