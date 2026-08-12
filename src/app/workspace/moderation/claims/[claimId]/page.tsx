import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { DisclosureNotice } from "@/components/DisclosureNotice";
import { PageHeader } from "@/components/PageHeader";
import { ConflictDisclosureCard } from "@/components/topics/ConflictDisclosureCard";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { MainContainer } from "@/components/layout/MainContainer";
import { ModerationActionForm } from "@/components/workspace/ModerationActionForm";
import { ModerationHistoryTimeline } from "@/components/workspace/ModerationHistoryTimeline";
import { resolveAppMode } from "@/lib/env/app-mode";

export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ claimId: string }> };

export default async function ClaimModerationDetailPage({ params }: PageProps) {
  if (resolveAppMode() !== "gated") {
    notFound();
  }

  const { claimId } = await params;
  const { requireGatedSession } = await import("@/lib/auth/guard");
  const gated = await requireGatedSession();
  if (!gated.ok) {
    if (gated.status === 401) redirect("/auth/sign-in");
    notFound();
  }

  const { getGatedDb } = await import("@/lib/auth/runtime");
  const { getClaimModerationDetail } = await import(
    "@/lib/moderation/queues"
  );
  const db = getGatedDb();
  const detail = await getClaimModerationDetail(db, {
    actorAccountId: gated.session.accountId,
    claimId,
  });
  if (!detail.ok) {
    if (detail.code.startsWith("AUTHZ")) redirect("/");
    notFound();
  }

  const { claim, topic, history, conflictDisclosure, canSeePrivateDetail } =
    detail.value;
  const privateDetail =
    canSeePrivateDetail &&
    conflictDisclosure &&
    "privateDetail" in conflictDisclosure
      ? conflictDisclosure.privateDetail
      : null;

  return (
    <MainContainer className="space-y-8">
      <Breadcrumbs
        items={[
          { href: "/", label: "Home" },
          { href: "/workspace/moderation", label: "Moderation" },
          { label: claim.title },
        ]}
      />
      <PageHeader
        eyebrow="Claim moderation"
        title={claim.title}
        description={`${topic.title} · ${claim.moderationVisibility} · submitter ${claim.submitterDisplayLabel}`}
      />
      <DisclosureNotice title="Visibility actions retain history" tone="caution">
        Hold and hide withhold this claim from public projection without
        deleting content or changing workflow acceptance. Restore returns it to
        visible and is not approval or truth certification.
      </DisclosureNotice>

      <dl className="grid gap-4 text-sm sm:grid-cols-2">
        <div>
          <dt className="font-medium">Topic</dt>
          <dd>{topic.title}</dd>
        </div>
        <div>
          <dt className="font-medium">Workflow</dt>
          <dd>{claim.workflowState.replaceAll("_", " ")}</dd>
        </div>
        <div>
          <dt className="font-medium">Current visibility</dt>
          <dd>{claim.moderationVisibility}</dd>
        </div>
        <div>
          <dt className="font-medium">Topic publication</dt>
          <dd>{topic.publicationStatus}</dd>
        </div>
      </dl>

      {conflictDisclosure ? (
        <ConflictDisclosureCard
          publicSummary={conflictDisclosure.publicSummary}
          privateDetail={privateDetail}
          title="Conflict disclosure on this claim"
        />
      ) : (
        <p className="text-sm text-muted-foreground">
          No conflict disclosure recorded for this claim.
        </p>
      )}

      <section className="space-y-3" aria-labelledby="moderation-action-heading">
        <h2 id="moderation-action-heading" className="font-heading text-xl">
          Record visibility action
        </h2>
        <ModerationActionForm
          subjectType="claim"
          subjectId={claim.subjectId}
          currentVisibility={claim.moderationVisibility}
          expectedUpdatedAt={detail.value.expectedUpdatedAt}
        />
      </section>

      <ModerationHistoryTimeline history={history} />

      <p className="text-sm">
        <Link
          href="/workspace/moderation"
          className="text-primary underline underline-offset-2"
        >
          Back to moderation queue
        </Link>
      </p>
    </MainContainer>
  );
}
