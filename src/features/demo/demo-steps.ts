export type DemoStep = {
  id: string;
  title: string;
  summary: string;
  href?: string;
  linkLabel?: string;
  presenterNotes: string;
  audienceStop?: "legal" | "technical" | "board";
};

/**
 * Phase 4.1 primary guided journey:
 * Follow an idea from community discussion to collective action.
 */
export const demoSteps: DemoStep[] = [
  {
    id: "welcome",
    title: "Follow an idea from community discussion to collective action",
    summary:
      "This guided demonstration recenters on the complete democratic journey: Idea Commons → qualified proposal → Public Input → agenda qualification → deliberation → policy recommendation → member actions → audit. All people, votes, and decisions are synthetic. Nothing here calls Pol.is or writes to the gated alpha.",
    presenterNotes:
      "State the primary task out loud. Emphasize Idea Commons vs Formal Topic Pipeline separation before clicking onward.",
  },
  {
    id: "idea-commons",
    title: "1. Idea Commons discussion",
    summary:
      "Inspect (or practice writing) an informal Idea Commons discussion. Content is labeled informal and not yet in the Formal Topic Pipeline.",
    href: "/idea-commons",
    linkLabel: "Open Idea Commons",
    presenterNotes:
      "Show the informal banner. Point out that a moderator-authored ordinary proposal has no elevated badge.",
  },
  {
    id: "proposal",
    title: "2. Turn a discussion into a proposal",
    summary:
      "Open the drought-surcharge thread and convert a contribution into an unqualified proposal. History stays visible.",
    href: "/idea-commons/idea-cedar-surcharge-discussion",
    linkLabel: "Open surcharge discussion",
    presenterNotes:
      "Use the local Convert to proposal control. Reset clears practice posts.",
  },
  {
    id: "scoping",
    title: "3. Scoping and qualification criteria",
    summary:
      "See the published criteria that must be met before Informal content can enter the Formal Topic Pipeline. No preference-based shortcut.",
    href: "/formal-topics/cedar-river-drought-surcharge",
    linkLabel: "Open formal topic gate view",
    presenterNotes:
      "Call out criteria met vs unmet, who can act now, and that elevated roles cannot privately promote.",
  },
  {
    id: "public-input",
    title: "4. Synthetic Public Input consultation",
    summary:
      "Enter the synthetic Public Input surface powered by fixture data (not Pol.is). Pol.is is planned as an input later — never a decision-maker.",
    href: "/topics/cedar-river-drought-surcharge/consult",
    linkLabel: "Open Public Input",
    presenterNotes:
      "Remind viewers there is no live provider network request from public-demo.",
  },
  {
    id: "vote",
    title: "5. Submit a statement and cast practice votes",
    summary:
      "Locally Agree / Disagree / Pass. Practice votes stay in sessionStorage and do not personalize the sealed aggregate report.",
    href: "/topics/cedar-river-drought-surcharge/consult",
    linkLabel: "Practice voting",
    presenterNotes:
      "Cast a few votes, refresh, then continue — votes restore until Reset.",
  },
  {
    id: "report",
    title: "6. Anonymous aggregate Public Input report",
    summary:
      "View the allowlisted aggregate report: participation totals, neutrally named groups, agreement/disagreement, sufficiency, representation limits, method version. No per-person votes or group membership.",
    href: "/formal-topics/cedar-river-drought-surcharge/consultation/report",
    linkLabel: "Open aggregate report",
    presenterNotes:
      "Point to small-cell suppression notice (provisional threshold 5).",
  },
  {
    id: "agenda-trace",
    title: "7. Agenda qualification trace",
    summary:
      "Inspect independent signals — participation, breadth, agreement, disagreement, evidence readiness, scope, lineage, capacity, process. No composite truth score. Human review records reason, role, timestamp, conflicts, method version.",
    href: "/agenda/cedar-river-drought-surcharge",
    linkLabel: "Open qualification trace",
    presenterNotes:
      "Also show the deferred billing-ops trajectory where evidence readiness fails.",
  },
  {
    id: "deliberation",
    title: "8. Follow the topic into deliberation",
    summary:
      "Observer view of capacity-limited deliberation. Formal deliberation bodies now have different authority than pre-deliberation moderators.",
    href: "/deliberation/cedar-river-drought-surcharge",
    linkLabel: "Open deliberation",
    presenterNotes:
      "Distinguish deliberation council seats from Policy Council recommendation authority.",
  },
  {
    id: "policy",
    title: "9. Policy recommendation",
    summary:
      "See how discussion and amendments become an actionable Policy Council recommendation (not enacted law, not board adoption).",
    href: "/decisions/cedar-river-drought-surcharge",
    linkLabel: "Open recommendation",
    presenterNotes:
      "Minority report stays equal prominence. Governing-board adoption remains unresolved.",
  },
  {
    id: "actions",
    title: "10. Member action opportunities",
    summary:
      "Review synthetic civic actions linked to the recommendation: town hall, interest-group meeting, public comment, agency review, evidence session. Basis is explicit fixture geography/interests — not individual votes or inferred ideology.",
    href: "/actions/cedar-river-drought-surcharge",
    linkLabel: "Open member actions",
    presenterNotes:
      "Read sponsorship/conflict and non-endorsement language aloud.",
  },
  {
    id: "audit",
    title: "11. Public audit and topic lineage",
    summary:
      "Inspect the public audit trail and complete topic lineage, including advance, merge/split, and deferred trajectories.",
    href: "/transparency",
    linkLabel: "Open public record and lineage",
    presenterNotes:
      "Trajectories: advance (Cedar primary), merge (hardship), defer (billing ops).",
  },
  {
    id: "trajectories",
    title: "Three synthetic trajectories",
    summary:
      "Confirm the three fixture paths: one proposal advances through every stage; one merges into another topic with visible lineage; one is deferred because a published criterion is unmet.",
    href: "/formal-topics",
    linkLabel: "Compare formal trajectories",
    presenterNotes:
      "Do not imply other visitors are live. Fixtures depict multi-user process only.",
  },
  {
    id: "workflow-secondary",
    title: "Secondary: snapshot explorer",
    summary:
      "Optional secondary tool for staff/visitor snapshot exploration. Not the primary demo.",
    href: "/demo/workflow",
    linkLabel: "Open secondary workflow tools",
    presenterNotes:
      "Keep this clearly secondary to the democratic journey.",
  },
  {
    id: "questions-legal",
    title: "Questions for legal counsel",
    summary:
      "Pause for counsel critique: Public Input data processing, small-cell thresholds, retention of raw exports, and membership language.",
    audienceStop: "legal",
    presenterNotes:
      "Point to open-questions and phase-2 counsel gates. Do not treat demo copy as approved terms.",
  },
  {
    id: "questions-technical",
    title: "Questions for technical collaborators",
    summary:
      "Pause for engineering critique: provider-neutral adapters, public DTO allowlists, dual-mode isolation, and unsupported Pol.is features.",
    audienceStop: "technical",
    presenterNotes:
      "No live Pol.is in 4.1. xid remains forbidden until approved.",
  },
  {
    id: "questions-board",
    title: "Questions for prospective board members",
    summary:
      "Pause for fiduciary critique: agenda legitimacy without preference promotion, deliberation vs board authority, and member-action non-endorsement.",
    audienceStop: "board",
    presenterNotes:
      "Ask them to critique institutional rules, not only visuals.",
  },
  {
    id: "close",
    title: "Close and reset",
    summary:
      "Invite critique of the institutional design. Reset clears guided-demo step, presenter notes, Cedar River practice votes, workflow practice, and Idea Commons practice posts.",
    presenterNotes:
      "Stop after 4.1 for owner review before any live Pol.is package.",
  },
];
