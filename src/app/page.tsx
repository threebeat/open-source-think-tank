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
import { institutionalProcessSteps } from "@/lib/process-steps";
import { cn } from "@/lib/utils";

export default function Home() {
  const featuredTopic = getFeaturedTopic(fixtureCatalog);

  return (
    <MainContainer className="space-y-10">
      <Breadcrumbs items={[{ label: "Home" }]} />
      <PageHeader
        eyebrow="Proposed project · Phase 1 prototype"
        title="Open-Source Think Tank"
        description="A demonstration of how a nonpartisan, evidence-aware public process could move from open consultation to a published decision record. All people, evidence, votes, and decisions in this prototype are synthetic. This is a demonstration of a proposed project. It does not claim that an organization is incorporated, tax-exempt, legally reviewed, or accepting members."
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
          </>
        }
      />

      <DisclosureNotice title="Synthetic data only" tone="caution">
        Preference, cross-group agreement, and evidence quality stay separate.
        Algorithms organize or recommend; humans decide. Membership status remains
        an unresolved legal question.
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
      </section>

      <section className="space-y-4">
        <h2 className="font-heading text-2xl text-foreground">
          Institutional pipeline
        </h2>
        <ProcessStepper
          steps={institutionalProcessSteps}
          currentStepId="decision"
        />
      </section>
    </MainContainer>
  );
}
