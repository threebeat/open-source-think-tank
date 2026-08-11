import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PageHeader } from "@/components/PageHeader";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { MainContainer } from "@/components/layout/MainContainer";
import { ConsultationSimulator } from "@/features/consultation/ConsultationSimulator";
import {
  getScenarioBundle,
  listTopics,
} from "@/domain/selectors";
import { fixtureCatalog } from "@/fixtures";

type ConsultPageProps = {
  params: Promise<{ slug: string }>;
};

export function generateStaticParams() {
  return listTopics(fixtureCatalog).map((topic) => ({ slug: topic.slug }));
}

export async function generateMetadata({
  params,
}: ConsultPageProps): Promise<Metadata> {
  const { slug } = await params;
  const bundle = getScenarioBundle(fixtureCatalog, slug);
  if (!bundle) {
    return { title: "Public input not found" };
  }
  return {
    title: `Public Input · ${bundle.topic.title}`,
    description:
      "Simulated public input for the demonstration (eligible/invited participants in the intended product). Not a live Pol.is conversation; responses stay in the browser.",
  };
}

export default async function ConsultPage({ params }: ConsultPageProps) {
  const { slug } = await params;
  const bundle = getScenarioBundle(fixtureCatalog, slug);
  if (!bundle) {
    notFound();
  }

  const { topic, consultationResult, consultationStatements, claims, evidenceSources } =
    bundle;
  const groups = fixtureCatalog.opinionGroups.filter((group) =>
    consultationResult?.opinionGroupIds.includes(group.id),
  );
  const orderedStatements = consultationResult
    ? consultationResult.statementIds
        .map((id) =>
          consultationStatements.find((statement) => statement.id === id),
        )
        .filter((statement) => statement != null)
    : consultationStatements;

  return (
    <MainContainer className="space-y-8">
      <Breadcrumbs
        items={[
          { href: "/", label: "Home" },
          { href: "/topics", label: "Topics" },
          { href: `/topics/${topic.slug}`, label: topic.title },
          { label: "Public Input" },
        ]}
      />
      <PageHeader
        eyebrow="Simulated public input"
        title={`Public Input · ${topic.title}`}
        description="Practice responding to short statements, then open the sealed synthetic report. In the intended product, input comes from eligible/invited participants. Preference signals stay separate from research quality."
      />
      <ConsultationSimulator
        topicId={topic.id}
        topicSlug={topic.slug}
        topicTitle={topic.title}
        statements={orderedStatements}
        result={consultationResult ?? null}
        groups={groups}
        claims={claims}
        evidenceSources={evidenceSources}
      />
    </MainContainer>
  );
}
