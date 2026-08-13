# Open-Source Think Tank: MVP Build Plan for Cursor

Status: Phase 1 demonstration MVP complete (see `docs/phase-1-handoff.md`)  
Initial jurisdiction: Tennessee, with intended U.S. expansion  
Immediate objective: build a working browser-based demonstration using synthetic data

## 1. What the MVP must prove

The first MVP is not a production community platform. It is a runnable, responsive demonstration that makes the proposed institution understandable.

Someone viewing it should be able to answer:

1. How does a person join?
2. What is being verified, and at what stage?
3. How are policy questions and evidence presented?
4. How does an open consultation work?
5. How does Pol.is-style opinion mapping influence an agenda without automatically deciding it?
6. Who is allowed to deliberate after the open consultation?
7. Who adopts a final institutional position?
8. What records, disagreements, overrides, and conflicts become public?
9. What participant information stays private?

Phase 1 must use synthetic data only. It must not accept real memberships, real political-opinion data, donations, identity documents, or legally binding agreements.

## 2. Product terminology for the prototype

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

Do not call every platform account a legal or corporate “member.” That term may have consequences under Tennessee nonprofit law. The prototype should visibly label this as an unresolved legal decision.

## 3. Development phases

### Phase 1 — Demonstration MVP

Create a working, mobile-responsive browser application that demonstrates the full institutional journey with synthetic data. Membership verification, Pol.is, agenda calculations, and deliberation are simulated. The product must be coherent enough to show lawyers, designers, potential board members, developers, and early funders.

### Phase 2 — Membership, consent, and governance foundation

Add real accounts, role-based permissions, versioned conduct assent, privacy consent, audit events, and an initial verification ladder. Resolve with counsel whether community participants are merely program participants or statutory members. No public recruitment should occur until the core documents and data handling are reviewed.

**Active work packages:** see [`docs/phase-2-plan.md`](./phase-2-plan.md). Phase 2 is an invite-only foundation in a separate gated environment; the tagged Phase 1 synthetic demonstration remains separately deployable.

### Phase 3 — Topics, claims, and evidence workflow

Build the real system for creating topic briefs, submitting claims, attaching sources, recording counterevidence, reviewing source quality, disclosing conflicts, moderating submissions, and preserving revision history. Keep evidence quality separate from popularity and consensus.

### Phase 4 — Computational democracy journey & Public Input

Recenter the product around Idea Commons → qualified proposal → Public Input (Pol.is when approved) → transparent agenda qualification → deliberation → policy recommendation → member actions → review/lineage. Retain Pol.is deliverables (supported hosted embed; provider-neutral mapping; conversation-scoped pseudonyms; moderation; versioned import/export and reports; outage/retention/reset/audit) across packages 4.2–4.4+. Package **4.1** ships the institutional contract and synthetic end-to-end demo only — **no live Pol.is**. See [`docs/phase-4-plan.md`](./phase-4-plan.md).

### Phase 5 — Agenda engine and algorithm laboratory

Implement published eligibility thresholds, cross-group consensus measurements, disagreement and salience measures, evidence-readiness checks, representation diagnostics, and documented human overrides. Every algorithm run must be reproducible from a dataset snapshot, code version, parameters, and output. New algorithms must run in shadow mode before affecting decisions.

### Phase 6 — Deliberation and decision-making

Create the real council workspace: member selection and terms, conflict disclosures, meeting records, proposal versions, amendments, evidence requests, recusals, votes, minority reports, appeals, and final decision records. The governing documents must define which actions are advisory, binding, or reserved to the legal board.

### Phase 7 — Public pilot, security, and legal readiness

Complete a privacy and security review, threat model, moderation staffing plan, incident response plan, backup and recovery testing, accessibility review, legal-document implementation, insurance review, and limited Tennessee-based adult pilot. Incorporation or fiscal sponsorship, federal tax status, Tennessee charity registration, and fundraising compliance belong here or earlier if money is accepted.

### Phase 8 — National expansion and native mobile application

Expand eligibility and operations beyond Tennessee, review charitable-solicitation and privacy obligations state by state, improve sampling and representation, add scalable moderation, and build an Expo/React Native app against the same application API. Stable web URLs should become universal/app links in the native application.

## 4. Phase 1 definition of done

Phase 1 is complete only when all of the following are true:

- A new developer can clone the repository, run `npm install`, and start it with `npm run dev`.
- `npm run build`, linting, type checking, unit tests, and end-to-end smoke tests pass.
- The prototype works in phone browsers without installation, including current iPhone Safari and Android Chrome.
- The prototype is usable at 320 px, 375 px, 390 px, and 430 px widths, in both portrait and landscape where appropriate, as well as at tablet and desktop widths.
- Every principal stage can be reached through navigation and a guided demo.
- All people, organizations, evidence, votes, consultation results, and decisions are unmistakably synthetic.
- No database, account provider, analytics service, Pol.is account, payment processor, or identity vendor is required.
- No secret or API key is present.
- The prototype contains no real form submission that implies membership, consent, verification, or donation.
- Keyboard navigation works and automated accessibility tests report no serious or critical violations.
- The interface never presents consensus as proof, evidence quality as popularity, or participating users as a representative sample of the United States.
- A five-to-eight-minute demonstration can explain the institution from joining through final decision publication.
- A legal-questions document identifies the decisions that require Tennessee nonprofit, federal tax-exemption, privacy, platform, and multistate-fundraising advice.

## 5. Phase 1 technical constraints

Cursor must follow these constraints throughout Phase 1:

- Use Next.js App Router, TypeScript, Tailwind CSS, and a small set of shadcn/ui components.
- Use a single application repository. Do not introduce microservices or a monorepo.
- Use static TypeScript fixtures and client-side demo state only.
- Keep domain types independent from React components.
- Put future external services behind interfaces or adapters.
- Do not install Supabase, a real authentication provider, Pol.is server code, an identity-verification SDK, analytics, advertising, payments, or AI APIs.
- Do not create a native app.
- Do not build a general social feed, private messaging, notifications, or personalized content ranking.
- Do not write legal terms as though they have been approved. Use clearly marked placeholders and legal-review questions.
- Do not use red-versus-blue political visual language, campaign motifs, flags, or ideology labels.
- Do not generate claims that resemble statements by real identifiable people.
- Prefer understandable code over abstraction. Add an abstraction only when it supports an identified future service boundary.

### Phone-browser requirements

Phone-browser support is part of Phase 1, not a later mobile-app phase. Cursor must:

- Make every public route usable directly in Safari on iPhone and Chrome on Android without installing an app.
- Include correct responsive viewport metadata.
- Use fluid layouts and mobile-first breakpoints; do not create a separate reduced mobile website.
- Avoid page-level horizontal scrolling. If a complex data table cannot become cards, place it in a clearly labeled, keyboard-accessible local scroll region and provide a plain-language summary.
- Make primary touch targets at least 44 by 44 CSS pixels and leave sufficient space between adjacent controls.
- Never require hover to reveal information or activate an action.
- Use at least 16 CSS pixels for form-control text so iPhone Safari does not unexpectedly zoom when a field receives focus.
- Keep focused fields and controls visible when the on-screen keyboard opens.
- Account for notches and browser controls with safe-area insets where fixed or sticky elements are used.
- Prefer dynamic viewport units such as `dvh` with sensible fallbacks rather than assuming `100vh` equals the visible phone screen.
- Ensure sticky headers, bottom controls, dialogs, and sheets do not cover content or trap scrolling.
- Allow text to resize and reflow without clipping, overlap, or lost controls.
- Give every chart or visual metric a textual explanation and an accessible tabular or list representation.
- Keep images small, responsive, and optional to understanding; lazy-load noncritical images.
- Add a basic web-app manifest and mobile metadata, but do not add a service worker or offline behavior during Phase 1.
- Document how to open the local demonstration from a phone on the same network, and how to use a deployable preview build when collaborators are not physically present.
- Test at least one real iPhone/Safari device and one real Android/Chrome device before calling Phase 1 complete, when those devices are available. Browser emulation alone is not sufficient for final signoff.

## 6. Phase 1 route map

Cursor should implement these routes:

| Route | Purpose |
| --- | --- |
| `/` | Mission, value proposition, current demonstration topic, and start-demo action |
| `/process` | Complete public explanation of the institutional pipeline |
| `/join` | Nonfunctional preview of eligibility, human verification, conduct, privacy, and account steps |
| `/topics` | Searchable/filterable list of demonstration topics |
| `/topics/[slug]` | Topic brief, claims, sources, counterevidence, disclosures, and status |
| `/topics/[slug]/consult` | Simulated Pol.is-style statement voting and mock results |
| `/agenda` | Agenda qualification rules and current synthetic agenda items |
| `/agenda/[slug]` | Why an item qualified, its evidence readiness, disagreement, and human review record |
| `/deliberation/[slug]` | Public-observer view of council discussion, amendments, evidence requests, and conflicts |
| `/decisions/[slug]` | Final proposal, vote, rationale, dissent, evidence, and revision history |
| `/transparency` | Public audit log, method versions, governance diagram, and prototype data policy |
| `/about` | Project description, openness commitments, limitations, and contact placeholder |
| `/demo` | Guided demonstration controls and scenario reset |

## 7. Phase 1 synthetic scenario

Create one complete fictional policy scenario and two lighter examples. Use subjects that are meaningful enough to demonstrate evidence and disagreement but do not imitate a current candidate campaign.

The complete scenario must include:

- A neutral policy question
- A short factual background
- At least three claims supporting different policy approaches
- At least six synthetic evidence sources with visibly different review states
- Supporting evidence and counterevidence
- At least eight short consultation statements
- Three simulated opinion groups named neutrally, such as Group A, Group B, and Group C
- At least two cross-group consensus statements
- At least two high-disagreement statements
- One statement that is popular but has weak evidence
- One statement that is less popular but has stronger evidence
- A synthetic agenda-calculation result
- A documented human review decision
- One draft proposal, two amendments, one evidence request, and one recusal
- A final vote, written rationale, and minority report
- A later revision or scheduled review date

Never label synthetic opinion groups as liberal, conservative, populist, establishment, urban, rural, or another inferred identity.

## 8. Phase 1 work packages and individual steps

Cursor should complete one work package at a time. It must stop after each package, run the specified checks, summarize changed files, and wait for human approval before continuing.

### Work package 1.1 — Establish the written build contract

1. Create `docs/product-charter.md`.
2. State the mission in plain, nonpartisan language.
3. Define Phase 1 as a demonstration using synthetic data.
4. List the intended audiences for the demo.
5. Copy the prototype terminology table into the charter.
6. State the distinction between participant preference, cross-group agreement, and evidence quality.
7. State that algorithms recommend or organize; they do not silently make institutional decisions.
8. Add the Phase 1 exclusions from this plan.
9. Create `docs/open-questions.md` for unresolved product decisions.
10. Create `docs/legal-questions.md` using the legal-question list in Section 10.
11. Add a short architecture decision record, `docs/decisions/0001-static-demonstration-first.md`.

Acceptance criteria:

- The documents consistently describe the same stages and roles.
- Nothing claims that the organization is already incorporated, tax-exempt, legally reviewed, or accepting members.
- The distinction between public transparency and private personal data is explicit.

### Work package 1.2 — Scaffold the repository

1. Confirm that a current Node.js LTS release and Git are installed.
2. Create a Next.js project with App Router, TypeScript, Tailwind, ESLint, a `src` directory, and `@/*` import alias.
3. Confirm the development server runs.
4. Initialize or confirm Git version control.
5. Add `.nvmrc` or an equivalent Node-version declaration.
6. Add scripts for `dev`, `build`, `lint`, `typecheck`, `test`, and `test:e2e`.
7. Add Vitest and React Testing Library.
8. Add Playwright and axe integration for basic end-to-end accessibility checks.
9. Initialize shadcn/ui and add only the components required by the first screen.
10. Create the folders `src/domain`, `src/features`, `src/components`, `src/lib/adapters`, `src/fixtures`, and `docs/decisions`.
11. Replace the starter page with a minimal prototype placeholder.
12. Add a visible development-only banner reading “Demonstration — synthetic data only.”
13. Run build, lint, typecheck, and the starter test.
14. Commit this work separately.

Acceptance criteria:

- A clean installation and local start work from the README instructions.
- No environment variables are required.
- No unused platform service has been installed.
- The initial page has no console error or hydration warning.

### Work package 1.3 — Define the domain model and fixtures

1. Create framework-independent TypeScript types for `Topic`, `Claim`, `EvidenceSource`, `ConsultationStatement`, `OpinionGroup`, `ConsultationResult`, `AgendaItem`, `Proposal`, `Amendment`, `CouncilParticipant`, `ConflictDisclosure`, `Decision`, and `AuditEvent`.
2. Add enumerated statuses for topic stage, evidence review, agenda state, proposal state, and decision outcome.
3. Add runtime validation for fixture data with Zod or an equivalent small schema library.
4. Create one complete synthetic scenario matching Section 7.
5. Create two smaller topic fixtures in earlier stages.
6. Add a `synthetic: true` marker to every top-level fixture.
7. Use fictional organizations and sources that cannot be mistaken for actual institutions.
8. Give fixtures stable IDs and slugs.
9. Create selector functions that retrieve topics, agenda items, deliberations, and decisions without importing React.
10. Add unit tests that validate every fixture and catch broken relationships.

Acceptance criteria:

- Invalid fixture data causes a test failure.
- No React component contains a large hard-coded dataset.
- The same synthetic scenario powers the topic, consultation, agenda, deliberation, and decision pages.

### Work package 1.4 — Create the design system and application shell

1. Define color, typography, spacing, border, radius, focus, and motion tokens in CSS variables.
2. Use a warm neutral background, dark ink text, a restrained teal or green primary color, and an accessible amber accent.
3. Verify text and interactive-element contrast.
4. Use an open, readable sans-serif family; optionally use a restrained serif for policy-document headings.
5. Build the global header, desktop navigation, mobile navigation, main content container, footer, and breadcrumb.
6. Build reusable components: `PrototypeBanner`, `StageBadge`, `ProcessStepper`, `MetricWithExplanation`, `DisclosureNotice`, `EmptyState`, and `PageHeader`.
7. Ensure every interactive component has visible hover, active, disabled, and keyboard-focus states.
8. Respect reduced-motion preferences.
9. Add metadata, a generic favicon placeholder, and an informative page title pattern.
10. Add responsive viewport metadata, mobile theme metadata, and a basic web-app manifest.
11. Implement safe-area spacing for any sticky or fixed mobile element.
12. Verify that menus, dialogs, sheets, and long pages scroll correctly with touch and with the on-screen keyboard open.
13. Test the shell at 320 px, 375 px, 390 px, and 430 px phone widths, phone landscape, tablet, and desktop sizes.

Acceptance criteria:

- The visual style does not resemble a political campaign.
- Navigation is usable with keyboard only.
- Navigation is usable by touch in iPhone Safari and Android Chrome without relying on hover.
- The prototype banner is visible on every route.
- No content requires horizontal scrolling at phone width.
- No sticky or fixed element is hidden behind a notch, home indicator, or browser toolbar.

### Work package 1.5 — Build the public explanation and join preview

1. Build the home page with mission, one-sentence method, featured synthetic topic, current stage, and “Explore the demo” action.
2. Build `/process` with a seven-stage process explanation.
3. For each stage, show who participates, what happens, what is produced, and what becomes public.
4. Show that the governing board’s precise legal authority is pending counsel review.
5. Build `/join` as a nonfunctional visual walkthrough.
6. Include screens or panels for eligibility, bot resistance, account continuity, conduct assent, privacy consent, and stronger verification for higher-impact roles.
7. Clearly distinguish bot detection, account continuity, uniqueness, and legal identity.
8. Display placeholder summaries for the conduct and privacy documents marked “Not legally reviewed.”
9. Disable the final join action and explain that the prototype does not collect information.
10. Add a short explanation of viewpoint-neutral participation and behavior-based enforcement.
11. Add component and route-level tests.

Acceptance criteria:

- A lawyer can see every intended consent and verification step.
- A visitor cannot accidentally submit personal information.
- The page does not imply that identification documents will necessarily be required.

### Work package 1.6 — Build topics and evidence views

1. Build `/topics` with stage, subject, and status filters.
2. Add a plain-language search box that filters local fixtures only.
3. Build a reusable `TopicCard`.
4. Build `/topics/[slug]` using the complete synthetic scenario.
5. Show the policy question, neutral background, scope, stage, participation summary, and next step.
6. Build reusable `ClaimCard` and `EvidenceSourceCard` components.
7. Show supporting evidence and counterevidence beside each claim.
8. Show source date, author type, source type, review status, conflicts, and limitations.
9. Add a visible rule that popularity does not change an evidence-review status.
10. Include a changelog for the topic brief.
11. Add a “How evidence is reviewed” explainer.
12. Test missing, pending, disputed, and reviewed evidence states.

Acceptance criteria:

- Opposing claims receive the same visual treatment.
- Source quality and participant support are visually distinct.
- A visitor can determine why a source is pending, accepted, limited, or disputed.

### Work package 1.7 — Build the simulated consultation

1. Build `/topics/[slug]/consult`.
2. Add an introductory explanation that this imitates the role of Pol.is but is not a real Pol.is conversation.
3. Present one short statement at a time.
4. Add Agree, Disagree, and Pass controls.
5. Keep selections only in browser memory or session storage.
6. Add a reset control.
7. Prevent fixture content from changing based on the simulated user’s answers in a way that resembles personalization.
8. Add an accessible progress indicator.
9. After several responses, allow the visitor to open the fixed synthetic report.
10. Show participation count, response coverage, consensus statements, high-disagreement statements, and neutral group labels.
11. Explain that the displayed participants are not a representative sample.
12. Explain that consensus is not proof and disagreement is not evidence of equal factual support.
13. Link each statement to related claims or evidence where applicable.
14. Add keyboard and screen-reader tests for the voting controls.

Acceptance criteria:

- The simulation is understandable without knowing Pol.is.
- No synthetic vote is sent anywhere.
- The results page does not label groups ideologically or present a population mandate.

### Work package 1.8 — Build the agenda view and transparent mock calculation

1. Build `/agenda` with a concise explanation of the agenda gate.
2. Display synthetic items in proposed, qualified, deferred, and rejected states.
3. Build `/agenda/[slug]` for the complete scenario.
4. Show each published eligibility threshold separately.
5. Include participation coverage, cross-group support, disagreement/salience, evidence readiness, and representation warning indicators.
6. Do not combine all indicators into an unexplained “truth score.”
7. Show a plain-language calculation trace using fixed fixture inputs.
8. Show the algorithm or method version.
9. Include a human-review section with reviewer role, decision, timestamp, conflicts, and rationale.
10. Include at least one example where the reviewer defers an item rather than overriding evidence concerns.
11. Include a sensitivity note describing which result could change if thresholds changed.
12. Link back to the consultation and evidence record.
13. Add tests for every agenda status.

Acceptance criteria:

- A visitor can explain why the item qualified or did not qualify.
- Every human departure from the default calculation is visible and reasoned.
- The UI never implies that popularity alone determines the agenda.

### Work package 1.9 — Build the public-observer deliberation view

1. Build `/deliberation/[slug]`.
2. Explain how the synthetic deliberation council was selected.
3. Show fictional council participants, terms, selection path, and conflict disclosures.
4. Show the initial proposal and subsequent versions.
5. Add two synthetic amendments with status and rationale.
6. Add an evidence request and the response supplied to the council.
7. Add one recusal with an explanation that does not disclose unnecessary private information.
8. Add a chronological meeting or action timeline.
9. Clearly distinguish public observation from participation rights.
10. Add a placeholder for permitted narrow redactions and a public redaction reason.
11. Link every material factual claim back to the evidence record.
12. Test proposal version navigation and amendment status display.

Acceptance criteria:

- A visitor can follow how the draft changed.
- Conflicts, recusals, and redactions are visible without exposing unnecessary personal data.
- “Closed” means capacity-limited participation, not secret institutional action.

### Work package 1.10 — Build the decision record and transparency center

1. Build `/decisions/[slug]`.
2. Show the final proposal, adopting body, vote, rationale, effective date, and review date.
3. Include a roll-call view using fictional people.
4. Include a minority report with equal prominence and clear authorship.
5. Show the full proposal version history.
6. Link to the topic, evidence, consultation, agenda review, and deliberation pages.
7. Build `/transparency`.
8. Add a synthetic append-only audit-event feed.
9. Add a governance map showing the participant, council, policy-council, and board relationships.
10. Add a method registry listing consultation, evidence-review, and agenda-method versions.
11. Add an “Open by default / Protected by necessity” data table.
12. Mark identities, verification artifacts, security-sensitive details, and granular political-opinion histories as protected.
13. Add prototype limitations and known unresolved decisions.
14. Add route-level tests.

Acceptance criteria:

- Every outcome can be traced backward to its inputs and institutional actions.
- Dissent is not buried.
- Transparency never means exposing identity or political-opinion records.

### Work package 1.11 — Add the guided demonstration

1. Build `/demo` as a presentation-mode entry point.
2. Create a five-to-eight-minute guided sequence through the complete synthetic scenario.
3. Provide Next, Back, Exit, and Reset controls.
4. Preserve the current demonstration step on refresh without storing personal information.
5. Add optional presenter notes that are visible only after an explicit toggle.
6. Add a “Questions for legal counsel” stop in the walkthrough.
7. Add a “Questions for technical collaborators” stop.
8. Add a “Questions for prospective board members” stop.
9. Ensure direct URLs still work without presentation mode.
10. Add an end-to-end test covering the full guided path.

Acceptance criteria:

- A presenter can conduct the demo without explaining missing navigation or broken screens.
- Reset restores the original synthetic state.
- The walkthrough never implies that mocked actions are legally or technically operational.

### Work package 1.12 — Quality assurance and handoff

1. Run formatting, linting, type checking, unit tests, end-to-end tests, and production build.
2. Fix all errors rather than disabling the check that found them.
3. Run automated accessibility tests on every principal route.
4. Manually test keyboard navigation, focus order, visible focus, headings, labels, error-free zoom, and reduced motion.
5. Test at 320 px, 375 px, 390 px, and 430 px phone widths; phone landscape; tablet; laptop; and wide desktop widths.
6. Test the complete guided demonstration using mobile emulation for iPhone Safari and Android Chrome.
7. When devices are available, run the complete guided demonstration on a real iPhone in Safari and a real Android phone in Chrome.
8. Test touch target sizes, mobile menus, long-page scrolling, dialogs, sticky elements, text resizing, orientation changes, and the on-screen keyboard.
9. Test the browser back button, direct links, refresh, and restoration of the demonstration step on phone browsers.
10. Confirm that the local development instructions include a network-access command and firewall troubleshooting, without exposing the development server to the public internet.
11. Confirm that the production build can be deployed as an ordinary HTTPS website and opened from a shared phone-browser link.
12. Check that every route has a useful title and description.
13. Check every internal link and every empty state.
14. Search the repository for real names, emails, tokens, secrets, and accidental political-party labels.
15. Verify that all fixtures are marked synthetic.
16. Verify that no form transmits data.
17. Update `README.md` with setup, commands, route list, architecture, synthetic-data notice, phone-browser instructions, and demo script.
18. Add `docs/data-map.md` showing what later production phases may collect, why, visibility, proposed retention, and unresolved legal basis.
19. Add `docs/threat-model.md` covering Sybil accounts, brigading, doxxing, moderator bias, administrator abuse, re-identification, data breach, and algorithm gaming.
20. Add `docs/phase-1-handoff.md` listing completed work, known limitations, deferred decisions, and recommended Phase 2 sequence.
21. Capture screenshots of the principal desktop and mobile routes for presentation backup.
22. Tag the Git commit as the Phase 1 demonstration release.

Acceptance criteria:

- All Phase 1 definition-of-done items pass.
- The repository contains enough documentation for another developer to run and understand it.
- A static screenshot backup exists if the live demonstration encounters a local-machine problem.
- The live demonstration is usable from an ordinary HTTPS link in phone browsers without an app-store installation.

## 9. Cursor/Fable operating instructions

Place the following instructions in the repository’s Cursor rules or project instructions:

```text
This project is a demonstration of a proposed open-source think tank.

Before editing:
1. Read docs/product-charter.md and the current work package.
2. Restate the acceptance criteria.
3. Propose the exact files to create or change.
4. Identify privacy, security, accessibility, and governance assumptions.

While editing:
- Complete only the approved work package.
- Use synthetic data only.
- Do not introduce external services, secrets, real authentication, payments,
  analytics, AI APIs, identity verification, or production Pol.is integration.
- Keep evidence quality separate from participant popularity.
- Keep algorithm output separate from human institutional decisions.
- Do not infer or label participant ideology.
- Do not write legal language as approved fact.
- Preserve keyboard accessibility and mobile responsiveness.

Before declaring completion:
1. Run formatting, lint, type checking, relevant tests, and production build.
2. Inspect the affected screens at phone and desktop widths.
3. Report changed files and commands run.
4. Report any failed check, shortcut, placeholder, or unresolved decision.
5. Stop and wait for human approval before starting another work package.
```

Additional rules:

- Cursor must not solve uncertain governance questions by silently inventing an answer.
- Cursor must create an entry in `docs/open-questions.md` when a choice affects legal authority, privacy, verification, representation, moderation, or public data.
- Cursor must not weaken a test, type, access boundary, or acceptance criterion merely to make a check pass.
- Cursor must keep changes small enough for a human to review.
- Production participant data must never be placed in prompts, fixtures, logs, screenshots, or test recordings.

## 10. Questions the Phase 1 demo should take to counsel

The prototype should make these questions concrete without attempting to answer them:

1. Should the project begin under a fiscal sponsor or form its own Tennessee nonprofit corporation?
2. Is the primary federal lane 501(c)(3), 501(c)(4), or an eventual paired structure?
3. Are “community participants” statutory members under Tennessee law, nonvoting program participants, or a separate advisory class?
4. What legal authority belongs to the community, deliberation council, policy council, and governing board?
5. Can any crowd or council decision bind the legal board, and what explanation is required when the board departs from it?
6. What purpose and dissolution language should appear in Tennessee organizing documents?
7. What activities count as research, education, lobbying, ballot-measure activity, or campaign intervention?
8. What conduct, participation, appeal, moderation, privacy, copyright, and data-release terms are required?
9. What form of electronic assent should be recorded for each document version?
10. What information may be public, pseudonymous, confidential, or deleted?
11. How should political-opinion data and verification records be separated and retained?
12. Should the first pilot be limited to Tennessee residents or merely administered from Tennessee?
13. What charitable-solicitation registrations may be triggered by a national website or national fundraising?
14. When would qualification, registration, tax, employment, or lobbying obligations arise in another state?
15. What insurance should be in place before recruiting participants?
16. Who owns the code, domain, brand, datasets, policy publications, and contributor submissions?
17. What open-source, content, and open-data licenses are appropriate?
18. What records should remain private even under an openness commitment?

## 11. Tennessee and national-expansion notes

The organization can be formed in Tennessee and operate a national web platform. National operation does not require incorporating a new nonprofit in every state. It may, however, create registration or compliance obligations in other states through fundraising, employees, offices, lobbying, contracts, or other activity.

Before public fundraising:

- Review Tennessee nonprofit-corporation formation with Tennessee counsel.
- Review Tennessee charitable-organization registration or exemption through the Secretary of State.
- Review federal tax-exemption strategy.
- Review each state in which the organization will affirmatively solicit contributions.
- Avoid telling the public that donations are tax deductible until the applicable legal basis exists.

Current official starting points:

- Tennessee nonprofit filing FAQ: https://sos.tn.gov/businesses/faqs/how-do-i-register-a-nonprofit-in-tennessee
- Tennessee charitable-organization initial registration: https://sos.tn.gov/charities/guides/initial-registration
- Tennessee charity registration portal information: https://sos.tn.gov/charities/services/register-or-renew-a-charity-online
- Tennessee nonprofit sales-and-use-tax exemption overview: https://revenue.support.tn.gov/hc/en-us/articles/360058251372-SUT-77-Nonprofit-Exemption-Overview
- IRS state charitable-solicitation overview: https://www.irs.gov/charities-non-profits/charitable-organizations/charitable-solicitation-state-requirements

## 12. Recommended presentation sequence

Use the Phase 1 demonstration in this order:

1. Home: the problem and institutional promise
2. Process: the whole pipeline and separation of powers
3. Join preview: verification, conduct, privacy, and unresolved membership status
4. Topic: neutral brief, competing claims, and evidence
5. Consultation: preference and cross-group agreement
6. Agenda: transparent thresholds plus reasoned human review
7. Deliberation: selection, amendments, conflicts, evidence requests, and recusal
8. Decision: final rationale, vote, dissent, and review date
9. Transparency: audit events, method versions, and protected data
10. Legal questions: decisions that require professional advice

The presentation should end by asking collaborators to critique the institutional rules, not merely the colors or animation.
