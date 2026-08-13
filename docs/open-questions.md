# Open Product Questions

This file tracks **unresolved product decisions** that affect design, UX, and demonstration framing. It does not answer legal questions; those belong in [legal-questions.md](./legal-questions.md).

Do not treat items below as settled. When a choice would invent governance authority, membership status, or privacy rules, leave it open and link to counsel questions instead.

**Status key:** Unresolved

Phase 2 decision register and counsel gates: [phase-2-plan.md](./phase-2-plan.md) (§6–§7). Do not treat Phase 2 engineering as closing these items.

---

## Roles and authority

1. **Authority boundaries (product framing)** — Alpha-test scoped clearance in [ADR 0007](./decisions/0007-alpha-test-interim-council-dispositions.md) (continual communication sufficient until the test ends). Lasting post-alpha authority wording remains open for the post-alpha report. See legal questions 4–5.

2. **“Community participant” / member / delegate** — Alpha-test scoped clearance in ADR 0007: “member” OK if test purpose is communicated at assent and continually; preferred synonym **delegate**. Permanent statutory membership remains open for the post-alpha report. See legal question 3.

3. **When a crowd or council outcome binds (or does not bind) the board** — Alpha-test scoped clearance (communication sufficient). Lasting binding rules remain open for the post-alpha report. See legal question 5.

3a. **Decision-record outcome labels** — Unresolved. Phase 1 fixtures use `recommended` for Policy Council outputs so the demo does not invent board adoption. Whether a later board action becomes a separate `adopted` record, an overlay status, or another model remains open.

3b. **Overlapping council membership** — Unresolved for production. Phase 1 models Deliberation Council and Policy Council as separate seats. Some synthetic people may hold both roles only when each role has its own selection path and conflicts are recorded for the person; equivalence is never inferred from one roster alone.

---

## Representation and sampling

4. **Representation diagnostics in the demo** — Unresolved. How strongly should Phase 1 warn that synthetic consultation participants are not a representative sample, and what representation metrics (if any) appear as placeholders versus omitted until later phases?

5. **Production sampling claims** — Alpha-test: no geographical eligibility requirements until the test ends ([ADR 0007](./decisions/0007-alpha-test-interim-council-dispositions.md)). Post-alpha residency/national claims remain open for the report.

---

## Consultation, agenda, and overrides

6. **Moderation defaults in the simulated consultation** — Unresolved. Which moderation actions are shown as institutional capability vs deferred, and how visibly should Phase 1 distinguish “simulated moderation” from a live workflow?

7. **Human override and deferral UX** — Unresolved. Default demonstration includes at least one reasoned human review that defers rather than overriding evidence concerns. Broader override taxonomy (who may override, appeal path, publication timing) remains open.

8. **Agenda threshold presentation** — Unresolved. Exact numeric thresholds in fixtures are synthetic for the demo; which thresholds are educational placeholders vs candidates for a later published method registry is not decided.

---

## Evidence and publication

9. **Evidence-review rubric depth in Phase 1** — Unresolved. How much of a future review checklist is shown as explanatory UI versus deferred to Phase 3?

9a. **Topic `status` vs institutional `stage`** — Unresolved for production meaning. Phase 1 treats `status` (`open` / `paused` / `closed`) as brief-publication availability independent of pipeline `stage`. Phase 3 plans a gated **workflow** state machine (`draft` → `open_for_submissions` → `under_review` → `published` → `paused`/`archived`) in [phase-3-plan.md](./phase-3-plan.md); how that maps to demo `status`/`stage` labels for visitors remains open.

10. **Redaction placeholders** — Unresolved. What examples of “permitted narrow redaction + public reason” are appropriate in the deliberation observer view without teaching harmful disclosure patterns?

---

## Demonstration emphasis by audience

11. **Guided demo emphasis** — Unresolved. Relative weight of stops for legal counsel vs technical collaborators vs prospective board members (beyond the planned dedicated question stops) may change after first rehearsals.

12. **Join-preview fidelity** — Unresolved. How much verification-ladder detail is enough for lawyers to critique without implying that government ID will necessarily be required?

---

## Naming and branding

13. **Public product name** — Unresolved. “Open-Source Think Tank” is a working name for the proposed project, not a registered or legal entity name.

---

## Phase 2 operations

14. **Distributed auth / mutation rate limiting** — Unresolved for staging/production. Work Package 2.4 ships an in-process auth limiter; Work Package 3.9 ships a replaceable in-process `MutationRateLimiter` for gated mutations. Both are single-instance only. Multi-instance gated deployments need a shared limiter before real enrollment or multi-instance alpha (architecture D13).

15. **Retention and deletion rights** — Alpha-test scoped clearance in [ADR 0007](./decisions/0007-alpha-test-interim-council-dispositions.md): proposed postures may run to prove efficacy; **must** reset all included alpha-test data (no user/topic carry-over). Permanent post-alpha schedules remain open for the report.

16. **Phase 3 start while Phase 2 readiness was blocked** — Product/sequencing (not counsel). [ADR 0006](./decisions/0006-phase-3-two-lane-sequencing.md): Phase 3 synthetic/closed engineering may proceed. Lane B alpha-test foundation now authorized under ADR 0007 scopes.

17. **Post-alpha report contents** — Required by interim council. After the alpha test, retain the product and a report covering the full plan, achievements, and **lasting open questions / decisions** that must be made once the alpha test is over. Do not carry alpha-test users or topic discussion forward.

---

## Phase 3 operational alpha

18. **Public attribution of claim/evidence authors** — Unresolved. Phase 3 forbids publishing account identifiers, contact channels, and verification records. Whether gated published topics show a preferred display name, a neutral “participant” label, or no personal attribution remains open ([phase-3-plan.md](./phase-3-plan.md), [architecture-phase-3.md](./architecture-phase-3.md) D14).

19. **Alpha wipe versus assent/audit copies for the post-alpha report** — Unresolved at the edge. ADR 0007 requires resetting alpha users and topic discussion; Phase 2 closure retains assent/audit for living accounts. Package **3.12** implements a metadata-only `alpha.reset_executed` receipt and wipes alpha assent/audit rows on the operator CLI path ([alpha-reset-runbook.md](./alpha-reset-runbook.md)). What redacted aggregates (if any) may be copied into the post-alpha report without carrying live alpha datastores forward remains open (architecture D15).

20. **Pre-publication visibility of others’ in-flight submissions** — Unresolved. Visitors must not see drafts/rejected/held material. Whether **other active participants** (not staff) may see peers’ submitted-but-unpublished claims in the gated workspace before topic publication remains open (architecture D16).

21. **Operator self-attestation for first-administrator verification (owner-run alpha)** — Unresolved as a lasting governance posture. Package 3.3 requires a concurrency-safe bootstrap path when no reviewer/administrator yet exists. The engineering ceremony may record required alpha verification floor decisions with explicit `operator_bootstrap` provenance (operator label + reason; not represented as independent account review). Whether that interim owner-run attestation is acceptable beyond the resettable alpha test, and what independent review should replace it afterward, remains open for the post-alpha report ([phase-3-plan.md](./phase-3-plan.md), [architecture-phase-3.md](./architecture-phase-3.md) §10a).

22. **Pre-revision evidence-quality decisions after content edits** — Unresolved. When a submission is edited after an evidence-quality decision (or other review) that predates the revised content, should that prior quality status block publication eligibility until re-reviewed? Package **3.7** records immutable revisions and surfaces chronology notices but does **not** invent a new publish blocker and does **not** auto-reset quality ([phase-3-plan.md](./phase-3-plan.md) 3.7, [architecture-phase-3.md](./architecture-phase-3.md) §3.4, [threat-model.md](./threat-model.md)).

23. **Public moderation-notice depth on published topics** — Unresolved for 3.10 polish. Package **3.8** exposes allowlisted withhold/restore notices (action + public rationale + date; subjectKind claim/evidence) without titles, bodies, URLs, or IDs. Whether visitors should see richer chronology, appeal pointers, or eligibility interactions—and whether dual-control should apply to some visibility actions—remains open. 3.8 does **not** invent appeal policy, dual control for every moderation action, legal disclosure taxonomy, or permanent retention ([phase-3-plan.md](./phase-3-plan.md) 3.8, [architecture-phase-3.md](./architecture-phase-3.md) §3.6 / §4).

24. **Trusted proxy hops for mutation origin buckets** — Unresolved operationally. Package **3.9** derives opaque origin refs only when `TRUSTED_PROXY_HOPS` is a positive integer; otherwise the origin bucket is omitted and the account bucket remains. Which production proxy topology and hop count to trust remains open; never trust arbitrary forwarded headers silently.

25. **Gated topic-recommendation intake** — Unresolved / not authorized. The 3.9 public-demo “Recommend a topic” journey is an interaction prototype with local fixture state only. Whether and how the gated alpha accepts topic recommendations remains a later package decision.

---

## Phase 4 computational democracy / Public Input

26. **Pol.is vendor / data-processing approval** — Unresolved / **blocker for LIVE activation** (not for 4.3 engineering). Phase 4.2 recorded a sourced assessment ([public-input-provider-assessment.md](./public-input-provider-assessment.md)) with verdict **insufficient information**. Phase 4.3 landed the institutional lifecycle and a fail-closed embed shell; live install remains blocked until hosted vs self-hosted selection, written DPA, subprocessors (incl. LLM report processors), residency, retention/deletion, breach/SLA, export schema, permitted-services register addendum, and owner `ENABLE LIVE POLIS…` authorization clear ([phase-4-plan.md](./phase-4-plan.md) §11d, [ADR 0012](./decisions/0012-public-input-provider-boundary.md), activation checklist in `src/lib/public-input/lifecycle/activation.ts`).

27. **Production small-cell suppression threshold** — Unresolved. Synthetic demo uses a provisional threshold of **5**; production threshold requires privacy review. Phase 4.2 requires suppressed cells to render as explicit “Suppressed” (share `null`), never as `0%`.

28. **`xid` / identity-linking mechanisms** — Unresolved / forbidden until approved. Supported status, purpose, retention, access control, deletion behavior, and reidentification risk must be explicit before any use. Embed examples and marketing are not authorization. Remains activation gate `xid_forbidden_confirmed`.

29. **Raw provider export retention vs alpha wipe** — Unresolved / **blocker for LIVE activation**. Raw Pol.is/provider exports are protected data; how long gated alpha may retain them versus wipe/report copies remains open (related to OQ19 / D15). Phase 4.3 documents that **local** alpha reset deletes institutional conversation rows only and must **never claim remote provider deletion** without verified remote execution ([ADR 0017](./decisions/0017-local-versus-remote-reset-semantics.md); activation gate `remote_alpha_reset_verified`). No raw export ingest in 4.2–4.3.

30. **Member-action personalization beyond explicit interests** — Unresolved. 4.1 allows only explicit fixture geography/interests with explained basis. Any richer matching (without votes/ideology inference) needs a later privacy review.

31. **Formal-gate numeric thresholds as published method registry candidates** — Unresolved. Fixture numbers are educational; which become candidates for a later published method registry is not decided (extends OQ8).

32. **Gated public discussion/proposal relationships** — Unresolved / not yet operational. Phase 4.2 shows an honest empty state for gated publications; no speculative schema migration. Whether and how Idea Commons–style relationships are persisted for alpha remains a later package decision (must not pre-empt OQ20 visibility rules).

33. **Provider embed CSP / third-party JS acceptance** — Unresolved / **blocker for LIVE activation**. Official embed requires third-party JavaScript to create a responsive iframe ([compdemocracy embed KB](https://compdemocracy.org/embed-code/)). Phase 4.3 ships exact-origin allowlisting and fail-closed URL construction with **no iframe UI wiring** ([ADR 0016](./decisions/0016-provider-embed-activation-exact-origin.md)). Restrictive iframe policy, CSP `frame-src` / script decisions, and clickjacking controls still need security acceptance before any live embed (activation gate `csp_iframe_third_party_script`).

34. **Progressive evidence disclosure vs confidentiality** — Clarified for product engineering; remains listed so reviewers do not re-litigate silently. Phase 4.3 progressive disclosure (`<details>`/`<summary>`) is a **readability** pattern over fields that are already public in the projection. It is **not** a confidentiality, redaction, or access-control boundary. Protected fields must be filtered before they reach the disclosure model ([ADR 0015](./decisions/0015-progressive-evidence-disclosure.md)). If a future package needs true confidentiality controls, that is a separate design — not “keep it inside closed `<details>`.”

---

## How to add questions

When a design choice affects legal authority, privacy, verification, representation, moderation, or public data:

1. Add an entry here as **Unresolved**.
2. Link related items in [legal-questions.md](./legal-questions.md) when counsel input is required.
3. Do not silently invent a product answer that pretends the legal question is closed.
