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

**Status:** Implemented. Command: `npm run operator:bootstrap`.

### Required environment

| Variable | Notes |
| --- | --- |
| `APP_MODE=gated` | Public-demo fails before DB construction |
| `DATABASE_URL` | Local/ephemeral Postgres only until host addendum |
| `OPERATOR_BOOTSTRAP_SECRET` | ≥32 characters; **never** pass on CLI argv |
| `OPERATOR_LABEL` | Non-secret label stored in audit / verification provenance |

### Commands

```bash
# 1) Issue bootstrap invitation (zero administrators required)
npm run operator:bootstrap -- issue --contact=you@example.test --reason="Owner-run alpha first admin"

# One-time stdout includes invitationId, expiresAt, and the acceptance link.
# Copy the link now — it is not recoverable.

# 2) Candidate: open link → accept → contact verify → assent → submit
#    verification assertions for bot_resistance, contact_continuity, uniqueness, eligibility

# 3) Finalize (operator_bootstrap decisions + activate + grant administrator)
npm run operator:bootstrap -- finalize --reason="Complete first administrator" --verification-reason="Owner-run alpha operator_bootstrap attestation"
```

### Safe delivery

- Deliver the acceptance link out of band (email remains capture-only).
- Do not paste raw links or `OPERATOR_BOOTSTRAP_SECRET` into CI logs, shell history that is shared, screenshots, or support tickets.
- Leaving the CLI session does not re-print the link.

### Retry / recovery

- While bootstrap is `invitation_live` and not completed, `issue` may revoke the prior pending bootstrap invitation and reissue (audited).
- After `completed`, both `issue` and `finalize` refuse until the alpha datastore is deliberately reset (truncates include `operator_bootstrap_state`).
- Concurrent finalize attempts: singleton row `FOR UPDATE` + re-check zero admins; one winner.

### Verify completion without secrets

- Audit action `operator.bootstrap_administrator` present for the account id.
- Exactly one non-revoked `administrator` role assignment.
- Verification cases for the candidate show `decision_source = operator_bootstrap` and null `reviewer_account_id`.
- No council appointment created by bootstrap.

### Reset implications

Alpha reset (3.12) must clear `operator_bootstrap_state` and bootstrap invitations with other alpha tables. Synthetic seed re-inserts `operator_bootstrap_state` as `not_started`.
