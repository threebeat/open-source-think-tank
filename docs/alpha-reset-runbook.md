# Alpha reset runbook (Phase 3.12)

**Audience:** Environment operators of a **gated** invite-only alpha.  
**Not** a browser feature. **Not** public-demo. **Not** counsel-approved production retention.

Full table classification: [alpha-reset-classification.md](./alpha-reset-classification.md).

---

## Safety (read first)

1. Confirm `APP_MODE=gated`.
2. Confirm `DATABASE_URL` points at the **intended** alpha database (print fingerprint; never paste passwords).
3. Prefer dry-run. Execution requires `--execute` and an exact fingerprint confirmation.
4. Automated CI/smoke uses disposable database `ostt_alpha_reset` only. Do **not** point smoke at `ostt_dev` or any shared/remote production-like host.
5. Never commit dumps, credentials, or reset stdout containing alpha PII.
6. Never fetch remote source URLs during reset.
7. Never copy live data into public-demo fixtures, prompts, screenshots, or handoff prose.

---

## Environment (placeholders only)

```bash
export APP_MODE=gated
# Prefer a secret manager / env vault. Example shape only — never commit credentials:
export DATABASE_URL="postgres://USER@HOST:5432/DBNAME"
export OPERATOR_RESET_SECRET="…at-least-32-characters…"
export OPERATOR_LABEL="operator-label"
# Optional for receipt:
export SOURCE_COMMIT_SHA="$(git rev-parse HEAD)"
```

`OPERATOR_RESET_SECRET` is distinct from `OPERATOR_BOOTSTRAP_SECRET`.

---

## Dry-run (default)

```bash
npm run operator:reset-alpha -- --reason "Scheduled alpha wipe rehearsal"
```

Inspect the printed **database fingerprint** and coarse pre-counts. No rows should change.

---

## Execute (destructive)

```bash
npm run operator:reset-alpha -- \
  --execute \
  --confirm-fingerprint=PASTE_FINGERPRINT_HERE \
  --reason "Owner-approved alpha wipe after drill"
```

On success, the audit ledger contains `alpha.reset_executed` with metadata-only payload (operator label, fingerprint, schema/migration version, commit SHA, coarse family counts, manifest version/hash). No account IDs, contacts, bodies, URLs, or private notes.

---

## After reset

1. Confirm accounts/topics/claims/evidence are empty.
2. Re-run first-administrator bootstrap if needed: `npm run operator:bootstrap`.
3. Reseed synthetic fixtures only in disposable/local drills: `npm run db:seed` (gated env).
4. Verify audit ledger continuity for the reset receipt.

---

## Disposable smoke (CI / local)

```bash
npm run db:up
npm run alpha:reset:smoke
```

Creates/migrates `ostt_alpha_reset` on the Docker Postgres instance, seeds synthetic data, dry-runs, executes, verifies emptiness + receipt, second reset safety, and reseed — without touching `ostt_dev`.
