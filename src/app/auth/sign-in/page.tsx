import { redirect } from "next/navigation";

import { DisclosureNotice } from "@/components/DisclosureNotice";
import { PageHeader } from "@/components/PageHeader";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { MainContainer } from "@/components/layout/MainContainer";
import { SignInForm } from "@/components/auth/SignInForm";
import { resolveAppMode } from "@/lib/env/app-mode";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Sign in",
  description: "Invite-only sign-in for the gated foundation environment.",
};

export default function SignInPage() {
  if (resolveAppMode() !== "gated") {
    redirect("/join");
  }

  return (
    <MainContainer className="space-y-8">
      <Breadcrumbs
        items={[{ href: "/", label: "Home" }, { label: "Sign in" }]}
      />
      <PageHeader
        eyebrow="Invite-only"
        title="Sign in"
        description="Public self-registration is not available. Use an invitation or an existing invite-created account."
      />
      <DisclosureNotice title="No public signup" tone="caution">
        Knowing a URL is not enough. Accounts are created only through a valid
        invitation. This form never creates a new account.
      </DisclosureNotice>
      <SignInForm />
    </MainContainer>
  );
}
