import { redirect } from "next/navigation";

import { DisclosureNotice } from "@/components/DisclosureNotice";
import { PageHeader } from "@/components/PageHeader";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { MainContainer } from "@/components/layout/MainContainer";
import { resolveAppMode } from "@/lib/env/app-mode";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Authentication error",
  description: "Authentication could not be completed.",
};

export default function AuthErrorPage() {
  if (resolveAppMode() !== "gated") {
    redirect("/join");
  }

  return (
    <MainContainer className="space-y-8">
      <Breadcrumbs
        items={[{ href: "/", label: "Home" }, { label: "Authentication error" }]}
      />
      <PageHeader
        eyebrow="Invite-only"
        title="Authentication error"
        description="The sign-in or invitation challenge could not be completed."
      />
      <DisclosureNotice title="No public signup" tone="caution">
        This environment does not offer public self-registration. Request a new
        invitation or sign-in link if you already have an invite-created account.
      </DisclosureNotice>
    </MainContainer>
  );
}
