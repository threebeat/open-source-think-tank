import type { Metadata } from "next";

import { PageHeader } from "@/components/PageHeader";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { MainContainer } from "@/components/layout/MainContainer";
import { GuidedDemo } from "@/features/demo/GuidedDemo";

export const metadata: Metadata = {
  title: "Guided demo",
  description:
    "Five-to-eight-minute synthetic walkthrough from how joining works through recommendation & council vote and the public record.",
};

export default function DemoPage() {
  return (
    <MainContainer className="space-y-10">
      <Breadcrumbs
        items={[{ href: "/", label: "Home" }, { label: "Guided demo" }]}
      />
      <PageHeader
        eyebrow="Presentation mode"
        title="Guided demo"
        description="A short presenter-led path through the Cedar River synthetic scenario. Reset restores local demo state only; no server data is stored."
      />
      <GuidedDemo />
    </MainContainer>
  );
}
