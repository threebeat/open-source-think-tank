import { notFound, redirect } from "next/navigation";

import { ClaimEvidenceSubmitForm } from "@/components/workspace/ClaimEvidenceSubmitForm";
import { DisclosureNotice } from "@/components/DisclosureNotice";
import { PageHeader } from "@/components/PageHeader";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { MainContainer } from "@/components/layout/MainContainer";
import { resolveAppMode } from "@/lib/env/app-mode";
import { formatTopicGeography } from "@/lib/geography/tennessee-counties";

export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: PageProps) {
  const { slug } = await params;
  return {
    title: `Submit — ${slug}`,
    description: "Submit a claim and evidence source for an open topic.",
  };
}

export default async function WorkspaceTopicSubmitPage({ params }: PageProps) {
  if (resolveAppMode() !== "gated") {
    notFound();
  }

  const { slug } = await params;
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
  const db = getGatedDb();
  const principal = await loadPrincipal(db, gated.session.accountId);
  for (const capability of [
    "claims.submit",
    "evidence.submit",
    "conflicts.disclose_own",
  ] as const) {
    const decision = await authorizeCapability(db, principal, capability);
    if (!decision.ok) {
      redirect("/");
    }
  }

  const { getTopicBySlug } = await import("@/lib/topics/repository");
  const topicResult = await getTopicBySlug(db, slug);
  if (!topicResult.ok || !topicResult.value) {
    notFound();
  }
  const topic = topicResult.value;

  return (
    <MainContainer className="space-y-8">
      <Breadcrumbs
        items={[
          { href: "/", label: "Home" },
          { href: "/workspace/submissions", label: "My submissions" },
          { label: `Submit — ${topic.title}` },
        ]}
      />
      <PageHeader
        eyebrow="Community participant workspace"
        title="Submit claim and evidence"
        description="Create a claim with one evidence source URL, relationship, limitations, and conflict disclosure."
      />
      <DisclosureNotice title="Not yet public" tone="caution">
        Staff can see submissions. Visitor-public publication is a later review
        step. Topic geography (
        {formatTopicGeography({
          jurisdictionLevel: topic.jurisdictionLevel,
          stateCode: "TN",
          countyFips: topic.countyFips,
        })}
        ) is classification only — not eligibility.
      </DisclosureNotice>

      {topic.workflowState !== "open_for_submissions" ? (
        <p className="text-sm text-muted-foreground" role="status">
          This topic is not open for submissions (
          {topic.workflowState.replaceAll("_", " ")}).
        </p>
      ) : (
        <ClaimEvidenceSubmitForm
          topicId={topic.id}
          topicTitle={topic.title}
        />
      )}
    </MainContainer>
  );
}
