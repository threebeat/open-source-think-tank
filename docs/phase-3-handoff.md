# Phase 3 handoff — operational invite-only alpha

**Status:** **Phase 3 engineering closure candidate; awaiting explicit owner acceptance before Phase 4.**  
**Reviewed baseline (PR #15 / 3.12 merge):** `33874e8a9ea9d3ddc690dc69de4d015861e41fcb`  
**This document is engineering handoff evidence.** It is **not** production-launch approval, penetration-test certification, legal clearance, counsel disposition, real off-device alpha deployment approval, or Phase 4 / Pol.is authorization.

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
| Phase 3 closure corrections | Engineering candidate (this handoff) — **not** Work Package 3.13; **not** Phase 4 |

**Owner waivers:** none.  
**Stop condition:** Human review before Phase 4 (explicit owner acceptance).

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
| D9 | Pol.is Public Input | **Phase 4** — not started |
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

## 6. Recommended Phase 4 entry criteria

1. Explicit owner acceptance of this Phase 3 engineering closure (`APPROVE PHASE 3 COMPLETE`).
2. Explicit owner decision to start Phase 4 **Public Input** packaging (Pol.is) with vendor register addendum — not assumed here.
3. Counsel gates for any production-adjacent data processing remain blocking where marked in phase-2-plan §7.
4. Do not treat alpha reset or handoff evidence as production readiness.

---

## 7. Explicit non-claims

- No production launch approval.
- No penetration-test certification.
- No legal/counsel clearance.
- No real off-device alpha deployment approval.
- No Phase 4 or Pol.is work started or authorized.
- No managed PostgreSQL / production email / analytics / AI / payments / remote source fetching / file uploads introduced.
- Phase 3 is **not** owner-approved in repository prose until the owner replies with `APPROVE PHASE 3 COMPLETE`.

---

## 8. Local / CI verification (closure candidate)

Fill exact counts after the closure PR verification run. Distinguish:

| Check | Result |
| --- | --- |
| Baseline `origin/main` | `33874e8a9ea9d3ddc690dc69de4d015861e41fcb` |
| Candidate head | *(set after push)* |
| Closure PR | *(set after open)* |
| `npm ci` | *(pending)* |
| `npm run lint` | *(pending)* |
| `npm run typecheck` | *(pending)* |
| `npm test` (database-free unit job equivalent) | *(pending — report passed/skipped exactly; do not claim unqualified “all passed” if any skipped)* |
| `npm run test:pg:invites` | *(pending — mandatory PostgreSQL evidence)* |
| `npm run test:pg:alpha-reset` | *(pending)* |
| `npm run phase3:acceptance` | *(pending)* |
| `npm run security:check` | *(pending)* |
| `npm run backup:smoke` | *(pending)* |
| `npm run alpha:reset:smoke` | *(pending)* |
| `APP_MODE=public-demo npm run build` | *(pending)* |
| Public-demo Playwright | *(pending)* |
| Gated production build | *(pending)* |
| Gated Playwright | *(pending)* |
| `git diff --check` | *(pending)* |
| Migrations | none |
| Dependency/vendor diff vs `33874e8` | scripts/docs/tests + operator reset hardening only; no new runtime deps |
| Real/shared DB reset | **none** — disposable drills only |
| Sensitive dump committed | **none** |

**Intentionally deferred manual evidence:** D12 NVDA sign-off; D11 penetration test; real off-device alpha deployment.
