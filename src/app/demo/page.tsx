import type { Metadata } from "next";

import { InteractiveHallDemo } from "@/components/demo/InteractiveHallDemo";
import { PageHeader } from "@/components/PageHeader";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { MainContainer } from "@/components/layout/MainContainer";

export const metadata: Metadata = {
  title: "Demo",
  description:
    "Interactive pre-alpha tour of Commons, Public Agenda, Chamber, and Council using the real hall components.",
};

export default function DemoPage() {
  return (
    <MainContainer className="space-y-10">
      <Breadcrumbs items={[{ href: "/", label: "Home" }, { label: "Demo" }]} />
      <PageHeader
        eyebrow="Interactive hall"
        title="Tour Commonhall"
        description="Click through the same Commons, Public Agenda, Chamber, and Council surfaces members use. This is a demonstration, not a live town hall."
      />
      <InteractiveHallDemo />
    </MainContainer>
  );
}
