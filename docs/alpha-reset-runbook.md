# Alpha reset runbook (Phase 3 closure)

**Audience:** Environment operators of a **gated** invite-only alpha.  
**Not** a browser feature. **Not** public-demo. **Not** counsel-approved production retention.

Full table classification: [alpha-reset-classification.md](./alpha-reset-classification.md).

---

## Safety (read first)

1. Confirm `APP_MODE=gated`.
2. Confirm `DATABASE_URL` points at the **intended** alpha database (print fingerprint; never paste passwords).
3. Prefer dry-run. Execution requires `--execute` and an exact fingerprint confirmation.
4. Automated CI/smoke uses disposable databases (`ostt_alpha_reset`, `ostt_alpha_reset_concurrency`, `ostt_phase3_acceptance`) only. Do **not** point smoke at `ostt_dev` or any shared/remote production-like host.
5. Never commit dumps, credentials, or reset stdout containing alpha PII.
6. Never fetch remote source URLs during reset.
7. Never copy live data into public-demo fixtures, prompts, screenshots, or handoff prose.

---

## Quiescence contract (required before `--execute`)

Ordinary application writes do **not** take the alpha-reset advisory lock. To prevent races that leave rows behind or produce misleading counts:

1. **Stop or maintenance-quiesce** the gated application and any workers that can write to the alpha database.
2. Confirm no deploy/migrate job is writing concurrently.
3. Keep the environment **quiesced through** dry-run review, execute, and post-reset verification (counts, bootstrap readiness).
4. Only then resume the gated application.

Inside the destructive transaction the operator service still acquires:

- bounded `lock_timeout` / `statement_timeout` (fail closed on contention)
- `pg_advisory_xact_lock` (transaction-scoped; unlock follows commit/rollback)
- allowlisted `LOCK TABLE … IN SHARE ROW EXCLUSIVE MODE` on reset/regenerated tables
- authoritative before/after coarse counts inside that protected window

If the protected window cannot be established, the command changes nothing and returns a sanitized `RESET_LOCK_UNAVAILABLE` (or equivalent) failure.

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

Inspect the printed **database fingerprint** and coarse pre-counts. No rows should change. Receipt provenance for the CLI is always **operational** (non-synthetic).

---

## Execute (destructive)

```bash
npm run operator:reset-alpha -- \
  --execute \
  --confirm-fingerprint=PASTE_FINGERPRINT_HERE \
  --reason "Owner-approved alpha wipe after drill"
```

On success, the audit ledger contains a **new** chain rooted at `alpha.reset_executed` (metadata-only: operator label, fingerprint, schema/migration version, commit SHA, coarse family counts, manifest version/hash, `receiptProvenance=operational`). This is **not** continuity with the erased pre-reset ledger. No account IDs, contacts, bodies, URLs, or private notes.

---

## After reset

1. Confirm accounts/topics/claims/evidence/assent records/sessions/invitations are empty.
2. Confirm **operational** published assent documents were regenerated (catalog in `src/lib/operator/operational-assent-documents.ts`) — provisional placeholders, not counsel-approved legal language.
3. Confirm retention defaults and `operator_bootstrap_state = not_started`.
4. Re-run first-administrator bootstrap: `npm run operator:bootstrap` (no synthetic seed required for recovery).
5. Reseed synthetic fixtures **only** in disposable/local drills if desired: `npm run db:seed` (gated env). Synthetic reseeding is **not** the proof that the environment is recoverable.

---

## Disposable smoke (CI / local)

```bash
npm run db:up
npm run alpha:reset:smoke
```

Creates/migrates `ostt_alpha_reset` on the Docker Postgres instance, seeds synthetic data, dry-runs, executes with **explicit synthetic** receipt provenance, verifies emptiness + regenerated operational documents, proves **bootstrap/onboarding without** `seedSyntheticFoundation`, then optionally reseeds for a separate drill — without touching `ostt_dev`.

Related proofs:

- `npm run test:pg:alpha-reset` — concurrency / lock timeout / rollback
- `npm run phase3:acceptance` — connected Phase 3 journey including reset recovery
