# Counsel review packet — Phase 2 readiness (2.12)

**Status:** Disposition return recorded — alpha-test interim council (2026-08-10).  
**Issued date:** 2026-08-10  
**Issued by:** Phase 2 readiness engineering  
**Purpose:** Obtain recorded counsel dispositions required before the Phase 2 foundation readiness tag and any real launch. Under the project-owner two-lane rule ([ADR 0006](./decisions/0006-phase-3-two-lane-sequencing.md)), Phase 3 *synthetic/closed* engineering may proceed. Public summary of returned dispositions: [ADR 0007](./decisions/0007-alpha-test-interim-council-dispositions.md).

Nothing in this packet invents clearance beyond the recorded public summary. Privileged counsel material must not be committed.

## Public-repository confidentiality warning

This repository is (or may become) **public**. Do **not** commit privileged counsel advice, private client facts, or non-public legal analysis.

| Allowed in-repo | Not allowed in-repo |
| --- | --- |
| Counsel-approved **public summaries** of disposition status/scope | Privileged memoranda, emails, or verbatim counsel advice |
| Opaque internal decision-record references (e.g. “Counsel memo 2026-…, on file”) | Attachment of private PDFs or paste of confidential reasoning |
| Updates to plan §7 / `dispositions.ts` using the public vocabulary (`blocking` / `conditionally_cleared` / `cleared`) | Secrets, real participant data, or production credentials |

Return privileged detail through a private channel; record only the approved public summary and opaque citation here.

## How dispositions were returned

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

## Topics and recorded dispositions

### 1. Data map and retention schedule

| Item | Location |
| --- | --- |
| Gate id | `data_map_retention` |
| Materials | [data-map.md](./data-map.md), provisional retention rules in `src/lib/privacy/retention-rules.ts`, retention job notes in [incident-response.md](./incident-response.md) / handoff |
| Linked questions | LQ10–11, OQ15 (deletion/retention), open questions on political-opinion retention |
| Recorded status | **cleared** (alpha-test scope) |
| Scope | Proposed retention postures may run to prove efficacy; project **must** reset all included alpha-test data — no users or topic discussion carry over |
| Provenance | [ADR 0007](./decisions/0007-alpha-test-interim-council-dispositions.md) |

### 2. Electronic assent documents

| Item | Location |
| --- | --- |
| Gate id | `electronic_assent` |
| Materials | Seeded provisional privacy/conduct docs (synthetic), assent flows under `/account/assent`, LQ8–9 |
| Recorded status | **cleared** (alpha-test scope) |
| Scope | Keep current electronic assent; bot/activity metrics and engineering discretion may inform later authentication |
| Provenance | [ADR 0007](./decisions/0007-alpha-test-interim-council-dispositions.md) |

### 3. Account-holder versus statutory-member terminology

| Item | Location |
| --- | --- |
| Gate id | `statutory_membership` |
| Materials | [product-charter.md](./product-charter.md), LQ3, OQ2, UI copy using “account holder” / “community participant” |
| Recorded status | **cleared** (alpha-test scope) |
| Scope | “Member” OK if test purpose communicated at assent and continually; preferred synonym **delegate**; not permanent statutory membership |
| Provenance | [ADR 0007](./decisions/0007-alpha-test-interim-council-dispositions.md) |

### 4. Eligibility and geographic assertions

| Item | Location |
| --- | --- |
| Gate id | `eligibility_geography` |
| Materials | Verification ladder (2.7), LQ12–14, eligibility assertion kinds |
| Recorded status | **cleared** (alpha-test scope) |
| Scope | **No geographical eligibility requirements** until the alpha test ends; keep eligibility open for travel/demo |
| Provenance | [ADR 0007](./decisions/0007-alpha-test-interim-council-dispositions.md) |

### 5. Council and board authority

| Item | Location |
| --- | --- |
| Gate id | `account_council_authority` |
| Materials | LQ4–5, OQ1, OQ3; recommendation-only decision records in Phase 1 demo |
| Recorded status | **cleared** (alpha-test scope) |
| Scope | Continual communication of test purpose/limits sufficient; formal council/board forms during the alpha test |
| Provenance | [ADR 0007](./decisions/0007-alpha-test-interim-council-dispositions.md) |

### 6. Separation of verification data and political-opinion data

| Item | Location |
| --- | --- |
| Gate id | `political_opinion_verification` |
| Materials | LQ10–11; identity store vs pseudonym maps (2.10); consultation participation forbidden in Phase 2 |
| Recorded status | **cleared** (alpha-test scope) |
| Scope | Existing separation adequate for now; no further action for the alpha-test foundation |
| Provenance | [ADR 0007](./decisions/0007-alpha-test-interim-council-dispositions.md) |

### 7. Formation or fiscal sponsorship (related readiness)

| Item | Location |
| --- | --- |
| Gate id | `formation_fiscal` |
| Materials | LQ1–2 |
| Recorded status | **cleared** (alpha-test scope) |
| Scope | Existing proposed-project / not-incorporated framing adequate for now |
| Provenance | [ADR 0007](./decisions/0007-alpha-test-interim-council-dispositions.md) |

## Return checklist (counsel)

- [x] Disposition returned for `data_map_retention`
- [x] Disposition returned for `electronic_assent`
- [x] Disposition returned for `statutory_membership`
- [x] Disposition returned for `eligibility_geography`
- [x] Disposition returned for `account_council_authority`
- [x] Disposition returned for `political_opinion_verification`
- [x] Disposition returned for `formation_fiscal` (if affecting readiness claims)
- [x] Plan §7 table updated with full provenance
- [x] `src/lib/counsel/dispositions.ts` updated to match
- [x] Handoff updated; foundation tag authorized after interim council return + gated E2E evidence

## Explicit non-outcomes

- These dispositions authorize the **alpha-test invite-only foundation** under the scopes above — not a public launch, recruitment, donations, or live consultation.
- Alpha-test participant/topic data must remain **resettable**; post-alpha lasting questions go in the report.
- These dispositions do **not** approve managed Postgres or production email vendors.
