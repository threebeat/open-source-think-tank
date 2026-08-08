# Product Charter — Open-Source Think Tank (Phase 1)

**Status:** Proposed project and demonstration prototype. This is not a claim that an organization is incorporated, tax-exempt, legally reviewed, or accepting members.

**Working name:** Open-Source Think Tank (proposed project name, not a legal entity name)

**Initial jurisdiction (intended):** Tennessee, with intended U.S. expansion. Formation, tax status, and multistate obligations remain unresolved; see [legal-questions.md](./legal-questions.md).

---

## Mission

Build a public, nonpartisan process for examining policy questions with open evidence, structured consultation, transparent agenda rules, capacity-limited deliberation, and published decision records—so that preference, cross-group agreement, and evidence quality stay visibly separate, and no algorithm silently becomes the institution.

Phase 1 proves that journey as a runnable browser demonstration using synthetic data only.

---

## Phase 1 scope

Phase 1 is a **demonstration MVP**, not a production community platform.

- All people, organizations, evidence, votes, consultation results, and decisions in the prototype are unmistakably synthetic.
- Membership verification, Pol.is-style consultation, agenda calculations, and deliberation are simulated.
- The prototype must not accept real memberships, real political-opinion data, donations, identity documents, or legally binding agreements.
- No database, account provider, analytics service, Pol.is account, payment processor, or identity vendor is required.
- No secret or API key is present.

Someone viewing the demo should be able to answer:

1. How does a person join?
2. What is being verified, and at what stage?
3. How are policy questions and evidence presented?
4. How does an open consultation work?
5. How does Pol.is-style opinion mapping influence an agenda without automatically deciding it?
6. Who is allowed to deliberate after the open consultation?
7. Who adopts a final institutional position?
8. What records, disagreements, overrides, and conflicts become public?
9. What participant information stays private?

---

## Intended audiences for the demonstration

| Audience | Why they view the demo |
| --- | --- |
| Lawyers / counsel | See intended consent, verification, transparency, and unresolved legal questions without mistaking placeholders for approved terms |
| Designers | Critique clarity of stages, roles, and mobile-usable public surfaces |
| Prospective board members | Understand separation of powers and what would remain fiduciary vs advisory |
| Developers | Understand technical boundaries, synthetic fixtures, and future service adapters |
| Early funders | See institutional coherence before real recruitment or fundraising |

---

## Prototype terminology

Use these terms consistently until legal counsel advises otherwise:

| Prototype term | Meaning |
| --- | --- |
| Visitor | Anyone viewing public material without an account |
| Community participant | A person eligible to contribute to open consultations |
| Deliberation council | A capacity-limited, term-limited group that discusses agenda items |
| Policy council | The body that recommends adoption of a final position |
| Governing board | The legal fiduciary body; its exact authority remains a legal-design question |
| Consultation | A structured period for submitting and voting on short statements |
| Agenda item | A question that passed published thresholds and human review |
| Decision record | The permanent, versioned explanation of an adopted, rejected, or returned proposal |

Do not call every platform account a legal or corporate “member.” That term may have consequences under Tennessee nonprofit law. The prototype must visibly label membership status as an unresolved legal decision. See [open-questions.md](./open-questions.md) and [legal-questions.md](./legal-questions.md).

---

## Institutional stages (demonstration pipeline)

The Phase 1 journey, in order:

1. **Join preview** — Eligibility, verification ladder preview, conduct and privacy assent placeholders (nonfunctional; no data collected).
2. **Topic and evidence** — Neutral brief, competing claims, sources, counterevidence, disclosures.
3. **Consultation** — Simulated Pol.is-style statement voting and mock opinion-group results.
4. **Agenda** — Published thresholds, calculation trace, evidence readiness, human review.
5. **Deliberation** — Public-observer view of council discussion, amendments, evidence requests, conflicts, recusals.
6. **Decision** — Final proposal, vote, rationale, minority report, revision or review date.
7. **Transparency** — Audit log, method versions, governance map, open-by-default vs protected-by-necessity data.

Roles along this path: Visitor → Community participant (consultation) → Deliberation council → Policy council → Governing board (authority pending counsel). Algorithms and fixtures may recommend or organize; they do not silently replace human institutional decisions.

---

## Preference, agreement, and evidence quality

These must remain distinct in product language and UI:

| Signal | What it measures | What it is not |
| --- | --- | --- |
| Participant preference | How individuals respond to consultation statements (agree / disagree / pass) | Proof that a claim is true |
| Cross-group agreement | Overlap across neutrally labeled opinion groups (e.g., Group A, B, C) | A population mandate or representative sample of the United States |
| Evidence quality | Source review status, limitations, conflicts, and counterevidence | Popularity or consensus |

Rules for the prototype:

- Popularity does not change an evidence-review status.
- Consensus is not proof; disagreement is not evidence of equal factual support.
- Opinion groups are labeled neutrally; they are never labeled by ideology or inferred identity.
- Participating users in the demo are synthetic and are not a representative sample.

---

## Algorithms recommend; humans decide

- Agenda methods, consultation summaries, and related calculations **recommend or organize**.
- They do **not** silently make institutional decisions.
- Every material human departure from a default calculation must be visible and reasoned (reviewer role, decision, timestamp, conflicts, rationale).
- The interface must never present a single unexplained “truth score” that collapses preference, agreement, and evidence.

---

## Public transparency vs private personal data

**Open by default (institutional / public):** decision records; disagreement and minority reports; human overrides and rationales; conflict disclosures appropriate to public observation; method and algorithm versions; append-only audit of institutional actions; published agenda thresholds and calculation traces using synthetic inputs in Phase 1.

**Protected by necessity (not public in production intent; not collected in Phase 1):** legal identities; verification artifacts; security-sensitive details; granular political-opinion histories; other personal data that would enable re-identification or misuse.

Transparency never means exposing identity or political-opinion records. Phase 1 collects no real participant data.

---

## Phase 1 exclusions

Do not introduce or imply any of the following during Phase 1:

- Real accounts, authentication providers, or membership enrollment
- Databases or required environment variables / secrets / API keys
- Hosted Pol.is accounts or Pol.is server code; identity-verification SDKs
- Analytics, advertising, payments, donations, or AI APIs
- A native mobile application
- A general social feed, private messaging, notifications, or personalized content ranking
- Legal terms written as though approved; use clearly marked placeholders and counsel questions
- Red-versus-blue political visual language, campaign motifs, flags, or ideology labels
- Claims that resemble statements by real identifiable people
- Real form submission that implies membership, consent, verification, or donation
- Treating “community participant” as a settled statutory membership status

Technical shape for Phase 1 (see [decisions/0001-static-demonstration-first.md](./decisions/0001-static-demonstration-first.md)): Next.js App Router, TypeScript, Tailwind CSS, static fixtures, client-side demo state, domain types independent of React, future services behind adapters.

---

## Related documents

- [open-questions.md](./open-questions.md) — unresolved product decisions
- [legal-questions.md](./legal-questions.md) — questions for counsel
- [decisions/0001-static-demonstration-first.md](./decisions/0001-static-demonstration-first.md) — Phase 1 architecture decision
