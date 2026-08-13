import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { PageHeader } from "@/components/PageHeader";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { MainContainer } from "@/components/layout/MainContainer";
import { QualificationTracePanel } from "@/features/agenda-qualification/QualificationTracePanel";
import { FormalTopicGatePanel } from "@/features/journey/FormalTopicGatePanel";
import { getPublicInputPublicDto } from "@/features/public-input/aggregate-report";
import { PublicInputReportPanel } from "@/features/public-input/PublicInputReportPanel";
import {
  formalTopicGateViews,
  qualificationTraces,
} from "@/fixtures/journey-catalog";

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ view?: string }>;
};

export async function generateStaticParams() {
  return formalTopicGateViews.map((gate) => ({ slug: gate.topicSlug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  return {
    title: `Formal topic · ${slug}`,
    description:
      "Formal Topic Pipeline gate status, lineage, and allowlisted Public Input aggregates.",
  };
}

export default async function FormalTopicDetailPage({
  params,
  searchParams,
}: Props) {
  const { slug } = await params;
  const { view } = await searchParams;
  const gate = formalTopicGateViews.find((item) => item.topicSlug === slug);
  if (!gate) {
    notFound();
  }
  const report =
    view === "public-input-report" ? getPublicInputPublicDto(slug) : null;
  const trace = qualificationTraces.find((item) => item.topicSlug === slug);

  return (
    <MainContainer className="space-y-10">
      <Breadcrumbs
        items={[
          { href: "/", label: "Home" },
          { href: "/formal-topics", label: "Formal Topic Pipeline" },
          { label: slug },
        ]}
      />
      <PageHeader
        eyebrow="Formal Topic Pipeline"
        title={slug}
        description="Stage, criteria, lineage, public versus protected information, and next transition — for gate-passed topics only."
      />

      {report ? <PublicInputReportPanel report={report} /> : null}

      <FormalTopicGatePanel gate={gate} />

      {trace ? <QualificationTracePanel trace={trace} /> : null}

      <nav className="flex flex-wrap gap-4 text-sm" aria-label="Related formal stages">
        <Link
          href={`/topics/${slug === "cedar-river-billing-ops-gap" ? "cedar-river-drought-surcharge" : slug}`}
          className="font-medium text-primary underline-offset-4 hover:underline"
        >
          Topic brief
        </Link>
        {slug !== "cedar-river-billing-ops-gap" ? (
          <>
            <Link
              href={`/topics/${slug}/consult`}
              className="font-medium text-primary underline-offset-4 hover:underline"
            >
              Public Input
            </Link>
            <Link
              href={`/formal-topics/${slug}?view=public-input-report`}
              className="font-medium text-primary underline-offset-4 hover:underline"
            >
              Aggregate report
            </Link>
            <Link
              href={`/agenda/${slug}`}
              className="font-medium text-primary underline-offset-4 hover:underline"
            >
              Agenda qualification
            </Link>
            <Link
              href={`/deliberation/${slug}`}
              className="font-medium text-primary underline-offset-4 hover:underline"
            >
              Deliberation
            </Link>
            <Link
              href={`/decisions/${slug}`}
              className="font-medium text-primary underline-offset-4 hover:underline"
            >
              Recommendation
            </Link>
            <Link
              href={`/actions/${slug}`}
              className="font-medium text-primary underline-offset-4 hover:underline"
            >
              Member actions
            </Link>
          </>
        ) : (
          <Link
            href="/agenda/cedar-river-billing-ops-gap"
            className="font-medium text-primary underline-offset-4 hover:underline"
          >
            Deferred agenda item
          </Link>
        )}
      </nav>
    </MainContainer>
  );
}
