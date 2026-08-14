import type { Metadata } from "next";

import { HallPlaceholder } from "@/components/member/HallPlaceholder";

export const metadata: Metadata = {
  title: "Records",
  description: "Commonhall Records placeholder — public projections open later.",
};

export default function RecordsPage() {
  return (
    <HallPlaceholder
      title="Records"
      description="Allowlisted public records, roll calls, and version history open in a later phase."
    />
  );
}
