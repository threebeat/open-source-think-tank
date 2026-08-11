import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { DisclosureNotice } from "@/components/DisclosureNotice";
import { PageHeader } from "@/components/PageHeader";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { MainContainer } from "@/components/layout/MainContainer";
import { resolveAppMode } from "@/lib/env/app-mode";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "My submissions",
  description: "Own claim and evidence submissions in the gated workspace.",
};

export default async function WorkspaceSubmissionsPage() {
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
  const { authorizeCapability } = await import(
    "@/lib/authz/authorize-capability"
  );
  const { loadPrincipal } = await import("@/lib/authz/load-principal");
  const { listTopics } = await import("@/lib/topics/repository");
  const { listClaims } = await import("@/lib/claims/repository");
  const db = getGatedDb();
  const principal = await loadPrincipal(db, gated.session.accountId);
  if (!principal) {
    redirect("/auth/sign-in");
  }
  const decision = await authorizeCapability(db, principal, "claims.submit");
  if (!decision.ok) {
    redirect("/");
  }

  const topics = await listTopics(db);
  if (!topics.ok) {
    notFound();
  }

  const openTopics = topics.value.filter(
    (topic) => topic.workflowState === "open_for_submissions",
  );

  const ownByTopic: Array<{
    topicSlug: string;
    topicTitle: string;
    claims: Array<{
      id: string;
      title: string;
      workflowState: string;
      updatedAt: Date;
    }>;
  }> = [];

  for (const topic of topics.value) {
    const claims = await listClaims(db, { topicId: topic.id });
    if (!claims.ok) continue;
    const own = claims.value.filter(
      (claim) => claim.authorAccountId === principal.accountId,
    );
    if (own.length === 0) continue;
    ownByTopic.push({
      topicSlug: topic.slug,
      topicTitle: topic.title,
      claims: own.map((claim) => ({
        id: claim.id,
        title: claim.title,
        workflowState: claim.workflowState,
        updatedAt: claim.updatedAt,
      })),
    });
  }

  return (
    <MainContainer className="space-y-8">
      <Breadcrumbs
        items={[
          { href: "/", label: "Home" },
          { label: "My submissions" },
        ]}
      />
      <PageHeader
        eyebrow="Community participant workspace"
        title="My submissions"
        description="Only your own drafts and submissions appear here. Other participants’ private drafts are not listed."
      />
      <DisclosureNotice title="Staff-visible until published" tone="neutral">
        Submissions are not visitor-public until a later reviewed publication
        step. Withdrawal retains history; rows are not deleted.
      </DisclosureNotice>

      <section className="space-y-3" aria-labelledby="open-topics-heading">
        <h2
          id="open-topics-heading"
          className="font-heading text-xl text-foreground"
        >
          Topics open for submissions
        </h2>
        {openTopics.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No topics are currently open for submissions.
          </p>
        ) : (
          <ul className="space-y-2 text-sm">
            {openTopics.map((topic) => (
              <li key={topic.id}>
                <Link
                  className="underline underline-offset-2"
                  href={`/workspace/topics/${topic.slug}/submit`}
                >
                  Submit to {topic.title}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-3" aria-labelledby="own-submissions-heading">
        <h2
          id="own-submissions-heading"
          className="font-heading text-xl text-foreground"
        >
          Your submissions
        </h2>
        {ownByTopic.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            You have not submitted any claims yet.
          </p>
        ) : (
          <ul className="space-y-4">
            {ownByTopic.map((group) => (
              <li key={group.topicSlug} className="space-y-2">
                <h3 className="text-sm font-medium">{group.topicTitle}</h3>
                <ul className="space-y-1 text-sm text-muted-foreground">
                  {group.claims.map((claim) => (
                    <li key={claim.id}>
                      <Link
                        className="text-foreground underline underline-offset-2"
                        href={`/workspace/submissions/${claim.id}`}
                      >
                        {claim.title}
                      </Link>{" "}
                      — {claim.workflowState.replaceAll("_", " ")}
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        )}
      </section>
    </MainContainer>
  );
}
