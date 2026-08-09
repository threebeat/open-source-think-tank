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
    title: "Join preview",
    summary:
      "Show the nonfunctional eligibility and assent placeholders. No form submits data; membership status remains an unresolved legal question.",
    href: "/join",
    linkLabel: "Open join preview",
    presenterNotes:
      "Point to disabled controls and “not legally reviewed” language. Do not invent whether participants are statutory members.",
  },
  {
    id: "topics",
    title: "Topic brief and evidence",
    summary:
      "Open the Cedar River topic. Keep popularity separate from evidence-review status. Note pending, accepted, limited, disputed, and rejected sources.",
    href: "/topics/cedar-river-drought-surcharge",
    linkLabel: "Open Cedar River topic",
    presenterNotes:
      "Call out the popular/weak vs less-popular/strong examples when you reach consultation. Evidence quality does not move with agreement.",
  },
  {
    id: "consultation",
    title: "Simulated consultation",
    summary:
      "Practice Agree / Disagree / Pass locally, then open the sealed synthetic report. Groups stay neutrally labeled; the cohort is not a population sample.",
    href: "/topics/cedar-river-drought-surcharge/consult",
    linkLabel: "Open consultation simulation",
    presenterNotes:
      "Remind viewers that local practice votes do not personalize the fixture report and that this is not a live Pol.is conversation.",
  },
  {
    id: "agenda",
    title: "Agenda gate and human review",
    summary:
      "Show separate thresholds, the calculation trace, and a deferral that refuses to override evidence concerns. No combined truth score.",
    href: "/agenda/cedar-river-drought-surcharge",
    linkLabel: "Open qualified agenda item",
    presenterNotes:
      "Also glance at deferred and rejected sibling items on /agenda so popularity alone is visibly insufficient.",
  },
  {
    id: "deliberation",
    title: "Deliberation observer view",
    summary:
      "Walk proposal versions, amendments with targeted sources, the billing evidence request, recusal, and the redaction placeholder. Closed means capacity-limited, not secret.",
    href: "/deliberation/cedar-river-drought-surcharge",
    linkLabel: "Open deliberation record",
    presenterNotes:
      "Distinguish Deliberation Council seats from the later Policy Council recommendation roster.",
  },
  {
    id: "decision",
    title: "Policy Council decision record",
    summary:
      "Show the recommendation (not board adoption), Policy Council roll call, equal-prominence minority report, and full proposal history.",
    href: "/decisions/cedar-river-drought-surcharge",
    linkLabel: "Open decision record",
    presenterNotes:
      "Name Farah Quinn as the minority author on the Policy Council. Dual-seat members keep separate selection paths.",
  },
  {
    id: "transparency",
    title: "Transparency center",
    summary:
      "Audit feed, method registry, governance map, and open-by-default vs protected-by-necessity classes. Identity and granular opinion histories stay protected.",
    href: "/transparency",
    linkLabel: "Open transparency center",
    presenterNotes:
      "Transparency is explainability of institutional action, not total exposure of personal or political-opinion records.",
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
      "Reset clears the demo step, presenter-notes toggle, and local Cedar River consultation practice votes only.",
  },
];
