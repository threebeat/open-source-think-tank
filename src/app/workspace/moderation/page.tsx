import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { DisclosureNotice } from "@/components/DisclosureNotice";
import { PageHeader } from "@/components/PageHeader";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { MainContainer } from "@/components/layout/MainContainer";
import { resolveAppMode } from "@/lib/env/app-mode";

export const dynamic = "force-dynamic";

export default async function WorkspaceModerationPage() {
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
  const { listModerationQueue } = await import("@/lib/moderation/queues");
  const db = getGatedDb();

  const queue = await listModerationQueue(db, {
    actorAccountId: gated.session.accountId,
  });

  if (!queue.ok && queue.code.startsWith("AUTHZ")) {
    redirect("/");
  }

  const items = queue.ok ? queue.value : [];
  const heldOrHidden = items.filter(
    (item) =>
      item.moderationVisibility === "held" ||
      item.moderationVisibility === "hidden",
  );
  const visible = items.filter(
    (item) => item.moderationVisibility === "visible",
  );

  return (
    <MainContainer className="space-y-8">
      <Breadcrumbs
        items={[
          { href: "/", label: "Home" },
          { href: "/workspace/review", label: "Review queues" },
          { label: "Moderation" },
        ]}
      />
      <PageHeader
        eyebrow="Staff moderation"
        title="Moderation queue"
        description="Hold, hide, or restore submission visibility. These actions do not delete content, change workflow acceptance, or certify truth."
      />
      <DisclosureNotice title="Visibility is not deletion" tone="neutral">
        Held and hidden submissions remain in institutional history. Public
        rationales may appear on published topics; private notes stay
        staff-only. Restoration returns content to visible — it is not approval
        or consensus.
      </DisclosureNotice>

      <p className="text-sm">
        <Link
          href="/workspace/review"
          className="text-primary underline underline-offset-2"
        >
          Back to review queues
        </Link>
      </p>

      <section className="space-y-3" aria-labelledby="held-hidden-heading">
        <h2 id="held-hidden-heading" className="font-heading text-xl">
          Held or hidden
        </h2>
        {heldOrHidden.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No held or hidden submissions.
          </p>
        ) : (
          <ul className="space-y-3">
            {heldOrHidden.map((item) => (
              <li
                key={`${item.subjectType}-${item.subjectId}`}
                className="rounded-md border border-border bg-surface px-4 py-3"
              >
                <Link
                  href={
                    item.subjectType === "claim"
                      ? `/workspace/moderation/claims/${item.subjectId}`
                      : `/workspace/moderation/evidence/${item.subjectId}`
                  }
                  className="font-medium text-foreground underline-offset-2 hover:underline"
                >
                  {item.title}
                </Link>
                <p className="mt-1 text-sm text-muted-foreground">
                  {item.subjectType === "claim" ? "Claim" : "Evidence"} ·{" "}
                  {item.moderationVisibility} · Topic: {item.topicTitle} ·
                  Submitter: {item.submitterDisplayLabel}
                </p>
                {item.latestActionSummary ? (
                  <p className="mt-1 text-sm text-muted-foreground">
                    Latest: {item.latestActionSummary.action} ·{" "}
                    {item.latestActionSummary.publicRationale}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-3" aria-labelledby="visible-heading">
        <h2 id="visible-heading" className="font-heading text-xl">
          Visible (eligible for hold/hide)
        </h2>
        {visible.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No visible non-draft submissions in the queue.
          </p>
        ) : (
          <ul className="space-y-3">
            {visible.map((item) => (
              <li
                key={`${item.subjectType}-${item.subjectId}`}
                className="rounded-md border border-border bg-surface px-4 py-3"
              >
                <Link
                  href={
                    item.subjectType === "claim"
                      ? `/workspace/moderation/claims/${item.subjectId}`
                      : `/workspace/moderation/evidence/${item.subjectId}`
                  }
                  className="font-medium text-foreground underline-offset-2 hover:underline"
                >
                  {item.title}
                </Link>
                <p className="mt-1 text-sm text-muted-foreground">
                  {item.subjectType === "claim" ? "Claim" : "Evidence"} ·
                  Workflow: {item.workflowState.replaceAll("_", " ")} · Topic:{" "}
                  {item.topicTitle}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </MainContainer>
  );
}
