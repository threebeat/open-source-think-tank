# Secrets, environments, backup, and vendor operations

**Status:** Phase 2 Work Package 2.2 policy  
**Related:** [phase-2-plan.md](./phase-2-plan.md), [decisions/0002-environments-and-demo-isolation.md](./decisions/0002-environments-and-demo-isolation.md)

This is an engineering policy, not a privacy policy or DPA.

## Environment variables

| Variable class | public-demo | gated (dev/test/staging/production) |
| --- | --- | --- |
| `APP_MODE` | `public-demo` | `gated` |
| `DATABASE_URL` | **must be unset** | required |
| Auth secrets (`AUTH_SECRET`, etc.) | **must be unset** | required |
| Email provider keys | unset | required in staging/production; optional local stub |
| Verification vendor keys | unset | only if a vendor is later approved |
| `OPERATOR_BOOTSTRAP_SECRET` | **must be unset** | required only for first-administrator operator ceremony (3.3); never pass on CLI argv |
| `OPERATOR_LABEL` | unset | non-secret operator label recorded in bootstrap audit (3.3) |

Rules:

1. Never commit `.env` files with secrets. Use `.env.example` with empty placeholders only.
2. No secret or database credential may be prefixed with `NEXT_PUBLIC_`.
3. Public-demo CI and production demo deploys must fail if gated secrets are detected.
4. Rotate `AUTH_SECRET` and DB credentials on staff offboarding or suspected exposure.

## Secrets management

- **Local:** developer-managed `.env.local` (gitignored).
- **CI:** repository secrets / OIDC to ephemeral test DB.
- **Staging / production:** host secret manager or platform env vault; least privilege DB roles (migrator vs app runtime).
- Browser bundles and client logs must never receive privileged credentials, recovery tokens, or raw invite tokens after first use.

## Backup, restore, migration, rollback

| Concern | Approach |
| --- | --- |
| Migrations | Drizzle Kit forward migrations in git; apply in deploy pipeline before app start |
| Rollback | Prefer forward-fix migration; for catastrophic failure restore DB from backup to a documented PITR/snapshot |
| Backups | Staging nightly; production continuous or frequent PITR (host-specific)—documented per environment in ops runbook during 2.11 |
| Restore test | `npx tsx scripts/backup-restore-smoke.ts` (ephemeral migrate+seed shape check); host PITR still required before managed production DB |
| Audit / assent immutability | Application roles cannot UPDATE/DELETE; backups retain history for legal-hold (counsel-gated) |

## Vendor processing considerations (for counsel / ops review)

Candidates below are **not** all approved. See permitted-services register in [phase-2-plan.md](./phase-2-plan.md) §4.

| Vendor class | Data expected | Region preference | Retention / deletion | Export | Breach notification |
| --- | --- | --- | --- | --- | --- |
| PostgreSQL + Drizzle (technology) | Local/ephemeral schema only in 2.3 | Developer machine / CI | Synthetic seeds only | n/a locally | n/a |
| Managed PostgreSQL host | **Blocked — TBD** until vendor addendum | staging/production not authorized | — | — | Host SLA, region, retention, export, breach terms required before approval |
| Auth.js | Session tokens, email for magic link | App-server local; email via CaptureEmailAdapter until vendor addendum | Sessions revocable; short-lived magic links; in-process rate limits only | Account export (2.11) | Internal IR |
| Transactional email (TBD) | Email address, invite/magic-link content | Provider region in DPA | Provider logs minimized; no verification artifacts in email body | Provider tools / support export | Provider DPA + IR |
| Verification vendor | None selected in 2.2 | — | Prefer no raw artifact storage | — | — |

Live Pol.is, payments, analytics, and AI APIs remain **forbidden** in Phase 2. **Pol.is-powered Public Input** remains planned for Phase 4 of the alpha and is not installed or called in Phase 3.

## First-administrator bootstrap (Package 3.3)

**Status:** Contract for implementation in 3.3. Exact CLI flags and tested runbook land with the bootstrap checkpoints.

Ceremony summary:

1. `APP_MODE=gated` with `DATABASE_URL`, `OPERATOR_BOOTSTRAP_SECRET`, and `OPERATOR_LABEL` set (secret never as a command-line argument).
2. Operator issues one administrator-bootstrap invitation while zero administrators exist; only the token hash is stored; the raw acceptance link is printed once for out-of-band delivery (email remains capture-only).
3. Candidate accepts via the existing invite path, completes contact verification and applicable assent.
4. Operator finalizes: required verification floor may be recorded as structurally tagged `operator_bootstrap` decisions (not independent reviewer decisions); activation uses existing gates; `administrator` is granted with reason; no council seat is granted by bootstrap.
5. A database singleton/lock prevents two concurrent first-administrator completions. After completion, bootstrap issue/finalize refuse until deliberate alpha datastore reset.
6. Ordinary later administrators use authenticated `roles.grant_platform`. Ordinary invitations use `invites.issue`.

**Warnings:** Shell history, CI logs, screenshots, and support tickets must never contain raw invite links or operator secrets. Public-demo must fail before constructing the database if bootstrap is invoked.
