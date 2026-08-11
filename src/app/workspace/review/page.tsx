import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { DisclosureNotice } from "@/components/DisclosureNotice";
import { PageHeader } from "@/components/PageHeader";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { MainContainer } from "@/components/layout/MainContainer";
import { resolveAppMode } from "@/lib/env/app-mode";

export const dynamic = "force-dynamic";

export default async function WorkspaceReviewPage() {
  if (resolveAppMode() !== "gated") {
    notFound();
  }

  const { requireGatedSession } = await import("@/lib/auth/guard");
  const gated = await requireGatedSession();
  if (!gated.ok) {
    if (gated.status === 401) redirect("/auth/sign-in");
    notFound();
  }

  const { getGatedDb } = await import("@/lib/auth/runtime");
  const { listClaimReviewQueue, listEvidenceReviewQueue } = await import(
    "@/lib/review/queues"
  );
  const db = getGatedDb();

  const claims = await listClaimReviewQueue(db, {
    actorAccountId: gated.session.accountId,
  });
  const evidence = await listEvidenceReviewQueue(db, {
    actorAccountId: gated.session.accountId,
  });

  if (!claims.ok && claims.code.startsWith("AUTHZ")) {
    redirect("/");
  }
  if (!evidence.ok && evidence.code.startsWith("AUTHZ")) {
    redirect("/");
  }

  const claimItems = claims.ok ? claims.value : [];
  const evidenceItems = evidence.ok ? evidence.value : [];

  return (
    <MainContainer className="space-y-8">
      <Breadcrumbs
        items={[
          { href: "/", label: "Home" },
          { label: "Review queues" },
        ]}
      />
      <PageHeader
        eyebrow="Staff review"
        title="Review queues"
        description="Claim workflow and evidence workflow/quality decisions are authorized staff actions. Evidence quality does not establish claim truth and is independent of popularity."
      />
      <DisclosureNotice title="Private notes stay staff-only" tone="neutral">
        Queue rows exclude contact channels, verification artifacts, and private
        disclosure detail. Public rationales may later appear on published
        topics.
      </DisclosureNotice>

      <section className="space-y-3" aria-labelledby="claim-queue-heading">
        <h2 id="claim-queue-heading" className="font-heading text-xl">
          Claim queue (submitted)
        </h2>
        {claimItems.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No submitted claims awaiting review.
          </p>
        ) : (
          <ul className="space-y-3">
            {claimItems.map((item) => (
              <li
                key={item.claimId}
                className="rounded-md border border-border bg-surface px-4 py-3"
              >
                <Link
                  href={`/workspace/review/claims/${item.claimId}`}
                  className="font-medium text-foreground underline-offset-2 hover:underline"
                >
                  {item.title}
                </Link>
                <p className="mt-1 text-sm text-muted-foreground">
                  Topic: {item.topicTitle} · Submitter:{" "}
                  {item.submitterDisplayLabel} · Submitted{" "}
                  {new Date(item.submittedAt).toLocaleString()}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-3" aria-labelledby="evidence-queue-heading">
        <h2 id="evidence-queue-heading" className="font-heading text-xl">
          Evidence queue (submitted)
        </h2>
        {evidenceItems.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No submitted evidence awaiting workflow review.
          </p>
        ) : (
          <ul className="space-y-3">
            {evidenceItems.map((item) => (
              <li
                key={item.evidenceSubmissionId}
                className="rounded-md border border-border bg-surface px-4 py-3"
              >
                <Link
                  href={`/workspace/review/evidence/${item.evidenceSubmissionId}`}
                  className="font-medium text-foreground underline-offset-2 hover:underline"
                >
                  {item.title}
                </Link>
                <p className="mt-1 text-sm text-muted-foreground">
                  Topic: {item.topicTitle} · Quality:{" "}
                  {item.qualityStatus.replaceAll("_", " ")} · Submitter:{" "}
                  {item.submitterDisplayLabel}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </MainContainer>
  );
}
