import type { Metadata } from "next";

import { ProcessTour } from "@/components/demo/ProcessTour";
import { PageHeader } from "@/components/PageHeader";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { MainContainer } from "@/components/layout/MainContainer";

export const metadata: Metadata = {
  title: "Demo",
  description:
    "Unauthenticated synthetic tour of Commons, qualification, consultation, Chamber, Council, and records.",
};

export default function DemoPage() {
  return (
    <MainContainer className="space-y-10">
      <Breadcrumbs items={[{ href: "/", label: "Home" }, { label: "Demo" }]} />
      <PageHeader
        eyebrow="Synthetic process tour"
        title="Tour Commonhall"
        description="Walk Commons → qualification → consultation → Chamber → Council → records. No account is required. This is a demonstration, not a live town hall."
      />
      <ProcessTour />
    </MainContainer>
  );
}
