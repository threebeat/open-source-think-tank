import type { ProcessStep } from "@/components/ProcessStepper";

export const institutionalProcessSteps: ProcessStep[] = [
  {
    id: "idea-commons",
    label: "Idea Commons",
    description: "Informal discussion and early proposals",
  },
  {
    id: "proposal",
    label: "Qualified proposal",
    description: "Scoping criteria before formal entry",
  },
  {
    id: "consultation",
    label: "Public Input",
    description: "Aggregate consultation (Pol.is when approved)",
  },
  {
    id: "agenda",
    label: "Agenda qualification",
    description: "Independent published signals + human review",
  },
  {
    id: "deliberation",
    label: "Deliberation",
    description: "Capacity-limited policy drafting",
  },
  {
    id: "decision",
    label: "Policy recommendation",
    description: "Council recommendation record",
  },
  {
    id: "actions",
    label: "Member actions",
    description: "Civic follow-through opportunities",
  },
  {
    id: "transparency",
    label: "Review & lineage",
    description: "Public audit and follow-up topics",
  },
];
