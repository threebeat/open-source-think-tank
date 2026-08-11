import { notFound, redirect } from "next/navigation";

import { DisclosureNotice } from "@/components/DisclosureNotice";
import { PageHeader } from "@/components/PageHeader";
import { ClaimReviewForm } from "@/components/workspace/ClaimReviewForm";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { MainContainer } from "@/components/layout/MainContainer";
import { resolveAppMode } from "@/lib/env/app-mode";

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
  const detail = await getClaimReviewDetail(getGatedDb(), {
    actorAccountId: gated.session.accountId,
    claimId,
  });
  if (!detail.ok) {
    if (detail.code.startsWith("AUTHZ")) redirect("/");
    notFound();
  }

  const { claim, topic, links, reviews } = detail.value;
  const canReview = claim.workflowState === "submitted";

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
        Linked evidence URLs are shown for reference only. This application never
        fetches, scrapes, or previews remote sources.
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
        <div>
          <dt className="font-medium">Public conflict summary</dt>
          <dd>{claim.conflictPublicSummary ?? "—"}</dd>
        </div>
      </dl>

      <section className="space-y-3" aria-labelledby="linked-evidence-heading">
        <h2 id="linked-evidence-heading" className="font-heading text-xl">
          Linked evidence
        </h2>
        <ul className="space-y-2 text-sm">
          {links.map((link) => (
            <li key={link.evidenceSubmissionId}>
              {link.evidenceTitle} ({link.relationship}) —{" "}
              <span className="break-all font-mono text-xs">
                {link.sourceUrl}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-3" aria-labelledby="prior-reviews-heading">
        <h2 id="prior-reviews-heading" className="font-heading text-xl">
          Prior reviews
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
