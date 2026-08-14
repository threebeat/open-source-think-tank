import type { Metadata } from "next";

import { HallPlaceholder } from "@/components/member/HallPlaceholder";

export const metadata: Metadata = {
  title: "Chamber",
  description: "Commonhall Chamber placeholder — appointments and roll calls open later.",
};

export default function ChamberPage() {
  return (
    <HallPlaceholder
      title="Chamber"
      description="Appointed Chamber deliberation and roll calls open in a later phase. Community enrollment never grants a Chamber seat."
    />
  );
}
