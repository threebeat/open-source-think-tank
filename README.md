# Open-Source Think Tank

Browser-based demonstration of a proposed open-source think tank, plus a **separately deployable gated foundation** for an invite-only alpha test. The default **public-demo** mode uses **synthetic data only**. This repository does not accept public self-registration, donations, identity documents, or legally binding agreements as a public product. It does not claim that an organization is incorporated, tax-exempt, or legally reviewed.

Source vision: [`docs/open-source-think-tank-mvp-plan.md`](docs/open-source-think-tank-mvp-plan.md)  
Build contract: [`docs/product-charter.md`](docs/product-charter.md)  
Phase 1 handoff: [`docs/phase-1-handoff.md`](docs/phase-1-handoff.md)  
Phase 2 foundation: [`docs/phase-2-plan.md`](docs/phase-2-plan.md) · [`docs/phase-2-handoff.md`](docs/phase-2-handoff.md)  
Phase 3 plan (operational invite-only alpha; packages 3.1–3.12): [`docs/phase-3-plan.md`](docs/phase-3-plan.md) · [`docs/phase-3-handoff.md`](docs/phase-3-handoff.md)  
Alpha reset: [`docs/alpha-reset-runbook.md`](docs/alpha-reset-runbook.md) · [`docs/alpha-reset-classification.md`](docs/alpha-reset-classification.md)

## Requirements

### Public-demo (default)

- Node.js 22 (see `.nvmrc`)
- npm 10+
- Git

No environment variables, API keys, or third-party accounts are required for public-demo.

### Gated foundation (invite-only alpha engineering)

- Same Node/npm/Git requirements
- Local PostgreSQL 16 via Docker Compose (`npm run db:up`) when exercising gated paths
- `APP_MODE=gated` and documented secrets only in gated environments — see [`docs/secrets-and-operations.md`](docs/secrets-and-operations.md)
- Managed PostgreSQL host and production email vendors remain **blocked** pending register addenda
- Phase 3 operational topic/evidence workflow is **planned** in [`docs/phase-3-plan.md`](docs/phase-3-plan.md); do not assume those routes or tables already exist

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
| `npm run db:up` | Start local Postgres (Docker) on port 54329 — not a managed-host approval |
| `npm run db:migrate` | Apply Drizzle migrations to `DATABASE_URL` (requires `APP_MODE=gated`) |
| `npm run db:generate` | Generate SQL migrations from `src/db/schema.ts` |
| `npm run operator:bootstrap` | First-administrator ceremony (gated; env secrets only) |
| `npm run operator:reset-alpha` | Alpha wipe dry-run/execute (gated; see [docs/alpha-reset-runbook.md](docs/alpha-reset-runbook.md)) |
| `npm run alpha:reset:smoke` | Disposable `ostt_alpha_reset` drill only — never a shared/live DB |
| `npm run security:check` | Headers, secret patterns, vendor/isolation guards, npm audit |
| `npm run backup:smoke` | Ephemeral backup/restore shape check |

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
| [`docs/phase-2-handoff.md`](docs/phase-2-handoff.md) | Phase 2 foundation evidence and alpha-test posture |
| [`docs/architecture-phase-2.md`](docs/architecture-phase-2.md) | Phase 2 environments, adapters, data-flow |
| [`docs/phase-3-plan.md`](docs/phase-3-plan.md) | Phase 3 operational alpha work packages |
| [`docs/phase-3-handoff.md`](docs/phase-3-handoff.md) | Phase 3 evidence handoff (awaiting human review before Phase 4) |
| [`docs/alpha-reset-runbook.md`](docs/alpha-reset-runbook.md) | Operator alpha wipe CLI runbook |
| [`docs/alpha-reset-classification.md`](docs/alpha-reset-classification.md) | Table-by-table reset/retain/regenerate manifest |
| [`docs/architecture-phase-3.md`](docs/architecture-phase-3.md) | Phase 3 services, tables, projections |
| [`docs/decisions/0008-phase-3-operational-alpha-contract.md`](docs/decisions/0008-phase-3-operational-alpha-contract.md) | Phase 3 operational alpha ADR |
| [`docs/capability-matrix.md`](docs/capability-matrix.md) | Server-enforced capabilities |
| [`docs/secrets-and-operations.md`](docs/secrets-and-operations.md) | Secrets, backup, vendor ops checklist |
| [`docs/presentation-backup/`](docs/presentation-backup/) | Static screenshot backup |

## Status

- **Phase 1** demonstration MVP is complete (tag `phase-1-demonstration`). Public-demo mode remains synthetic and separately deployable.
- **Phase 2** invite-only foundation packages 2.1–2.12 are in place (tag `phase-2-foundation`; see [`docs/phase-2-handoff.md`](docs/phase-2-handoff.md)). Gated auth, roles, assent, verification, audit, and isolation are the baseline for alpha engineering.
- **Phase 3** packages **3.1–3.12** are implemented on the gated foundation ([`docs/phase-3-handoff.md`](docs/phase-3-handoff.md)). **3.12 complete; Phase 3 handoff awaiting human review before Phase 4.**
- Public recruitment, live Pol.is, payments, analytics, AI APIs, managed production PostgreSQL, and unsettled legal formation claims remain out of scope until their gates clear. Alpha-test data must stay fully resettable via the operator CLI.
