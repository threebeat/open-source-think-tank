# Open-Source Think Tank (Phase 1 Demonstration)

Browser-based demonstration of a proposed open-source think tank. **Synthetic data only.** This repository does not accept real memberships, donations, identity documents, or legally binding agreements. It does not claim that an organization is incorporated, tax-exempt, or legally reviewed.

Source vision and work packages: [`docs/open-source-think-tank-mvp-plan.md`](docs/open-source-think-tank-mvp-plan.md)  
Build contract: [`docs/product-charter.md`](docs/product-charter.md)

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

## Architecture (Phase 1)

- Next.js App Router, TypeScript, Tailwind CSS, shadcn/ui
- Static fixtures and client-side demo state only (see `docs/decisions/0001-static-demonstration-first.md`)
- Domain types live under `src/domain` (independent of React)
- Future services go behind adapters in `src/lib/adapters`

## Status

Work packages are completed one at a time against the MVP plan. Phase 1 scaffolding is in progress; most routes are not built yet.
