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
      <DisclosureNotice title="Counsel gate" tone="caution">
        Electronic assent counsel disposition remains blocking for production
        legal claims. Synthetic fixtures are for engineering only.
      </DisclosureNotice>
      <DocumentReviewClient documentVersionId={documentVersionId} />
    </MainContainer>
  );
}
