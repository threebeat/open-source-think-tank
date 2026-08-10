# Phase 2 handoff

**Status:** Closed-environment readiness review complete for packages 2.1–2.12 engineering criteria. **Not** a public launch, production community platform, or counsel-cleared activation. Do **not** tag a foundation release until a human explicitly approves after reviewing remaining blockers below.

**Baseline:** Phase 1 tag [`phase-1-demonstration`](https://github.com/threebeat/open-source-think-tank/releases/tag/phase-1-demonstration) at `33ff0cc`.  
**Plan:** [phase-2-plan.md](./phase-2-plan.md).

## What Phase 2 delivered

| Package | Outcome |
| --- | --- |
| 2.1–2.2 | Contract, ADRs, `APP_MODE` public-demo vs gated isolation |
| 2.3 | Drizzle/Postgres schema + synthetic seed (ephemeral/local; managed host still blocked) |
| 2.4 | Auth.js invite/challenge lifecycle to `pending_onboarding` only |
| 2.5 | Server-enforced capabilities and role grants |
| 2.6 | Versioned assent with provisional / not-legally-reviewed posture |
| 2.7 | Verification ladder scaffolding (no identity-vendor SDK) |
| 2.8 | Invite-only onboarding; real `active` blocked by counsel gates |
| 2.9 | Append-only institutional audit ledger + public projections |
| 2.10 | Conversation-scoped pseudonyms (registry; no live Pol.is) |
| 2.11 | Export, closure, legal holds, retention job, dual-control scaffolding, security headers/CSRF |
| 2.12 | Closed readiness review, hardening of dual-control/privacy atomicity, handoff |

## Hardening completed in this readiness pass

- **Dual control is enforced, not advisory.** `releaseLegalHold` and `executeAccountClosure` lock an approved, unexpired request, require exact action + payload match, mark it `executed` in the same transaction as the mutation, and reject bypass / replay / payload substitution. Concurrent approvers: exactly one wins.
- **Privacy mutations are transactional with audits.** Closure request, hold place/release, retention purges, and related audits share one transaction; hold checks for closure/purge run under subject advisory locks so hold placement cannot race past the check.
- **Ephemeral PGlite recovery drill** (`npm run backup:smoke`) dumps unique post-seed data via `dumpDataDir` / `loadDataDir` and verifies row contents, assent immutability, ledger continuity, schema label, and audit head. **This is not production restore validation** (managed host still blocked).

## Readiness checks run (2026-08-10)

| Check | Result |
| --- | --- |
| `npm run lint` | Pass (existing unused-param warnings in stub adapters) |
| `npm run typecheck` | Pass |
| `npm test` | Pass — 121 tests / 27 files |
| `npm run build` | Pass |
| `npm run security:check` | Pass (npm audit high clean; moderate esbuild via drizzle-kit noted) |
| `npm run backup:smoke` | Pass — ephemeral PGlite recovery drill |
| Public Playwright (`npx playwright test`) | Pass — 46 tests (axe on principal public routes; auth isolation; guided demo on Desktop Chrome, Mobile Safari, Mobile Chrome) |
| Gated Playwright (`npm run test:e2e:gated`) | **Not run** — Docker unavailable on this machine |
| Managed Postgres backup/PITR | **N/A** — host blocked pending vendor addendum |

## Accessibility

- Public principal routes: axe serious/critical clean via `e2e/a11y.spec.ts`.
- Account/staff gated flows: covered by unit/integration tests and gated E2E specs, but **gated browser a11y was not re-executed** here without Docker. Re-run `npm run test:e2e:gated` before any foundation tag.

## Threat-model and data-map review (engineering)

Reviewed against implemented controls; docs updated for dual-control **claim** on hold release/closure and transactional privacy mutations. Residual risks remain in [threat-model.md](./threat-model.md) and [data-map.md](./data-map.md). **Counsel has not cleared** data-map retention, legal bases, or public audit publication depth.

## Isolation and non-launch posture

- Public-demo defaults when `APP_MODE` unset; gated secrets fail closed (`assertEnvironmentSafe`).
- Public demo adapters refuse DB/auth; join preview cannot enroll; no public signup CTA.
- Live consultation participation adapter remains forbidden; no donation/payment paths; no recruitment CTA.
- Role language stays “account holder” / “community participant”; no statutory membership claims.
- Assent documents remain provisional / not legally reviewed while electronic-assent gate is **blocking**.

## Phase 3 / pilot blockers (unresolved)

Do not invent answers; see [open-questions.md](./open-questions.md), [legal-questions.md](./legal-questions.md), and phase-2-plan §7.

1. **Counsel gates still blocking** — statutory membership, formation/fiscal sponsorship, account/council authority, electronic assent, eligibility/geography, political-opinion/verification separation, and related dispositions in `src/lib/counsel/dispositions.ts`.
2. **Real account activation** — must not set non-synthetic accounts to `active` until packages 2.6–2.8 counsel gates clear (or are explicitly provisional with labeled docs).
3. **Managed Postgres host** — blocked pending vendor addendum; local/ephemeral only.
4. **Production email vendor** — blocked pending addendum; synthetic/test email path only.
5. **Still forbidden until register approval** — payments, analytics, AI APIs, live Pol.is, identity-verification SDKs.
6. **Gated E2E on CI/hardware with Docker** — required before tagging a foundation release.
7. **Production backup/restore** — PGlite drill is not a substitute; need host PITR/runbook after addendum.
8. **Penetration test / formal security review** — not an exit criterion completed in 2.12; schedule before pilot.
9. **Public launch, recruitment, donation, live consultation** — out of scope; must remain absent.

## Tagging rule

Tag an approved foundation release **only after**:

1. Human approval of this handoff and phase-2-plan stop conditions.
2. Gated E2E green with Docker.
3. Explicit decision that remaining blockers are accepted as Phase 3 (not silently cleared).

Suggested tag name (when approved): record in git notes / release — do not invent a tag here.

## Commands for the next developer

```bash
npm install
npm run dev
npm run lint
npm run typecheck
npm test
npm run build
npm run security:check
npm run backup:smoke
npx playwright test
# Requires Docker:
npm run test:e2e:gated
```

## Related docs

- [phase-2-plan.md](./phase-2-plan.md)
- [phase-1-handoff.md](./phase-1-handoff.md)
- [secrets-and-operations.md](./secrets-and-operations.md)
- [incident-response.md](./incident-response.md)
- [data-map.md](./data-map.md)
- [threat-model.md](./threat-model.md)
