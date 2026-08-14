import type { Metadata } from "next";

import { HallPlaceholder } from "@/components/member/HallPlaceholder";

export const metadata: Metadata = {
  title: "Commons",
  description: "Commonhall Commons placeholder — posting opens in a later phase.",
};

export default function CommonsPage() {
  return (
    <HallPlaceholder
      title="Commons"
      description="Formal categories will appear first, then informal discussion after the unreviewed-content disclaimer. Member posts open in Phase 3."
    />
  );
}
