import { notFound, redirect } from "next/navigation";

import { DisclosureNotice } from "@/components/DisclosureNotice";
import { PageHeader } from "@/components/PageHeader";
import { SubmissionEditResubmitForm } from "@/components/workspace/SubmissionEditResubmitForm";
import { SubmissionWithdrawControls } from "@/components/workspace/SubmissionWithdrawControls";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { MainContainer } from "@/components/layout/MainContainer";
import { resolveAppMode } from "@/lib/env/app-mode";

export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ claimId: string }> };

function qualityPlainLanguage(status: string): string {
  switch (status) {
    case "accepted":
      return "Reviewers accepted this source’s quality for workflow purposes. That does not mean the claim is true.";
    case "limited":
      return "Reviewers found this source useful with constraints. That does not mean the claim is true.";
    case "disputed":
      return "Reviewers recorded contested source fitness. That does not settle claim truth.";
    case "rejected":
      return "Reviewers rejected this source’s quality. That does not settle claim truth.";
    default:
      return "No substantive quality decision has been recorded yet.";
  }
}

export default async function WorkspaceSubmissionDetailPage({
  params,
}: PageProps) {
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
  const { getClaimById, listClaimEvidenceLinks, listClaimReviews } =
    await import("@/lib/claims/repository");
  const { getEvidenceSubmissionById, listEvidenceReviews } = await import(
    "@/lib/evidence/repository"
  );
  const { listConflictDisclosuresForClaim } = await import(
    "@/lib/conflicts/repository"
  );
  const { getTopicById } = await import("@/lib/topics/repository");
  const db = getGatedDb();

  const claim = await getClaimById(db, claimId);
  if (!claim.ok || !claim.value) {
    notFound();
  }
  if (claim.value.authorAccountId !== gated.session.accountId) {
    notFound();
  }

  const topic = await getTopicById(db, claim.value.topicId);
  const links = await listClaimEvidenceLinks(db, { claimId: claim.value.id });
  const link = links.ok ? links.value[0] : undefined;
  const evidence = link
    ? await getEvidenceSubmissionById(db, link.evidenceSubmissionId)
    : null;
  const disclosures = await listConflictDisclosuresForClaim(db, claim.value.id);
  const claimReviews = await listClaimReviews(db, claim.value.id);
  const evidenceReviews =
    evidence?.ok && evidence.value
      ? await listEvidenceReviews(db, evidence.value.id)
      : null;

  const canWithdraw = ["draft", "submitted", "changes_requested"].includes(
    claim.value.workflowState,
  );
  const needsResubmit = claim.value.workflowState === "changes_requested";

  const publicClaimReviews = (claimReviews.ok ? claimReviews.value : [])
    .slice()
    .sort((a, b) => a.decidedAt.getTime() - b.decidedAt.getTime())
    .map((row) => ({
      decision: row.decision,
      publicRationale: row.publicRationale,
      decidedAt: row.decidedAt.toISOString(),
    }));

  const publicEvidenceReviews = (
    evidenceReviews && evidenceReviews.ok ? evidenceReviews.value : []
  )
    .slice()
    .sort((a, b) => a.decidedAt.getTime() - b.decidedAt.getTime())
    .map((row) => ({
      decision: row.decision,
      qualityStatus: row.qualityStatus,
      workflowDecision: row.workflowDecision,
      publicRationale: row.publicRationale,
      decidedAt: row.decidedAt.toISOString(),
    }));

  return (
    <MainContainer className="space-y-8">
      <Breadcrumbs
        items={[
          { href: "/", label: "Home" },
          { href: "/workspace/submissions", label: "My submissions" },
          { label: claim.value.title },
        ]}
      />
      <PageHeader
        eyebrow="Own submission"
        title={claim.value.title}
        description="Private drafts belonging to other community participants are never shown here."
      />
      <DisclosureNotice title="Public review outcomes" tone="neutral">
        You can see current statuses and public rationales for your own envelope.
        Private reviewer notes and staff queue controls are never shown here.
        Accepted evidence workflow is not the same as “the claim is true.”
      </DisclosureNotice>

      {needsResubmit && evidence?.ok && evidence.value ? (
        <section className="space-y-3" aria-labelledby="edit-resubmit-heading">
          <h2 id="edit-resubmit-heading" className="font-heading text-xl">
            Edit and resubmit
          </h2>
          <DisclosureNotice title="Changes requested" tone="caution">
            Staff requested changes. Edit the fields below, then resubmit for
            another review. Creating a brand-new submission is not required.
          </DisclosureNotice>
          <SubmissionEditResubmitForm
            claimId={claim.value.id}
            initialClaimTitle={claim.value.title}
            initialClaimSummary={claim.value.summary}
            initialApproachLabel={claim.value.approachLabel}
            initialSourceUrl={evidence.value.sourceUrl}
            initialEvidenceTitle={evidence.value.title}
            initialOrganization={evidence.value.organization}
            initialAuthorType={evidence.value.authorType}
            initialSourceType={evidence.value.sourceType}
            initialLimitations={evidence.value.limitations}
            expectedClaimUpdatedAt={claim.value.updatedAt.toISOString()}
            expectedEvidenceUpdatedAt={evidence.value.updatedAt.toISOString()}
          />
        </section>
      ) : needsResubmit ? (
        <DisclosureNotice title="Changes requested" tone="caution">
          Staff requested changes, but linked evidence could not be loaded for
          editing.
        </DisclosureNotice>
      ) : null}

      <dl className="grid gap-4 text-sm sm:grid-cols-2">
        <div>
          <dt className="font-medium">Topic</dt>
          <dd>
            {topic.ok && topic.value ? topic.value.title : claim.value.topicId}
          </dd>
        </div>
        <div>
          <dt className="font-medium">Claim workflow</dt>
          <dd>{claim.value.workflowState.replaceAll("_", " ")}</dd>
        </div>
        <div>
          <dt className="font-medium">Summary</dt>
          <dd className="whitespace-pre-wrap">{claim.value.summary}</dd>
        </div>
        {evidence?.ok && evidence.value ? (
          <>
            <div>
              <dt className="font-medium">Evidence title</dt>
              <dd>{evidence.value.title}</dd>
            </div>
            <div>
              <dt className="font-medium">Source URL (stored, not fetched)</dt>
              <dd className="break-all font-mono text-xs">
                {evidence.value.sourceUrl}
              </dd>
            </div>
            <div>
              <dt className="font-medium">Relationship</dt>
              <dd>{link?.relationship ?? "—"}</dd>
            </div>
            <div>
              <dt className="font-medium">Evidence workflow</dt>
              <dd>{evidence.value.workflowState.replaceAll("_", " ")}</dd>
            </div>
            <div>
              <dt className="font-medium">Evidence quality</dt>
              <dd>
                <span className="block">
                  {evidence.value.qualityStatus.replaceAll("_", " ")}
                </span>
                <span className="block text-xs text-muted-foreground">
                  {qualityPlainLanguage(evidence.value.qualityStatus)}
                </span>
              </dd>
            </div>
            <div>
              <dt className="font-medium">Limitations</dt>
              <dd className="whitespace-pre-wrap">
                {evidence.value.limitations}
              </dd>
            </div>
          </>
        ) : null}
        <div>
          <dt className="font-medium">Public conflict summary</dt>
          <dd>
            {disclosures.ok && disclosures.value[0]
              ? disclosures.value[0].publicSummary
              : "—"}
          </dd>
        </div>
      </dl>

      <section className="space-y-3" aria-labelledby="claim-outcomes-heading">
        <h2 id="claim-outcomes-heading" className="font-heading text-xl">
          Public claim review outcomes
        </h2>
        {publicClaimReviews.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No public claim review rationales yet.
          </p>
        ) : (
          <ol className="space-y-3">
            {publicClaimReviews.map((review, index) => (
              <li
                key={`${review.decidedAt}-${index}`}
                className="rounded-md border border-border bg-surface px-4 py-3 text-sm"
              >
                <p className="font-medium">
                  {review.decision.replaceAll("_", " ")} ·{" "}
                  {new Date(review.decidedAt).toLocaleString()}
                </p>
                <p className="mt-1 text-muted-foreground">
                  {review.publicRationale}
                </p>
              </li>
            ))}
          </ol>
        )}
      </section>

      <section className="space-y-3" aria-labelledby="evidence-outcomes-heading">
        <h2 id="evidence-outcomes-heading" className="font-heading text-xl">
          Public evidence review outcomes
        </h2>
        {publicEvidenceReviews.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No public evidence review rationales yet.
          </p>
        ) : (
          <ol className="space-y-3">
            {publicEvidenceReviews.map((review, index) => (
              <li
                key={`${review.decidedAt}-${index}`}
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
                  {review.publicRationale}
                </p>
              </li>
            ))}
          </ol>
        )}
      </section>

      <section className="space-y-3" aria-labelledby="withdraw-heading">
        <h2 id="withdraw-heading" className="font-heading text-xl">
          Withdraw
        </h2>
        <SubmissionWithdrawControls
          claimId={claim.value.id}
          claimWorkflowState={claim.value.workflowState}
          evidenceWorkflowState={
            evidence?.ok && evidence.value
              ? evidence.value.workflowState
              : claim.value.workflowState
          }
          canWithdraw={canWithdraw}
        />
      </section>
    </MainContainer>
  );
}
