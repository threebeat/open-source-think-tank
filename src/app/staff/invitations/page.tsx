import { redirect } from "next/navigation";

import { DisclosureNotice } from "@/components/DisclosureNotice";
import { PageHeader } from "@/components/PageHeader";
import { IssueInvitationForm } from "@/components/staff/IssueInvitationForm";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { MainContainer } from "@/components/layout/MainContainer";
import { resolveAppMode } from "@/lib/env/app-mode";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Staff invitations",
  description: "Issue single-use invitation links for the gated alpha.",
};

export default async function StaffInvitationsPage() {
  if (resolveAppMode() !== "gated") {
    redirect("/");
  }

  const { requireGatedSession } = await import("@/lib/auth/guard");
  const gated = await requireGatedSession();
  if (!gated.ok) {
    redirect("/auth/sign-in");
  }

  const { getGatedDb } = await import("@/lib/auth/runtime");
  const { listIssuedInvitations } = await import("@/lib/invites/issue");
  const listed = await listIssuedInvitations(
    getGatedDb(),
    gated.session.accountId,
  );

  return (
    <MainContainer className="space-y-8">
      <Breadcrumbs
        items={[
          { href: "/", label: "Home" },
          { href: "/staff/onboarding", label: "Staff" },
          { label: "Invitations" },
        ]}
      />
      <PageHeader
        eyebrow="Staff-restricted"
        title="Issue invitations"
        description="Create a single-use, expiring invitation. Only the token hash is stored. The raw link is shown once."
      />
      <DisclosureNotice title="Capture-only email" tone="caution">
        Transactional email remains capture-only. Deliver the acceptance link
        yourself. This page does not contact an external mail provider.
      </DisclosureNotice>

      {!listed.ok ? (
        <p className="text-sm text-destructive" role="alert">
          {listed.error}
        </p>
      ) : (
        <>
          <IssueInvitationForm />
          <section className="space-y-3" aria-labelledby="invite-list-heading">
            <h2
              id="invite-list-heading"
              className="font-heading text-xl text-foreground"
            >
              Recent invitations
            </h2>
            <p className="text-sm text-muted-foreground">
              Contacts are redacted. Token hashes and raw tokens are never
              listed.
            </p>
            <ul className="divide-y divide-border rounded-md border border-border">
              {listed.value.length === 0 ? (
                <li className="px-4 py-3 text-sm text-muted-foreground">
                  No invitations yet.
                </li>
              ) : (
                listed.value.map((row) => (
                  <li
                    key={row.invitationId}
                    className="grid gap-1 px-4 py-3 text-sm sm:grid-cols-4"
                  >
                    <span>{row.contactRedacted}</span>
                    <span>
                      {row.kind} · {row.status}
                      {row.expired ? " · expired" : ""}
                    </span>
                    <span className="text-muted-foreground">
                      {new Date(row.expiresAt).toLocaleString()}
                    </span>
                    <span className="text-muted-foreground">
                      {row.synthetic ? "synthetic" : "operational"}
                    </span>
                  </li>
                ))
              )}
            </ul>
          </section>
        </>
      )}
    </MainContainer>
  );
}
