# Alpha reset runbook (gated Commonhall pre-alpha)

**Audience:** Environment operators of a **gated Commonhall pre-alpha** (open local enrollment + disableable synthetic seed).  
**Not** a browser feature. **Not** public-demo. **Not** counsel-approved production retention. **Not** a remote Pol.is wipe.

Use this ceremony to wipe a disposable gated database before an alpha. Open enrollment (`COMMONHALL_V2_OPEN_ENROLLMENT`) and the synthetic catalog (`COMMONHALL_SYNTHETIC_SEED`) are pre-alpha engineering postures; they do not close V2-18/V2-19 or related legal/vendor holds.

Full table classification: [alpha-reset-classification.md](./alpha-reset-classification.md).  
Local vs remote semantics: [ADR 0017](./decisions/0017-local-versus-remote-reset-semantics.md).  
Council delivery overview: [v2/final_overview.md](./v2/final_overview.md).

Full table classification: [alpha-reset-classification.md](./alpha-reset-classification.md).  
Local vs remote semantics: [ADR 0017](./decisions/0017-local-versus-remote-reset-semantics.md).

---

## Safety (read first)

1. Confirm `APP_MODE=gated`.
2. Confirm `DATABASE_URL` points at the **intended** alpha database (print fingerprint; never paste passwords).
3. Prefer dry-run. Execution requires `--execute` and an exact fingerprint confirmation.
4. Automated CI/smoke uses disposable databases (`ostt_alpha_reset`, `ostt_alpha_reset_concurrency`, `ostt_phase3_acceptance`) only. Do **not** point smoke at `ostt_dev` or any shared/remote production-like host.
5. Never commit dumps, credentials, or reset stdout containing alpha PII.
6. Never fetch remote source URLs during reset.
7. Never copy live data into public-demo fixtures, prompts, screenshots, or handoff prose.
8. **Never claim remote provider deletion.** Local reset wipes institutional Public Input rows in **this** database only — conversation lifecycle tables (`public_input_conversations`, `public_input_conversation_transitions`) and report/moderation tables (`public_input_report_imports`, `public_input_reports`, `public_input_report_groups`, `public_input_report_findings`, `public_input_report_moderation_actions`, `public_input_provider_moderation_records`). It does not call Pol.is or any remote admin API, and must not be described as deleting remote conversations, votes, or exports (OQ29; activation gate `remote_alpha_reset_verified` remains unresolved). Local ≠ remote. Hosted Pol.is cannot be enabled in this pre-alpha (`isHostedPolisEnabled()` is always false).

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

### Commonhall pre-alpha flags (not production settlements)

| Flag | Gated default | Notes |
| --- | --- | --- |
| `COMMONHALL_SYNTHETIC_SEED` | on | `off` hides synthetic catalog rows from member DTOs. Reset still wipes the rows. Reseed with `npm run db:seed` only on disposable databases. |
| `COMMONHALL_V2_OPEN_ENROLLMENT` | on | `off` stops new local identifier+password enrollment. Always off in public-demo. |
| `COMMONHALL_V2_KERNEL` | on | `off` refuses organization/governance writes. Always off in public-demo. |
| Hosted Pol.is | impossible | Cannot be enabled. Local reset never claims remote deletion. |

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
2. Confirm `public_input_conversations` and `public_input_conversation_transitions` are empty (Phase 4.3).
3. Confirm Phase 4.4 report/moderation tables are empty when present: `public_input_report_imports`, `public_input_reports`, `public_input_report_groups`, `public_input_report_findings`, `public_input_report_moderation_actions`, `public_input_provider_moderation_records`.
4. Confirm **operational** published assent documents were regenerated (catalog in `src/lib/operator/operational-assent-documents.ts`) — provisional placeholders, not counsel-approved legal language.
5. Confirm retention defaults and `operator_bootstrap_state = not_started`.
6. Re-run first-administrator bootstrap: `npm run operator:bootstrap` (no synthetic seed required for recovery).
7. Reseed the synthetic catalog **only** in disposable/local drills if desired: `npm run db:seed` (gated env). `COMMONHALL_SYNTHETIC_SEED=off` hides that catalog from member UI without deleting it. Synthetic reseeding is **not** the proof that the environment is recoverable.
8. Confirm Commons discussions, member statement positions, and Chamber/Council session tables are empty before optional reseed.
9. If any remote consultation provider data ever existed outside this database, handle it under a **separate, verified** remote procedure — do not treat local reset success as remote wipe confirmation. Hosted Pol.is remains impossible to enable.

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
