import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";

import { RollCallTable } from "@/components/bodies/RollCallTable";
import { DisclosureNotice } from "@/components/DisclosureNotice";
import { PageHeader } from "@/components/PageHeader";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { MainContainer } from "@/components/layout/MainContainer";
import { PublicTime } from "@/components/topics/PublicTime";
import { requireMemberSession } from "@/lib/auth/guard";
import { loadMemberCommonsContext } from "@/lib/commons/member-context";
import { getRecordsTopic } from "@/lib/bodies/service";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  return {
    title: "Record",
    description: `Commonhall published record ${slug}`,
  };
}

export default async function RecordsTopicPage({ params }: PageProps) {
  const { slug } = await params;
  const session = await requireMemberSession();
  const { db, principal, organizationId } = await loadMemberCommonsContext(
    session.accountId,
  );
  if (!organizationId) {
    notFound();
  }
  const result = await getRecordsTopic(db, {
    principal,
    organizationId,
    slugOrPublicId: slug,
  });
  if (!result.ok) {
    notFound();
  }
  const topic = result.value;

  return (
    <MainContainer className="space-y-8">
      <Breadcrumbs
        items={[
          { href: "/", label: "Home" },
          { href: "/records", label: "Records" },
          { label: topic.title },
        ]}
      />
      <PageHeader
        eyebrow="Records"
        title={topic.title}
        description={topic.question ?? topic.stateLabel}
      />
      {topic.synthetic ? (
        <DisclosureNotice title="Synthetic seed" tone="caution">
          This published record is a labeled synthetic fixture. Recommendations
          are not enacted law.
        </DisclosureNotice>
      ) : null}
      {topic.overview ? (
        <p className="max-w-prose text-base leading-7">{topic.overview}</p>
      ) : null}

      {topic.chamberVerdict ? (
        <section className="space-y-3" aria-labelledby="record-chamber-heading">
          <h2 id="record-chamber-heading" className="font-heading text-xl tracking-tight">
            Chamber verdict version {topic.chamberVerdict.version}
          </h2>
          <p className="text-sm">
            Outcome: {topic.chamberVerdict.outcome}. Published{" "}
            <PublicTime dateTime={topic.chamberVerdict.publishedAt} />.
          </p>
          <p className="max-w-prose text-base leading-7">
            {topic.chamberVerdict.rationale}
          </p>
          <RollCallTable
            caption={`Chamber roll call for ${topic.title}.`}
            rows={topic.chamberRollCall}
            timezone="America/Chicago"
          />
        </section>
      ) : null}

      {topic.councilRecommendation ? (
        <section className="space-y-3" aria-labelledby="record-council-heading">
          <h2 id="record-council-heading" className="font-heading text-xl tracking-tight">
            Council recommendation version {topic.councilRecommendation.version}
          </h2>
          <p className="text-sm">
            Published{" "}
            <PublicTime dateTime={topic.councilRecommendation.publishedAt} />.
          </p>
          <p className="max-w-prose text-base leading-7">
            {topic.councilRecommendation.rationale}
          </p>
          {topic.councilRecommendation.minorityReasoning ? (
            <p className="max-w-prose text-sm leading-6 text-muted-foreground">
              Minority reasoning: {topic.councilRecommendation.minorityReasoning}
            </p>
          ) : null}
          <RollCallTable
            caption={`Council roll call for ${topic.title}.`}
            rows={topic.councilRollCall}
            timezone="America/Chicago"
          />
        </section>
      ) : null}

      <p className="text-sm">
        <Link className="underline" href="/records">
          Back to Records
        </Link>
        {" · "}
        <Link className="underline" href={`/chamber/topics/${topic.slug}`}>
          Chamber
        </Link>
        {" · "}
        <Link className="underline" href={`/council/topics/${topic.slug}`}>
          Council
        </Link>
      </p>
    </MainContainer>
  );
}
