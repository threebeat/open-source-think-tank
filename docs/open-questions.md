# Open Product Questions

This file tracks **unresolved product decisions** that affect design, UX, and demonstration framing. It does not answer legal questions; those belong in [legal-questions.md](./legal-questions.md).

Do not treat items below as settled. When a choice would invent governance authority, membership status, or privacy rules, leave it open and link to counsel questions instead.

**Status key:** Unresolved

Phase 2 decision register and counsel gates: [phase-2-plan.md](./phase-2-plan.md) (§6–§7). Do not treat Phase 2 engineering as closing these items.

---

## Roles and authority

1. **Authority boundaries (product framing)** — Unresolved. How should the UI describe the exact powers of Community participants, the Deliberation council, the Policy council, and the Governing board without inventing legal answers? The charter uses advisory/recommend language for councils and marks board authority as pending counsel. See legal questions 4–5.

2. **“Community participant” vs statutory member** — Unresolved. The prototype avoids calling every account a legal “member.” Product copy must keep showing this as unresolved until counsel advises. See legal question 3.

3. **When a crowd or council outcome binds (or does not bind) the board** — Unresolved for product messaging. Phase 1 must show the question, not invent a binding rule. See legal question 5.

3a. **Decision-record outcome labels** — Unresolved. Phase 1 fixtures use `recommended` for Policy Council outputs so the demo does not invent board adoption. Whether a later board action becomes a separate `adopted` record, an overlay status, or another model remains open.

3b. **Overlapping council membership** — Unresolved for production. Phase 1 models Deliberation Council and Policy Council as separate seats. Some synthetic people may hold both roles only when each role has its own selection path and conflicts are recorded for the person; equivalence is never inferred from one roster alone.

---

## Representation and sampling

4. **Representation diagnostics in the demo** — Unresolved. How strongly should Phase 1 warn that synthetic consultation participants are not a representative sample, and what representation metrics (if any) appear as placeholders versus omitted until later phases?

5. **Production sampling claims** — Unresolved. What claims about Tennessee-first vs national participation may appear after a real pilot? Do not imply a U.S.-wide mandate in Phase 1.

---

## Consultation, agenda, and overrides

6. **Moderation defaults in the simulated consultation** — Unresolved. Which moderation actions are shown as institutional capability vs deferred, and how visibly should Phase 1 distinguish “simulated moderation” from a live workflow?

7. **Human override and deferral UX** — Unresolved. Default demonstration includes at least one reasoned human review that defers rather than overriding evidence concerns. Broader override taxonomy (who may override, appeal path, publication timing) remains open.

8. **Agenda threshold presentation** — Unresolved. Exact numeric thresholds in fixtures are synthetic for the demo; which thresholds are educational placeholders vs candidates for a later published method registry is not decided.

---

## Evidence and publication

9. **Evidence-review rubric depth in Phase 1** — Unresolved. How much of a future review checklist is shown as explanatory UI versus deferred to Phase 3?

9a. **Topic `status` vs institutional `stage`** — Unresolved for production meaning. Phase 1 treats `status` (`open` / `paused` / `closed`) as brief-publication availability independent of pipeline `stage`. Whether production uses the same pair, merges them, or derives availability from permissions remains open.

10. **Redaction placeholders** — Unresolved. What examples of “permitted narrow redaction + public reason” are appropriate in the deliberation observer view without teaching harmful disclosure patterns?

---

## Demonstration emphasis by audience

11. **Guided demo emphasis** — Unresolved. Relative weight of stops for legal counsel vs technical collaborators vs prospective board members (beyond the planned dedicated question stops) may change after first rehearsals.

12. **Join-preview fidelity** — Unresolved. How much verification-ladder detail is enough for lawyers to critique without implying that government ID will necessarily be required?

---

## Naming and branding

13. **Public product name** — Unresolved. “Open-Source Think Tank” is a working name for the proposed project, not a registered or legal entity name.

---

## How to add questions

When a design choice affects legal authority, privacy, verification, representation, moderation, or public data:

1. Add an entry here as **Unresolved**.
2. Link related items in [legal-questions.md](./legal-questions.md) when counsel input is required.
3. Do not silently invent a product answer that pretends the legal question is closed.
