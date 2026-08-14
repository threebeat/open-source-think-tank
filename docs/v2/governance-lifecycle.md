# Governance lifecycle

The executable source of truth is [governance-state-machine.json](./governance-state-machine.json). This narrative explains the user experience and authority boundaries; it must not introduce shortcuts absent from the JSON contract.

## 1. Informal Commons

Community members can create general discussions, topic proposals, and approach proposals. Content is public by default but carries the unreviewed-content disclaimer. A proposal has no formal standing, no consultation, no agenda priority, and no presumption of moderator review.

A member may submit a proposal to the formal queue. The system snapshots the submission version and applicable organization rules.

## 2. Formal review and qualification

A moderator separately assesses safety and qualification. Approval means only that the published criteria are satisfied. A decision records the moderator, organization, rule version, criteria trace, conflicts/recusal, timestamp, and reason.

Possible results:

- qualify and create the Public Agenda consultation record;
- return to the author for a named, remediable deficiency;
- wait under a published duplicate, evidence, or capacity rule; or
- restrict/remove under the community standards with notice and appeal.

No elevated role can directly set `qualified_consultation`. The transition is valid only through the review service and a complete criteria trace.

## 3. Public Agenda and consultation

Qualification creates a public topic page and one current consultation entity. The page begins with topic facts and state, then provides Overview, Evidence, Discussion, and History.

During consultation:

- community members participate through the approved Pol.is embed or an honest unavailable state;
- Commonhall does not publish raw votes, people, or person-level map points;
- evidence review continues independently;
- linked discussion does not change the consultation outcome invisibly; and
- organization thresholds and closing rules are visible before participation.

At close, immutable metrics and rule versions produce exactly one community result: accepted, disputed, or inconclusive. The allowlisted aggregate insights become public after close for all three results. Published insights explain participation and discussion shape, not truth or representativeness.

Accepted topics enter the Chamber queue. Disputed and inconclusive topics remain on the Public Agenda through their published retention window, then lose qualification honorably unless a separately authorized rule creates a new consultation. Do not silently reopen or reuse the old provider entity.

## 4. Chamber

The Chamber is an organization body of explicitly appointed, higher-assent members. Its schedule, roster, appointment terms, conflicts, and attendance are public.

The Chamber deliberates in public, may request evidence or amendments, and issues a versioned accepted or disputed verdict. Every member position is one of yes, no, abstain, recused, or absent. Minority reasoning is attachable. A verdict is not a Council decision.

The topic remains in the Public Agenda while queued, deliberating, or awaiting Council intake.

## 5. Council intake and Council Agenda

The organization Council publishes its intake schedule. It may accept or decline a Chamber topic.

- Accepting a Chamber-accepted verdict may reference the Chamber’s existing rationale.
- Declining a Chamber-accepted verdict requires a Council explanation.
- Accepting a Chamber-disputed verdict requires an override explanation.
- Declining a Chamber-disputed verdict may reference the Chamber rationale.

On acceptance, the topic leaves the Public Agenda and Chamber and enters the Council Agenda. A decline remains publicly visible through its retention window and can later lose qualification honorably.

## 6. Council deliberation and recommendations

Council deliberation is public and versioned. The record shows the schedule, agenda materials, evidence requests, amendments, conflicts, recusals, attendance, member positions, rationale, and any minority report.

The Council publishes recommendations either for external legislators/the public or for organization/community action. Recommendations are not enacted law and are not attributed to the service nonprofit. Community actions show organizer, sponsorship/conflict, eligibility, source, date, status, relationship to the recommendation, and non-endorsement language.

## 7. Records and lineage

Every public topic history exposes:

- originating proposal and safe predecessor/successor links;
- organization and rule versions;
- qualification criteria trace;
- all state transitions and correction/recovery reasons;
- consultation dates and allowlisted aggregate publication;
- moderator, Chamber, and Council institutional records;
- report/method versions and representation limitations; and
- honorable expiration or safe public disposition.

Corrections create new versions. They do not rewrite institutional history. Security-sensitive fields and person-level consultation data remain protected.

## Status vocabulary

Use the exact labels from the state-machine contract in persistence and APIs. UI copy may be friendlier but maps one-to-one. Do not reuse the old generic `agenda`, `deliberation`, or `decision` status as an authoritative v2 state.

## Still-open policy values

The model fixes the shape of the process, not organization-specific numbers. Participation thresholds, decision thresholds, retention windows, Chamber size, cadence, appointment terms, and Council schedules remain versioned organization configuration bounded by service minimums. See [open-decisions.md](./open-decisions.md).

