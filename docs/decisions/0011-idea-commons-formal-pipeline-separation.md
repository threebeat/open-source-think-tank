# ADR 0011 — Idea Commons / Formal Topic Pipeline separation

**Status:** Accepted (product/engineering decision)  
**Date:** 2026-08-13  
**Package:** 4.1  
**Related:** [phase-4-plan.md](../phase-4-plan.md), [architecture-phase-4.md](../architecture-phase-4.md), [0010-computational-democracy-pipeline.md](./0010-computational-democracy-pipeline.md)

This ADR is a **product/engineering decision**. It does not invent statutory membership, board authority, or counsel-approved legal language.

## Context

Visitors and collaborators previously encountered “topics” that mixed early ideas, synthetic briefs, and post-gate institutional stages. Board direction requires an unmistakable separation between informal community discussion and formal topics that have passed published gates. Preference-based promotion by elevated roles would undermine legitimacy.

## Decision

1. **Idea Commons** is the product area for general discussion, questions, early ideas, and unqualified proposals. UI copy must label content as informal and **not yet in the Formal Topic Pipeline**.
2. **Formal Topic Pipeline** contains only topics that passed the required published gate. Entry is criteria-based and auditable — never a private preference action by a moderator, administrator, board member, or single participant.
3. **Every formal topic** surfaces: current stage; origin/lineage; criteria met; unmet criteria; who can act now; next transition; public vs protected information; complete transition history.
4. **Lineage is visible** when ideas merge, split, defer, or nominate for scoping; history is not erased.
5. **Conversion paths** (discussion → proposal → scoping nomination) are ordinary participant flows in the demo; elevated roles gain no privileged shortcut and no ranking badge on ordinary contributions.
6. **Public-demo practice state** for Idea Commons is session-scoped, resettable, and never written to gated stores.
7. Navigation, headings, and disclosures must make the two areas distinguishable at a glance (including mobile).

## Consequences

- New public-demo routes and fixtures introduce Idea Commons without claiming live multi-user community hosting.
- Existing Cedar River formal-stage routes remain Formal Topic Pipeline surfaces and gain explicit gate/lineage presentation.
- Tests must fail if Idea Commons content is presented as formal, or if elevated roles can directly promote pre-deliberation topics.

## Confirmation

Recorded as the Work Package 4.1 separation contract (2026-08-13).
