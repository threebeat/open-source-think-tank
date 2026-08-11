import { notFound, redirect } from "next/navigation";

import { DisclosureNotice } from "@/components/DisclosureNotice";
import { PageHeader } from "@/components/PageHeader";
import {
  EvidenceComparison,
  groupEvidenceByRelationship,
  type ComparableEvidenceItem,
} from "@/components/topics/EvidenceComparison";
import { RevisionHistoryPanel } from "@/components/topics/RevisionHistoryPanel";
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

const editableStates = new Set(["draft", "changes_requested"]);
const withdrawableStates = new Set(["draft", "submitted", "changes_requested"]);

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
  const {
    getOwnClaimRevisionHistory,
    getOwnEvidenceRevisionHistory,
  } = await import("@/lib/revisions/history");
  const db = getGatedDb();

  const claim = await getClaimById(db, claimId);
  if (!claim.ok || !claim.value) {
    notFound();
  }
  if (claim.value.authorAccountId !== gated.session.accountId) {
    notFound();
  }

  const topic = await getTopicById(db, claim.value.topicId);
  const linksResult = await listClaimEvidenceLinks(db, {
    claimId: claim.value.id,
  });
  const links = linksResult.ok ? linksResult.value : [];

  const evidenceRows = [];
  for (const link of links) {
    const evidence = await getEvidenceSubmissionById(
      db,
      link.evidenceSubmissionId,
    );
    if (evidence.ok && evidence.value) {
      evidenceRows.push({ link, evidence: evidence.value });
    }
  }

  // Primary editable evidence: prefer an owned changes_requested/draft row,
  // otherwise the first owned link — never mutate via array-order alone on server.
  const primaryOwned =
    evidenceRows.find(
      (row) =>
        row.evidence.submitterAccountId === gated.session.accountId &&
        editableStates.has(row.evidence.workflowState),
    ) ??
    evidenceRows.find(
      (row) => row.evidence.submitterAccountId === gated.session.accountId,
    );

  const disclosures = await listConflictDisclosuresForClaim(db, claim.value.id);
  const claimReviews = await listClaimReviews(db, claim.value.id);

  const claimHistory = await getOwnClaimRevisionHistory(db, {
    actorAccountId: gated.session.accountId,
    claimId: claim.value.id,
  });

  const evidenceHistories = [];
  const seenEvidence = new Set<string>();
  for (const row of evidenceRows) {
    if (seenEvidence.has(row.evidence.id)) continue;
    seenEvidence.add(row.evidence.id);
    if (row.evidence.submitterAccountId !== gated.session.accountId) continue;
    const history = await getOwnEvidenceRevisionHistory(db, {
      actorAccountId: gated.session.accountId,
      evidenceSubmissionId: row.evidence.id,
    });
    evidenceHistories.push({
      evidenceId: row.evidence.id,
      title: row.evidence.title,
      history: history.ok ? history.value : null,
    });
  }

  const publicClaimReviews = (claimReviews.ok ? claimReviews.value : [])
    .slice()
    .sort((a, b) => a.decidedAt.getTime() - b.decidedAt.getTime())
    .map((row) => ({
      decision: row.decision,
      publicRationale: row.publicRationale,
      decidedAt: row.decidedAt.toISOString(),
    }));

  const latestClaimReviewAt = publicClaimReviews.at(-1)?.decidedAt ?? null;
  const claimLatestRevisionAt =
    claimHistory.ok ? claimHistory.value.latestRevisionAt : null;
  const claimReviewPredates =
    Boolean(latestClaimReviewAt) &&
    Boolean(claimLatestRevisionAt) &&
    new Date(latestClaimReviewAt!).getTime() <
      new Date(claimLatestRevisionAt!).getTime();

  const claimEditable = editableStates.has(claim.value.workflowState);
  const claimResubmittable = claim.value.workflowState === "changes_requested";
  const evidenceEditable = primaryOwned
    ? editableStates.has(primaryOwned.evidence.workflowState)
    : false;
  const evidenceResubmittable = primaryOwned
    ? primaryOwned.evidence.workflowState === "changes_requested"
    : false;

  const grouped = groupEvidenceByRelationship(
    evidenceRows.map(({ link, evidence }) => ({
      relationship: link.relationship,
      evidence,
      link,
    })),
  );

  const comparable: ComparableEvidenceItem[] = evidenceRows.map(
    ({ link, evidence }) => ({
      key: evidence.id,
      relationship: link.relationship,
      title: evidence.title,
      organization: evidence.organization,
      authorType: evidence.authorType,
      sourceType: evidence.sourceType,
      limitations: evidence.limitations,
      qualityStatus: evidence.qualityStatus,
      qualityPlainLanguage: qualityPlainLanguage(evidence.qualityStatus),
      qualityPublicRationale: null,
      workflowPublicRationale: null,
      sourceUrl: evidence.sourceUrl,
    }),
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
      <DisclosureNotice title="Public review outcomes" tone="neutral">
        You can see current statuses and public rationales for your own subjects.
        Private reviewer notes and staff queue controls are never shown here.
        Claim and evidence workflow decisions are independent.
      </DisclosureNotice>

      {(claimEditable || evidenceEditable) && primaryOwned ? (
        <section className="space-y-3" aria-labelledby="edit-resubmit-heading">
          <h2 id="edit-resubmit-heading" className="font-heading text-xl">
            Edit and resubmit
          </h2>
          <DisclosureNotice title="Subject-specific edits" tone="caution">
            Post-submission edits in changes_requested write immutable content
            revisions. Draft-only edits before first submission are not
            versioned.
          </DisclosureNotice>
          <SubmissionEditResubmitForm
            claimId={claim.value.id}
            evidenceSubmissionId={primaryOwned.evidence.id}
            claimEditable={claimEditable}
            evidenceEditable={evidenceEditable}
            claimResubmittable={claimResubmittable}
            evidenceResubmittable={evidenceResubmittable}
            initialClaimTitle={claim.value.title}
            initialClaimSummary={claim.value.summary}
            initialApproachLabel={claim.value.approachLabel}
            initialSourceUrl={primaryOwned.evidence.sourceUrl}
            initialEvidenceTitle={primaryOwned.evidence.title}
            initialOrganization={primaryOwned.evidence.organization}
            initialAuthorType={primaryOwned.evidence.authorType}
            initialSourceType={primaryOwned.evidence.sourceType}
            initialLimitations={primaryOwned.evidence.limitations}
            expectedClaimUpdatedAt={claim.value.updatedAt.toISOString()}
            expectedEvidenceUpdatedAt={primaryOwned.evidence.updatedAt.toISOString()}
          />
        </section>
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
        <div className="sm:col-span-2">
          <dt className="font-medium">Summary</dt>
          <dd className="whitespace-pre-wrap break-words">
            {claim.value.summary}
          </dd>
        </div>
        <div>
          <dt className="font-medium">Public conflict summary</dt>
          <dd>
            {disclosures.ok && disclosures.value[0]
              ? disclosures.value[0].publicSummary
              : "—"}
          </dd>
        </div>
      </dl>

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
              <ul className="space-y-3">
                {grouped.supporting.map(({ evidence, link }) => (
                  <li
                    key={link.id}
                    className="rounded-md border border-border px-4 py-3 text-sm"
                  >
                    <p className="font-medium break-words">{evidence.title}</p>
                    <p className="text-muted-foreground break-words">
                      {evidence.organization} ·{" "}
                      {evidence.workflowState.replaceAll("_", " ")} · quality{" "}
                      {evidence.qualityStatus.replaceAll("_", " ")}
                    </p>
                    <p className="mt-2 break-all font-mono text-xs">
                      {evidence.sourceUrl}
                    </p>
                    <p className="mt-2 whitespace-pre-wrap break-words text-muted-foreground">
                      {evidence.limitations}
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
              <ul className="space-y-3">
                {grouped.counterevidence.map(({ evidence, link }) => (
                  <li
                    key={link.id}
                    className="rounded-md border border-border px-4 py-3 text-sm"
                  >
                    <p className="font-medium break-words">{evidence.title}</p>
                    <p className="text-muted-foreground break-words">
                      {evidence.organization} ·{" "}
                      {evidence.workflowState.replaceAll("_", " ")} · quality{" "}
                      {evidence.qualityStatus.replaceAll("_", " ")}
                    </p>
                    <p className="mt-2 break-all font-mono text-xs">
                      {evidence.sourceUrl}
                    </p>
                    <p className="mt-2 whitespace-pre-wrap break-words text-muted-foreground">
                      {evidence.limitations}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
        <EvidenceComparison claimTitle={claim.value.title} items={comparable} />
      </section>

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
                  Review decision: {review.decision.replaceAll("_", " ")} ·{" "}
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

      <RevisionHistoryPanel
        title="Claim content revisions"
        history={claimHistory.ok ? claimHistory.value : null}
        reviewPredatesLatestRevision={claimReviewPredates}
        latestReviewAt={latestClaimReviewAt}
      />

      {evidenceHistories.map((row) => (
        <RevisionHistoryPanel
          key={row.evidenceId}
          title={`Evidence content revisions — ${row.title}`}
          history={row.history}
        />
      ))}

      <section className="space-y-3" aria-labelledby="withdraw-heading">
        <h2 id="withdraw-heading" className="font-heading text-xl">
          Withdraw
        </h2>
        <SubmissionWithdrawControls
          claimId={claim.value.id}
          evidenceSubmissionId={primaryOwned?.evidence.id ?? null}
          claimWorkflowState={claim.value.workflowState}
          evidenceWorkflowState={primaryOwned?.evidence.workflowState ?? null}
          canWithdrawClaim={withdrawableStates.has(claim.value.workflowState)}
          canWithdrawEvidence={
            primaryOwned
              ? withdrawableStates.has(primaryOwned.evidence.workflowState)
              : false
          }
        />
      </section>
    </MainContainer>
  );
}
