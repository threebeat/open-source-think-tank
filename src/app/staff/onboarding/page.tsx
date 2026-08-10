import { redirect } from "next/navigation";

import { DisclosureNotice } from "@/components/DisclosureNotice";
import { PageHeader } from "@/components/PageHeader";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { MainContainer } from "@/components/layout/MainContainer";
import { resolveAppMode } from "@/lib/env/app-mode";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Staff onboarding",
  description: "Redacted invitation and onboarding queues (staff-restricted).",
};

export default async function StaffOnboardingPage() {
  if (resolveAppMode() !== "gated") {
    redirect("/");
  }

  const { requireGatedSession } = await import("@/lib/auth/guard");
  const gated = await requireGatedSession();
  if (!gated.ok) {
    redirect("/auth/sign-in");
  }

  const { getGatedDb } = await import("@/lib/auth/runtime");
  const { listStaffInvitations, listStaffOnboardingStatuses } = await import(
    "@/lib/onboarding/staff"
  );
  const db = getGatedDb();
  const [onboarding, invitations] = await Promise.all([
    listStaffOnboardingStatuses(db, gated.session.accountId),
    listStaffInvitations(db, gated.session.accountId),
  ]);

  if (!onboarding.ok) {
    return (
      <MainContainer className="space-y-6">
        <PageHeader
          eyebrow="Staff-restricted"
          title="Onboarding queues"
          description="You do not have permission to view staff onboarding status."
        />
        <p className="text-sm text-destructive" role="alert">
          {onboarding.error}
        </p>
      </MainContainer>
    );
  }
  if (!invitations.ok) {
    return (
      <MainContainer className="space-y-6">
        <PageHeader
          eyebrow="Staff-restricted"
          title="Onboarding queues"
          description="You do not have permission to view staff onboarding status."
        />
        <p className="text-sm text-destructive" role="alert">
          {invitations.error}
        </p>
      </MainContainer>
    );
  }

  return (
    <MainContainer className="space-y-8">
      <Breadcrumbs
        items={[
          { href: "/", label: "Home" },
          { href: "/staff/onboarding", label: "Staff" },
          { label: "Onboarding" },
        ]}
      />
      <PageHeader
        eyebrow="Staff-restricted"
        title="Invitation and onboarding status"
        description="Redacted queues only. Contact channels are masked; verification artifacts are never shown."
      />
      <DisclosureNotice title="Not a membership register" tone="caution">
        Rows describe account holders in onboarding — not statutory members.
      </DisclosureNotice>

      <section className="space-y-3">
        <h2 className="font-serif text-lg">Pending onboarding</h2>
        {onboarding.value.length === 0 ? (
          <p className="text-sm text-muted-foreground">No pending accounts.</p>
        ) : (
          <ul className="space-y-3 text-sm">
            {onboarding.value.map((row) => (
              <li key={row.accountId}>
                <span className="font-mono text-xs">{row.accountId}</span>
                {" · "}
                {row.contactRedacted}
                {" · "}
                {row.stepSummary}
                {row.synthetic ? " · synthetic" : ""}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="font-serif text-lg">Open invitations</h2>
        {invitations.value.length === 0 ? (
          <p className="text-sm text-muted-foreground">No open invitations.</p>
        ) : (
          <ul className="space-y-3 text-sm">
            {invitations.value.map((row) => (
              <li key={row.invitationId}>
                {row.contactRedacted}
                {" · "}
                {row.status}
                {row.expired ? " · expired" : ""}
                {" · expires "}
                {row.expiresAt}
              </li>
            ))}
          </ul>
        )}
      </section>
    </MainContainer>
  );
}
