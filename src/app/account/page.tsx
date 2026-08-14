import { redirect } from "next/navigation";
import Link from "next/link";

import { DisclosureNotice } from "@/components/DisclosureNotice";
import { PageHeader } from "@/components/PageHeader";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { MainContainer } from "@/components/layout/MainContainer";
import { requireMemberSession } from "@/lib/auth/guard";
import { PRE_ALPHA_ASSIGNMENT_EXPLANATION } from "@/lib/auth/community-standards";
import { resolveAppMode } from "@/lib/env/app-mode";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Account",
  description: "Commonhall account, membership, and privacy controls.",
};

export default async function AccountPage() {
  if (resolveAppMode() !== "gated") {
    redirect("/");
  }

  const session = await requireMemberSession();

  return (
    <MainContainer className="space-y-8">
      <Breadcrumbs
        items={[{ href: "/", label: "Home" }, { label: "Account" }]}
      />
      <PageHeader
        eyebrow="Community account"
        title="Your account"
        description="Community membership is organization service membership in this pre-alpha synthetic hall. It is not nonprofit or statutory membership."
      />
      <DisclosureNotice title="Assignment explanation" tone="neutral">
        {PRE_ALPHA_ASSIGNMENT_EXPLANATION}
      </DisclosureNotice>
      <dl className="grid gap-4 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-muted-foreground">Lifecycle state</dt>
          <dd className="font-medium">{session.lifecycleState}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Synthetic pre-alpha row</dt>
          <dd className="font-medium">{session.synthetic ? "yes" : "no"}</dd>
        </div>
      </dl>
      <nav aria-label="Account sections" className="flex flex-wrap gap-4 text-sm">
        <Link className="underline" href="/account/profile">
          Profile
        </Link>
        <Link className="underline" href="/account/membership">
          Membership
        </Link>
        <Link className="underline" href="/account/history">
          History
        </Link>
        <Link className="underline" href="/account/privacy">
          Privacy
        </Link>
        <Link className="underline" href="/account/onboarding">
          Onboarding
        </Link>
        <Link className="underline" href="/account/assent">
          Assent
        </Link>
      </nav>
    </MainContainer>
  );
}
