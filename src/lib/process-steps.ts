import type { ProcessStep } from "@/components/ProcessStepper";

export const institutionalProcessSteps: ProcessStep[] = [
  {
    id: "join",
    label: "How Joining Works",
    description: "Eligibility and assent placeholders",
  },
  {
    id: "evidence",
    label: "Fact-Check & Research",
    description: "Claims and source review",
  },
  {
    id: "consultation",
    label: "Public Input",
    description: "Areas of agreement and disagreement (simulated)",
  },
  {
    id: "agenda",
    label: "Decide What Moves Forward",
    description: "Public criteria plus human review",
  },
  {
    id: "deliberation",
    label: "State-Level Policy Drafting",
    description: "Capacity-limited council view",
  },
  {
    id: "decision",
    label: "Recommendation & Council Vote",
    description: "Record, dissent, review date",
  },
  {
    id: "transparency",
    label: "The Public Record",
    description: "Activity history and protected data",
  },
];
