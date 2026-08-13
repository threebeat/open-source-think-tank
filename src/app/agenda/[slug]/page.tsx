import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { PageHeader } from "@/components/PageHeader";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { MainContainer } from "@/components/layout/MainContainer";
import { AgendaDetail } from "@/features/agenda/AgendaDetail";
import { QualificationTracePanel } from "@/features/agenda-qualification/QualificationTracePanel";
import {
  getAgendaItemBySlug,
  getTopicById,
  listAgendaItems,
} from "@/domain/selectors";
import { fixtureCatalog } from "@/fixtures";
import { qualificationTraces } from "@/fixtures/journey-catalog";

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
  const qualificationTrace = qualificationTraces.find(
    (trace) => trace.topicSlug === item.slug,
  );

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
        description={`Topic: ${topic.title}. Independent qualification signals stay separate from evidence quality and from any composite popularity score.`}
      />
      {qualificationTrace ? (
        <QualificationTracePanel trace={qualificationTrace} />
      ) : null}
      <AgendaDetail item={item} topic={topic} />
      {item.state === "qualified" ? (
        <p className="text-sm text-muted-foreground">
          Continue to the{" "}
          <Link
            href={`/deliberation/${item.slug}`}
            className="font-medium text-foreground underline-offset-4 hover:underline focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
          >
            public-observer deliberation record
          </Link>
          .
        </p>
      ) : null}
    </MainContainer>
  );
}
