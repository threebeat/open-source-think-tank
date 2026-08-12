export type DemoStep = {
  id: string;
  title: string;
  summary: string;
  href?: string;
  linkLabel?: string;
  presenterNotes: string;
  audienceStop?: "legal" | "technical" | "board";
};

export const demoSteps: DemoStep[] = [
  {
    id: "welcome",
    title: "Start: synthetic demonstration only",
    summary:
      "This guided walkthrough uses fictional people, evidence, votes, and decisions. Nothing here enrolls a member, verifies identity, binds a board, or calls Pol.is.",
    presenterNotes:
      "State the disclaimer out loud. Emphasize that Phase 1 proves institutional clarity with fixtures, not operational membership.",
  },
  {
    id: "join",
    title: "How Joining Works",
    summary:
      "Show the nonfunctional eligibility and assent placeholders. No form submits data; membership status remains an unresolved legal question.",
    href: "/join",
    linkLabel: "Open how joining works",
    presenterNotes:
      "Point to disabled controls and “not legally reviewed” language. Do not invent whether participants are statutory members.",
  },
  {
    id: "topics",
    title: "Fact-Check & Research",
    summary:
      "Open the Cedar River topic. Keep popularity separate from research review status. Note pending, accepted, limited, disputed, and rejected sources — none of these prove a claim is true by themselves.",
    href: "/topics/cedar-river-drought-surcharge",
    linkLabel: "Open Cedar River topic",
    presenterNotes:
      "Call out the popular/weak vs less-popular/strong examples when you reach public input. Research quality does not move with agreement.",
  },
  {
    id: "consultation",
    title: "Public Input (simulated)",
    summary:
      "Practice Agree / Disagree / Pass locally, then open the sample Public Input report. This demonstration is not connected to Pol.is; a later alpha phase is planned to use Pol.is for live Public Input from eligible/invited participants. Groups stay neutrally labeled; the cohort is not a population sample.",
    href: "/topics/cedar-river-drought-surcharge/consult",
    linkLabel: "Open public input simulation",
    presenterNotes:
      "Remind viewers that local practice votes do not personalize the fixture report, Pol.is is not live yet, and preference/agreement stay separate from research quality.",
  },
  {
    id: "agenda",
    title: "Decide What Moves Forward",
    summary:
      "Show separate public criteria, how this result was calculated, and a deferral that refuses to override research concerns. No combined truth score.",
    href: "/agenda/cedar-river-drought-surcharge",
    linkLabel: "Open qualified agenda item",
    presenterNotes:
      "Also glance at deferred and rejected sibling items on /agenda so popularity alone is visibly insufficient.",
  },
  {
    id: "deliberation",
    title: "State-Level Policy Drafting (observer view)",
    summary:
      "Walk proposal versions, amendments with targeted sources, the billing evidence request, someone who stepped aside because of a conflict, and the redaction placeholder. Closed means capacity-limited, not secret.",
    href: "/deliberation/cedar-river-drought-surcharge",
    linkLabel: "Open policy drafting record",
    presenterNotes:
      "Distinguish Policy Drafting Council seats from the later Policy Council recommendation roster.",
  },
  {
    id: "decision",
    title: "Recommendation & Council Vote",
    summary:
      "Show the recommendation (not enacted law and not board adoption), Policy Council roll call, equal-prominence minority report, and full proposal history.",
    href: "/decisions/cedar-river-drought-surcharge",
    linkLabel: "Open recommendation & council vote",
    presenterNotes:
      "Name Farah Quinn as the minority author on the Policy Council. Dual-seat members keep separate selection paths.",
  },
  {
    id: "workflow",
    title: "Operational workflow preview",
    summary:
      "Open the fixture-backed feature tour of synthetic submission, disclosure, review, revision, comparison, moderation visibility, and visitor projection snapshots. URL query state is presentation-only.",
    href: "/demo/workflow",
    linkLabel: "Open operational workflow preview",
    presenterNotes:
      "Label every screen as a synthetic role preview. Never imply live moderation actions, admin consoles, or other current visitors.",
  },
  {
    id: "transparency",
    title: "The Public Record",
    summary:
      "Demonstration activity history, methods and updates, who does what, and what we publish vs what we protect. Identity and granular opinion histories stay protected.",
    href: "/transparency",
    linkLabel: "Open the public record",
    presenterNotes:
      "The public record explains institutional action; it is not total exposure of personal or political-opinion records.",
  },
  {
    id: "questions-legal",
    title: "Questions for legal counsel",
    summary:
      "Pause for counsel critique: formation and tax lane, statutory membership vs program participation, board authority, assent records, and what must remain private.",
    audienceStop: "legal",
    presenterNotes:
      "Point collaborators to docs/legal-questions.md. Do not treat demo copy as approved terms.",
  },
  {
    id: "questions-technical",
    title: "Questions for technical collaborators",
    summary:
      "Pause for engineering critique: fixture boundaries, adapters for later services, auditability of algorithms, accessibility, and what must never enter prompts or logs.",
    audienceStop: "technical",
    presenterNotes:
      "Emphasize static fixtures now, adapters later, and no production participant data in demos.",
  },
  {
    id: "questions-board",
    title: "Questions for prospective board members",
    summary:
      "Pause for fiduciary critique: which recommendations may bind, how overrides are published, capacity limits, and what remains reserved to a governing board after counsel advice.",
    audienceStop: "board",
    presenterNotes:
      "Ask them to critique institutional rules, not only visual design. Board adoption authority is intentionally unresolved.",
  },
  {
    id: "close",
    title: "Close and reset",
    summary:
      "End by inviting critique of the institutional design. Use Reset to restore the original synthetic demonstration state in this browser session.",
    presenterNotes:
      "Reset clears the demo step, presenter-notes toggle, and local Cedar River public-input practice votes only.",
  },
];
