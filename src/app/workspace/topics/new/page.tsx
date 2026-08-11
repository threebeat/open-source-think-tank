import { notFound, redirect } from "next/navigation";

import { PageHeader } from "@/components/PageHeader";
import { TopicCreateForm } from "@/components/workspace/TopicCreateForm";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { MainContainer } from "@/components/layout/MainContainer";
import { resolveAppMode } from "@/lib/env/app-mode";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Create topic",
  description: "Create a draft gated topic for the operational alpha.",
};

export default async function WorkspaceNewTopicPage() {
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
  const db = getGatedDb();
  const principal = await loadPrincipal(db, gated.session.accountId);
  const decision = await authorizeCapability(db, principal, "topics.create");
  if (!decision.ok) {
    redirect("/");
  }

  return (
    <MainContainer className="space-y-8">
      <Breadcrumbs
        items={[
          { href: "/", label: "Home" },
          { href: "/workspace/topics", label: "Topics" },
          { label: "New" },
        ]}
      />
      <PageHeader
        eyebrow="Administrator workspace"
        title="Create draft topic"
        description="Creates an unpublished draft. This is not a governing-board action and does not publish a public projection."
      />
      <TopicCreateForm />
    </MainContainer>
  );
}
