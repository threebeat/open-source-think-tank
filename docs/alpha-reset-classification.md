# Alpha reset table classification (Phase 3.12)

**Status:** Operator procedure for gated invite-only alpha. Not a public-demo feature. Not production retention counsel.

**Scope:** Every `pgTable` in `src/db/schema.ts` (35 tables) is classified as exactly one of:

| Class | Meaning |
| --- | --- |
| **reset** | Rows are deliberately deleted by the operator alpha-reset (explicit `DELETE FROM` in fixed order). |
| **retained** | Rows are left in place (product/schema metadata that must survive a drill). |
| **regenerated** | Cleared or reset to a known-good skeleton, then defaults / reset receipt written by the procedure. |
| **deferred** | Intentionally not classified for wipe yet — **none** in this package (all tables classified). |

Machine-readable mirror: `src/lib/operator/alpha-reset-manifest.ts`.

---

## Fail-closed rules

1. **Gated only** — `APP_MODE=gated`. Public-demo must never construct a reset client.
2. **Secrets from environment** — `OPERATOR_RESET_SECRET` (≥32 chars), never CLI argv. Separate from `OPERATOR_BOOTSTRAP_SECRET`.
3. **Operator label + reason** — `OPERATOR_LABEL` and a substantive `--reason` required.
4. **Fingerprint confirm** — `--execute` requires `--confirm-fingerprint=` matching `computeDatabaseFingerprint(DATABASE_URL)` (hash of host+port+dbname only; never password).
5. **Refuse `ostt_dev` in automated smoke** — if the database name is `ostt_dev` and `OSTT_ALLOW_DEV_RESET !== "1"`, refuse. Smoke uses disposable `ostt_alpha_reset` on the same Docker Postgres.
6. **No HTTP/browser route** — CLI / domain service only.
7. **Explicit delete list** — only tables marked **reset** (plus regenerated clears) are deleted; no `TRUNCATE … CASCADE` of unknown tables.
8. **Immutability triggers** — tables with `BEFORE DELETE` immutability triggers are deleted only after those known triggers are disabled for the operator transaction, then re-enabled. Fail closed if disable/enable fails.
9. **Success audit only after success** — `alpha.reset_executed` is appended only after deletes + regenerated defaults succeed in the same transactional work; failed reset must not leave a success receipt.
10. **No PII in audit payload** — coarse family counts, fingerprints, versions, and operator label only.
11. **Advisory lock** — fixed bigint `pg_advisory_lock` serializes concurrent reset attempts.
12. **Manifest completeness** — `assertManifestComplete(knownTableNames)` throws if schema adds a table not classified.

---

## Classification (35 tables)

| Table | Class | Rationale |
| --- | --- | --- |
| `persons` | reset | Alpha identity; wipe with accounts. |
| `accounts` | reset | Alpha account holders. |
| `profiles` | reset | Account-private display prefs. |
| `invitations` | reset | Invite tokens/metadata (incl. bootstrap invites). |
| `operator_bootstrap_state` | reset | Ceremony state cleared; singleton `not_started` row recreated after wipe so bootstrap can run again. |
| `role_assignments` | reset | Platform roles (alpha staff). |
| `council_appointments` | reset | Council seats (alpha). |
| `document_versions` | reset | Synthetic / alpha assent documents (seeded; not permanent product config). |
| `assent_records` | reset | Alpha assent history (immutable in normal ops; operator reset disables delete trigger). |
| `assent_outcomes` | reset | Decline/withdraw outcomes. |
| `assent_presentations` | reset | Presentation sessions. |
| `verification_cases` | reset | Verification workflow. |
| `verification_assertions` | reset | Assertion decisions. |
| `verification_artifact_holds` | reset | Artifact holds. |
| `verification_artifact_payloads` | reset | Artifact payloads. |
| `audit_events` | reset | Alpha ledger wiped; new chain starts with reset receipt. |
| `audit_ledger_head` | regenerated | Cleared to empty head, then updated by `alpha.reset_executed` append. |
| `closed_test_conversations` | reset | Synthetic closed-test conversation registry. |
| `conversation_pseudonyms` | reset | Account↔pseudonym maps. |
| `retention_policy_settings` | regenerated | Cleared then re-seeded with provisional synthetic defaults. |
| `account_deletion_requests` | reset | Closure workflow rows. |
| `legal_holds` | reset | Hold rows (alpha). |
| `dual_control_requests` | reset | Dual-control queue. |
| `auth_sessions` | reset | Session hashes. |
| `auth_challenges` | reset | Challenge hashes. |
| `schema_meta` | retained | Migration/health labels survive reset (migrate remains source of schema). |
| `topics` | reset | Alpha topic workflow. |
| `claims` | reset | Participant claims. |
| `evidence_submissions` | reset | Evidence rows. |
| `claim_evidence_links` | reset | Claim↔evidence links. |
| `conflict_disclosures` | reset | Disclosure rows. |
| `moderation_actions` | reset | Moderation history (immutable normally). |
| `claim_reviews` | reset | Claim review provenance. |
| `content_revisions` | reset | Revision snapshots (immutable normally). |
| `evidence_reviews` | reset | Evidence review provenance. |

**Deferred:** none.

---

## Delete order

Children first; see `DELETE_ORDER` in `alpha-reset-manifest.ts`. Matches the spirit of `scripts/gated-e2e-prepare.mjs` truncate order without cascading unknown tables. Self-referential FKs (e.g. `conversation_pseudonyms.superseded_by_id`) are nulled before delete.

---

## Operator usage (summary)

```bash
# Dry-run (default)
APP_MODE=gated DATABASE_URL=... OPERATOR_RESET_SECRET=... OPERATOR_LABEL=ops \
  npm run operator:reset-alpha -- --reason="Alpha drill dry-run"

# Execute (fingerprint from dry-run output)
npm run operator:reset-alpha -- --execute --confirm-fingerprint=<exact> --reason="Alpha drill execute"
```

Automated proof: `npm run alpha:reset:smoke` against disposable `ostt_alpha_reset` only (never `ostt_dev`).
