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

