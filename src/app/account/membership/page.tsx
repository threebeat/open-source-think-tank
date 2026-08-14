import { redirect } from "next/navigation";

import { MembershipCorrectionForm } from "@/components/account/MembershipCorrectionForm";
import { DisclosureNotice } from "@/components/DisclosureNotice";
import { PageHeader } from "@/components/PageHeader";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { MainContainer } from "@/components/layout/MainContainer";
import { PRE_ALPHA_ASSIGNMENT_EXPLANATION } from "@/lib/auth/community-standards";
import { requireMemberSession } from "@/lib/auth/guard";
import { resolveAppMode } from "@/lib/env/app-mode";
import { listMembershipsForAccount } from "@/lib/organizations/membership-repository";
import { getOrganization } from "@/lib/organizations/repository";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Membership",
  description: "Organization assignment and correction path.",
};

export default async function AccountMembershipPage() {
  if (resolveAppMode() !== "gated") {
    redirect("/");
  }
  const session = await requireMemberSession();
  const { getGatedDb } = await import("@/lib/auth/runtime");
  const db = getGatedDb();
  const memberships = await listMembershipsForAccount(db, session.accountId);
  const rows = await Promise.all(
    memberships.map(async (membership) => {
      const org = await getOrganization(db, membership.organizationId);
      return {
        ...membership,
        displayName: org?.displayName ?? membership.organizationId,
      };
    }),
  );

  return (
    <MainContainer className="space-y-8">
      <Breadcrumbs
        items={[
          { href: "/", label: "Home" },
          { href: "/account", label: "Account" },
          { label: "Membership" },
        ]}
      />
      <PageHeader
        eyebrow="Organization assignment"
        title="Membership"
        description="You have one active primary organization in this pre-alpha. Transfer is not available (V2-05)."
      />
      <DisclosureNotice title="Why this organization" tone="neutral">
        {PRE_ALPHA_ASSIGNMENT_EXPLANATION}
      </DisclosureNotice>
      <ul className="space-y-3 text-sm">
        {rows.map((row) => (
          <li key={`${row.organizationId}:${row.status}`} className="rounded-md border border-border p-4">
            <p className="font-medium">{row.displayName}</p>
            <p className="text-muted-foreground">
              Status {row.status}
              {row.isPrimary ? " · primary" : ""}
            </p>
          </li>
        ))}
      </ul>
      <MembershipCorrectionForm />
    </MainContainer>
  );
}
