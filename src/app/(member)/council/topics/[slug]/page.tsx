import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";

import { RollCallTable } from "@/components/bodies/RollCallTable";
import { RosterTable } from "@/components/bodies/RosterTable";
import { DisclosureNotice } from "@/components/DisclosureNotice";
import { PageHeader } from "@/components/PageHeader";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { MainContainer } from "@/components/layout/MainContainer";
import { PublicTime } from "@/components/topics/PublicTime";
import { requireMemberSession } from "@/lib/auth/guard";
import { loadMemberCommonsContext } from "@/lib/commons/member-context";
import { getCouncilTopic } from "@/lib/bodies/service";
import { resolveAppMode } from "@/lib/env/app-mode";
import { localCouncilTopic } from "@/lib/pre-alpha/member-views";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  return {
    title: "Council topic",
    description: `Commonhall Council topic ${slug}`,
  };
}

export default async function CouncilTopicPage({ params }: PageProps) {
  const { slug } = await params;
  const session = await requireMemberSession();
  let topic;
  if (resolveAppMode() !== "gated") {
    topic = localCouncilTopic(slug);
    if (!topic) {
      notFound();
    }
  } else {
    const { db, principal, organizationId } = await loadMemberCommonsContext(
      session.accountId,
    );
    if (!organizationId || !db) {
      notFound();
    }
    const result = await getCouncilTopic(db, {
      principal,
      organizationId,
      slugOrPublicId: slug,
    });
    if (!result.ok) {
      notFound();
    }
    topic = result.value;
  }

  return (
    <MainContainer className="space-y-8">
      <Breadcrumbs
        items={[
          { href: "/", label: "Home" },
          { href: "/council", label: "Council" },
          { label: topic.title },
        ]}
      />
      <PageHeader
        eyebrow="Council"
        title={topic.title}
        description={topic.question ?? topic.stateLabel}
      />
      {topic.synthetic ? (
        <DisclosureNotice title="Synthetic seed" tone="caution">
          This Council record is a labeled synthetic fixture. It is not a
          production cadence or quorum (V2-10). A decline of a Chamber-accepted
          verdict and an accept of a Chamber-disputed verdict require reasons.
        </DisclosureNotice>
      ) : null}
      <dl className="grid gap-3 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-muted-foreground">State</dt>
          <dd className="font-medium">{topic.state}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Public Agenda</dt>
          <dd className="font-medium">
            {topic.publicAgenda ? "Remains on Public Agenda" : "Left Public Agenda"}
          </dd>
        </div>
      </dl>
      {topic.intakeReason ? (
        <p className="max-w-prose text-sm leading-6">
          Intake reason: {topic.intakeReason}
        </p>
      ) : null}
      {topic.overview ? (
        <p className="max-w-prose text-base leading-7">{topic.overview}</p>
      ) : null}

      {topic.session ? (
        <section className="space-y-3" aria-labelledby="council-schedule-heading">
          <h2 id="council-schedule-heading" className="font-heading text-xl tracking-tight">
            Schedule
          </h2>
          <p className="text-sm">
            Opens <PublicTime dateTime={topic.session.scheduledOpensAt} /> · Closes{" "}
            <PublicTime dateTime={topic.session.scheduledClosesAt} /> · Timezone{" "}
            {topic.session.timezone}
          </p>
        </section>
      ) : null}

      <section className="space-y-3" aria-labelledby="council-roster-heading">
        <h2 id="council-roster-heading" className="font-heading text-xl tracking-tight">
          Roster
        </h2>
        <RosterTable
          caption="Council seats for this organization. Clerks run process; members hold voting seats."
          seats={topic.roster}
        />
      </section>

      {topic.recommendation ? (
        <section className="space-y-3" aria-labelledby="council-rec-heading">
          <h2 id="council-rec-heading" className="font-heading text-xl tracking-tight">
            Recommendation version {topic.recommendation.version}
          </h2>
          <p className="text-sm">
            Published <PublicTime dateTime={topic.recommendation.publishedAt} />.
            Not enacted law.
          </p>
          <p className="max-w-prose text-base leading-7">
            {topic.recommendation.rationale}
          </p>
          {topic.recommendation.minorityReasoning ? (
            <p className="max-w-prose text-sm leading-6 text-muted-foreground">
              Minority reasoning: {topic.recommendation.minorityReasoning}
            </p>
          ) : null}
        </section>
      ) : null}

      <section className="space-y-3" aria-labelledby="council-roll-call-heading">
        <h2 id="council-roll-call-heading" className="font-heading text-xl tracking-tight">
          Roll call
        </h2>
        <RollCallTable
          caption={`Council roll call for ${topic.title}.`}
          rows={topic.rollCall}
          timezone={topic.session?.timezone ?? "America/Chicago"}
        />
      </section>

      <p className="text-sm">
        <Link className="underline" href="/council">
          Back to Council
        </Link>
        {" · "}
        <Link className="underline" href={`/chamber/topics/${topic.slug}`}>
          Chamber page
        </Link>
      </p>
    </MainContainer>
  );
}
