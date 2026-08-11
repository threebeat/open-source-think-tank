import { notFound, redirect } from "next/navigation";

import { DisclosureNotice } from "@/components/DisclosureNotice";
import { PageHeader } from "@/components/PageHeader";
import { TopicEditForm } from "@/components/workspace/TopicEditForm";
import { TopicTransitionControls } from "@/components/workspace/TopicTransitionControls";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { MainContainer } from "@/components/layout/MainContainer";
import { resolveAppMode } from "@/lib/env/app-mode";
import {
  publicationStatusHelp,
  publicationStatusLabel,
  workflowStateLabel,
} from "@/lib/topics/labels";

export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: PageProps) {
  const { slug } = await params;
  return {
    title: `Topic ${slug}`,
    description: "Gated topic authoring detail.",
  };
}

export default async function WorkspaceTopicDetailPage({ params }: PageProps) {
  if (resolveAppMode() !== "gated") {
    notFound();
  }

  const { slug } = await params;
  const { requireGatedSession } = await import("@/lib/auth/guard");
  const gated = await requireGatedSession();
  if (!gated.ok) {
    if (gated.status === 401) redirect("/auth/sign-in");
    notFound();
  }

  const { getGatedDb } = await import("@/lib/auth/runtime");
  const { authorizeCapability } = await import(
    "@/lib/authz/authorize-capability"
  );
  const { loadPrincipal } = await import("@/lib/authz/load-principal");
  const db = getGatedDb();
  const principal = await loadPrincipal(db, gated.session.accountId);
  const decision = await authorizeCapability(db, principal, "topics.create");
  if (!decision.ok) {
    redirect("/");
  }

  const { getTopicBySlug } = await import("@/lib/topics/repository");
  const topicResult = await getTopicBySlug(db, slug);
  if (!topicResult.ok || !topicResult.value) {
    notFound();
  }
  const topic = topicResult.value;

  return (
    <MainContainer className="space-y-8">
      <Breadcrumbs
        items={[
          { href: "/", label: "Home" },
          { href: "/workspace/topics", label: "Topics" },
          { label: topic.title },
        ]}
      />
      <PageHeader
        eyebrow="Administrator workspace"
        title={topic.title}
        description="Operational workflow and publication status are separate. This record is not enacted policy, law, or board adoption."
      />
      <DisclosureNotice title="Publication is read-only in 3.4" tone="caution">
        Gated publication lands in Package 3.6. There is no Publish button here.
        Pause and archive never change publication status.
      </DisclosureNotice>

      <dl className="grid gap-4 text-sm sm:grid-cols-2">
        <div>
          <dt className="font-medium">Slug</dt>
          <dd className="font-mono text-xs text-muted-foreground">{topic.slug}</dd>
        </div>
        <div>
          <dt className="font-medium">Operational workflow</dt>
          <dd>{workflowStateLabel(topic.workflowState)}</dd>
        </div>
        <div>
          <dt className="font-medium">Publication status</dt>
          <dd>
            <span className="block">
              {publicationStatusLabel(topic.publicationStatus)}
            </span>
            <span className="block text-xs text-muted-foreground">
              {publicationStatusHelp(topic.publicationStatus)}
            </span>
          </dd>
        </div>
        <div>
          <dt className="font-medium">Synthetic classification</dt>
          <dd>{topic.synthetic ? "synthetic" : "operational"}</dd>
        </div>
      </dl>

      <section className="space-y-3" aria-labelledby="topic-metadata-heading">
        <h2
          id="topic-metadata-heading"
          className="font-heading text-xl text-foreground"
        >
          Metadata
        </h2>
        <TopicEditForm
          topicId={topic.id}
          initialTitle={topic.title}
          initialQuestion={topic.question}
          initialBackground={topic.background}
          initialScope={topic.scope}
          expectedUpdatedAt={topic.updatedAt.toISOString()}
          editable={topic.workflowState === "draft"}
        />
      </section>

      <section className="space-y-3" aria-labelledby="topic-transition-heading">
        <h2
          id="topic-transition-heading"
          className="font-heading text-xl text-foreground"
        >
          Workflow transitions
        </h2>
        <TopicTransitionControls
          topicId={topic.id}
          workflowState={topic.workflowState}
        />
      </section>
    </MainContainer>
  );
}
