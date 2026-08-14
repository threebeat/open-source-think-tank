import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";

import { HostedPolisUnavailable } from "@/components/agenda/HostedPolisUnavailable";
import { StatementPositionForm } from "@/components/agenda/StatementPositionForm";
import { TopicTabs } from "@/components/agenda/TopicTabs";
import { DisclosureNotice } from "@/components/DisclosureNotice";
import { PageHeader } from "@/components/PageHeader";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { MainContainer } from "@/components/layout/MainContainer";
import { requireMemberSession } from "@/lib/auth/guard";
import { loadMemberCommonsContext } from "@/lib/commons/member-context";
import { getAgendaTopic } from "@/lib/agenda/service";
import { isAgendaTab, type AgendaTab } from "@/lib/agenda/types";
import { formatPublicDateTime } from "@/lib/format/public-datetime";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ tab?: string }>;
};

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug } = await params;
  return {
    title: "Agenda topic",
    description: `Commonhall Public Agenda topic ${slug}`,
  };
}

export default async function AgendaTopicPage({ params, searchParams }: PageProps) {
  const { slug } = await params;
  const query = await searchParams;
  const tab: AgendaTab = isAgendaTab(query.tab ?? "") ? query.tab as AgendaTab : "overview";
  const session = await requireMemberSession();
  const { db, principal, organizationId } = await loadMemberCommonsContext(
    session.accountId,
  );
  if (!organizationId) {
    notFound();
  }
  const result = await getAgendaTopic(db, {
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
          { href: "/agenda", label: "Agenda" },
          { label: topic.title },
        ]}
      />
      <PageHeader
        eyebrow="Public Agenda"
        title={topic.title}
        description={topic.question ?? topic.stateLabel}
      />
      {topic.synthetic ? (
        <DisclosureNotice title="Synthetic seed" tone="caution">
          This topic is a labeled synthetic fixture. It is not a live
          consultation and does not represent a statutory or nonprofit decision.
        </DisclosureNotice>
      ) : null}
      <dl className="grid gap-3 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-muted-foreground">State</dt>
          <dd className="font-medium">{topic.state}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Realm</dt>
          <dd className="font-medium">{topic.realm}</dd>
        </div>
      </dl>
      <TopicTabs slug={topic.slug} active={tab} />

      {tab === "overview" ? (
        <section className="space-y-6" aria-labelledby="overview-heading">
          <h2 id="overview-heading" className="font-heading text-xl tracking-tight">
            Overview
          </h2>
          {topic.overview ? (
            <p className="max-w-prose text-base leading-7">{topic.overview}</p>
          ) : null}
          <HostedPolisUnavailable />
          <StatementPositionForm
            slug={topic.slug}
            statements={topic.statements}
            canRecord={topic.canRecordPosition}
          />
        </section>
      ) : null}

      {tab === "evidence" ? (
        <section className="space-y-4" aria-labelledby="evidence-heading">
          <h2 id="evidence-heading" className="font-heading text-xl tracking-tight">
            Evidence
          </h2>
          <p className="text-sm text-muted-foreground">
            Evidence is ordered by quality status, then title. Consultation
            popularity does not change evidence quality or order.
          </p>
          {topic.evidence.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No evidence listings for this topic.
            </p>
          ) : (
            <ul className="space-y-4">
              {topic.evidence.map((item) => (
                <li
                  key={`${item.title}-${item.qualityStatus}`}
                  className="rounded-md border border-border p-4"
                >
                  <h3 className="font-medium">{item.title}</h3>
                  {item.summary ? (
                    <p className="mt-2 text-sm leading-6">{item.summary}</p>
                  ) : null}
                  <p className="mt-2 text-sm">
                    <span className="text-muted-foreground">Quality: </span>
                    {item.qualityStatus}
                    {item.labeledSynthetic ? " · Synthetic" : null}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {item.limitations}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}

      {tab === "discussion" ? (
        <section className="space-y-4" aria-labelledby="discussion-heading">
          <h2 id="discussion-heading" className="font-heading text-xl tracking-tight">
            Discussion
          </h2>
          {topic.discussions.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No linked Commons discussions.
            </p>
          ) : (
            <ul className="space-y-3">
              {topic.discussions.map((discussion) => (
                <li key={discussion.publicId}>
                  <Link
                    className="underline underline-offset-2"
                    href={`/commons/discussions/${discussion.publicId}`}
                  >
                    {discussion.title}
                  </Link>
                  <p className="text-sm text-muted-foreground">
                    {discussion.category}
                    {discussion.synthetic ? " · Synthetic seed" : null}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}

      {tab === "history" ? (
        <section className="space-y-4" aria-labelledby="history-heading">
          <h2 id="history-heading" className="font-heading text-xl tracking-tight">
            History
          </h2>
          {topic.history.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No governance events are listed.
            </p>
          ) : (
            <ol className="space-y-3">
              {topic.history.map((event) => (
                <li
                  key={`${event.at}-${event.action}`}
                  className="rounded-md border border-border p-4 text-sm"
                >
                  <p className="font-medium">
                    {event.action}: {event.fromState} → {event.toState}
                  </p>
                  <p className="mt-1 text-muted-foreground">
                    {formatPublicDateTime(event.at)} · {event.actorPrincipalKind}
                    {event.synthetic ? " · Synthetic" : null}
                  </p>
                </li>
              ))}
            </ol>
          )}
        </section>
      ) : null}

      <p className="text-sm">
        <Link className="underline" href="/agenda">
          Back to Agenda
        </Link>
      </p>
    </MainContainer>
  );
}
