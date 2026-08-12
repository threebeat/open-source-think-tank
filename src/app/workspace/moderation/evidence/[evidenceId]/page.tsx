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

type PageProps = { params: Promise<{ evidenceId: string }> };

export default async function EvidenceModerationDetailPage({
  params,
}: PageProps) {
  if (resolveAppMode() !== "gated") {
    notFound();
  }

  const { evidenceId } = await params;
  const { requireGatedSession } = await import("@/lib/auth/guard");
  const gated = await requireGatedSession();
  if (!gated.ok) {
    if (gated.status === 401) redirect("/auth/sign-in");
    notFound();
  }

  const { getGatedDb } = await import("@/lib/auth/runtime");
  const { getEvidenceModerationDetail } = await import(
    "@/lib/moderation/queues"
  );
  const db = getGatedDb();
  const detail = await getEvidenceModerationDetail(db, {
    actorAccountId: gated.session.accountId,
    evidenceSubmissionId: evidenceId,
  });
  if (!detail.ok) {
    if (detail.code.startsWith("AUTHZ")) redirect("/");
    notFound();
  }

  const { evidence, topic, history, conflictDisclosure, canSeePrivateDetail } =
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
          { label: evidence.title },
        ]}
      />
      <PageHeader
        eyebrow="Evidence moderation"
        title={evidence.title}
        description={`${topic.title} · ${evidence.moderationVisibility} · submitter ${evidence.submitterDisplayLabel}`}
      />
      <DisclosureNotice title="Do not fetch source URLs" tone="caution">
        Source URLs are stored for reference only. Visibility actions do not
        delete evidence, change quality labels, or certify claim truth.
      </DisclosureNotice>

      <dl className="grid gap-4 text-sm sm:grid-cols-2">
        <div>
          <dt className="font-medium">Organization</dt>
          <dd>{evidence.organization}</dd>
        </div>
        <div>
          <dt className="font-medium">Source URL (stored, not fetched)</dt>
          <dd className="break-all font-mono text-xs">{evidence.sourceUrl}</dd>
        </div>
        <div>
          <dt className="font-medium">Workflow</dt>
          <dd>{evidence.workflowState.replaceAll("_", " ")}</dd>
        </div>
        <div>
          <dt className="font-medium">Quality</dt>
          <dd>
            {evidence.qualityStatus
              ? evidence.qualityStatus.replaceAll("_", " ")
              : "—"}
          </dd>
        </div>
        <div>
          <dt className="font-medium">Current visibility</dt>
          <dd>{evidence.moderationVisibility}</dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="font-medium">Limitations</dt>
          <dd className="whitespace-pre-wrap">{evidence.limitations}</dd>
        </div>
      </dl>

      {conflictDisclosure ? (
        <ConflictDisclosureCard
          publicSummary={conflictDisclosure.publicSummary}
          privateDetail={privateDetail}
          title="Conflict disclosure on this evidence"
        />
      ) : (
        <p className="text-sm text-muted-foreground">
          No conflict disclosure recorded for this evidence.
        </p>
      )}

      <section className="space-y-3" aria-labelledby="moderation-action-heading">
        <h2 id="moderation-action-heading" className="font-heading text-xl">
          Record visibility action
        </h2>
        <ModerationActionForm
          subjectType="evidence"
          subjectId={evidence.subjectId}
          currentVisibility={evidence.moderationVisibility}
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
