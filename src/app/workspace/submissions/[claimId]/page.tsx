import { notFound, redirect } from "next/navigation";

import { DisclosureNotice } from "@/components/DisclosureNotice";
import { PageHeader } from "@/components/PageHeader";
import { SubmissionWithdrawControls } from "@/components/workspace/SubmissionWithdrawControls";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { MainContainer } from "@/components/layout/MainContainer";
import { resolveAppMode } from "@/lib/env/app-mode";

export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ claimId: string }> };

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
  const { getClaimById, listClaimEvidenceLinks } = await import(
    "@/lib/claims/repository"
  );
  const { getEvidenceSubmissionById } = await import(
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

  const canWithdraw = ["draft", "submitted", "changes_requested"].includes(
    claim.value.workflowState,
  );

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
      <DisclosureNotice title="Staff-visible" tone="neutral">
        Review and publication controls are out of scope for this package.
      </DisclosureNotice>

      <dl className="grid gap-4 text-sm sm:grid-cols-2">
        <div>
          <dt className="font-medium">Topic</dt>
          <dd>{topic.ok && topic.value ? topic.value.title : claim.value.topicId}</dd>
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
