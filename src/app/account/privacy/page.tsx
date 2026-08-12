import { redirect } from "next/navigation";

import { DisclosureNotice } from "@/components/DisclosureNotice";
import { PageHeader } from "@/components/PageHeader";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { MainContainer } from "@/components/layout/MainContainer";
import { PrivacyControlsClient } from "@/components/privacy/PrivacyControlsClient";
import { resolveAppMode } from "@/lib/env/app-mode";
import { RETENTION_RULES } from "@/lib/privacy/retention-rules";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Privacy controls",
  description: "Account-holder export and closure request (provisional).",
};

export default async function AccountPrivacyPage() {
  if (resolveAppMode() !== "gated") {
    redirect("/");
  }

  const { requireGatedSession } = await import("@/lib/auth/guard");
  const gated = await requireGatedSession();
  if (!gated.ok) {
    redirect("/auth/sign-in");
  }

  return (
    <MainContainer className="space-y-8">
      <Breadcrumbs
        items={[
          { href: "/", label: "Home" },
          { href: "/account", label: "Account" },
          { label: "Privacy" },
        ]}
      />
      <PageHeader
        eyebrow="Invite-only foundation"
        title="Privacy controls"
        description="Export your account-holder data or request closure. Retention and deletion rights remain counsel-gated."
      />
      <DisclosureNotice title="Provisional engineering controls" tone="caution">
        {RETENTION_RULES.counselGate}. {RETENTION_RULES.closure} This is not a
        settled privacy policy, and submission of a closure request does not
        promise immediate deletion.
      </DisclosureNotice>
      <PrivacyControlsClient />
    </MainContainer>
  );
}
