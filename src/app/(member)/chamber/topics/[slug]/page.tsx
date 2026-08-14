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
import { getChamberTopic } from "@/lib/bodies/service";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  return {
    title: "Chamber topic",
    description: `Commonhall Chamber topic ${slug}`,
  };
}

export default async function ChamberTopicPage({ params }: PageProps) {
  const { slug } = await params;
  const session = await requireMemberSession();
  const { db, principal, organizationId } = await loadMemberCommonsContext(
    session.accountId,
  );
  if (!organizationId) {
    notFound();
  }
  const result = await getChamberTopic(db, {
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
          { href: "/chamber", label: "Chamber" },
          { label: topic.title },
        ]}
      />
      <PageHeader
        eyebrow="Chamber"
        title={topic.title}
        description={topic.question ?? topic.stateLabel}
      />
      {topic.synthetic ? (
        <DisclosureNotice title="Synthetic seed" tone="caution">
          This Chamber record is a labeled synthetic fixture. It is not a
          production appointment policy (V2-09). Positions are explicit:
          yes, no, abstain, recused, or absent.
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
      {topic.overview ? (
        <p className="max-w-prose text-base leading-7">{topic.overview}</p>
      ) : null}

      {topic.session ? (
        <section className="space-y-3" aria-labelledby="chamber-schedule-heading">
          <h2 id="chamber-schedule-heading" className="font-heading text-xl tracking-tight">
            Schedule
          </h2>
          <p className="text-sm">
            Opens <PublicTime dateTime={topic.session.scheduledOpensAt} /> · Closes{" "}
            <PublicTime dateTime={topic.session.scheduledClosesAt} /> · Timezone{" "}
            {topic.session.timezone}
          </p>
        </section>
      ) : null}

      <section className="space-y-3" aria-labelledby="chamber-roster-heading">
        <h2 id="chamber-roster-heading" className="font-heading text-xl tracking-tight">
          Roster
        </h2>
        <RosterTable
          caption="Chamber seats for this organization. Clerks run process; members hold voting seats."
          seats={topic.roster}
        />
      </section>

      {topic.conflicts.length > 0 ? (
        <section className="space-y-3" aria-labelledby="chamber-conflicts-heading">
          <h2 id="chamber-conflicts-heading" className="font-heading text-xl tracking-tight">
            Conflicts and recusals
          </h2>
          <ul className="space-y-2 text-sm">
            {topic.conflicts.map((item) => (
              <li key={`${item.memberPublicId}-${item.kind}`}>
                {item.kind}: {item.reason}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {topic.verdict ? (
        <section className="space-y-3" aria-labelledby="chamber-verdict-heading">
          <h2 id="chamber-verdict-heading" className="font-heading text-xl tracking-tight">
            Verdict version {topic.verdict.version}
          </h2>
          <p className="text-sm">
            Outcome: {topic.verdict.outcome}. Published{" "}
            <PublicTime dateTime={topic.verdict.publishedAt} />.
          </p>
          <p className="max-w-prose text-base leading-7">{topic.verdict.rationale}</p>
          {topic.verdict.minorityReasoning ? (
            <p className="max-w-prose text-sm leading-6 text-muted-foreground">
              Minority reasoning: {topic.verdict.minorityReasoning}
            </p>
          ) : null}
        </section>
      ) : null}

      <section className="space-y-3" aria-labelledby="chamber-roll-call-heading">
        <h2 id="chamber-roll-call-heading" className="font-heading text-xl tracking-tight">
          Roll call
        </h2>
        <RollCallTable
          caption={`Chamber roll call for ${topic.title}.`}
          rows={topic.rollCall}
          timezone={topic.session?.timezone ?? "America/Chicago"}
        />
      </section>

      <p className="text-sm">
        <Link className="underline" href="/chamber">
          Back to Chamber
        </Link>
        {" · "}
        <Link className="underline" href={`/agenda/topics/${topic.slug}`}>
          Agenda page
        </Link>
      </p>
    </MainContainer>
  );
}
