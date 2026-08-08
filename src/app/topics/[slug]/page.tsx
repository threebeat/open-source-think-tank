import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { DisclosureNotice } from "@/components/DisclosureNotice";
import { PageHeader } from "@/components/PageHeader";
import { StageBadge } from "@/components/StageBadge";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { MainContainer } from "@/components/layout/MainContainer";
import { ClaimCard } from "@/features/topics/ClaimCard";
import { EvidenceReviewExplainer } from "@/features/topics/EvidenceReviewExplainer";
import { EvidenceSourceCard } from "@/features/topics/EvidenceSourceCard";
import {
  getEvidenceForTopic,
  getScenarioBundle,
  listTopics,
} from "@/domain/selectors";
import { fixtureCatalog } from "@/fixtures";

type TopicPageProps = {
  params: Promise<{ slug: string }>;
};

export function generateStaticParams() {
  return listTopics(fixtureCatalog).map((topic) => ({ slug: topic.slug }));
}

export async function generateMetadata({
  params,
}: TopicPageProps): Promise<Metadata> {
  const { slug } = await params;
  const bundle = getScenarioBundle(fixtureCatalog, slug);
  if (!bundle) {
    return { title: "Topic not found" };
  }
  return {
    title: bundle.topic.title,
    description: bundle.topic.question,
  };
}

export default async function TopicDetailPage({ params }: TopicPageProps) {
  const { slug } = await params;
  const bundle = getScenarioBundle(fixtureCatalog, slug);
  if (!bundle) {
    notFound();
  }

  const { topic, claims, evidenceSources } = bundle;
  const evidenceById = new Map(
    getEvidenceForTopic(fixtureCatalog, topic.id).map((source) => [
      source.id,
      source,
    ]),
  );

  return (
    <MainContainer className="space-y-10">
      <Breadcrumbs
        items={[
          { href: "/", label: "Home" },
          { href: "/topics", label: "Topics" },
          { label: topic.title },
        ]}
      />
      <PageHeader
        eyebrow="Synthetic topic brief"
        title={topic.title}
        description={topic.question}
        actions={<StageBadge stage={topic.stage} />}
      />

      <DisclosureNotice title="Popularity is not evidence quality" tone="caution">
        Participant support and cross-group agreement do not change whether a
        source is pending, accepted, limited, disputed, or rejected.
      </DisclosureNotice>

      <section className="grid gap-4 md:grid-cols-2">
        <div className="rounded-md border border-border bg-surface p-5">
          <h2 className="font-heading text-xl text-foreground">Background</h2>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            {topic.background}
          </p>
        </div>
        <div className="rounded-md border border-border bg-surface p-5">
          <h2 className="font-heading text-xl text-foreground">Scope</h2>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            {topic.scope}
          </p>
          {topic.participationSummary ? (
            <p className="mt-4 text-sm leading-6 text-muted-foreground">
              <span className="font-medium text-foreground">
                Participation summary:{" "}
              </span>
              {topic.participationSummary}
            </p>
          ) : null}
          <p className="mt-4 text-sm leading-6 text-muted-foreground">
            <span className="font-medium text-foreground">Next step: </span>
            {topic.nextStep}
          </p>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="font-heading text-2xl text-foreground">
          Claims and evidence
        </h2>
        {claims.length > 0 ? (
          <div className="space-y-4">
            {claims.map((claim) => (
              <ClaimCard
                key={claim.id}
                claim={claim}
                supporting={claim.supportingEvidenceIds
                  .map((id) => evidenceById.get(id))
                  .filter((source) => source != null)}
                counterevidence={claim.counterEvidenceIds
                  .map((id) => evidenceById.get(id))
                  .filter((source) => source != null)}
              />
            ))}
          </div>
        ) : (
          <p className="rounded-md border border-dashed border-border bg-surface p-5 text-sm text-muted-foreground">
            No claims have been submitted yet for this synthetic topic. The brief
            stage is intentionally empty of competing approaches.
          </p>
        )}
      </section>

      {evidenceSources.length > 0 ? (
        <section className="space-y-4">
          <h2 className="font-heading text-2xl text-foreground">
            Evidence inventory
          </h2>
          <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
            All sources attached to this topic, including pending, limited,
            disputed, and rejected states. Source quality is shown independently
            from any consultation popularity.
          </p>
          <div className="grid gap-4 lg:grid-cols-2">
            {evidenceSources.map((source) => (
              <EvidenceSourceCard key={source.id} source={source} />
            ))}
          </div>
        </section>
      ) : null}

      <EvidenceReviewExplainer />

      <section className="space-y-4">
        <h2 className="font-heading text-2xl text-foreground">
          Topic brief changelog
        </h2>
        <ol className="space-y-3">
          {topic.changelog.map((entry) => (
            <li
              key={`${entry.at}-${entry.summary}`}
              className="rounded-md border border-border bg-surface px-4 py-3 text-sm"
            >
              <p className="font-medium text-foreground">{entry.at}</p>
              <p className="mt-1 text-muted-foreground">{entry.summary}</p>
            </li>
          ))}
        </ol>
      </section>
    </MainContainer>
  );
}
