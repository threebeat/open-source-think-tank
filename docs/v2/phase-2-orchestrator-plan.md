# Phase 2 orchestrator plan — Commonhall landing, enrollment, authenticated shell

**Status:** Binding plan for the Phase 2 subagent. Council-authorized pre-alpha. Not production, legal, or email-vendor clearance.

**Authorized phase:** Phase 2 only. Do not implement Commons posting (Phase 3), Agenda/consultation (Phase 4), Chamber/Council (Phase 5), or legacy deletion (Phase 6). Placeholders for later areas are allowed if they are honest and account-gated.

**Base:** `origin/main` at Phase 1 merge (`5276c9a`, PR #24). Branch: `v2/phase-2-landing-enrollment`.

**Open PR overlap:** PR #22 may still be open; do not revive 4.5B IA. Phase 1 already incorporated report integrity.

## Canonical reading order

1. `AGENTS.md`
2. `docs/README.md`
3. `docs/product-charter.md` → `docs/v2/product-charter.md`
4. `docs/v2/governance-state-machine.json`
5. `docs/v2/governance-lifecycle.md`
6. `docs/v2/community-standards.md`
7. `docs/v2/architecture.md` (updated routes)
8. `docs/v2/testing-strategy.md`
9. `docs/v2/ci-pr-workflow.md`
10. `docs/v2/open-decisions.md` (V2-21–23 and Council pre-alpha table)
11. `docs/v2/implementation-plan.md` Phase 2
12. This file
13. Next.js 16 App Router docs in `node_modules/next/dist/docs/`
14. Current auth (`src/lib/auth/*`, `src/lib/authz/*`), join pages, `src/proxy.ts`, `AppShell`, `SiteHeader`, `src/lib/navigation.ts`, seeds, e2e `home`/`join`/`about`/`shell`

## User journeys

1. **Unauthenticated visitor (public-demo or gated)** — Opens `/`. Sees Commonhall (not “Open-Source Think Tank”). Two primary actions: **Tour the demo** and **Create an account** / **Sign in**. Can complete `/demo` without an account. Cannot open `/commons`, `/agenda`, `/chamber`, `/council`, `/records`, `/account`, `/idea-commons`, `/formal-topics`, etc. Those redirect to `/auth/sign-in` (gated) or `/` (public-demo).
2. **Demo visitor** — `/demo` walks Commons → qualification → consultation (fixture, Pol.is unavailable) → Chamber → Council → records using synthetic copy. Keyboard and axe clean. States this is a demonstration, not a live town hall, and not statutory membership.
3. **New member (gated)** — Create account: identifier (email-shaped string stored locally, not sent to a vendor), password, honeypot empty, community-standards assent (versioned). Assigned to synthetic primary org with explanation. Lands in member shell. Can open Account profile/membership/history/privacy. Commons/Agenda/Chamber/Council/Records may show “Opens in a later Commonhall phase” placeholders unless already routed.
4. **Returning member** — Sign in with identifier + password. Session cookie via existing Auth.js bridge.
5. **Abuser** — Rapid sign-ups, duplicate identifier, filled honeypot, too-fast submit, kill switch off → denied. No Chamber seat.
6. **Staff bootstrap** — Existing `/auth/accept` invite path remains for administrator bootstrap. Open enrollment must not break it.
7. **Public-demo deploy** — No `DATABASE_URL`. Landing + demo render. Create-account explains that accounts require the gated service. No auth client construction.

## Acceptance criteria

- Visual identity is Commonhall (metadata, header, footer, landing).
- Unauthenticated surface is only `/`, `/demo/**`, `/join`, `/auth/**`.
- Gated enrollment + sign-in work end-to-end in Playwright gated suite.
- Assent version stored; assignment event append-only; explanation shown.
- Enrollment ≠ elevated authority (negative tests).
- Rate limit, honeypot, min fill time, duplicate identifier, kill switch tests.
- Passwords never logged, never in URLs, never in public DTOs, hashed at rest (scrypt or argon2id via `node:crypto`).
- `CI / required` green. Existing CSRF/origin/privacy tests not weakened.
- No production participant data.

## Schema (drizzle `0024_open_enrollment.sql`)

- `account_credentials`: `account_id` PK/FK, `password_hash` text not null, `password_scheme` text not null (`scrypt_n32768` or similar), `rotated_at`, timestamps. Never selected by public projections.
- Optional `accounts.enrollment_kind` enum `invite` | `open` default `invite` for existing rows.
- `organization_memberships` already exist — enrollment writes assigned/active membership to `org_ostt_synth_alpha_internal` plus an `organization_membership_events` row (`assignment`) with reason `pre-alpha synthetic primary organization (V2-04)`.
- Do **not** add email-vendor tables.
- Rollback comments at top of SQL. Journal entry. Reset manifest: `account_credentials` class `reset`; bump `RESET_MANIFEST_VERSION` to `v2.2.0`. Classify in `docs/alpha-reset-classification.md`.
- Lifecycle: open enrollment creates `pending_onboarding` then calls the existing `activateAccount` path after assent (do not invent a second activation backdoor). Extend only if `assertActivationTransition` cannot be reached; prefer using it.

## Auth / enrollment services

New modules (names may vary, keep under `src/lib/auth` and `src/lib/organizations`):

- `src/lib/auth/passwords.ts` — hash/verify; constant-time compare; unit tests.
- `src/lib/auth/enrollment.ts` — create person+account+credential+assent+membership+event in one transaction; rate limit key = hashed identifier + coarse IP if present; reject honeypot; reject if submit elapsed < 1500ms; kill switch via `isOpenEnrollmentEnabled()`.
- Credentials provider **or** a second Auth.js credentials id `password` that verifies hash then creates a session token using existing `AuthService` session table (reuse `auth_sessions`).
- `isOpenEnrollmentEnabled()`: gated mode, `COMMONHALL_V2_OPEN_ENROLLMENT !== "off"` (default on in gated). Public-demo always false.
- Keep invite accept flow.

Identifier rules: trim, lowercase for uniqueness, max length, must look like `local@domain` **or** a non-email handle if you document it — prefer email-shaped local identifier without sending mail. Unique `accounts.contact_channel`.

Password rules: min 12 characters, reject identifier-as-password; no complexity theatre that harms a11y.

## Routing / UI

- New landing `src/app/page.tsx` — Commonhall, two CTAs, short mission, synthetic/not-statutory disclosures. Distinct layout from the old think-tank home (new hero, new nav, new palette tokens if needed; keep contrast).
- `/demo` rebuilt as Commonhall process tour (sections or stepper). May summarize later phases as fixture narrative.
- `src/lib/navigation.ts` — unauthenticated nav: Demo, Create account, Sign in. Authenticated: Commons, Agenda, Chamber, Council, Records, Account.
- `SiteHeader` wordmark: Commonhall.
- `src/app/layout.tsx` metadata: Commonhall (working name), not OSTT.
- Gate: server helper `requireMemberSession()` used by product layouts. Implement a route group `(member)/` with layout that redirects unauthenticated users. Put Commons/Agenda/Chamber/Council/Records/Account placeholders there.
- Phase 2 placeholders for Commons/Agenda/Chamber/Council/Records: honest “This hall is seeded in later phases. Your account is ready.” Do **not** re-expose old think-tank pages as the member product.
- Old URLs: middleware/proxy or page-level redirect to `/auth/sign-in` when unauthenticated. Authenticated old URLs → member placeholders or `/`.
- `/join` becomes create-account (gated) / explanation (public-demo). Replace disabled CTA tests.

## Visual redesign (required)

The project must look different from the think-tank demo:

- Wordmark and page titles: Commonhall
- Header/footer/nav rebuilt
- Landing is not the old “Start the guided journey / Idea Commons / Formal Topic Pipeline” trio
- Prototype banner: pre-alpha Commonhall, synthetic data, not a government or nonprofit membership
- Keep mobile-first, 11px min touch, reduced-motion, semantic HTML

## Tests

- Unit: passwords, enrollment abuse (duplicate, honeypot, rate, kill switch, too-fast), assignment explanation, flags.
- DB/PGlite: credential row exists; password hash not equal to plaintext; membership event append-only; reset classifies `account_credentials`.
- API: unauthenticated POST enroll in public-demo fails; gated enroll succeeds; sign-in wrong password 401.
- Authz: new member `authorize(..., organization.appointment.grant)` false; no council roles.
- E2E public: landing Commonhall; demo visible; `/commons` not the old Idea Commons content; axe on `/` and `/demo`.
- E2E gated: register → assent → session → account page; cannot open org admin; invite bootstrap still works.
- Update/remove `e2e/join.spec.ts` disabled-enrollment assertions for **gated** (keep public-demo honest).
- Update `e2e/home.spec.ts` (no longer require heading “Open-Source Think Tank”).
- Update `e2e/about.spec.ts`: `/about` redirects; move essential about copy onto landing or `/demo`.
- Shell/nav e2e: authenticated vs not.

## CI

- Public job remains `APP_MODE=public-demo` (landing+demo).
- Gated job exercises enrollment.
- Add `test:pg:enrollment` if you write a postgres uniqueness/concurrency enroll test (recommended: two concurrent same-identifier enrolls → one success).

## Commit sequence

1. `docs(v2): authorize Commonhall pre-alpha phases 2–6` (already may be on branch)
2. `feat(v2): open enrollment credentials and assignment`
3. `feat(v2): Commonhall landing, demo, and account gate`
4. `feat(v2): authenticated shell and account pages`
5. `test(v2): enrollment abuse, a11y, and route gating`
6. `docs(v2): Phase 2 honesty, reset classification, flags`

## Out of scope

- Member posts, qualification UI, Pol.is, Chamber votes, deleting all legacy tests (only those broken by the new landing/gate), email sending, production thresholds.

## Handoff the subagent must return

Changed files, commits, migrations/rollback, tests/results, unexpected conflicts, open decisions, disabled features, no-production-data statement, Phase 2-only confirmation.

Push the branch and open a **draft PR to `main`** using `.github/pull_request_template.md` with `skip_branch_prefix_check` if using the `v2/phase-*` name. Do not merge. Do not start Phase 3.
