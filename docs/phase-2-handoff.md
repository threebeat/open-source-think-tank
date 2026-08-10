# Phase 2 handoff

**Status:** Implementation complete; readiness blocked.

Engineering packages **2.1–2.12 implementation** are in place, but **work package 2.12 is not complete** until gated readiness checks and the documented counsel review finish. This is **not** a public launch, production community platform, or counsel-cleared activation. **Do not tag** a foundation release and **do not declare Phase 2 complete** while readiness remains blocked.

**Baseline:** Phase 1 tag [`phase-1-demonstration`](https://github.com/threebeat/open-source-think-tank/releases/tag/phase-1-demonstration) at `33ff0cc`.  
**Plan:** [phase-2-plan.md](./phase-2-plan.md).

## Readiness blockers (must clear before 2.12 complete / tag)

| Blocker | Status | Required evidence |
| --- | --- | --- |
| Gated E2E (Docker + prepared DB) | **Blocked** — Docker unavailable in last readiness attempt | `npm run test:e2e:gated` green, including `e2e/*.gated.spec.ts` |
| Account/staff axe coverage | **Blocked** with gated E2E | `e2e/a11y.gated.spec.ts` plus onboarding gated a11y paths |
| Counsel review of data map + active documents | **Outstanding** | Recorded disposition in phase-2-plan §7 / counsel source link; not owner risk acceptance alone |
| Managed Postgres host / production email | **Blocked** pending vendor addenda | Register + addendum |
| Foundation release tag | **Forbidden** until rows above clear | Human approval after green gated suite |

## What Phase 2 implementation delivered

| Package | Outcome |
| --- | --- |
| 2.1–2.2 | Contract, ADRs, `APP_MODE` public-demo vs gated isolation |
| 2.3 | Drizzle/Postgres schema + synthetic seed (ephemeral/local; managed host still blocked) |
| 2.4 | Auth.js invite/challenge lifecycle to `pending_onboarding` only (plus synthetic staff fixture for gated UI) |
| 2.5 | Server-enforced capabilities and role grants |
| 2.6 | Versioned assent with provisional / not-legally-reviewed posture |
| 2.7 | Verification ladder scaffolding (no identity-vendor SDK) |
| 2.8 | Invite-only onboarding; real `active` blocked by counsel gates |
| 2.9 | Append-only institutional audit ledger + public projections |
| 2.10 | Conversation-scoped pseudonyms (registry; no live Pol.is) |
| 2.11 | Export, closure, legal holds, retention job, dual-control, security headers/CSRF |
| 2.12 (impl) | Hardening + handoff draft; readiness checks still open |

## Hardening notes (post-feedback)

- Dual control is enforced (claim + payload match) for hold release and closure.
- Privacy mutations + audits are transactional; hold vs closure/purge serialized.
- Closure `account_request` binds `deletionRequestId` to `accountId` + executable status; `administrator_initiated` is a distinct workflow without a deletion request id.
- Security logs use opaque `subjectRef` / actor refs, recursive identifier redaction, and emit success only after commit.
- Ephemeral PGlite recovery drill (`npm run backup:smoke`) is **not** production restore validation.

## Checks last run (implementation readiness)

| Check | Result |
| --- | --- |
| `npm run lint` / `typecheck` / `test` / `build` | Expected green after this pass (re-run before approval) |
| `npm run security:check` / `backup:smoke` | Expected green |
| Public Playwright | Previously green (46) |
| Gated Playwright + account/staff axe | **Not complete** — blocked on Docker |
| Counsel data-map / active-document review | **Outstanding** |

## Isolation and non-launch posture

- Public-demo defaults when `APP_MODE` unset; gated secrets fail closed.
- No public signup, recruitment, donation, or live consultation path.
- Role language: “account holder” / “community participant”; no statutory membership claims.
- Assent documents remain provisional while electronic-assent gate is **blocking**.

## Phase 3 / pilot blockers (unresolved)

See [open-questions.md](./open-questions.md), [legal-questions.md](./legal-questions.md), and phase-2-plan §7. Do not invent answers.

1. Counsel gates still blocking (membership, formation, authority, assent, geography, political-opinion separation, …).
2. Real account activation forbidden until gates clear/conditionally clear with labeled docs.
3. Managed Postgres host and production email vendors blocked pending addenda.
4. Payments, analytics, AI APIs, live Pol.is, identity-verification SDKs still forbidden until register approval.
5. Production backup/PITR runbook after host approval (PGlite drill is insufficient).
6. Penetration test / formal security review before pilot.

## Tagging rule

Tag an approved foundation release **only after**:

1. Gated E2E green, including account/staff axe (`a11y.gated.spec.ts` and related gated flows).
2. Documented counsel review of data maps and active documents recorded in phase-2-plan §7.
3. Human approval that remaining items are Phase 3 blockers (not silently cleared).
4. Explicit decision that 2.12 status may move from readiness-blocked to complete.

## Commands

```bash
npm install
npm run lint
npm run typecheck
npm test
npm run build
npm run security:check
npm run backup:smoke
npx playwright test
# Requires Docker — required for 2.12 completion:
npm run test:e2e:gated
```

## Related docs

- [phase-2-plan.md](./phase-2-plan.md)
- [phase-1-handoff.md](./phase-1-handoff.md)
- [secrets-and-operations.md](./secrets-and-operations.md)
- [incident-response.md](./incident-response.md)
- [data-map.md](./data-map.md)
- [threat-model.md](./threat-model.md)
