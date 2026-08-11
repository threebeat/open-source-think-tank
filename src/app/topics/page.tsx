import type { Metadata } from "next";
import { connection } from "next/server";

import { DisclosureNotice } from "@/components/DisclosureNotice";
import { PageHeader } from "@/components/PageHeader";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { MainContainer } from "@/components/layout/MainContainer";
import { TopicsExplorer } from "@/features/topics/TopicsExplorer";
import { listTopics } from "@/domain/selectors";
import { fixtureCatalog } from "@/fixtures";
import { resolveAppMode } from "@/lib/env/app-mode";

// Dual-mode: gated reads use connection()/DB; conditional segment config is
// not statically analyzable, so keep these routes request-time in both modes.
export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  if (resolveAppMode() === "gated") {
    await connection();
    const { gatedTopicsMetadata } = await import("./gated-published-topics");
    return gatedTopicsMetadata;
  }
  return {
    title: "Topics",
    description:
      "Browse synthetic Tennessee-oriented demonstration topics with local search and filters.",
  };
}

export default async function TopicsPage() {
  if (resolveAppMode() === "gated") {
    await connection();
    const { default: GatedPublishedTopicsPage } = await import(
      "./gated-published-topics"
    );
    return <GatedPublishedTopicsPage />;
  }

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
