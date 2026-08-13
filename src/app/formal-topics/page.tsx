import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";

import { DisclosureNotice } from "@/components/DisclosureNotice";
import { PageHeader } from "@/components/PageHeader";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { MainContainer } from "@/components/layout/MainContainer";
import { TopicsExplorer } from "@/features/topics/TopicsExplorer";
import { listTopics } from "@/domain/selectors";
import { fixtureCatalog } from "@/fixtures";
import {
  formalTopicGateViews,
  journeyTrajectories,
} from "@/fixtures/journey-catalog";
import { resolveAppMode } from "@/lib/env/app-mode";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  if (resolveAppMode() === "gated") {
    return {
      title: "Published topics",
      description:
        "Allowlisted published formal topics from the gated alpha projection.",
    };
  }
  return {
    title: "Formal Topic Pipeline",
    description:
      "Topics that passed published gates — distinct from informal Idea Commons discussion.",
  };
}

export default async function FormalTopicsPage() {
  if (resolveAppMode() === "gated") {
    await connection();
    const { default: GatedPublishedTopicsPage } = await import(
      "@/app/topics/gated-published-topics"
    );
    return <GatedPublishedTopicsPage />;
  }

  return (
    <MainContainer className="space-y-10">
      <Breadcrumbs
        items={[
          { href: "/", label: "Home" },
          { label: "Formal Topic Pipeline" },
        ]}
      />
      <PageHeader
        eyebrow="Gate-passed institutional topics"
        title="Formal Topic Pipeline"
        description="Contains only topics that passed published criteria. Informal discussion belongs in Idea Commons."
      />
      <DisclosureNotice title="No preference-based promotion" tone="caution">
        No moderator, administrator, board member, or individual participant may
        directly promote a pre-deliberation topic based on preference. Agenda
        formation uses published metrics and human review with recorded reasons.
      </DisclosureNotice>

      <section className="space-y-4" aria-labelledby="trajectories-heading">
        <h2
          id="trajectories-heading"
          className="font-heading text-2xl text-foreground"
        >
          Three synthetic trajectories
        </h2>
        <ul className="space-y-4">
          {journeyTrajectories.map((trajectory) => (
            <li
              key={trajectory.id}
              className="rounded-md border border-border px-4 py-4"
            >
              <p className="text-xs font-medium tracking-wide text-primary uppercase">
                {trajectory.outcome}
              </p>
              <h3 className="mt-1 font-heading text-xl text-foreground">
                {trajectory.title}
              </h3>
              <p className="mt-2 text-sm text-muted-foreground">
                {trajectory.summary}
              </p>
              <div className="mt-3 flex flex-wrap gap-4 text-sm">
                <Link
                  href={`/idea-commons/${trajectory.ideaCommonsRootId}`}
                  className="font-medium text-primary underline-offset-4 hover:underline"
                >
                  Idea Commons origin
                </Link>
                {trajectory.formalTopicSlug ? (
                  <Link
                    href={`/formal-topics/${trajectory.formalTopicSlug}`}
                    className="font-medium text-primary underline-offset-4 hover:underline"
                  >
                    Formal topic
                  </Link>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-4" aria-labelledby="formal-list-heading">
        <h2
          id="formal-list-heading"
          className="font-heading text-2xl text-foreground"
        >
          Gate-passed topics
        </h2>
        <ul className="space-y-3">
          {formalTopicGateViews.map((gate) => (
            <li key={gate.topicSlug}>
              <Link
                href={`/formal-topics/${gate.topicSlug}`}
                className="font-medium text-primary underline-offset-4 hover:underline"
              >
                {/* Prefer human titles via gate slug map; titles load on detail. */}
                {gate.topicSlug === "cedar-river-drought-surcharge"
                  ? "Cedar River residential drought surcharge"
                  : gate.topicSlug === "cedar-river-billing-ops-gap"
                    ? "Cedar River billing-operations readiness (deferred)"
                    : gate.topicSlug}
              </Link>
              <p className="text-sm text-muted-foreground">
                Stage: {gate.currentStage} · {gate.originSummary}
              </p>
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-4" aria-labelledby="browse-briefs-heading">
        <h2
          id="browse-briefs-heading"
          className="font-heading text-2xl text-foreground"
        >
          Browse synthetic topic briefs
        </h2>
        <p className="text-sm text-muted-foreground">
          Secondary fixture browser for demonstration topics. Canonical detail
          pages open on Overview with Evidence and Discussions &amp; Proposals
          controls.
        </p>
        <TopicsExplorer topics={listTopics(fixtureCatalog)} />
      </section>

      <p className="text-sm text-muted-foreground">
        Still exploring early ideas?{" "}
        <Link
          href="/idea-commons"
          className="font-medium text-primary underline-offset-4 hover:underline"
        >
          Return to Idea Commons
        </Link>
        .
      </p>
    </MainContainer>
  );
}
