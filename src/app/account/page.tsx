import { redirect } from "next/navigation";

import { DisclosureNotice } from "@/components/DisclosureNotice";
import { PageHeader } from "@/components/PageHeader";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { MainContainer } from "@/components/layout/MainContainer";
import { resolveAppMode } from "@/lib/env/app-mode";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Account",
  description: "Gated account holder status (invite-only foundation).",
};

export default async function AccountPage() {
  if (resolveAppMode() !== "gated") {
    redirect("/");
  }

  const { requireGatedSession } = await import("@/lib/auth/guard");
  const gated = await requireGatedSession();
  if (!gated.ok) {
    redirect("/auth/sign-in");
  }

  const { session } = gated;

  return (
    <MainContainer className="space-y-8">
      <Breadcrumbs
        items={[{ href: "/", label: "Home" }, { label: "Account" }]}
      />
      <PageHeader
        eyebrow="Invite-only foundation"
        title="Account holder status"
        description="Authentication does not grant institutional active capabilities. Activation is owned by later work packages after assent and verification."
      />
      <DisclosureNotice title="Pending institutional activation" tone="caution">
        This account is authenticated for onboarding only. Community participant
        status is not a settled legal membership category.
      </DisclosureNotice>
      <dl className="grid gap-4 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-muted-foreground">Lifecycle state</dt>
          <dd className="font-medium">{session.lifecycleState}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Synthetic fixture</dt>
          <dd className="font-medium">{session.synthetic ? "yes" : "no"}</dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="text-muted-foreground">Account id</dt>
          <dd className="font-mono text-xs break-all">{session.accountId}</dd>
        </div>
      </dl>
    </MainContainer>
  );
}
