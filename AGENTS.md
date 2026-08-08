<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Open-Source Think Tank — agent operating rules

This project is a demonstration of a proposed open-source think tank.

Before editing:

1. Read `docs/product-charter.md` and the current work package in `docs/open-source-think-tank-mvp-plan.md`.
2. Restate the acceptance criteria.
3. Propose the exact files to create or change.
4. Identify privacy, security, accessibility, and governance assumptions.

While editing:

- Complete only the approved work package.
- Use synthetic data only.
- Do not introduce external services, secrets, real authentication, payments, analytics, AI APIs, identity verification, or production Pol.is integration.
- Keep evidence quality separate from participant popularity and consensus.
- Keep algorithm output separate from human institutional decisions. Algorithms organize or recommend; humans decide.
- Do not infer or label participant ideology.
- Do not invent governance authority or settled membership status.
- Do not write legal language as approved fact.
- Preserve keyboard accessibility and mobile responsiveness.

Before declaring completion:

1. Run formatting, lint, type checking, relevant tests, and production build.
2. Inspect the affected screens at phone and desktop widths when UI changed.
3. Report changed files and commands run.
4. Report any failed check, shortcut, placeholder, or unresolved decision.
5. Stop and wait for human approval before starting another work package.

Additional rules:

- Do not solve uncertain governance questions by silently inventing an answer.
- Create an entry in `docs/open-questions.md` when a choice affects legal authority, privacy, verification, representation, moderation, or public data.
- Do not weaken a test, type, access boundary, or acceptance criterion merely to make a check pass.
- Keep changes small enough for a human to review.
- Production participant data must never be placed in prompts, fixtures, logs, screenshots, or test recordings.
