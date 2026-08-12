import { notFound, redirect } from "next/navigation";

import { DisclosureNotice } from "@/components/DisclosureNotice";
import { PageHeader } from "@/components/PageHeader";
import { ConflictDisclosureCard } from "@/components/topics/ConflictDisclosureCard";
import { RevisionHistoryPanel } from "@/components/topics/RevisionHistoryPanel";
import { EvidenceReviewForms } from "@/components/workspace/EvidenceReviewForms";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { MainContainer } from "@/components/layout/MainContainer";
import { resolveAppMode } from "@/lib/env/app-mode";

export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ evidenceId: string }> };

export default async function EvidenceReviewDetailPage({ params }: PageProps) {
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
  const { getEvidenceReviewDetail } = await import("@/lib/review/queues");
  const db = getGatedDb();
  const detail = await getEvidenceReviewDetail(db, {
    actorAccountId: gated.session.accountId,
    evidenceSubmissionId: evidenceId,
  });
  if (!detail.ok) {
    if (detail.code.startsWith("AUTHZ")) redirect("/");
    notFound();
  }

  const { getStaffEvidenceRevisionHistory } =
    await import("@/lib/revisions/history");
  const evidenceHistory = await getStaffEvidenceRevisionHistory(db, {
    actorAccountId: gated.session.accountId,
    evidenceSubmissionId: evidenceId,
  });

  const { getConflictDisclosureForEvidence } =
    await import("@/lib/conflicts/repository");
  const { toOwnerOrReviewerConflictDisclosure } =
    await import("@/lib/conflicts/audiences");
  const disclosureRow = await getConflictDisclosureForEvidence(db, evidenceId);
  const ownerDisclosure =
    disclosureRow.ok && disclosureRow.value
      ? toOwnerOrReviewerConflictDisclosure(disclosureRow.value)
      : null;

  const { evidence, topic, linkedClaims, reviews } = detail.value;
  const latestReviewAt = reviews.at(-1)?.decidedAt ?? null;
  const evidenceLatestRevisionAt = evidenceHistory.ok
    ? evidenceHistory.value.latestRevisionAt
    : null;
  const reviewPredates =
    Boolean(latestReviewAt) &&
    Boolean(evidenceLatestRevisionAt) &&
    new Date(latestReviewAt!).getTime() <
      new Date(evidenceLatestRevisionAt!).getTime();

  return (
    <MainContainer className="space-y-8">
      <Breadcrumbs
        items={[
          { href: "/", label: "Home" },
          { href: "/workspace/review", label: "Review queues" },
          { label: evidence.title },
        ]}
      />
      <PageHeader
        eyebrow="Evidence review"
        title={evidence.title}
        description={`${topic.title} · submitter ${evidence.submitterDisplayLabel}`}
      />
      <DisclosureNotice title="Quality ≠ truth" tone="caution">
        Evidence quality is independent of workflow acceptance, popularity, and
        later consultation agreement. A quality label does not establish whether
        a claim is true. Source URLs are never fetched by this application.
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
          <dd>{evidence.qualityStatus.replaceAll("_", " ")}</dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="font-medium">Limitations</dt>
          <dd className="whitespace-pre-wrap">{evidence.limitations}</dd>
        </div>
      </dl>

      {ownerDisclosure ? (
        <ConflictDisclosureCard
          publicSummary={ownerDisclosure.publicSummary}
          privateDetail={ownerDisclosure.privateDetail}
          title="Conflict disclosure (public + private)"
        />
      ) : (
        <p className="text-sm text-muted-foreground">
          No conflict disclosure recorded for this evidence.
        </p>
      )}

      <section className="space-y-2" aria-labelledby="linked-claims-heading">
        <h2 id="linked-claims-heading" className="font-heading text-xl">
          Linked claims
        </h2>
        <p className="text-sm text-muted-foreground">
          One evidence source may support or counter several claims. Evidence
          content history appears once below — not once per link.
        </p>
        <ul className="space-y-1 text-sm">
          {linkedClaims.map((claim) => (
            <li key={claim.claimId}>
              {claim.title} (
              {claim.relationship === "supporting"
                ? "Supporting evidence"
                : "Counterevidence"}
              )
            </li>
          ))}
        </ul>
      </section>

      <RevisionHistoryPanel
        title="Evidence content revisions"
        history={evidenceHistory.ok ? evidenceHistory.value : null}
        reviewPredatesLatestRevision={reviewPredates}
        latestReviewAt={latestReviewAt}
      />

      <section className="space-y-3" aria-labelledby="prior-evidence-reviews">
        <h2 id="prior-evidence-reviews" className="font-heading text-xl">
          Prior review decisions
        </h2>
        {reviews.length === 0 ? (
          <p className="text-sm text-muted-foreground">No reviews yet.</p>
        ) : (
          <ol className="space-y-3">
            {reviews.map((review) => (
              <li
                key={review.id}
                className="rounded-md border border-border bg-surface px-4 py-3 text-sm"
              >
                <p className="font-medium">
                  {review.decision.replaceAll("_", " ")}
                  {review.qualityStatus
                    ? ` · quality ${review.qualityStatus}`
                    : ""}
                  {review.workflowDecision
                    ? ` · workflow ${review.workflowDecision}`
                    : ""}{" "}
                  · {new Date(review.decidedAt).toLocaleString()}
                </p>
                <p className="mt-1 text-muted-foreground">
                  Public: {review.publicRationale}
                </p>
                {review.privateNotes ? (
                  <p className="mt-1 text-muted-foreground">
                    Private: {review.privateNotes}
                  </p>
                ) : null}
              </li>
            ))}
          </ol>
        )}
      </section>

      <EvidenceReviewForms
        evidenceSubmissionId={evidence.evidenceSubmissionId}
        expectedWorkflowState={evidence.workflowState}
        expectedQualityStatus={evidence.qualityStatus}
        canWorkflowReview={evidence.workflowState === "submitted"}
      />
    </MainContainer>
  );
}
