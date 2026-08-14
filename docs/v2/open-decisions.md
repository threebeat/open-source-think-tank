# Commonhall v2 open decisions

Do not silently settle these in application code. A decision needs an owner, date, evidence, affected organizations, migration impact, and an ADR/config version. “Owner accepted risk” and “counsel cleared” remain different statuses.

| ID | Decision | Current safe posture | Blocks |
| --- | --- | --- | --- |
| V2-01 | Final name and trademark/domain review | Use “Commonhall v2” as a working name only | Dropping `v2`, public branding spend |
| V2-02 | Legal meaning of community membership | Treat as organization service membership, not nonprofit/statutory membership | Final terms and legal claims |
| V2-03 | Nonprofit/service-steward emergency authority | Narrow technical/abuse action only; no organization vote | Production service terms |
| V2-04 | Initial organization matching inputs | Coarse region, availability, explanation, correction/appeal; never ideology | Automatic assignment launch |
| V2-05 | Membership transfer and overlapping organizations | One active primary organization; retain history; no silent dual voting | Regional expansion |
| V2-06 | Qualification criteria floor and capacity rules | Use charter floor; return rather than preference-reject | Formal submission launch |
| V2-07 | Consultation acceptance/dispute/inconclusive thresholds | Organization versioned config inside service minimums | Live outcome calculation |
| V2-08 | Retention window before honorable disqualification | Configurable, captured on state entry; no hard-coded production value | Expiration worker |
| V2-09 | Chamber size, quorum, appointment and terms | No production defaults; fixtures only | Live Chamber appointments |
| V2-10 | Council intake/cadence/quorum | No production defaults; fixtures only | Live Council agenda |
| V2-11 | Hosted versus self-hosted Pol.is and DPA | Hosted embed disabled; aggregate fixture boundary only | Live embed |
| V2-12 | Pol.is CSP/third-party-script and consent UX | Exact-origin, explicit activation, accessible failure | Live embed |
| V2-13 | Provider retention/deletion and incident guarantees | Store no raw export; local reset makes no remote claim | Live embed |
| V2-14 | Production small-cell/reporting floor | Keep current provisional values synthetic-only | Live aggregate publication |
| V2-15 | Aggregate map transformation | No individual dots; design and re-identification review required | Public map |
| V2-16 | Dishonorable-disqualification public metadata | Protected by default; safe aggregate reason only after harm review | Public moderation report |
| V2-17 | Federation authentication/protocol | Public link records inside one service only | Cross-instance exchange |
| V2-18 | Production email, database host, analytics/metrics vendors | No new vendor without register/security/privacy decision | Production deployment |
| V2-19 | Existing alpha-account migration | Require new assent/assignment; do not auto-convert | Open enrollment rollout |
| V2-20 | Representation claims and geographic scope | Describe participants, never claim population mandate | Public impact language |
| V2-21 | Unauthenticated product-surface policy | Pre-alpha: `/`, `/demo`, and auth pages only; product routes require an account. Does not settle production public-observer law | Production public Agenda/Chamber/Council without login |
| V2-22 | Enrollment verification channel | Pre-alpha: local identifier + password; no outbound email (V2-18). Email verification deferred | Password recovery by email; production identity proof |
| V2-23 | Bot / abuse vendor | Pre-alpha: in-process rate limit, honeypot, minimum fill time, duplicate identifier. No third-party bot SDK | Scale-out / distributed abuse |

## Phase 1 fail-closed postures (not settlements)

Phase 1 records these engineering postures. They do **not** close the decisions above.

| ID | Phase 1 posture |
| --- | --- |
| V2-01 | Public copy uses “Commonhall v2” as a working name only. |
| V2-02 | UI states community membership is not nonprofit/statutory membership. Enrollment stays invite-only. |
| V2-03 | Service administrator cannot cast organization actions or self-appoint. |
| V2-04 | Service areas store coarse region codes (`US-TN`) only. No assignment launch. |
| V2-05 | Schema allows one primary membership; no transfer product. |
| V2-06 | Qualification remains kernel-only; no formal submission launch. |
| V2-07 | Non-synthetic config that includes `consultationThresholds` is rejected. |
| V2-08 | `retention_deadline_at` may be null; expiration worker is disabled. |
| V2-09 | Chamber appointments may persist; `COMMONHALL_V2_CHAMBER_LIVE` cannot enable live process. |
| V2-10 | Council appointments may persist; live Council transitions are refused. |
| V2-11–V2-13 | Hosted Pol.is cannot be enabled in flags or published config. |
| V2-14–V2-16 | No live aggregate map or dishonorable public metadata product. |
| V2-17 | No federation protocol. |
| V2-18 | No new production vendors. |
| V2-19 | Alpha accounts are not auto-converted to organization community members. |
| V2-20 | Public copy does not claim population mandate or production readiness. |

Phase 1 recorded invite-only enrollment. Phase 2 supersedes that **gated pre-alpha** posture without closing V2-02/V2-21–V2-23. See the Phase 2 table below.

## Council pre-alpha directions (Phases 2–6, 2026-08-14)

Authorized for the pre-alpha Commonhall build. **Not** counsel-cleared or production settlements.

| ID | Pre-alpha direction |
| --- | --- |
| V2-01 | UI wordmark may be “Commonhall”; legal-adjacent copy keeps “v2” / working-name status. |
| V2-02 | Enrollment copy: organization community membership, not nonprofit/statutory membership. |
| V2-04 | New members are assigned to the synthetic primary organization with a visible explanation and a correction/appeal event. Not a production matching algorithm. |
| V2-07–V2-10 | Synthetic fixture numbers only; labeled synthetic; ignored as production defaults. |
| V2-11–V2-13 | Hosted Pol.is remains impossible to enable. Fixture + in-house agree/disagree/pass only. |
| V2-18 | No email, analytics, or identity vendor. Password enrollment is local. |
| V2-19 | Do not auto-convert historical invite-only alpha accounts. New enrollment required. |
| V2-21 | Account-gated product routes; demo is the unauthenticated process tour. |
| V2-22 | Identifier + password; email verification out of scope. |
| V2-23 | In-house bot heuristics only. |
| Synthetic seed | `COMMONHALL_SYNTHETIC_SEED` defaults on in gated pre-alpha; off hides synthetic catalog from member UI. Operator reset remains the pre-alpha → alpha wipe. |

## Phase 2 fail-closed postures (not settlements)

Phase 2 records these engineering postures for the gated pre-alpha. They do **not** close V2-21–V2-23 or related legal/vendor decisions.

| ID | Phase 2 posture |
| --- | --- |
| V2-01 | UI wordmark is “Commonhall”; legal-adjacent copy keeps working-name / v2 status. |
| V2-02 | Enrollment copy states organization community membership, not nonprofit or statutory membership. |
| V2-04 | New gated members are assigned to `org_ostt_synth_alpha_internal` with a visible explanation and an append-only assignment event. Not a production matching algorithm. |
| V2-18 | No email, analytics, or identity vendor. The identifier is an email-shaped string stored locally. |
| V2-19 | Historical invite-only alpha accounts are not auto-converted. |
| V2-21 | Unauthenticated visitors may use `/`, `/demo/**`, `/join`, and `/auth/**` only. Product and legacy think-tank URLs redirect to `/auth/sign-in` (gated) or `/` (public-demo). |
| V2-22 | Identifier + password; no outbound email; email verification out of scope. |
| V2-23 | In-process rate limit, honeypot, 1500ms minimum fill, duplicate-identifier rejection. Kill switch `COMMONHALL_V2_OPEN_ENROLLMENT` (default on in gated; always off in public-demo). |
| Hosted Pol.is | Remains impossible to enable. |
| Elevated portal | `/org/**` does not grant organization-admin capability; community membership is redirected away. |

## Phase 3 fail-closed postures (not settlements)

Phase 3 records these engineering postures for the gated pre-alpha Commons. They do **not** close V2-06, V2-21–V2-23, or related legal/vendor decisions.

| ID | Phase 3 posture |
| --- | --- |
| V2-06 | Members may submit topic/approach proposals via kernel `submit_for_formal_review` only. Qualification remains a separate moderator record. Authors cannot qualify their own proposal. |
| V2-21 | `/commons` and `/commons/discussions/[id]` remain account-gated. Unauthenticated visitors still redirect. |
| V2-23 | Commons posting uses the in-process `commons_post` mutation limiter. No bot vendor. |
| Synthetic seed | `COMMONHALL_SYNTHETIC_SEED` defaults on in gated; `off` omits `synthetic=true` catalog rows from member list DTOs. Member-created posts are not catalog rows. |
| Formal flag | Members cannot set `formal=true` or post in formal categories. Formal is a projection of category rules. |
| Hosted Pol.is / Agenda / Chamber | Remain out of this phase. |

## Phase 4 fail-closed postures (not settlements)

Phase 4 records these engineering postures for the gated pre-alpha Public Agenda. They do **not** close V2-07 or V2-11–13.

| ID | Phase 4 posture |
| --- | --- |
| V2-07 | Fixture close playback uses labeled synthetic metrics snapshots only. Non-synthetic config still cannot set `consultationThresholds`. There is no live outcome calculator. |
| V2-11–V2-13 | `isHostedPolisEnabled()` remains false. Agenda UI never loads `https://pol.is/embed.js`. CSP omits pol.is. In-house agree/disagree/pass writes only to `member_statement_positions`. |
| V2-14 | No live reporting-floor product. Member positions are not published as people lists, XIDs, or raw votes. |
| Synthetic seed | `COMMONHALL_SYNTHETIC_SEED=off` omits synthetic Public Agenda catalog rows from member list/detail DTOs. |
| Chamber | `queue_for_chamber` remains kernel-only from `community_accepted`. Phase 4 does not build Chamber UI. |

## Phase 5 fail-closed postures (not settlements)

Phase 5 records these engineering postures for the gated pre-alpha Chamber and Council. They do **not** close V2-09/10.

| ID | Phase 5 posture |
| --- | --- |
| V2-09 | No production Chamber size, quorum, or appointment policy. Seeded roster and sessions are labeled synthetic. `COMMONHALL_V2_CHAMBER_LIVE` still cannot enable a production live Chamber. |
| V2-10 | No production Council cadence or quorum. Synthetic fixture playback may run appointed clerk/member kernel transitions on synthetic records only. |
| V2-08 | `retention_deadline_at` remains nullable; expiration worker stays disabled. Council-declined topics remain until a later captured retention. |
| V2-11–V2-13 | `isHostedPolisEnabled()` remains false. Chamber/Council UI never loads `https://pol.is/embed.js`. |
| Synthetic seed | `COMMONHALL_SYNTHETIC_SEED=off` omits synthetic Chamber/Council/Records catalog rows from member list/detail DTOs. |
| Appointments | Seeded Chamber/Council seats are new `organization_appointments` rows, not copies of legacy `deliberation_council`. Dual-control / no self-grant remains. `trustedSystem` is seed/playback only. |

## Decision record template

```md
# ADR: <decision>

- Status: proposed | approved-for-engineering | counsel-cleared | superseded
- Owner:
- Date:
- Applies to organization(s):
- Open-decision ID:
- Evidence and alternatives:
- Decision:
- Non-configurable service floor:
- Organization-configurable portion:
- Privacy/security/legal/accessibility review:
- Migration and rollback:
- Tests and public explanation:
```

