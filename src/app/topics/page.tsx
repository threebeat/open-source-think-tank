import type { Metadata } from "next";

import { DisclosureNotice } from "@/components/DisclosureNotice";
import { PageHeader } from "@/components/PageHeader";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { MainContainer } from "@/components/layout/MainContainer";
import { TopicsExplorer } from "@/features/topics/TopicsExplorer";
import { listTopics } from "@/domain/selectors";
import { fixtureCatalog } from "@/fixtures";

export const metadata: Metadata = {
  title: "Topics",
  description:
    "Browse synthetic demonstration topics with local stage, subject, and status filters.",
};

export default function TopicsPage() {
  const topics = listTopics(fixtureCatalog);

  return (
    <MainContainer className="space-y-8">
      <Breadcrumbs
        items={[{ href: "/", label: "Home" }, { label: "Topics" }]}
      />
      <PageHeader
        eyebrow="Synthetic fixtures only"
        title="Topics"
        description="Searchable and filterable demonstration topics. Evidence quality stays separate from participant popularity."
      />
      <DisclosureNotice title="Not a live submissions inbox">
        These topics are fixed synthetic fixtures for the Phase 1 demonstration.
        Nothing here accepts real membership, real political-opinion data, or live
        evidence uploads.
      </DisclosureNotice>
      <TopicsExplorer topics={topics} />
    </MainContainer>
  );
}
