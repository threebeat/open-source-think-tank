# Phase 1 handoff

**Status:** Demonstration MVP complete for institutional walkthrough review. Not a production community platform.

## Completed work

- Product charter, MVP plan, open questions, and legal-questions scaffolding
- Static synthetic catalog with validation (topics, evidence, consultation, agenda, deliberation, Policy Council decision, transparency)
- Application shell, process map, join preview (nonfunctional)
- Topic briefs with independent evidence-review states and empty-evidence handling
- Simulated consultation with local practice votes and sealed fixture report
- Agenda gate with separate thresholds, calculation traces, and human review
- Deliberation observer: proposal versions, amendments with targeted citations, evidence request, recusal, redaction placeholder
- Decision record: recommendation-only outcome, Policy Council roll call with scoped conflict disclosures, minority report, full proposal history with deliberation deep links
- Guided demo at `/demo` with presentation return/continue bar (`demoStep`), step restore, presenter notes, audience stops
- `/about` project framing (mission, commitments, limitations, contact placeholder)
- Automated lint, typecheck, unit tests, Playwright e2e (Desktop Chrome suite; full guided demo also on Mobile Safari/WebKit and Mobile Chrome/Android emulation; axe on principal routes; manual-QA automation for zoom, reduced motion, text resize, sticky controls, orientation, keyboard)
- Manual QA record: [phase-1-manual-qa.md](./phase-1-manual-qa.md)
- Presentation backup screenshots under `docs/presentation-backup/`
- Planning docs: [data-map.md](./data-map.md), [threat-model.md](./threat-model.md)
- Git tag `phase-1-demonstration` marks the Phase 1 demonstration release (published to `origin` at commit `33ff0cc`)

## Known limitations

- No real accounts, database, Pol.is, payments, identity verification, analytics, or AI APIs
- Consultation “groups” and agenda metrics are authored fixtures, not live computation
- Governing-board adoption authority is intentionally unresolved; decisions use `recommended`, not invented adoption
- Physical iPhone Safari / Android Chrome hardware walkthroughs remain conditional on device availability (emulated Mobile Safari and Mobile Chrome guided-demo runs are required and recorded)
- Screenshot backup must be regenerated after major UI changes (`npm run capture:screenshots`)

## Deferred decisions (do not invent)

See [open-questions.md](./open-questions.md) and [legal-questions.md](./legal-questions.md), especially:

- Statutory membership vs program participation
- Board authority relative to Policy Council recommendations
- Identity-assurance requirements by role
- Overlapping Deliberation / Policy Council membership rules in production
- Political-opinion data retention and public aggregation limits
- Redaction and audit publication depth

## Recommended Phase 2 sequence

Active plan: [phase-2-plan.md](./phase-2-plan.md). Packages **2.1–2.2** establish the contract and architecture ADRs. **Drizzle/PostgreSQL installs begin in 2.3** (gated environments only; public-demo stays fixture-only).

Summary of later packages in that plan: architecture ADRs and environment separation (2.2); production data model (2.3); authentication lifecycle (2.4); server-enforced roles (2.5); versioned assent (2.6); verification ladder (2.7); invite-only onboarding (2.8); audit ledger (2.9); conversation-scoped pseudonym foundations without live Pol.is (2.10); privacy/ops controls (2.11); closed readiness and handoff tag (2.12).

## Demo script (5–8 minutes)

1. Open `/demo`, state the synthetic-data disclaimer, toggle presenter notes.
2. Join preview → show disabled enrollment and “not legally reviewed” placeholders; use **Return to guided demo**.
3. Cedar River topic → evidence-review states independent of popularity.
4. Consultation → practice votes; open sealed report; note non-representative cohort.
5. Agenda → separate thresholds, trace, deferral that refuses popularity override.
6. Deliberation → versions, amendments, targeted citations, recusal, redaction.
7. Decision → Policy Council roll call, Farah minority report, Hugo recusal with conflict disclosure, proposal history accordion.
8. Transparency → audit feed and protected classes.
9. Audience stops: legal, technical, board.
10. Reset and confirm local demo state restores.

## Commands for the next developer

```bash
npm install
npm run dev
npm run lint
npm run typecheck
npm test
npm run test:e2e
```
