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
    "Browse synthetic Tennessee-oriented demonstration topics with local search and filters.",
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
        description="Searchable Tennessee-oriented demonstration topics. Geography is a classification label only. Evidence quality stays separate from participant popularity."
      />
      <DisclosureNotice title="Not a live submissions inbox">
        These topics are fixed synthetic fixtures. Real Tennessee and county names
        are geographic labels only — the records are hypothetical and do not
        describe actual Tennessee government action. Nothing here accepts real
        membership, real political-opinion data, or live evidence uploads.
      </DisclosureNotice>
      <TopicsExplorer topics={topics} />
    </MainContainer>
  );
}
