# Phase 2 handoff

**Status:** Phase 2 foundation readiness authorized for the **alpha-test** window. Interim council dispositions recorded ([ADR 0007](./decisions/0007-alpha-test-interim-council-dispositions.md)); local Docker Compose PG16 gated E2E green. Tag: `phase-2-foundation` (see Tagging below). **Post-merge 2.12 readiness addendum** after 2.11 privacy hardening is recorded below; the annotated foundation tag was **not** moved.

Engineering packages **2.1–2.12** are in place. Alpha-test data must remain **resettable**; lasting open questions ship in the post-alpha report (product + report retained; no user/topic carry-over).

**Baseline:** Phase 1 tag [`phase-1-demonstration`](https://github.com/threebeat/open-source-think-tank/releases/tag/phase-1-demonstration) at `33ff0cc`.  
**Plan:** [phase-2-plan.md](./phase-2-plan.md).  
**Counsel packet:** [counsel-review-packet-2.12.md](./counsel-review-packet-2.12.md).  
**Interim council dispositions:** [ADR 0007](./decisions/0007-alpha-test-interim-council-dispositions.md).  
**Two-lane sequencing:** [ADR 0006](./decisions/0006-phase-3-two-lane-sequencing.md).

## Two-lane rule (project-owner scope)

| Lane | Posture |
| --- | --- |
| **A — Phase 3 synthetic / closed engineering** | May proceed under existing permits and alpha-test counsel scopes. |
| **B — Phase 2 readiness / foundation tag / alpha-test activation** | Counsel readiness gates **cleared** (alpha-test scopes); foundation tag authorized. Real `active` accounts allowed when engineering onboarding gates also pass. |

## Readiness blockers (Lane B)

| Blocker | Status | Required evidence |
| --- | --- | --- |
| Application-level gated E2E (account/staff axe, mobile account flows) | Covered by Docker Compose PG16 run below | Green gated suite on the SHA below |
| Docker Compose PostgreSQL **16** (`npm run test:e2e:gated`) | **Cleared locally** 2026-08-10 — see evidence log | Green compose-based run (also reconfirm via CI `e2e-gated`) |
| CI on GitHub Actions | **Cleared** — run [31463889998](https://github.com/threebeat/open-source-think-tank/actions/runs/31463889998) | Green `unit` + `e2e-public` + `e2e-gated` |
| Counsel dispositions | **Cleared** (alpha-test interim council) | §7 + `dispositions.ts`; `readinessCounselAllowsFoundationTag() === true` |
| Manual NVDA spot-check (account/staff) | **Pending** (non-blocking for interim council tag authorization) | Notes in evidence table |
| Managed Postgres / production email | Blocked pending vendor addenda | Permitted-services register |
| Foundation release tag | **Authorized** — create/update `phase-2-foundation` on the disposition commit | Human + interim council authorization 2026-08-10 |

## Evidence log (fill on tag candidate)

| Field | Value |
| --- | --- |
| Candidate commit SHA (Docker PG16 suite) | `7f3fd53caac421ebe2b8737a5d6e1f703b84dee7` |
| Disposition / tag commit SHA | `eef9166dfd4d170ab55abe1f5811f0f4085e8f65` (`phase-2-foundation`) |
| Docker / Compose | Client+Engine **29.7.2** (Docker Desktop 4.86.0); Compose **v5.3.1**; context `desktop-linux` |
| Command | `npm run test:e2e:gated` (`db:up` with compose `--wait` → `gated-e2e-prepare.mjs` → `npm run build` → `playwright test -c playwright.gated.config.ts`) |
| PostgreSQL image / version | Image **`postgres:16-alpine`** (`sha256:57c72fd2a128…`); server reports **`postgres (PostgreSQL) 16.14`** on Alpine 3.24; host port **54329→5432**; container healthy |
| Date / host | 2026-08-10 (local Windows, Docker Desktop + WSL2) |
| Test count / result | **9 passed / 0 failed** (16.6s, 1 worker) — Pass |
| Specs covered | `a11y.gated.spec.ts`, `auth-lifecycle.gated.spec.ts`, `onboarding.gated.spec.ts` (incl. phone account flows + staff narrow viewport) |
| GitHub Actions run URL | https://github.com/threebeat/open-source-think-tank/actions/runs/31463889998 |
| Manual NVDA result | _pending_ |
| Counsel §7 readiness gates | **cleared** (alpha-test scopes) — [ADR 0007](./decisions/0007-alpha-test-interim-council-dispositions.md) |

### Prior application-level gated note (historical)

Earlier the same day, with Docker Desktop engine unavailable (WSL missing), the gated Playwright suite was also executed against a local PostgreSQL **17** host service. That was **application-level only** and is superseded for Docker/PG16 evidence by the Compose run above.

## Post-merge 2.12 readiness addendum (after 2.11)

Closes the readiness delta created when PR #12 (`a4ed112`) landed after the original foundation tag. Does **not** reopen counsel dispositions. Does **not** move or rewrite `phase-2-foundation` → `eef9166`.

| Field | Value |
| --- | --- |
| Post-tag 2.11 hardening baseline | `a4ed112016c4b5a402ee0ada6a043387c97b4999` (merged PR #12) |
| Main-branch CI on 2.11 merge | [31567948650](https://github.com/threebeat/open-source-think-tank/actions/runs/31567948650) — **success** |
| Original immutable foundation tag | `phase-2-foundation` → `eef9166dfd4d170ab55abe1f5811f0f4085e8f65` (**unchanged**) |
| Addendum candidate SHA | `004633444f24d134711939969a21d80a26a3c037` (PR #13) |
| Local gated revalidation | PostgreSQL **16.14** (Ubuntu package; Docker Compose overlay unavailable in agent host); `gated-e2e-prepare` + gated Playwright — **34 passed / 0 failed** (incl. new `privacy.gated.spec.ts`) |
| Privacy / axe coverage added | Stateful export + closure journey; axe on initial / error / receipt; 390×844 overflow + keyboard; CSRF `no-store`; `privacy_request` mutation family |
| Public-demo revalidation | `APP_MODE=public-demo` build + Playwright — **53 passed / 0 failed** |
| Unit / lint / typecheck / security / backup | Green on addendum SHA (368 unit tests passed) |
| Recommended patch tag (not created) | `phase-2-foundation-2.12.1` — **stop for human authorization** before any tag create |
| Manual NVDA spot-check | Still **pending** |
| Remaining operator / policy items | Managed Postgres host + production email (blocked); distributed mutation limiter (OQ14); production PITR; penetration test; post-alpha lasting questions |

### Addendum verification ladder (commands run)

```bash
npm ci
npm run lint          # 0 errors (pre-existing adapter unused-arg warnings only)
npm run typecheck     # pass
npm test              # 368 passed / 1 skipped
npm run security:check
npm run backup:smoke
APP_MODE=public-demo npm run build
APP_MODE=public-demo npx playwright test   # 53 passed
# Gated (PG16): prepare + build + playwright.gated.config.ts  # 34 passed
```

## Counsel review record

| Topic | Gate id | Disposition status | Source |
| --- | --- | --- | --- |
| Data map and retention schedule | `data_map_retention` | cleared | [ADR 0007](./decisions/0007-alpha-test-interim-council-dispositions.md) |
| Electronic assent documents | `electronic_assent` | cleared | same |
| Account-holder vs statutory-member terminology | `statutory_membership` | cleared (prefer **delegate**; “member” OK with continual test-purpose communication) | same |
| Eligibility and geographic assertions | `eligibility_geography` | cleared (no geo requirements until alpha test ends) | same |
| Council and board authority | `account_council_authority` | cleared | same |
| Separation of verification and political-opinion data | `political_opinion_verification` | cleared | same |
| Formation / fiscal sponsorship (readiness framing) | `formation_fiscal` | cleared | same |

Full provenance: [phase-2-plan.md](./phase-2-plan.md) §7 and `src/lib/counsel/dispositions.ts`.  
Interim council = project owner acting as council until alpha test; formal council/board forms during the test. Privileged counsel material must not be committed.

## What Phase 2 implementation delivered

| Package | Outcome |
| --- | --- |
| 2.1–2.2 | Contract, ADRs, `APP_MODE` public-demo vs gated isolation |
| 2.3 | Drizzle/Postgres schema + synthetic seed (ephemeral/local; managed host still blocked) |
| 2.4–2.8 | Auth, roles, assent, verification, invite-only onboarding (real `active` allowed under alpha-test counsel scopes) |
| 2.9–2.11 | Audit ledger, pseudonyms, privacy/ops controls |
| 2.12 | Hardening, handoff, CI, counsel packet, interim council dispositions, foundation tag |
| 2.12 post-merge addendum | Closure mutation gate + CSRF `no-store` + public-error sanitization; gated privacy E2E; handoff provenance after `a4ed112` (tag unchanged) |

## Isolation and alpha-test posture

- Public-demo defaults when `APP_MODE` unset; gated secrets fail closed.
- No public signup, recruitment, donation, or live consultation path.
- Preferred account synonym for the alpha test: **delegate** (member language OK only with clear continual test-purpose communication).
- Assent documents may be used for alpha-test invite-only accounts under the electronic_assent clearance; findings may inform later auth.
- Alpha-test participant and topic data must be **fully resettable**; retained outputs are the product and the post-alpha report.

## Phase 3 / pilot blockers (remaining)

See [open-questions.md](./open-questions.md) (incl. OQ16–OQ17), [legal-questions.md](./legal-questions.md), plan §7 scopes.

1. Post-alpha report must capture lasting open questions and decisions (OQ17).
2. Manual NVDA spot-check still pending.
3. Managed Postgres host and production email vendors blocked pending addenda.
4. Payments, analytics, AI APIs, live Pol.is, identity-verification SDKs forbidden until register approval.
5. Production backup/PITR after host approval (PGlite drill insufficient).
6. Penetration test / formal security review before a later pilot.
7. Phase 3 operational runtime not started — see [phase-3-plan.md](./phase-3-plan.md) (package 3.1 contract only).

## Tagging rule

Create/update `phase-2-foundation` after interim council dispositions allow `readinessCounselAllowsFoundationTag()`, gated E2E evidence is recorded, and a human explicitly authorizes the tag (authorized 2026-08-10).

**Post-merge addendum:** do **not** move, delete, or force-update `phase-2-foundation`. If a new release marker is wanted after this addendum merges and CI is green, create a **new** immutable patch tag (recommended: `phase-2-foundation-2.12.1`) only after explicit human authorization.

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
- [decisions/0007-alpha-test-interim-council-dispositions.md](./decisions/0007-alpha-test-interim-council-dispositions.md)
- [phase-3-plan.md](./phase-3-plan.md)
- [architecture-phase-3.md](./architecture-phase-3.md)
- [decisions/0008-phase-3-operational-alpha-contract.md](./decisions/0008-phase-3-operational-alpha-contract.md)
- [phase-1-handoff.md](./phase-1-handoff.md)
- [secrets-and-operations.md](./secrets-and-operations.md)
- [incident-response.md](./incident-response.md)
- [data-map.md](./data-map.md)
- [threat-model.md](./threat-model.md)
