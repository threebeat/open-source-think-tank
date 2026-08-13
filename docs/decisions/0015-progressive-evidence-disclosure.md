# ADR 0015 — Progressive evidence disclosure (readability, not confidentiality)

**Status:** Accepted for Phase 4.3 engineering contract  
**Date:** 2026-08-13  
**Related:** [phase-4-plan.md](../phase-4-plan.md), [architecture-phase-4.md](../architecture-phase-4.md), OQ34, [ADR 0013](./0013-canonical-formal-topic-page.md)

## Context

Formal Topic Evidence inventories can be dense. Visitors need a scannable collapsed summary without implying that collapsed content is secret, redacted, or access-controlled.

## Decision

1. Use native `<details>` / `<summary>` progressive disclosure (`EvidenceDisclosure`) for already-public evidence fields.
2. Default closed; never auto-open from URL query strings, localStorage, or sessionStorage.
3. Collapsed summary includes relationship, quality label, title, source organization/type, and contribution sentence.
4. Expanded panel holds remaining public metadata, rationales, limitations, public conflict summary, revision/moderation notices, linked claims, and the external source link (when present).
5. External links use `rel="noopener noreferrer"` and `referrerPolicy="no-referrer"`; the application does not fetch remote sources.
6. Progressive disclosure is a **readability** feature only. It is **not** a confidentiality, redaction, or authorization boundary. Protected fields must be filtered by the public projection (or synthetic fixtures) before mapping into the disclosure model.
7. Applies to public-demo fixture projections and gated published public projections alike.

## Consequences

- Dense evidence lists stay scannable without inventing a second privacy tier.
- Reviewers must not treat “closed `<details>`” as hiding protected data (OQ34).
- True confidentiality controls, if ever needed, require a separate access-control design — not disclosure UI.
