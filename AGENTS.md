<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Open-Source Think Tank — agent operating rules

This project is a demonstration of a proposed open-source think tank, plus (from Phase 2 onward) an invite-only foundation planned in a separate gated environment.

Before editing:

1. Read `docs/product-charter.md`.
2. Read the current work package:
   - Phase 1 / demo work: `docs/open-source-think-tank-mvp-plan.md`
   - Phase 2 work: `docs/phase-2-plan.md` (active packages 2.1–2.12)
3. Restate the acceptance criteria.
4. Propose the exact files to create or change.
5. Identify privacy, security, accessibility, and governance assumptions.
6. Check the **permitted-services register** and **counsel disposition gates** in `docs/phase-2-plan.md` before introducing any external service or real account flow.

While editing:

- Complete only the approved work package.
- Keep the public Phase 1 / demo paths synthetic and operational; they must not connect to a production participant datastore.
- Do not invent governance authority or settled membership status. Prefer “account holder” or “community participant”; never call someone a statutory member without recorded counsel approval in `docs/phase-2-plan.md`.
- Do not silently resolve authority, retention, verification, or privacy questions—update `docs/open-questions.md` / counsel gates instead.
- Do not write legal language as approved fact.
- Keep evidence quality separate from participant popularity and consensus.
- Keep algorithm output separate from human institutional decisions. Algorithms organize or recommend; humans decide.
- Do not infer or label participant ideology.
- Preserve keyboard accessibility and mobile responsiveness.
- **External services:** introduce only services marked **approved** in `docs/phase-2-plan.md` §4 (or an ADR linked from that register), and only in the work package that authorizes them.
- **Until Work Package 2.2 completes and the register is updated:** do not add authentication providers, databases/ORMs, email vendors, identity-verification SDKs, payments, analytics, AI APIs, or live Pol.is. Package 2.1 is documentation only.
- Production participant data must never be placed in prompts, fixtures, logs, screenshots, or test recordings.
- No secrets or privileged credentials in the browser bundle or repository.

Before declaring completion:

1. Run formatting, lint, type checking, relevant tests, and production build (skip e2e only when the package is docs-only and has no runtime impact).
2. Inspect the affected screens at phone and desktop widths when UI changed.
3. Report changed files and commands run.
4. Report any failed check, shortcut, placeholder, or unresolved decision.
5. Stop and wait for human approval before starting another work package.

Additional rules:

- Do not solve uncertain governance questions by silently inventing an answer.
- Create an entry in `docs/open-questions.md` when a choice affects legal authority, privacy, verification, representation, moderation, or public data.
- Do not weaken a test, type, access boundary, or acceptance criterion merely to make a check pass.
- Keep changes small enough for a human to review.
- Honor Phase 2 stop conditions in `docs/phase-2-plan.md` §8.
