import type { Metadata } from "next";

import { DisclosureNotice } from "@/components/DisclosureNotice";
import { PageHeader } from "@/components/PageHeader";
import { ProcessStepper } from "@/components/ProcessStepper";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { MainContainer } from "@/components/layout/MainContainer";
import { institutionalProcessSteps } from "@/lib/process-steps";
import { processStages } from "@/lib/process-content";

export const metadata: Metadata = {
  title: "How the Process Works",
  description:
    "Seven-stage explanation of how the proposed process works, using synthetic demonstration framing only.",
};

export default function ProcessPage() {
  return (
    <MainContainer className="space-y-10">
      <Breadcrumbs
        items={[{ href: "/", label: "Home" }, { label: "Process" }]}
      />
      <PageHeader
        eyebrow="How the Process Works"
        title="How the process is supposed to work"
        description="Seven stages from how joining works through the public record. This is a demonstration of a proposed project. Algorithms organize or recommend; humans decide. The governing board’s precise legal authority is pending counsel review."
      />

      <DisclosureNotice title="Governing board authority unresolved" tone="caution">
        The Policy Council may recommend a position. Whether any crowd or council
        decision can bind the legal governing board — and what explanation is
        required when the board departs — remains a counsel question. This
        prototype does not invent that answer.
      </DisclosureNotice>

      <ProcessStepper steps={institutionalProcessSteps} />

      <div className="space-y-6">
        {processStages.map((stage, index) => (
          <section
            key={stage.id}
            id={stage.id}
            className="rounded-md border border-border bg-surface p-5 sm:p-6"
          >
            <p className="text-xs font-medium tracking-wide text-primary uppercase">
              Stage {index + 1}
            </p>
            <h2 className="mt-2 font-heading text-2xl text-foreground">
              {stage.title}
            </h2>
            <dl className="mt-4 grid gap-4 sm:grid-cols-2">
              <div>
                <dt className="text-sm font-medium text-foreground">
                  Who participates
                </dt>
                <dd className="mt-1 text-sm leading-6 text-muted-foreground">
                  {stage.whoParticipates}
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-foreground">
                  What happens
                </dt>
                <dd className="mt-1 text-sm leading-6 text-muted-foreground">
                  {stage.whatHappens}
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-foreground">
                  What is produced
                </dt>
                <dd className="mt-1 text-sm leading-6 text-muted-foreground">
                  {stage.whatIsProduced}
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-foreground">
                  What becomes public
                </dt>
                <dd className="mt-1 text-sm leading-6 text-muted-foreground">
                  {stage.whatBecomesPublic}
                </dd>
              </div>
            </dl>
          </section>
        ))}
      </div>
    </MainContainer>
  );
}
