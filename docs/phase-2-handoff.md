# Phase 2 handoff

**Status:** Implementation complete; readiness blocked (counsel + Docker/PG16 CI confirmation on tag candidate). **Phase 2 is not complete.**

Engineering packages **2.1–2.12 implementation** are in place. **Do not tag** a foundation release and **do not** treat this handoff as Phase 2 done until Lane B blockers below clear.

**Baseline:** Phase 1 tag [`phase-1-demonstration`](https://github.com/threebeat/open-source-think-tank/releases/tag/phase-1-demonstration) at `33ff0cc`.  
**Plan:** [phase-2-plan.md](./phase-2-plan.md).  
**Counsel packet:** [counsel-review-packet-2.12.md](./counsel-review-packet-2.12.md).  
**Two-lane sequencing (owner scope, not counsel):** [ADR 0006](./decisions/0006-phase-3-two-lane-sequencing.md).

## Two-lane rule (project-owner scope)

| Lane | Posture |
| --- | --- |
| **A — Phase 3 synthetic / closed engineering** | May proceed under existing permits and blocking counsel constraints (confirm ADR 0006). |
| **B — Phase 2 readiness / foundation tag / real activation** | **Blocked** until counsel dispositions and Docker Compose PG16 CI (and remaining readiness evidence) clear. |

This is **not** counsel clearance of §7 gates and does **not** authorize real participant data.

## Readiness blockers (Lane B)

| Blocker | Status | Required evidence |
| --- | --- | --- |
| Application-level gated E2E (account/staff axe, mobile account flows) | Prior local pass recorded; **reconfirm on committed candidate SHA** | Green gated suite on the SHA below |
| Docker Compose PostgreSQL **16** (`docker compose` / `npm run test:e2e:gated`) | **Not confirmed** on this machine’s Docker engine (WSL/engine issues historically) | Green compose-based run or CI `e2e-gated` |
| CI on GitHub Actions | Workflow present; **run URL pending** on candidate SHA | Green `unit` + `e2e-public` + `e2e-gated` |
| Counsel dispositions | Packet issued; all readiness gates still **blocking** | §7 + `dispositions.ts`; `readinessCounselAllowsFoundationTag() === true` |
| Manual NVDA spot-check (account/staff) | **Pending** | Notes in evidence table |
| Managed Postgres / production email | Blocked pending vendor addenda | Permitted-services register |
| Foundation release tag | **Not created** | Human approval after Lane B clears |

## Evidence log (fill on tag candidate)

| Field | Value |
| --- | --- |
| Candidate commit SHA | Tip of `readiness/2.12-hardening-pass` at push time (see PR); reconfirm after merge to `main` |
| Application-level gated E2E | Prior: 2026-08-10 local run against **PostgreSQL 17** host service — **application-level gated E2E only**; **not** validation of Docker Compose or PostgreSQL 16 |
| Docker Compose PG16 result | _pending_ |
| GitHub Actions run URL | _pending_ |
| Manual NVDA result | _pending_ |
| Counsel §7 readiness gates | All **blocking** — [counsel-review-packet-2.12.md](./counsel-review-packet-2.12.md) |

### Prior application-level gated note (historical)

On 2026-08-10, with Docker Desktop engine unavailable (WSL missing), the gated Playwright suite was executed against a local PostgreSQL **17** instance on `127.0.0.1:5432` (`ostt_dev` / `ostt`). Result at that time: **9 passed**. That run validates **application behavior** under a gated `APP_MODE` + migrated/seeded foundation DB. It does **not** substitute for Docker Compose PostgreSQL **16** or CI `e2e-gated` on the committed candidate SHA.

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

Full provenance: [phase-2-plan.md](./phase-2-plan.md) §7 and `src/lib/counsel/dispositions.ts`.  
**No clearance invented.** Owner risk acceptance ≠ `cleared`. Privileged counsel material must not be committed (see packet confidentiality warning).

## What Phase 2 implementation delivered

| Package | Outcome |
| --- | --- |
| 2.1–2.2 | Contract, ADRs, `APP_MODE` public-demo vs gated isolation |
| 2.3 | Drizzle/Postgres schema + synthetic seed (ephemeral/local; managed host still blocked) |
| 2.4–2.8 | Auth, roles, assent, verification, invite-only onboarding (real `active` counsel-gated) |
| 2.9–2.11 | Audit ledger, pseudonyms, privacy/ops controls |
| 2.12 (impl) | Hardening, handoff, CI, counsel packet; readiness tag open |

## Isolation and non-launch posture

- Public-demo defaults when `APP_MODE` unset; gated secrets fail closed.
- No public signup, recruitment, donation, or live consultation path.
- Role language: “account holder” / “community participant”; no statutory membership claims.
- Assent documents remain provisional while `electronic_assent` is **blocking**.

## Phase 3 / pilot blockers (Lane B / pilot)

See [open-questions.md](./open-questions.md) (incl. OQ16), [legal-questions.md](./legal-questions.md), plan §7.

1. Readiness counsel gates still **blocking**.
2. Real account activation forbidden until activation counsel gates clear/conditionally clear.
3. Docker Compose PG16 + CI green on the tag candidate still required for Lane B.
4. Managed Postgres host and production email vendors blocked pending addenda.
5. Payments, analytics, AI APIs, live Pol.is, identity-verification SDKs forbidden until register approval.
6. Production backup/PITR after host approval (PGlite drill insufficient).
7. Penetration test / formal security review before pilot.

## Tagging rule (foundation tag **not** created)

Create `phase-2-foundation` **only after** evidence log is filled, counsel readiness gates allow `readinessCounselAllowsFoundationTag()`, and a human explicitly completes 2.12.

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
# Docker Compose PG16 (preferred for Lane B evidence):
npm run db:up          # waits for health (--wait or wait-for-postgres)
npm run test:e2e:gated
npm run db:down        # cleanup when finished
```

## Related docs

- [phase-2-plan.md](./phase-2-plan.md)
- [counsel-review-packet-2.12.md](./counsel-review-packet-2.12.md)
- [decisions/0006-phase-3-two-lane-sequencing.md](./decisions/0006-phase-3-two-lane-sequencing.md)
- [phase-1-handoff.md](./phase-1-handoff.md)
- [secrets-and-operations.md](./secrets-and-operations.md)
- [incident-response.md](./incident-response.md)
- [data-map.md](./data-map.md)
- [threat-model.md](./threat-model.md)
