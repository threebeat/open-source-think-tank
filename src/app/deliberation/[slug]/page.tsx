import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PageHeader } from "@/components/PageHeader";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { MainContainer } from "@/components/layout/MainContainer";
import { DeliberationObserver } from "@/features/deliberation/DeliberationObserver";
import {
  getDeliberationBundle,
  listDeliberations,
} from "@/domain/selectors";
import { fixtureCatalog } from "@/fixtures";

type DeliberationPageProps = {
  params: Promise<{ slug: string }>;
};

export function generateStaticParams() {
  return listDeliberations(fixtureCatalog).map((item) => ({
    slug: item.slug,
  }));
}

export async function generateMetadata({
  params,
}: DeliberationPageProps): Promise<Metadata> {
  const { slug } = await params;
  const bundle = getDeliberationBundle(fixtureCatalog, slug);
  if (!bundle) {
    return { title: "Deliberation not found" };
  }
  return {
    title: `Deliberation — ${bundle.topic.title}`,
    description: bundle.deliberation.observerNotice,
  };
}

export default async function DeliberationPage({
  params,
}: DeliberationPageProps) {
  const { slug } = await params;
  const bundle = getDeliberationBundle(fixtureCatalog, slug);
  if (!bundle?.agendaItem) {
    notFound();
  }

  return (
    <MainContainer className="space-y-10">
      <Breadcrumbs
        items={[
          { href: "/", label: "Home" },
          { label: "Deliberation" },
          { label: bundle.topic.title },
        ]}
      />
      <PageHeader
        eyebrow="Public-observer deliberation"
        title={bundle.topic.title}
        description="Capacity-limited synthetic council record. Closed means limited participation rights, not secret institutional action."
      />
      <DeliberationObserver
        deliberation={bundle.deliberation}
        topic={bundle.topic}
        participants={bundle.participants}
        conflicts={bundle.conflicts}
        proposals={bundle.proposals}
        amendments={bundle.amendments}
        relatedEvidence={bundle.relatedEvidence}
        agendaSlug={bundle.agendaItem.slug}
      />
    </MainContainer>
  );
}
