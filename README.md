# Open-Source Think Tank (Phase 1 Demonstration)

Browser-based demonstration of a proposed open-source think tank. **Synthetic data only.** This repository does not accept real memberships, donations, identity documents, or legally binding agreements. It does not claim that an organization is incorporated, tax-exempt, or legally reviewed.

Source vision and work packages: [`docs/open-source-think-tank-mvp-plan.md`](docs/open-source-think-tank-mvp-plan.md)  
Build contract: [`docs/product-charter.md`](docs/product-charter.md)  
Handoff: [`docs/phase-1-handoff.md`](docs/phase-1-handoff.md)

## Requirements

- Node.js 22 (see `.nvmrc`)
- npm 10+
- Git

No environment variables, API keys, or third-party accounts are required.

## Setup

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Phone on the same network (local only)

```bash
npm run dev -- --hostname 0.0.0.0
```

Then open `http://<your-lan-ip>:3000` from a phone browser. Keep the machine firewall limited to your LAN; do not expose the development server to the public internet. If the phone cannot connect, confirm both devices are on the same Wi‑Fi/VLAN and that Windows Firewall allows Node on private networks only.

Production-style check:

```bash
npm run build
npm run start
```

Serve that build behind ordinary HTTPS in deployment so phone browsers can open a shared link without an app-store install.

## Scripts

| Script | Purpose |
| --- | --- |
| `npm run dev` | Start the local development server |
| `npm run build` | Production build |
| `npm run start` | Serve the production build |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript (`tsc --noEmit`) |
| `npm test` | Unit tests (Vitest) |
| `npm run test:e2e` | Production build, then Playwright + axe e2e (self-contained; does not reuse a stale server) |
| `npm run capture:screenshots` | Write presentation-backup PNGs (requires `npm run start` already listening) |

## Routes

| Path | Purpose |
| --- | --- |
| `/` | Home and entry points |
| `/about` | Project framing (mission, commitments, limitations, contact placeholder) |
| `/process` | Institutional stage map |
| `/join` | Nonfunctional join / assent preview |
| `/topics` | Topic list |
| `/topics/[slug]` | Topic brief, claims, evidence |
| `/topics/[slug]/consult` | Simulated consultation |
| `/agenda` | Agenda list by human-review state |
| `/agenda/[slug]` | Thresholds, calculation trace, human review |
| `/deliberation/[slug]` | Public deliberation observer |
| `/decisions/[slug]` | Policy Council recommendation record |
| `/transparency` | Audit feed, methods, openness classes |
| `/demo` | Guided presentation mode |

Cedar River (`cedar-river-drought-surcharge`) is the complete end-to-end synthetic scenario.

## Architecture (Phase 1)

- Next.js App Router, TypeScript, Tailwind CSS, shadcn/ui
- Static fixtures and client-side demo state only ([`docs/decisions/0001-static-demonstration-first.md`](docs/decisions/0001-static-demonstration-first.md))
- Domain types and catalog validation under `src/domain`
- Feature UI under `src/features` and `src/components`
- Future services go behind adapters in `src/lib/adapters`
- Consultation practice votes: `sessionStorage` key `ostt-consult-votes:{topicId}`
- Guided demo step / notes: `ostt-demo-step`, `ostt-demo-presenter-notes`; stage pages use `?demoStep=`

## Synthetic-data notice

All people, organizations, evidence, votes, consultation results, conflicts, and decisions are fictional. The UI must never present consensus as proof, evidence quality as popularity, or participating users as a representative sample of the United States.

## Guided demo script (5–8 minutes)

1. Open `/demo` and state the synthetic-data disclaimer. Toggle presenter notes if helpful.
2. Use each stage link; the sticky **Presentation mode** bar provides **Return to guided demo** and **Continue** so you do not need the browser Back button.
3. Walk join → topic/evidence → consultation → agenda → deliberation → decision → transparency.
4. Pause at the legal, technical, and board audience stops.
5. On the decision record, show Policy Council roll call, Farah’s minority report, Hugo’s recusal with conflict disclosure, and proposal history.
6. **Reset** restores the local demo step, notes toggle, and Cedar practice votes.

Direct product URLs still work without presentation mode.

## Documentation map

| Doc | Contents |
| --- | --- |
| [`docs/product-charter.md`](docs/product-charter.md) | Mission and Phase 1 scope |
| [`docs/open-source-think-tank-mvp-plan.md`](docs/open-source-think-tank-mvp-plan.md) | Work packages and definition of done |
| [`docs/open-questions.md`](docs/open-questions.md) | Unresolved institutional questions |
| [`docs/legal-questions.md`](docs/legal-questions.md) | Questions for counsel |
| [`docs/data-map.md`](docs/data-map.md) | Future collection categories |
| [`docs/threat-model.md`](docs/threat-model.md) | Abuse and privacy threats |
| [`docs/phase-1-handoff.md`](docs/phase-1-handoff.md) | Completed work and Phase 2 sequence |
| [`docs/phase-1-manual-qa.md`](docs/phase-1-manual-qa.md) | Required Phase 1 QA results |
| [`docs/phase-2-plan.md`](docs/phase-2-plan.md) | Phase 2 invite-only foundation work packages |
| [`docs/presentation-backup/`](docs/presentation-backup/) | Static screenshot backup |

## Status

Phase 1 demonstration MVP is complete (tag `phase-1-demonstration`). Phase 2 work packages live in [`docs/phase-2-plan.md`](docs/phase-2-plan.md); start with package 2.1 before installing auth or databases. Public recruitment, live Pol.is, payments, and legal formation remain out of scope until their gates clear.
