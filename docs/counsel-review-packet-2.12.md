# Counsel review packet — Phase 2 readiness (2.12)

**Status:** Issued for counsel review — **not** a disposition.  
**Issued date:** 2026-08-10  
**Issued by:** Phase 2 readiness engineering  
**Purpose:** Obtain recorded counsel dispositions required before the Phase 2 foundation readiness tag and any real launch. Under the project-owner two-lane rule ([ADR 0006](./decisions/0006-phase-3-two-lane-sequencing.md)), Phase 3 *synthetic/closed* engineering may proceed; readiness tag and real activation remain blocked.

Nothing in this packet invents clearance. Owner risk acceptance must not be recorded as `cleared`.

## Public-repository confidentiality warning

This repository is (or may become) **public**. Do **not** commit privileged counsel advice, private client facts, or non-public legal analysis.

| Allowed in-repo | Not allowed in-repo |
| --- | --- |
| Counsel-approved **public summaries** of disposition status/scope | Privileged memoranda, emails, or verbatim counsel advice |
| Opaque internal decision-record references (e.g. “Counsel memo 2026-…, on file”) | Attachment of private PDFs or paste of confidential reasoning |
| Updates to plan §7 / `dispositions.ts` using the public vocabulary (`blocking` / `conditionally_cleared` / `cleared`) | Secrets, real participant data, or production credentials |

Return privileged detail through a private channel; record only the approved public summary and opaque citation here.

## How to return dispositions

For each topic below, counsel (or a linked decision record) should return:

| Field | Required |
| --- | --- |
| Status | `blocking` \| `conditionally_cleared` \| `cleared` |
| Scope and conditions | What is in/out of scope; any conditions |
| Recorded date | ISO date |
| Recorded by | Counsel or decision-record author |
| Counsel source or decision-record link | Citation or “none — still blocking” |
| Project-owner approval | Name/date or `n/a` |
| Affected packages | e.g. 2.6, 2.8, 2.12 |

Update **both**:

1. Disposition table in [phase-2-plan.md](./phase-2-plan.md) §7  
2. Server-readable rows in `src/lib/counsel/dispositions.ts`

## Topics under review

### 1. Data map and retention schedule

| Item | Location |
| --- | --- |
| Gate id | `data_map_retention` |
| Materials | [data-map.md](./data-map.md), provisional retention rules in `src/lib/privacy/retention-rules.ts`, retention job notes in [incident-response.md](./incident-response.md) / handoff |
| Linked questions | LQ10–11, OQ15 (deletion/retention), open questions on political-opinion retention |
| Current status | **blocking** — planning aid only; not a privacy policy or legal retention schedule |
| Ask | May the proposed retention postures proceed for a closed synthetic/gated foundation? What must remain provisional before real participant data? |

### 2. Electronic assent documents

| Item | Location |
| --- | --- |
| Gate id | `electronic_assent` |
| Materials | Seeded provisional privacy/conduct docs (synthetic), assent flows under `/account/assent`, LQ8–9 |
| Current status | **blocking** — no “not legally reviewed” doc may become active assent for real accounts |
| Ask | What form of electronic assent is acceptable for invite-only foundation accounts? Which documents may move from provisional to active assent, and under what conditions? |

### 3. Account-holder versus statutory-member terminology

| Item | Location |
| --- | --- |
| Gate id | `statutory_membership` |
| Materials | [product-charter.md](./product-charter.md), LQ3, OQ2, UI copy using “account holder” / “community participant” |
| Current status | **blocking** — no product claim of statutory membership |
| Ask | Confirm product language must avoid statutory “member” until formation/membership counsel settles; any allowed synonyms or required disclaimers? |

### 4. Eligibility and geographic assertions

| Item | Location |
| --- | --- |
| Gate id | `eligibility_geography` |
| Materials | Verification ladder (2.7), LQ12–14, eligibility assertion kinds |
| Current status | **blocking** — no national-mandate or settled residency rule |
| Ask | What eligibility/geography assertions are permitted for a closed pilot, and what must remain unset? |

### 5. Council and board authority

| Item | Location |
| --- | --- |
| Gate id | `account_council_authority` |
| Materials | LQ4–5, OQ1, OQ3; recommendation-only decision records in Phase 1 demo |
| Current status | **blocking** — recommendations only; no board-binding claims |
| Ask | Confirm Policy Council / Deliberation outputs remain non-binding pending board authority design; any required on-product disclaimers? |

### 6. Separation of verification data and political-opinion data

| Item | Location |
| --- | --- |
| Gate id | `political_opinion_verification` |
| Materials | LQ10–11; identity store vs pseudonym maps (2.10); consultation participation forbidden in Phase 2 |
| Current status | **blocking** — keep identity store separated from opinion/pseudonym maps |
| Ask | Confirm architectural separation is adequate for foundation work; conditions before any live consultation or opinion join? |

### 7. Formation or fiscal sponsorship (related readiness)

| Item | Location |
| --- | --- |
| Gate id | `formation_fiscal` |
| Materials | LQ1–2 |
| Current status | **blocking** — no entity/tax claims |
| Ask | Any change to public “proposed project / not incorporated” framing before readiness tag? |

## Return checklist (counsel)

- [ ] Disposition returned for `data_map_retention`
- [ ] Disposition returned for `electronic_assent`
- [ ] Disposition returned for `statutory_membership`
- [ ] Disposition returned for `eligibility_geography`
- [ ] Disposition returned for `account_council_authority`
- [ ] Disposition returned for `political_opinion_verification`
- [ ] Disposition returned for `formation_fiscal` (if affecting readiness claims)
- [ ] Plan §7 table updated with full provenance
- [ ] `src/lib/counsel/dispositions.ts` updated to match
- [ ] Handoff updated; foundation tag still withheld until gated E2E is also green

## Explicit non-outcomes

- This packet does **not** authorize real `active` accounts.
- This packet does **not** authorize public launch, recruitment, donations, or live consultation.
- This packet does **not** approve managed Postgres or production email vendors.
