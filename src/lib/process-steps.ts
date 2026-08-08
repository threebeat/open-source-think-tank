import type { ProcessStep } from "@/components/ProcessStepper";

export const institutionalProcessSteps: ProcessStep[] = [
  {
    id: "join",
    label: "Join preview",
    description: "Eligibility and assent placeholders",
  },
  {
    id: "evidence",
    label: "Topic & evidence",
    description: "Claims and source review",
  },
  {
    id: "consultation",
    label: "Consultation",
    description: "Preference mapping (simulated)",
  },
  {
    id: "agenda",
    label: "Agenda",
    description: "Thresholds plus human review",
  },
  {
    id: "deliberation",
    label: "Deliberation",
    description: "Capacity-limited council view",
  },
  {
    id: "decision",
    label: "Decision",
    description: "Record, dissent, review date",
  },
  {
    id: "transparency",
    label: "Transparency",
    description: "Audit and protected data",
  },
];
