import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PageHeader } from "@/components/PageHeader";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { MainContainer } from "@/components/layout/MainContainer";
import { DecisionRecord } from "@/features/decisions/DecisionRecord";
import { getDecisionBundle, listDecisions } from "@/domain/selectors";
import { fixtureCatalog } from "@/fixtures";
import { decisionOutcomeLabels } from "@/lib/evidence-labels";

type DecisionPageProps = {
  params: Promise<{ slug: string }>;
};

export function generateStaticParams() {
  return listDecisions(fixtureCatalog).map((item) => ({ slug: item.slug }));
}

export async function generateMetadata({
  params,
}: DecisionPageProps): Promise<Metadata> {
  const { slug } = await params;
  const bundle = getDecisionBundle(fixtureCatalog, slug);
  if (!bundle) {
    return { title: "Decision not found" };
  }
  return {
    title: `Decision — ${bundle.topic.title}`,
    description: bundle.decision.rationale,
  };
}

export default async function DecisionPage({ params }: DecisionPageProps) {
  const { slug } = await params;
  const bundle = getDecisionBundle(fixtureCatalog, slug);
  if (!bundle) {
    notFound();
  }

  return (
    <MainContainer className="space-y-10">
      <Breadcrumbs
        items={[
          { href: "/", label: "Home" },
          { label: "Decisions" },
          { label: bundle.topic.title },
        ]}
      />
      <PageHeader
        eyebrow={`Synthetic decision · ${decisionOutcomeLabels[bundle.decision.outcome]}`}
        title={bundle.topic.title}
        description="Final proposal, roll call, rationale, minority report, and links back through the institutional path."
      />
      <DecisionRecord
        decision={bundle.decision}
        topic={bundle.topic}
        deliberation={bundle.deliberation}
        agendaItem={bundle.agendaItem}
        finalProposal={bundle.finalProposal}
        proposalHistory={bundle.proposalHistory}
        rollCall={bundle.rollCall}
        minorityAuthors={bundle.minorityAuthors}
      />
    </MainContainer>
  );
}
