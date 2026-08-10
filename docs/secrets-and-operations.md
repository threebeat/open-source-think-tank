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
| Restore test | Required in 2.11; restore to isolated instance and run smoke tests |
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

Live Pol.is, payments, analytics, and AI APIs remain **forbidden** in Phase 2.
