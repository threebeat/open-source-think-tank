# Alpha reset table classification (Phase 3 closure + Phase 4.3–4.4 Public Input + v2 organization kernel)

**Status:** Operator procedure for gated pre-alpha. Not a public-demo feature. Not production retention counsel.  
**Manifest version:** `v2.2.0` — Commonhall v2 Phase 2 adds `account_credentials` classified **reset** below; `RESET_MANIFEST_VERSION` in `alpha-reset-manifest.ts` and this document stay in sync.

**Scope:** Every `pgTable` in `src/db/schema.ts` must be classified as exactly one of:

| Class | Meaning |
| --- | --- |
| **reset** | Rows are deliberately deleted by the operator alpha-reset (explicit `DELETE FROM` in fixed order). |
| **retained** | Rows are left in place (product/schema metadata that must survive a drill). |
| **regenerated** | Cleared or reset to a known-good skeleton, then defaults / operational catalog / reset receipt written by the procedure. |
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
10. **No PII in audit payload** — coarse family counts, fingerprints, versions, operator label, and explicit `receiptProvenance` only.
11. **Protected quiesced window** — inside the destructive transaction: bounded `lock_timeout` / `statement_timeout`, `pg_advisory_xact_lock`, and allowlisted `LOCK TABLE … IN SHARE ROW EXCLUSIVE MODE` on reset/regenerated tables. Authoritative before/after counts are collected inside that window. Lock release follows transaction outcome (no post-commit unlock that can flip success into failure).
12. **Quiescence contract** — gated application/workers must be stopped or verifiably maintenance-quiesced before execute and remain quiesced through post-reset verification (see runbook).
13. **Manifest completeness** — `assertManifestComplete(knownTableNames)` throws if schema adds a table not classified.
14. **Operational assent documents** — `document_versions` are **regenerated** from the checked-in non-participant catalog in `src/lib/operator/operational-assent-documents.ts`. Participant assent records/presentations/outcomes remain **reset**. Catalog bodies are provisional alpha placeholders — not counsel-approved legal language.

---

## Classification (53 tables)

| Table | Class | Rationale |
| --- | --- | --- |
| `persons` | reset | Alpha identity; wipe with accounts. |
| `accounts` | reset | Alpha account holders. |
| `account_credentials` | reset | Local password hashes for gated open enrollment (scrypt). Never public; wipe with accounts. |
| `profiles` | reset | Account-private display prefs. |
| `invitations` | reset | Invite tokens/metadata (incl. bootstrap invites). |
| `operator_bootstrap_state` | reset | Ceremony state cleared; singleton `not_started` row recreated after wipe so bootstrap can run again. |
| `role_assignments` | reset | Platform roles (alpha staff). |
| `council_appointments` | reset | Council seats (alpha). |
| `document_versions` | regenerated | Required operational assent document definitions; cleared then republished from deterministic non-participant catalog so post-reset bootstrap/onboarding can proceed without synthetic reseeding. |
| `assent_records` | reset | Alpha assent history (immutable in normal ops; operator reset disables delete trigger). |
| `assent_outcomes` | reset | Decline/withdraw outcomes. |
| `assent_presentations` | reset | Presentation sessions. |
| `verification_cases` | reset | Verification workflow. |
| `verification_assertions` | reset | Assertion decisions. |
| `verification_artifact_holds` | reset | Artifact holds. |
| `verification_artifact_payloads` | reset | Artifact payloads. |
| `audit_events` | reset | Alpha ledger wiped; **new audit chain rooted at** the reset receipt (not continuity with the erased pre-reset ledger). |
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
| `public_input_conversations` | reset | Public Input conversation lifecycle state (Phase 4.3). `providerConversationRef` is a protected opaque reference — never public, never logged; wiped like any other alpha row. **Local wipe only** — does not delete remote provider conversations ([ADR 0017](./decisions/0017-local-versus-remote-reset-semantics.md)). |
| `public_input_conversation_transitions` | reset | Append-only conversation lifecycle transition history (Phase 4.3; immutable in normal ops — operator reset disables the delete trigger like `moderation_actions`/`content_revisions`). Local wipe only. |
| `public_input_report_imports` | reset | Aggregate-only import provenance (Phase 4.4). Local wipe only. |
| `public_input_reports` | reset | Immutable report versions (Phase 4.4). Local wipe only. |
| `public_input_report_groups` | reset | Opinion-group rows for report versions (Phase 4.4). Local wipe only. |
| `public_input_report_findings` | reset | Agreement/disagreement finding rows (Phase 4.4). Local wipe only. |
| `public_input_report_moderation_actions` | reset | Institutional Public Input moderation / finding-eligibility actions (Phase 4.4; append-only in normal ops). Local wipe only. |
| `public_input_provider_moderation_records` | reset | Provider-side moderation observational records (Phase 4.4). Local wipe only — never implies remote provider deletion. |
| `appointment_conflicts_and_recusals` | reset | v2 appointment conflict/recusal rows (Phase 1 kernel). Synthetic/alpha only. |
| `topic_governance_events` | reset | Append-only v2 governance transitions (immutable in normal ops). Local wipe only. |
| `topic_governance_records` | reset | Composed v2 topic governance records. Local wipe only. |
| `organization_appointments` | reset | Organization Chamber/Council/moderator/admin appointments. Not a conversion of `council_appointments`. |
| `organization_membership_events` | reset | Append-only membership history (immutable in normal ops). |
| `organization_memberships` | reset | Organization community membership (gated open enrollment assigns the synthetic primary org; wipeable). |
| `organization_config_versions` | reset | Versioned organization configuration (synthetic). |
| `organization_service_areas` | reset | Coarse region codes only. |
| `organizations` | reset | Organization tenants. |

**Deferred:** none.

---

## Local versus remote reset semantics (Phase 4.3–4.4)

| Scope | What reset does | What reset must never claim |
| --- | --- | --- |
| **Local (this database)** | Deletes conversation lifecycle tables, the six Phase 4.4 report/moderation tables, and other reset-classified tables inside the gated alpha DB | — |
| **Remote consultation provider** | **Nothing automatic.** No Pol.is/admin API call is made from the reset ceremony | That remote conversations, votes, cookies, or exports were deleted |

Until activation gate `remote_alpha_reset_verified` is cleared and a verified remote procedure exists, operators must treat any former remote mapping as **possibly retained by the vendor** after local wipe. See [alpha-reset-runbook.md](./alpha-reset-runbook.md) and OQ29.

---

## Delete order

Children first; see `DELETE_ORDER` in `alpha-reset-manifest.ts` (class=`reset` only). Self-referential FKs (e.g. `conversation_pseudonyms.superseded_by_id`, `public_input_reports.superseded_by_report_id`) are nulled before delete. `document_versions` are cleared inside the regenerate step after assent child tables are gone.

---

## Receipt provenance

| Ceremony | `synthetic` on audit row | `receiptProvenance` |
| --- | --- | --- |
| Normal operator CLI (`npm run operator:reset-alpha`) | `false` | `operational` |
| Disposable smoke (`npm run alpha:reset:smoke`) | `true` | `synthetic_smoke` |

Provenance is an explicit input to the ceremony — never inferred from database name heuristics.

---

## Operator usage (summary)

```bash
# Dry-run (default)
APP_MODE=gated DATABASE_URL=... OPERATOR_RESET_SECRET=... OPERATOR_LABEL=ops \
  npm run operator:reset-alpha -- --reason="Alpha drill dry-run"

# Execute (fingerprint from dry-run output)
npm run operator:reset-alpha -- --execute --confirm-fingerprint=<exact> --reason="Alpha drill execute"
```

Automated proofs:

- `npm run alpha:reset:smoke` — disposable `ostt_alpha_reset` only; proves wipe + **bootstrap recovery without** `seedSyntheticFoundation`
- `npm run test:pg:alpha-reset` — concurrency / lock / rollback proofs on `ostt_alpha_reset_concurrency`
- `npm run phase3:acceptance` — connected Phase 3 journey on `ostt_phase3_acceptance`
