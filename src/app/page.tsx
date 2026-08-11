import type { Metadata } from "next";
import Link from "next/link";

import { DisclosureNotice } from "@/components/DisclosureNotice";
import { MetricWithExplanation } from "@/components/MetricWithExplanation";
import { PageHeader } from "@/components/PageHeader";
import { ProcessStepper } from "@/components/ProcessStepper";
import { StageBadge } from "@/components/StageBadge";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { MainContainer } from "@/components/layout/MainContainer";
import { buttonVariants } from "@/components/ui/button";
import { getFeaturedTopic } from "@/domain/selectors";
import { fixtureCatalog } from "@/fixtures";
import { oneSentenceMethod } from "@/lib/process-content";
import { institutionalProcessSteps } from "@/lib/process-steps";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Home",
  description:
    "Demonstration homepage for a proposed open-source think tank using synthetic data only.",
};

export default function Home() {
  const featuredTopic = getFeaturedTopic(fixtureCatalog);

  return (
    <MainContainer className="space-y-10">
      <Breadcrumbs items={[{ label: "Home" }]} />
      <PageHeader
        eyebrow="Proposed project · Phase 1 prototype"
        title="Open-Source Think Tank"
        description="A public, nonpartisan process for examining policy questions with open evidence, public input from eligible/invited participants, clear public criteria, capacity-limited policy drafting, and published recommendations (not enacted law)."
        actions={
          <>
            <Link
              href="/demo"
              className={cn(buttonVariants({ size: "lg" }), "min-h-11 px-4")}
            >
              Explore the demo
            </Link>
            <Link
              href="/process"
              className={cn(
                buttonVariants({ variant: "outline", size: "lg" }),
                "min-h-11 px-4",
              )}
            >
              View the process
            </Link>
            <Link
              href="/join"
              className={cn(
                buttonVariants({ variant: "outline", size: "lg" }),
                "min-h-11 px-4",
              )}
            >
              How Joining Works
            </Link>
          </>
        }
      />

      <p className="max-w-3xl text-base leading-7 text-muted-foreground">
        <span className="font-medium text-foreground">Method in one sentence: </span>
        {oneSentenceMethod}
      </p>

      <DisclosureNotice title="Demonstration of a proposed project" tone="caution">
        All people, evidence, votes, and decisions in this prototype are synthetic.
        It does not claim that an organization is incorporated, tax-exempt, legally
        reviewed, or accepting members. Preference, cross-group agreement, and
        evidence quality stay separate. Algorithms organize or recommend; humans
        decide.
      </DisclosureNotice>

      <section className="space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="font-heading text-2xl text-foreground">
            Featured synthetic topic
          </h2>
          <StageBadge stage={featuredTopic.stage} />
        </div>
        <p className="max-w-3xl text-base leading-7 text-muted-foreground">
          {featuredTopic.title}. {featuredTopic.question}
        </p>
        <div className="grid gap-4 md:grid-cols-2">
          <MetricWithExplanation
            label="Current stage"
            value={featuredTopic.stage}
            explanation="Stage labels describe institutional progress. They are not popularity scores or proof of evidence quality."
          />
          <MetricWithExplanation
            label="Participation note"
            value="Synthetic cohort"
            explanation={
              featuredTopic.participationSummary ??
              "Participants in this demonstration are fictional."
            }
          />
        </div>
        <Link
          href="/topics"
          className="inline-flex min-h-11 items-center text-sm font-medium text-primary underline-offset-4 hover:underline"
        >
          Browse topics (shell route)
        </Link>
      </section>

      <section className="space-y-4">
        <h2 className="font-heading text-2xl text-foreground">
          How the Process Works
        </h2>
        <ProcessStepper
          steps={institutionalProcessSteps}
          currentStepId="decision"
        />
      </section>
    </MainContainer>
  );
}
