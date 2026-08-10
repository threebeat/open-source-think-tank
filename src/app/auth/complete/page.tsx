import { redirect } from "next/navigation";

import { CompleteChallengeClient } from "@/components/auth/CompleteChallengeClient";
import { PageHeader } from "@/components/PageHeader";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { MainContainer } from "@/components/layout/MainContainer";
import { resolveAppMode } from "@/lib/env/app-mode";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Complete sign-in",
  description: "Complete a one-time authentication challenge.",
};

export default async function CompleteChallengePage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  if (resolveAppMode() !== "gated") {
    redirect("/join");
  }

  const params = await searchParams;
  const token = params.token?.trim() ?? "";

  return (
    <MainContainer className="space-y-8">
      <Breadcrumbs
        items={[{ href: "/", label: "Home" }, { label: "Complete sign-in" }]}
      />
      <PageHeader
        eyebrow="Invite-only"
        title="Complete sign-in"
        description="Finishing this one-time link establishes a session without granting active institutional capabilities."
      />
      <CompleteChallengeClient token={token} />
    </MainContainer>
  );
}
