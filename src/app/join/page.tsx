import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { CreateAccountForm } from "@/components/auth/CreateAccountForm";
import { JoinWalkthrough } from "@/components/join/JoinWalkthrough";
import { DisclosureNotice } from "@/components/DisclosureNotice";
import { PageHeader } from "@/components/PageHeader";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { MainContainer } from "@/components/layout/MainContainer";
import { resolveAppMode } from "@/lib/env/app-mode";
import { isOpenEnrollmentEnabled } from "@/lib/v2/flags";

export const metadata: Metadata = {
  title: "Create an account",
  description:
    "Gated Commonhall enrollment with a local identifier and password, or a public explanation that accounts are not created here.",
};

export const dynamic = "force-dynamic";

export default async function JoinPage() {
  if (resolveAppMode() === "gated") {
    const { requireGatedSession } = await import("@/lib/auth/guard");
    const gated = await requireGatedSession();
    if (gated.ok) {
      if (gated.session.lifecycleState === "active") {
        redirect("/account");
      }
      redirect("/account/onboarding");
    }

    if (!isOpenEnrollmentEnabled()) {
      return (
        <MainContainer className="space-y-8">
          <Breadcrumbs items={[{ href: "/", label: "Home" }, { label: "Join" }]} />
          <PageHeader
            eyebrow="Enrollment paused"
            title="Open enrollment is off"
            description="The COMMONHALL_V2_OPEN_ENROLLMENT kill switch is off. Staff bootstrap invitations still work."
          />
          <p className="text-sm">
            Have an invite?{" "}
            <a className="underline" href="/auth/accept">
              Accept invitation
            </a>
          </p>
        </MainContainer>
      );
    }

    return (
      <MainContainer className="space-y-8">
        <Breadcrumbs items={[{ href: "/", label: "Home" }, { label: "Create account" }]} />
        <PageHeader
          eyebrow="Gated pre-alpha"
          title="Create an account"
          description="Use an email-shaped identifier stored locally and a password. No message is sent. You will be assigned to the synthetic primary organization with an explanation."
        />
        <DisclosureNotice title="Not statutory membership" tone="caution">
          Creating an account grants organization community membership in a
          synthetic hall. It does not grant Chamber, Council, moderator, or
          organization-admin authority, and it is not nonprofit or statutory
          membership.
        </DisclosureNotice>
        <CreateAccountForm />
        <p className="text-sm text-muted-foreground">
          Staff bootstrap still uses{" "}
          <a className="underline" href="/auth/accept">
            Accept invitation
          </a>
          .
        </p>
      </MainContainer>
    );
  }

  return (
    <MainContainer className="space-y-8">
      <Breadcrumbs
        items={[{ href: "/", label: "Home" }, { label: "How joining works" }]}
      />
      <PageHeader
        eyebrow="Public demonstration"
        title="How joining works"
        description="This public-demo deployment cannot create accounts or open a database. The gated service uses a local identifier and password — still with no outbound email."
      />
      <DisclosureNotice title="Accounts require the gated service" tone="caution">
        Public-demo mode never constructs an auth or database client. You are
        exploring a synthetic walkthrough, not creating an account or seeing
        other live visitors.
      </DisclosureNotice>
      <JoinWalkthrough />
    </MainContainer>
  );
}
