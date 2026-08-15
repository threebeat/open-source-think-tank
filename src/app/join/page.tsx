import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";

import { CreateAccountForm } from "@/components/auth/CreateAccountForm";
import { DisclosureNotice } from "@/components/DisclosureNotice";
import { PageHeader } from "@/components/PageHeader";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { MainContainer } from "@/components/layout/MainContainer";
import { resolveAppMode } from "@/lib/env/app-mode";
import { isOpenEnrollmentEnabled } from "@/lib/v2/flags";

export const metadata: Metadata = {
  title: "Create an account",
  description:
    "Create a Commonhall account with an identifier and password, then open the halls.",
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
            <Link className="underline" href="/auth/accept">
              Accept invitation
            </Link>
          </p>
        </MainContainer>
      );
    }
  } else {
    const { readPreAlphaSessionFromStore } = await import(
      "@/lib/auth/pre-alpha-local"
    );
    if (await readPreAlphaSessionFromStore()) {
      redirect("/account");
    }
  }

  return (
    <MainContainer className="space-y-8">
      <Breadcrumbs items={[{ href: "/", label: "Home" }, { label: "Create account" }]} />
      <PageHeader
        eyebrow="Pre-alpha"
        title="Create an account"
        description="Use an email-shaped identifier and a password. After you create the account you can sign in and open Commons, Agenda, Chamber, and Council."
      />
      <DisclosureNotice title="Not statutory membership" tone="caution">
        Creating an account grants organization community membership in a
        synthetic hall. It does not grant Chamber, Council, moderator, or
        organization-admin authority, and it is not nonprofit or statutory
        membership.
      </DisclosureNotice>
      <CreateAccountForm />
      <p className="text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link className="underline" href="/auth/sign-in">
          Sign in
        </Link>
        {" · "}
        Have an invite?{" "}
        <Link className="underline" href="/auth/accept">
          Accept invitation
        </Link>
      </p>
    </MainContainer>
  );
}
