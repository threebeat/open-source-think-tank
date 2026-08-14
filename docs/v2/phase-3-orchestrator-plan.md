# Phase 3 orchestrator plan — Commons, member posts, synthetic seed

**Status:** Prepared while Phase 2 is in flight. Do not start this phase until the Phase 2 PR exists and the orchestrator reviews the Phase 2 diff. Phase 3 must stack on Phase 2 if Phase 2 is not yet merged.

**Authorized phase:** Phase 3 only.

## Canonical reading order

Same as Phase 2, plus `docs/v2/phase-2-orchestrator-plan.md`, the Phase 2 PR diff, `docs/v2/community-standards.md`, and `docs/v2/governance-state-machine.json`.

## User journeys

1. **Signed-in member** — Opens `/commons`. Sees formal categories first, then the exact unreviewed-content disclaimer, then informal topic proposals, approach proposals, general discussion, Disqualified Topics. Creates a general discussion post. Sees it listed under Informal Commons. Submits a topic proposal for formal review (`submit_for_formal_review`). Cannot qualify their own proposal. Cannot jump it to Agenda/Chamber/Council.
2. **Member browsing synthetic seed** — With `COMMONHALL_SYNTHETIC_SEED` on (default gated pre-alpha), sees labeled synthetic discussions and proposals. With the flag off, synthetic rows are omitted from member list DTOs.
3. **Unauthenticated** — `/commons` redirects to sign-in (Phase 2 gate). `/demo` may *show* a Commons screenshot-like narrative without writing posts.
4. **Moderator fixture (if seeded)** — Safety and qualification are separate records. No ideology field. Recusal/self-review denied by kernel.

## Acceptance criteria

- Formal-before-informal order and exact disclaimer copy.
- Member can create a post (organization-scoped) and see it after reload.
- Proposal submit uses governance kernel; illegal shortcuts denied.
- Synthetic catalog hideable.
- Cross-org post IDOR denied.
- a11y: keyboard create flow, labels, errors, mobile.
- Phase 2 enrollment/gate tests remain green.

## Schema (`0025_commons_posts.sql`)

Organization-scoped:

- `commons_discussions`: id, organization_id, public_id, category (`moderator_communications` | `council_communications` | `qualified_topic_discussions` | `qualified_approach_discussions` | `community_actions` | `topic_proposals` | `approach_proposals` | `general_discussion` | `disqualified_topics`), `formal` boolean (projection; must not be set true without qualification/category rules), visibility, author_account_id, title, body, lineage parent id same-org, synthetic, timestamps.
- `commons_discussion_topic_links` optional for later agenda linkage (may wait for Phase 4).
- Composite FKs on organization_id. Immutability not required for discussion edits; keep an append-only `commons_discussion_revisions` or reuse `content_revisions` pattern if cheap.
- Rate-limit remaining in-process for pre-alpha (V2-23).
- Reset: new tables `reset`. Manifest bump `v2.3.0`.

Do not relabel old Idea Commons fixture rows as v2 formal content.

## Services

- `src/lib/commons/repository.ts` — requires organizationId; no list-all.
- `src/lib/commons/service.ts` — createPost, listCommons, submitForFormalReview (calls governance service).
- Public/member DTO allowlist: no account internal ids in public demo; member UI may show own display name.
- Flag `COMMONHALL_SYNTHETIC_SEED` (default on gated, off public-demo).

## UI

- `/commons` member page with two regions.
- Create post form: title, body, category (informal only for members), rate-limit messaging.
- Discussion detail `/commons/discussions/[id]`.
- Redirect `/idea-commons` → `/commons` for authenticated users.

## Tests

- Unit/service: create, order, disclaimer, self-qualify denied, synthetic filter.
- DB: org isolation on discussions.
- E2E gated: login, create post, see it; axe.
- E2E public: `/commons` not reachable.

## Out of scope

Agenda tabs, Pol.is, Chamber, deleting remaining think-tank tests that still pass, live moderation staff UI beyond kernel denies.

## Commits

1. schema + reset
2. commons services
3. member UI
4. synthetic seed + flag
5. tests + redirects
