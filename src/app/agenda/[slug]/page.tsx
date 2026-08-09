import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PageHeader } from "@/components/PageHeader";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { MainContainer } from "@/components/layout/MainContainer";
import { AgendaDetail } from "@/features/agenda/AgendaDetail";
import {
  getAgendaItemBySlug,
  getTopicById,
  listAgendaItems,
} from "@/domain/selectors";
import { fixtureCatalog } from "@/fixtures";

type AgendaDetailPageProps = {
  params: Promise<{ slug: string }>;
};

export function generateStaticParams() {
  return listAgendaItems(fixtureCatalog).map((item) => ({ slug: item.slug }));
}

export async function generateMetadata({
  params,
}: AgendaDetailPageProps): Promise<Metadata> {
  const { slug } = await params;
  const item = getAgendaItemBySlug(fixtureCatalog, slug);
  if (!item) {
    return { title: "Agenda item not found" };
  }
  return {
    title: item.title,
    description: item.humanReview.rationale,
  };
}

export default async function AgendaDetailPage({
  params,
}: AgendaDetailPageProps) {
  const { slug } = await params;
  const item = getAgendaItemBySlug(fixtureCatalog, slug);
  if (!item) {
    notFound();
  }
  const topic = getTopicById(fixtureCatalog, item.topicId);
  if (!topic) {
    notFound();
  }

  return (
    <MainContainer className="space-y-10">
      <Breadcrumbs
        items={[
          { href: "/", label: "Home" },
          { href: "/agenda", label: "Agenda" },
          { label: item.title },
        ]}
      />
      <PageHeader
        eyebrow="Synthetic agenda calculation"
        title={item.title}
        description={`Topic: ${topic.title}. This page shows separate thresholds, a fixed calculation trace, and the human review record.`}
      />
      <AgendaDetail item={item} topic={topic} />
    </MainContainer>
  );
}
