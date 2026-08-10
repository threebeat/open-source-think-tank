import { redirect } from "next/navigation";

import { DisclosureNotice } from "@/components/DisclosureNotice";
import { PageHeader } from "@/components/PageHeader";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { MainContainer } from "@/components/layout/MainContainer";
import { resolveAppMode } from "@/lib/env/app-mode";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Verification status",
  description:
    "Account-private verification status (not ideology, credibility, or expertise).",
};

export default async function AccountVerificationPage() {
  if (resolveAppMode() !== "gated") {
    redirect("/");
  }

  const { requireGatedSession } = await import("@/lib/auth/guard");
  const gated = await requireGatedSession();
  if (!gated.ok) {
    redirect("/auth/sign-in");
  }

  const { getGatedDb } = await import("@/lib/auth/runtime");
  const { listAccountVerificationStatus, describeAssuranceLadder } =
    await import("@/lib/verification/status");
  const statuses = await listAccountVerificationStatus(
    getGatedDb(),
    gated.session.accountId,
  );
  const ladder = describeAssuranceLadder();

  return (
    <MainContainer className="space-y-8">
      <Breadcrumbs
        items={[
          { href: "/", label: "Home" },
          { href: "/account", label: "Account" },
          { label: "Verification" },
        ]}
      />
      <PageHeader
        eyebrow="Account-private"
        title="Verification status"
        description="Status only. This ladder is not proof of ideology, credibility, or policy expertise, and does not assume government ID."
      />
      <DisclosureNotice title="Counsel gates" tone="caution">
        Eligibility, residency, and legal-identity production claims remain
        counsel-blocked. Artifact bytes are not stored on this page.
      </DisclosureNotice>

      <section className="space-y-3">
        <h2 className="font-serif text-lg">Your cases</h2>
        {statuses.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No verification cases yet.
          </p>
        ) : (
          <ul className="space-y-3 text-sm">
            {statuses.map((row) => (
              <li key={`${row.kind}-${row.caseId}`}>
                <span className="font-medium">{row.kind}</span>
                {" · "}
                {row.status}
                {row.expiresAt ? ` · expires ${row.expiresAt}` : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="font-serif text-lg">Assurance ladder (engineering)</h2>
        <ul className="space-y-2 text-sm">
          {ladder.map((level) => (
            <li key={level.id}>
              <span className="font-medium">
                {level.id} — {level.label}
              </span>
              {level.requiredKinds.length > 0
                ? `: ${level.requiredKinds.join(", ")}`
                : ": none"}
            </li>
          ))}
        </ul>
      </section>
    </MainContainer>
  );
}
