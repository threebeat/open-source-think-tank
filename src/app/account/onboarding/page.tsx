import { redirect } from "next/navigation";

import { ActivateButton } from "@/components/onboarding/ActivateButton";
import { DisclosureNotice } from "@/components/DisclosureNotice";
import { PageHeader } from "@/components/PageHeader";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { MainContainer } from "@/components/layout/MainContainer";
import { resolveAppMode } from "@/lib/env/app-mode";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Onboarding",
  description:
    "Invite-only onboarding progress for account holders (not statutory membership).",
};

export default async function OnboardingPage() {
  if (resolveAppMode() !== "gated") {
    redirect("/join");
  }

  const { requireGatedSession } = await import("@/lib/auth/guard");
  const gated = await requireGatedSession();
  if (!gated.ok) {
    redirect("/auth/sign-in");
  }

  const { getGatedDb } = await import("@/lib/auth/runtime");
  const { getOnboardingProgress } = await import("@/lib/onboarding/progress");
  const progress = await getOnboardingProgress(
    getGatedDb(),
    gated.session.accountId,
  );
  if (!progress) {
    redirect("/auth/sign-in");
  }

  return (
    <MainContainer className="space-y-8">
      <Breadcrumbs
        items={[
          { href: "/", label: "Home" },
          { href: "/account", label: "Account" },
          { label: "Onboarding" },
        ]}
      />
      <PageHeader
        eyebrow="Invite-only"
        title="Onboarding progress"
        description="Complete assent and verification gates before activation. Preferred alpha-test synonym: delegate. “Member” language is allowed only when the alpha-test purpose is communicated clearly and continually."
      />
      <DisclosureNotice title="Alpha-test gates" tone="caution">
        Interim council clearances apply for the alpha test (ADR 0007): no
        geographical eligibility requirements; keep current electronic assent.
        Declining required documents blocks activation. Alpha-test data must be
        resettable after the test.
      </DisclosureNotice>

      <ol className="space-y-4">
        {progress.steps.map((step, index) => (
          <li key={step.id} className="border-b border-border pb-4">
            <p className="font-medium">
              {index + 1}. {step.title}{" "}
              <span className="text-sm font-normal text-muted-foreground">
                ({step.status})
              </span>
            </p>
            <p className="mt-1 text-sm text-muted-foreground">{step.why}</p>
            {step.detail ? <p className="mt-1 text-sm">{step.detail}</p> : null}
            {step.href && step.status !== "complete" ? (
              <p className="mt-2 text-sm">
                <a className="underline" href={step.href}>
                  Continue
                </a>
              </p>
            ) : null}
          </li>
        ))}
      </ol>

      {progress.blockingReasons.length > 0 &&
      progress.lifecycleState !== "active" ? (
        <div className="space-y-2" role="status">
          <h2 className="font-serif text-lg">Still required</h2>
          <ul className="list-disc space-y-1 pl-5 text-sm">
            {progress.blockingReasons.map((reason) => (
              <li key={reason}>{reason}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {progress.lifecycleState === "active" ? (
        <p className="text-sm">
          This account is already active.{" "}
          <a className="underline" href="/account">
            Return to account
          </a>
        </p>
      ) : (
        <ActivateButton disabled={!progress.canActivate} />
      )}
    </MainContainer>
  );
}
