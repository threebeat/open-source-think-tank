import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

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

type Props = {
  params: Promise<{ id: string }>;
};

export async function generateStaticParams() {
  return ideaCommonsPosts.map((post) => ({ id: post.id }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const post = ideaCommonsPosts.find((item) => item.id === id);
  return {
    title: post ? post.title : "Idea Commons",
    description: "Informal Idea Commons contribution — not a formal topic.",
  };
}

export default async function IdeaCommonsDetailPage({ params }: Props) {
  const { id } = await params;
  const post = ideaCommonsPosts.find((item) => item.id === id);
  if (!post) {
    notFound();
  }
  const children = ideaCommonsPosts.filter((item) => item.parentId === post.id);
  const trajectory = journeyTrajectories.find(
    (item) => item.id === post.trajectoryId,
  );

  return (
    <MainContainer className="space-y-10">
      <Breadcrumbs
        items={[
          { href: "/", label: "Home" },
          { href: "/idea-commons", label: "Idea Commons" },
          { label: post.title },
        ]}
      />
      <PageHeader
        eyebrow="Idea Commons · informal"
        title={post.title}
        description={post.body}
      />
      <DisclosureNotice title="Not in the Formal Topic Pipeline" tone="caution">
        {journeyInformalNotice}
      </DisclosureNotice>
      <dl className="grid gap-3 text-sm sm:grid-cols-2">
        <div>
          <dt className="font-medium">Author attribution</dt>
          <dd className="text-muted-foreground">
            {post.authorLabel} — {post.authorRoleNote}
          </dd>
        </div>
        <div>
          <dt className="font-medium">Kind</dt>
          <dd className="text-muted-foreground">{post.kind}</dd>
        </div>
        {post.citedSourceTitle ? (
          <div className="sm:col-span-2">
            <dt className="font-medium">Cited source</dt>
            <dd className="text-muted-foreground">{post.citedSourceTitle}</dd>
          </div>
        ) : null}
        {trajectory ? (
          <div className="sm:col-span-2">
            <dt className="font-medium">Trajectory</dt>
            <dd className="text-muted-foreground">
              {trajectory.title}: {trajectory.summary}
            </dd>
          </div>
        ) : null}
      </dl>

      {children.length > 0 ? (
        <section className="space-y-3" aria-labelledby="idea-history-heading">
          <h2
            id="idea-history-heading"
            className="font-heading text-xl text-foreground"
          >
            Visible history (replies, conversions, merge/defer notes)
          </h2>
          <ul className="space-y-3">
            {children.map((child) => (
              <li
                key={child.id}
                className="rounded-md border border-border px-4 py-3 text-sm"
              >
                <p className="text-xs font-medium tracking-wide text-primary uppercase">
                  {child.kind} · informal
                </p>
                <p className="mt-1 font-medium text-foreground">{child.title}</p>
                <p className="mt-1 text-muted-foreground">{child.body}</p>
                <p className="mt-2 text-xs text-muted-foreground">
                  {child.authorLabel} · {child.authorRoleNote}
                </p>
                {child.id === "idea-moderator-ordinary-proposal" ? (
                  <p className="mt-2 text-xs font-medium text-foreground">
                    No elevated badge, ranking advantage, or privileged promotion
                    path.
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <IdeaCommonsPractice
        parentId={post.id}
        heading="Reply or convert this contribution into a proposal"
      />

      {trajectory?.formalTopicSlug ? (
        <p className="text-sm text-muted-foreground">
          Related Formal Topic Pipeline entry:{" "}
          <Link
            href={`/formal-topics/${trajectory.formalTopicSlug}`}
            className="font-medium text-primary underline-offset-4 hover:underline"
          >
            {trajectory.formalTopicSlug}
          </Link>
        </p>
      ) : null}
    </MainContainer>
  );
}
