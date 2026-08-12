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

14. **Distributed auth rate limiting** — Unresolved for staging/production. Work Package 2.4 ships an in-process limiter suitable for local/ephemeral use. Multi-instance deployments need a shared limiter before real enrollment.

15. **Retention and deletion rights** — Alpha-test scoped clearance in [ADR 0007](./decisions/0007-alpha-test-interim-council-dispositions.md): proposed postures may run to prove efficacy; **must** reset all included alpha-test data (no user/topic carry-over). Permanent post-alpha schedules remain open for the report.

16. **Phase 3 start while Phase 2 readiness was blocked** — Product/sequencing (not counsel). [ADR 0006](./decisions/0006-phase-3-two-lane-sequencing.md): Phase 3 synthetic/closed engineering may proceed. Lane B alpha-test foundation now authorized under ADR 0007 scopes.

17. **Post-alpha report contents** — Required by interim council. After the alpha test, retain the product and a report covering the full plan, achievements, and **lasting open questions / decisions** that must be made once the alpha test is over. Do not carry alpha-test users or topic discussion forward.

---

## Phase 3 operational alpha

18. **Public attribution of claim/evidence authors** — Unresolved. Phase 3 forbids publishing account identifiers, contact channels, and verification records. Whether gated published topics show a preferred display name, a neutral “participant” label, or no personal attribution remains open ([phase-3-plan.md](./phase-3-plan.md), [architecture-phase-3.md](./architecture-phase-3.md) D14).

19. **Alpha wipe versus assent/audit copies for the post-alpha report** — Unresolved at the edge. ADR 0007 requires resetting alpha users and topic discussion; Phase 2 closure retains assent/audit for living accounts. What redacted aggregates (if any) may be copied into the post-alpha report without carrying live alpha datastores forward remains open (architecture D15).

20. **Pre-publication visibility of others’ in-flight submissions** — Unresolved. Visitors must not see drafts/rejected/held material. Whether **other active participants** (not staff) may see peers’ submitted-but-unpublished claims in the gated workspace before topic publication remains open (architecture D16).

21. **Operator self-attestation for first-administrator verification (owner-run alpha)** — Unresolved as a lasting governance posture. Package 3.3 requires a concurrency-safe bootstrap path when no reviewer/administrator yet exists. The engineering ceremony may record required alpha verification floor decisions with explicit `operator_bootstrap` provenance (operator label + reason; not represented as independent account review). Whether that interim owner-run attestation is acceptable beyond the resettable alpha test, and what independent review should replace it afterward, remains open for the post-alpha report ([phase-3-plan.md](./phase-3-plan.md), [architecture-phase-3.md](./architecture-phase-3.md) §10a).

22. **Pre-revision evidence-quality decisions after content edits** — Unresolved. When a submission is edited after an evidence-quality decision (or other review) that predates the revised content, should that prior quality status block publication eligibility until re-reviewed? Package **3.7** records immutable revisions and surfaces chronology notices but does **not** invent a new publish blocker and does **not** auto-reset quality ([phase-3-plan.md](./phase-3-plan.md) 3.7, [architecture-phase-3.md](./architecture-phase-3.md) §3.4, [threat-model.md](./threat-model.md)).

---

## How to add questions

When a design choice affects legal authority, privacy, verification, representation, moderation, or public data:

1. Add an entry here as **Unresolved**.
2. Link related items in [legal-questions.md](./legal-questions.md) when counsel input is required.
3. Do not silently invent a product answer that pretends the legal question is closed.
