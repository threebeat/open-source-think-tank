import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { JoinWalkthrough } from "@/components/join/JoinWalkthrough";
import { DisclosureNotice } from "@/components/DisclosureNotice";
import { PageHeader } from "@/components/PageHeader";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { MainContainer } from "@/components/layout/MainContainer";
import { resolveAppMode } from "@/lib/env/app-mode";

export const metadata: Metadata = {
  title: "Join",
  description:
    "Invite-only enrollment in the gated foundation, or a nonfunctional public join preview.",
};

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

    return (
      <MainContainer className="space-y-8">
        <Breadcrumbs
          items={[{ href: "/", label: "Home" }, { label: "Join" }]}
        />
        <PageHeader
          eyebrow="Invite-only foundation"
          title="Join with an invitation"
          description="Public self-registration is disabled. Enrollment begins only with a valid invitation link. This creates an account holder / community participant path — not a statutory membership claim."
        />
        <DisclosureNotice title="Recruitment disabled" tone="caution">
          There is no open recruitment call to action. If you were not invited,
          you cannot begin enrollment.
        </DisclosureNotice>
        <p className="text-sm">
          Have an invite?{" "}
          <a className="underline" href="/auth/accept">
            Accept invitation
          </a>
          {" · "}
          <a className="underline" href="/auth/sign-in">
            Sign in
          </a>
        </p>
        <p className="text-sm text-muted-foreground">
          Expired or revoked invitations cannot be used. Do not put secrets in
          URLs beyond the single-use invite token delivered to you.
        </p>
      </MainContainer>
    );
  }

  return (
    <MainContainer className="space-y-8">
      <Breadcrumbs
        items={[{ href: "/", label: "Home" }, { label: "Join preview" }]}
      />
      <PageHeader
        eyebrow="Nonfunctional preview"
        title="Join preview"
        description="A walkthrough of the intended eligibility, assurance, conduct, and privacy steps. Community participant status is not a settled legal membership category. Identification documents are not assumed to be required for every role."
      />
      <DisclosureNotice title="Not accepting members" tone="caution">
        This demonstration does not enroll anyone, collect personal information, or
        record legally binding assent. Placeholder conduct and privacy text is not
        legally reviewed.
      </DisclosureNotice>
      <JoinWalkthrough />
    </MainContainer>
  );
}
