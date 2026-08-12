# Phase 3 handoff — operational invite-only alpha

**Status:** **3.12 complete; Phase 3 handoff awaiting human review before Phase 4.**  
**Verified starting main SHA (3.12 branch base):** `418d6789b8e62a37704aa244fa10e67a5e2438bb` (merge of PR #14 / Work Package 3.11)  
**This document is engineering handoff evidence.** It is **not** production-launch approval, penetration-test certification, legal clearance, or counsel disposition.

Related: [phase-3-plan.md](./phase-3-plan.md), [architecture-phase-3.md](./architecture-phase-3.md), [alpha-reset-classification.md](./alpha-reset-classification.md), [alpha-reset-runbook.md](./alpha-reset-runbook.md), [capability-matrix.md](./capability-matrix.md), [open-questions.md](./open-questions.md)

---

## 1. Package status (3.1–3.12)

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
| 3.12 | Complete (this handoff) — awaiting human review before Phase 4 |

**Owner waivers:** none.

---

## 2. Phase 3 §4 journey → evidence map

| Step | Evidence |
| --- | --- |
| First-administrator bootstrap | `src/lib/operator/bootstrap.ts` + `npm run operator:bootstrap`; unit/integration coverage in operator/bootstrap tests; gated staff-admin seed for UI drills |
| Invitation issuance / acceptance | `e2e/onboarding.gated.spec.ts`, `e2e/auth-lifecycle.gated.spec.ts` |
| Active participant | `activateSyntheticParticipant` in `e2e/gated-helpers.ts`; submissions/search e2e |
| Admin creates/opens topic | `e2e/topics-authoring.gated.spec.ts` |
| Participant submits claim/evidence + relationship + limitations + disclosure | `e2e/submissions.gated.spec.ts`, `e2e/moderation-disclosure.gated.spec.ts`, unit `src/lib/submissions/submit.test.ts` |
| Reviewer decisions; quality independent of workflow | `e2e/review-publish.gated.spec.ts`, `src/lib/claims/review.test.ts`, `src/lib/evidence/review.ts` |
| Moderator visibility without deleting history | `e2e/moderation-disclosure.gated.spec.ts`, `src/lib/moderation/moderation.test.ts` |
| Administrator publishes | `e2e/review-publish.gated.spec.ts`, `src/lib/topics/publish.test.ts` |
| Anonymous allowlisted projection | `e2e/public-interface.gated.spec.ts`, `src/lib/topics/public-projection.test.ts` |
| Revision + audit explain workflow | `e2e/revisions-comparison.gated.spec.ts`, audit registry + append tests |
| Operator reset removes alpha data | `npm run alpha:reset:smoke` (disposable `ostt_alpha_reset` only); `docs/alpha-reset-runbook.md` |

---

## 3. 3.12 deliverables summary

### 3.11 carryovers closed
- Bounded SQL count + `LIMIT`/`OFFSET` search (page ≤100, pageSize ≤50); Previous/Next + accessible range.
- Admission-class href selection (owner drafts → owner surfaces even for multi-role principals); class never in DTOs.
- Sanitized thrown failures: `WORKSPACE_SEARCH_UNAVAILABLE`, `ACCOUNT_EXPORT_UNAVAILABLE`, `STAFF_EXPORT_UNAVAILABLE`; account export dynamically imported only after gated mode check.

### Alpha reset
- Classification: [alpha-reset-classification.md](./alpha-reset-classification.md) + `src/lib/operator/alpha-reset-manifest.ts`
- CLI: `npm run operator:reset-alpha` (dry-run default; `--execute` + fingerprint)
- Smoke: `npm run alpha:reset:smoke` against disposable `ostt_alpha_reset` only — **never** a live/shared/remote DB; **never** `ostt_dev` unless `OSTT_ALLOW_DEV_RESET=1` (not used in CI)
- Audit: `alpha.reset_executed` (metadata/counts only)

### Migrations
**none** (forward-only not required).

---

## 4. Dependency / vendor review

Compared to baseline `418d678`:
- **No new runtime dependencies** intended for reset (uses existing `postgres` / Drizzle / `tsx`).
- **Not introduced:** Pol.is, managed PostgreSQL host, production email, analytics, AI APIs, payments, remote source fetching, file uploads, Elasticsearch/search vendors.

---

## 5. Deferred register (D1–D16) — still deferred

Living table: [architecture-phase-3.md](./architecture-phase-3.md) §11. **None marked complete by this handoff.**

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

Relevant open questions remain open in [open-questions.md](./open-questions.md) (including post-alpha report inputs/retention).

---

## 6. Blockers and known limitations

- Real off-device multi-user alpha still needs an **approved** managed PostgreSQL host (D1) and production email (D2).
- In-process rate limiting is single-instance (D13).
- Public attribution and richer moderation chronology remain unresolved (OQ18 / OQ23).
- Alpha reset wipes alpha assent/audit history; post-alpha report retention is OQ19 / D15.
- Manual NVDA pass not claimed (D12).

---

## 7. Recommended Phase 4 entry criteria

1. Human acceptance of this Phase 3 handoff.
2. Explicit owner decision to start Phase 4 **Public Input** packaging (Pol.is) with vendor register addendum — not assumed here.
3. Counsel gates for any production-adjacent data processing remain blocking where marked in phase-2-plan §7.
4. Do not treat alpha reset or handoff evidence as production readiness.

---

## 8. Explicit non-claims

- Pol.is, managed PostgreSQL, production email, analytics, AI, payments, remote source fetching, and file uploads were **not** introduced in Phase 3.
- Phase 3 handoff evidence is **not** production-launch approval, penetration-test certification, or legal clearance.

---

## 9. Local verification (3.12 branch)

| Check | Result |
| --- | --- |
| Verified baseline `origin/main` | `418d6789b8e62a37704aa244fa10e67a5e2438bb` |
| `npm run lint` | pass (warnings only, pre-existing unused adapters) |
| `npm run typecheck` | pass |
| `npm test` | 426 passed |
| `npm run security:check` | pass |
| `npm run backup:smoke` | pass |
| `npm run alpha:reset:smoke` | pass (`ostt_alpha_reset` only) |
| `APP_MODE=public-demo npm run build` | pass |
| `APP_MODE=public-demo npx playwright test` | 53 passed |
| `npm run test:e2e:gated` | 37 passed |
| Migrations | none |
| Dependency/vendor diff vs baseline | scripts only (`operator:reset-alpha`, `alpha:reset:smoke`); no new runtime deps |
| Real/shared DB reset | **none** — disposable drill only |
| Sensitive dump committed | **none** |

**PR URL / candidate head / CI / Vercel / post-merge:** recorded in the PR conversation after open/merge.
