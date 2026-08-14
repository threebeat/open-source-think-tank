import type { Metadata } from "next";

import { HallPlaceholder } from "@/components/member/HallPlaceholder";

export const metadata: Metadata = {
  title: "Council",
  description: "Commonhall Council placeholder — intake and recommendations open later.",
};

export default function CouncilPage() {
  return (
    <HallPlaceholder
      title="Council"
      description="Organization Council intake, recommendations, and roll calls open in a later phase. Community enrollment never grants a Council seat."
    />
  );
}
