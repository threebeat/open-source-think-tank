# ADR 0007 — Alpha-test interim council dispositions (public summary)

**Status:** Accepted  
**Date:** 2026-08-10  
**Source packet:** [counsel-review-packet-2.12.md](../counsel-review-packet-2.12.md)  
**Mirrored in:** [phase-2-plan.md](../phase-2-plan.md) §7, `src/lib/counsel/dispositions.ts`

This is a **public summary** of dispositions returned by the project’s interim council. It is not privileged legal advice and must not be treated as a permanent post–alpha-test settlement of formation, membership, or privacy law.

## Operating context (interim council)

- The project is sole-built until the planned **alpha test**.
- Until that test, the project owner acts as the interim council; a formal council and board will be formed during the alpha test and will provide feedback from that point.
- From this disposition set through the end of the alpha test, retained institutional outputs are intended to be the **product** and a **post-alpha report** (full plan, achievements, and lasting open questions / decisions required after the alpha test). Participant accounts and topic discussion from the alpha test must not carry over.

## Disposition return (public summary)

| # | Gate id | Status | Scope and conditions (public summary) |
| --- | --- | --- | --- |
| 1 | `data_map_retention` | cleared | Proposed retention postures may operate to prove efficacy for the alpha test. The project **must** be able to reset all included alpha-test data; no users or topic discussion carry over after the test. |
| 2 | `electronic_assent` | cleared | Keep current electronic assent for the alpha test. Bot activity and other metrics may be used to learn what assent is necessary; engineering discretion applies to what is feasible in the alpha test and how findings inform later authentication strategy (see eligibility disposition). |
| 3 | `statutory_membership` | cleared | For the alpha test, “member” need not be omitted if the test purpose is communicated clearly at assent and continually during the test. Preferred synonym: **delegate**. Statutory/permanent membership claims remain out of scope for this clearance. |
| 4 | `eligibility_geography` | cleared | **No geographical eligibility requirements** until the alpha test ends. Eligibility should stay open enough to travel and demonstrate the platform; the test may inform later eligibility design. |
| 5 | `account_council_authority` | cleared | Continual communication of non-settled / test purpose is sufficient for the alpha test; no additional authority steps required until after the test completes. |
| 6 | `political_opinion_verification` | cleared | Existing separation of verification and political-opinion / pseudonym handling is adequate for now; no further action for the alpha-test foundation. |
| 7 | `formation_fiscal` | cleared | Existing “proposed project / not incorporated” framing is adequate for now; no further action for the alpha-test foundation. |

## Consequences

- Readiness counsel gates allow `readinessCounselAllowsFoundationTag()` when mirrored in `dispositions.ts`.
- Activation counsel gates allow real (non-synthetic) `active` accounts for the **alpha-test invite-only foundation** when engineering onboarding gates also pass.
- Lasting legal/product questions must be listed in the post-alpha report; do not treat this ADR as closing post-alpha counsel work.
- Managed Postgres host, production email, payments, analytics, AI APIs, live Pol.is, and identity-verification SDKs remain governed by the permitted-services register (unchanged by this ADR).

## Confirmation

Recorded from the interim council / board response authorizing Cursor to update plan §7, `dispositions.ts`, and the foundation tag (2026-08-10).
