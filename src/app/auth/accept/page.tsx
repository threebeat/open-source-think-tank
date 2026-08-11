import { Suspense } from "react";
import { redirect } from "next/navigation";

import { AcceptInviteForm } from "@/components/auth/AcceptInviteForm";
import { DisclosureNotice } from "@/components/DisclosureNotice";
import { PageHeader } from "@/components/PageHeader";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { MainContainer } from "@/components/layout/MainContainer";
import { resolveAppMode } from "@/lib/env/app-mode";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Accept invitation",
  description: "Accept a single-use invitation in the gated foundation environment.",
};

export default function AcceptInvitePage() {
  if (resolveAppMode() !== "gated") {
    redirect("/join");
  }

  return (
    <MainContainer className="space-y-8">
      <Breadcrumbs
        items={[{ href: "/", label: "Home" }, { label: "Accept invitation" }]}
      />
      <PageHeader
        eyebrow="Invite-only"
        title="Accept invitation"
        description="Invitation acceptance creates an invited account and sends a contact-verification link. It does not activate institutional capabilities."
      />
      <DisclosureNotice title="Contact verification required" tone="caution">
        After accepting, you must complete the emailed one-time link before the
        account leaves the invited state for pending_onboarding.
      </DisclosureNotice>
      <Suspense fallback={<p className="text-sm text-muted-foreground">Loading form…</p>}>
        <AcceptInviteForm />
      </Suspense>
    </MainContainer>
  );
}
