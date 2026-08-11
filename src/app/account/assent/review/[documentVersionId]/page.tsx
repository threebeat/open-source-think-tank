import { redirect } from "next/navigation";

import { DocumentReviewClient } from "@/components/assent/DocumentReviewClient";
import { DisclosureNotice } from "@/components/DisclosureNotice";
import { PageHeader } from "@/components/PageHeader";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { MainContainer } from "@/components/layout/MainContainer";
import { resolveAppMode } from "@/lib/env/app-mode";

export const dynamic = "force-dynamic";

export default async function DocumentReviewPage({
  params,
}: {
  params: Promise<{ documentVersionId: string }>;
}) {
  if (resolveAppMode() !== "gated") {
    redirect("/");
  }

  const { requireGatedSession } = await import("@/lib/auth/guard");
  const gated = await requireGatedSession();
  if (!gated.ok) {
    redirect("/auth/sign-in");
  }

  const { documentVersionId } = await params;

  return (
    <MainContainer className="space-y-8">
      <Breadcrumbs
        items={[
          { href: "/", label: "Home" },
          { href: "/account", label: "Account" },
          { href: "/account/assent", label: "Assent history" },
          { label: "Review document" },
        ]}
      />
      <PageHeader
        eyebrow="Assent"
        title="Review document"
        description="Present the complete published document, acknowledge required notices, then assent or decline. This flow uses assent vocabulary and does not characterize every privacy basis as consent."
      />
      <DisclosureNotice title="Alpha-test assent" tone="caution">
        Electronic assent is cleared for the invite-only alpha test (interim
        council, ADR 0007). Test purpose must stay clear; findings may inform
        later authentication. This is not a permanent post-alpha legal settlement.
      </DisclosureNotice>
      <DocumentReviewClient documentVersionId={documentVersionId} />
    </MainContainer>
  );
}
