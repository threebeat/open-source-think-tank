import type { Metadata } from "next";
import Link from "next/link";

import { DisclosureNotice } from "@/components/DisclosureNotice";
import { PageHeader } from "@/components/PageHeader";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { MainContainer } from "@/components/layout/MainContainer";
import { IdeaCommonsPractice } from "@/features/idea-commons/IdeaCommonsPractice";
import {
  ideaCommonsPosts,
  journeyInformalNotice,
  journeyTrajectories,
} from "@/fixtures/journey-catalog";

export const metadata: Metadata = {
  title: "Idea Commons",
  description:
    "Informal synthetic discussion and unqualified proposals — not the Formal Topic Pipeline.",
};

export default function IdeaCommonsPage() {
  const roots = ideaCommonsPosts.filter((post) => post.parentId === null);

  return (
    <MainContainer className="space-y-10">
      <Breadcrumbs
        items={[{ href: "/", label: "Home" }, { label: "Idea Commons" }]}
      />
      <PageHeader
        eyebrow="Informal community area"
        title="Idea Commons"
        description="General discussion, questions, early ideas, and unqualified proposals. This is not the Formal Topic Pipeline."
      />
      <DisclosureNotice title="Informal — not yet formal" tone="caution">
        {journeyInformalNotice} Fixed synthetic fixtures may depict multiple example
        participants to explain a multi-user process — they are not live users.
      </DisclosureNotice>

      <section className="space-y-4" aria-labelledby="idea-threads-heading">
        <h2
          id="idea-threads-heading"
          className="font-heading text-2xl text-foreground"
        >
          Synthetic discussions and proposals
        </h2>
        <ul className="space-y-4">
          {roots.map((post) => {
            const trajectory = journeyTrajectories.find(
              (item) => item.id === post.trajectoryId,
            );
            return (
              <li
                key={post.id}
                className="space-y-2 rounded-md border border-border px-4 py-4"
              >
                <p className="text-xs font-medium tracking-wide text-primary uppercase">
                  Idea Commons · {post.kind} · informal
                </p>
                <h3 className="font-heading text-xl text-foreground">
                  <Link
                    href={`/idea-commons/${post.id}`}
                    className="underline-offset-4 hover:underline"
                  >
                    {post.title}
                  </Link>
                </h3>
                <p className="text-sm text-muted-foreground">{post.body}</p>
                <p className="text-xs text-muted-foreground">
                  {post.authorLabel} · {post.authorRoleNote}
                </p>
                {trajectory ? (
                  <p className="text-xs text-muted-foreground">
                    Trajectory: {trajectory.title}
                  </p>
                ) : null}
              </li>
            );
          })}
        </ul>
      </section>

      <IdeaCommonsPractice />

      <p className="text-sm text-muted-foreground">
        Looking for gate-passed institutional topics?{" "}
        <Link
          href="/formal-topics"
          className="font-medium text-primary underline-offset-4 hover:underline"
        >
          Open the Formal Topic Pipeline
        </Link>
        .
      </p>
    </MainContainer>
  );
}
