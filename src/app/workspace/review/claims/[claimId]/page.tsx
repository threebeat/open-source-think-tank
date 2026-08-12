import { notFound, redirect } from "next/navigation";

import { DisclosureNotice } from "@/components/DisclosureNotice";
import { PageHeader } from "@/components/PageHeader";
import { ConflictDisclosureCard } from "@/components/topics/ConflictDisclosureCard";
import {
  EvidenceComparison,
  type ComparableEvidenceItem,
} from "@/components/topics/EvidenceComparison";
import { RevisionHistoryPanel } from "@/components/topics/RevisionHistoryPanel";
import { ClaimReviewForm } from "@/components/workspace/ClaimReviewForm";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { MainContainer } from "@/components/layout/MainContainer";
import { resolveAppMode } from "@/lib/env/app-mode";
import { groupEvidenceByRelationship } from "@/lib/topics/evidence-groups";

export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ claimId: string }> };

export default async function ClaimReviewDetailPage({ params }: PageProps) {
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
  const { getClaimReviewDetail } = await import("@/lib/review/queues");
  const db = getGatedDb();
  const detail = await getClaimReviewDetail(db, {
    actorAccountId: gated.session.accountId,
    claimId,
  });
  if (!detail.ok) {
    if (detail.code.startsWith("AUTHZ")) redirect("/");
    notFound();
  }

  const { getStaffClaimRevisionHistory } =
    await import("@/lib/revisions/history");
  const claimHistory = await getStaffClaimRevisionHistory(db, {
    actorAccountId: gated.session.accountId,
    claimId,
  });

  const { getConflictDisclosureForClaim } =
    await import("@/lib/conflicts/repository");
  const { toOwnerOrReviewerConflictDisclosure } =
    await import("@/lib/conflicts/audiences");
  const disclosureRow = await getConflictDisclosureForClaim(db, claimId);
  const ownerDisclosure =
    disclosureRow.ok && disclosureRow.value
      ? toOwnerOrReviewerConflictDisclosure(disclosureRow.value)
      : null;

  const { claim, topic, links, reviews } = detail.value;
  const canReview = claim.workflowState === "submitted";
  const latestReviewAt = reviews.at(-1)?.decidedAt ?? null;
  const claimLatestRevisionAt = claimHistory.ok
    ? claimHistory.value.latestRevisionAt
    : null;
  const reviewPredates =
    Boolean(latestReviewAt) &&
    Boolean(claimLatestRevisionAt) &&
    new Date(latestReviewAt!).getTime() <
      new Date(claimLatestRevisionAt!).getTime();

  const grouped = groupEvidenceByRelationship(links);
  const comparable: ComparableEvidenceItem[] = links.map((link) => ({
    key: link.evidenceSubmissionId,
    relationship: link.relationship,
    title: link.evidenceTitle,
    organization: link.organization,
    authorType: link.authorType,
    sourceType: link.sourceType,
    limitations: link.limitations,
    qualityStatus: link.qualityStatus,
    qualityPlainLanguage: `Recorded quality: ${link.qualityStatus.replaceAll("_", " ")}. Quality is independent of claim truth.`,
    qualityPublicRationale: null,
    workflowPublicRationale: null,
    sourceUrl: link.sourceUrl,
  }));

  return (
    <MainContainer className="space-y-8">
      <Breadcrumbs
        items={[
          { href: "/", label: "Home" },
          { href: "/workspace/review", label: "Review queues" },
          { label: claim.title },
        ]}
      />
      <PageHeader
        eyebrow="Claim review"
        title={claim.title}
        description={`${topic.title} · submitter ${claim.submitterDisplayLabel}`}
      />
      <DisclosureNotice title="Do not fetch source URLs" tone="caution">
        Linked evidence URLs are shown for reference only. This application
        never fetches, scrapes, or previews remote sources.
      </DisclosureNotice>

      <dl className="grid gap-4 text-sm sm:grid-cols-2">
        <div>
          <dt className="font-medium">Summary</dt>
          <dd className="whitespace-pre-wrap">{claim.summary}</dd>
        </div>
        <div>
          <dt className="font-medium">Approach</dt>
          <dd>{claim.approachLabel}</dd>
        </div>
        <div>
          <dt className="font-medium">Workflow</dt>
          <dd>{claim.workflowState.replaceAll("_", " ")}</dd>
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
          No conflict disclosure recorded for this claim.
        </p>
      )}

      <section className="space-y-4" aria-labelledby="linked-evidence-heading">
        <h2 id="linked-evidence-heading" className="font-heading text-xl">
          Linked evidence
        </h2>
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="space-y-2">
            <h3 className="text-sm font-medium">Supporting evidence</h3>
            {grouped.supporting.length === 0 ? (
              <p className="text-sm text-muted-foreground">None linked.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {grouped.supporting.map((link) => (
                  <li
                    key={link.evidenceSubmissionId}
                    className="rounded-md border border-border px-3 py-2"
                  >
                    <p className="font-medium break-words">
                      {link.evidenceTitle}
                    </p>
                    <p className="text-muted-foreground break-words">
                      {link.organization} · {link.authorType} ·{" "}
                      {link.sourceType} · quality{" "}
                      {link.qualityStatus.replaceAll("_", " ")} · workflow{" "}
                      {link.workflowState.replaceAll("_", " ")}
                    </p>
                    <p className="mt-1 break-all font-mono text-xs">
                      {link.sourceUrl}
                    </p>
                    <p className="mt-1 whitespace-pre-wrap break-words text-muted-foreground">
                      {link.limitations}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="space-y-2">
            <h3 className="text-sm font-medium">Counterevidence</h3>
            {grouped.counterevidence.length === 0 ? (
              <p className="text-sm text-muted-foreground">None linked.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {grouped.counterevidence.map((link) => (
                  <li
                    key={link.evidenceSubmissionId}
                    className="rounded-md border border-border px-3 py-2"
                  >
                    <p className="font-medium break-words">
                      {link.evidenceTitle}
                    </p>
                    <p className="text-muted-foreground break-words">
                      {link.organization} · {link.authorType} ·{" "}
                      {link.sourceType} · quality{" "}
                      {link.qualityStatus.replaceAll("_", " ")} · workflow{" "}
                      {link.workflowState.replaceAll("_", " ")}
                    </p>
                    <p className="mt-1 break-all font-mono text-xs">
                      {link.sourceUrl}
                    </p>
                    <p className="mt-1 whitespace-pre-wrap break-words text-muted-foreground">
                      {link.limitations}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
        <EvidenceComparison claimTitle={claim.title} items={comparable} />
      </section>

      <RevisionHistoryPanel
        title="Claim content revisions"
        history={claimHistory.ok ? claimHistory.value : null}
        reviewPredatesLatestRevision={reviewPredates}
        latestReviewAt={latestReviewAt}
      />

      <section className="space-y-3" aria-labelledby="prior-reviews-heading">
        <h2 id="prior-reviews-heading" className="font-heading text-xl">
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
                  {review.decision.replaceAll("_", " ")} ·{" "}
                  {new Date(review.decidedAt).toLocaleString()}
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

      {canReview ? (
        <section className="space-y-3" aria-labelledby="decision-heading">
          <h2 id="decision-heading" className="font-heading text-xl">
            Record decision
          </h2>
          <ClaimReviewForm
            claimId={claim.claimId}
            expectedWorkflowState="submitted"
          />
        </section>
      ) : (
        <p className="text-sm text-muted-foreground">
          Initial review decisions apply only to submitted claims. Ask the
          participant to resubmit if the state is changes requested.
        </p>
      )}
    </MainContainer>
  );
}
