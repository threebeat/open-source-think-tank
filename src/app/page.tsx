import type { Metadata } from "next";
import Link from "next/link";

import { DisclosureNotice } from "@/components/DisclosureNotice";
import { PageHeader } from "@/components/PageHeader";
import { ProcessStepper } from "@/components/ProcessStepper";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { MainContainer } from "@/components/layout/MainContainer";
import { buttonVariants } from "@/components/ui/button";
import { institutionalProcessSteps } from "@/lib/process-steps";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Home",
  description:
    "Follow an idea from community discussion to collective action — synthetic computational-democracy demonstration.",
};

export default function Home() {
  return (
    <MainContainer className="space-y-10">
      <Breadcrumbs items={[{ label: "Home" }]} />
      <PageHeader
        eyebrow="Proposed project · Phase 4 demonstration"
        title="Open-Source Think Tank"
        description="Follow an idea from community discussion to collective action."
        actions={
          <>
            <Link
              href="/demo"
              className={cn(buttonVariants({ size: "lg" }), "min-h-11 px-4")}
            >
              Start the guided journey
            </Link>
            <Link
              href="/idea-commons"
              className={cn(
                buttonVariants({ variant: "outline", size: "lg" }),
                "min-h-11 px-4",
              )}
            >
              Explore Idea Commons
            </Link>
            <Link
              href="/formal-topics"
              className={cn(
                buttonVariants({ variant: "outline", size: "lg" }),
                "min-h-11 px-4",
              )}
            >
              Formal Topic Pipeline
            </Link>
          </>
        }
      />

      <p className="max-w-3xl text-base leading-7 text-muted-foreground">
        Idea Commons → qualified proposal → Public Input → transparent agenda
        qualification → deliberation → policy recommendation → member actions →
        review and follow-up. Preference, agreement, and evidence quality stay
        separate. Algorithms organize or recommend; humans decide.
      </p>

      <DisclosureNotice title="Demonstration of a proposed project" tone="caution">
        All people, evidence, votes, and decisions in this prototype are synthetic.
        Public-demo mode never connects to Pol.is or the gated alpha datastore.
        Idea Commons is informal; the Formal Topic Pipeline contains only
        gate-passed topics.
      </DisclosureNotice>

      <section className="space-y-4">
        <h2 className="font-heading text-2xl text-foreground">
          The democratic journey
        </h2>
        <ProcessStepper
          steps={institutionalProcessSteps}
          currentStepId="idea-commons"
        />
      </section>
    </MainContainer>
  );
}
