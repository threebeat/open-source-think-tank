import { redirect } from "next/navigation";

import { DisplayNameForm } from "@/components/account/DisplayNameForm";
import { DisclosureNotice } from "@/components/DisclosureNotice";
import { PageHeader } from "@/components/PageHeader";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { MainContainer } from "@/components/layout/MainContainer";
import { getAccountProfile } from "@/lib/auth/account-profile";
import { requireMemberSession } from "@/lib/auth/guard";
import { resolveAppMode } from "@/lib/env/app-mode";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Profile",
  description: "Commonhall account profile.",
};

export default async function AccountProfilePage() {
  if (resolveAppMode() !== "gated") {
    redirect("/");
  }
  const session = await requireMemberSession();
  const { getGatedDb } = await import("@/lib/auth/runtime");
  const profile = await getAccountProfile(getGatedDb(), session.accountId);
  if (!profile) {
    redirect("/auth/sign-in");
  }

  return (
    <MainContainer className="space-y-8">
      <Breadcrumbs
        items={[
          { href: "/", label: "Home" },
          { href: "/account", label: "Account" },
          { label: "Profile" },
        ]}
      />
      <PageHeader
        eyebrow="Account"
        title="Profile"
        description="Your identifier is stored locally on the gated service. It is not sent to an email vendor."
      />
      <DisclosureNotice title="Not a public identity" tone="neutral">
        Display names are account-private in this phase. Public projections do
        not include identifiers or passwords.
      </DisclosureNotice>
      <dl className="grid gap-4 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-muted-foreground">Identifier</dt>
          <dd className="font-medium break-all">{profile.identifier}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Enrollment</dt>
          <dd className="font-medium">{profile.enrollmentKind}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Lifecycle</dt>
          <dd className="font-medium">{profile.lifecycleState}</dd>
        </div>
      </dl>
      <DisplayNameForm initial={profile.displayName ?? ""} />
    </MainContainer>
  );
}
