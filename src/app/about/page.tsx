import type { Metadata } from "next";
import Link from "next/link";

import { DisclosureNotice } from "@/components/DisclosureNotice";
import { PageHeader } from "@/components/PageHeader";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { MainContainer } from "@/components/layout/MainContainer";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "About",
  description:
    "Project framing for the Phase 1 Open-Source Think Tank demonstration: mission, openness commitments, limitations, and a contact placeholder. Synthetic data only.",
};

export default function AboutPage() {
  return (
    <MainContainer className="space-y-10">
      <Breadcrumbs items={[{ href: "/", label: "Home" }, { label: "About" }]} />
      <PageHeader
        eyebrow="Proposed project · Phase 1"
        title="About this demonstration"
        description="A browser prototype of a proposed open-source think tank. It shows how joining works, fact-check & research, public input, deciding what moves forward, state-level policy drafting, recommendation & council vote, and the public record could fit together—using synthetic data only."
        actions={
          <>
            <Link
              href="/demo"
              className={cn(buttonVariants({ size: "lg" }), "min-h-11 px-4")}
            >
              Open guided demo
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

      <DisclosureNotice title="Not an operating organization" tone="caution">
        This site does not claim incorporation, tax exemption, legal review, or
        membership acceptance. Placeholder conduct and privacy language is not
        approved terms. Formation and board authority remain counsel questions.
      </DisclosureNotice>

      <section className="space-y-3" aria-labelledby="mission-heading">
        <h2 id="mission-heading" className="font-heading text-2xl text-foreground">
          Mission (proposed)
        </h2>
        <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
          Build a public, nonpartisan process for examining policy questions with
          open evidence, public input from eligible/invited participants, public
          criteria, capacity-limited policy drafting, and published recommendations
          (not enacted law)—so that preference, cross-group agreement, and research
          quality stay visibly separate, and no algorithm silently becomes the
          institution.
        </p>
      </section>

      <section className="space-y-3" aria-labelledby="commitments-heading">
        <h2
          id="commitments-heading"
          className="font-heading text-2xl text-foreground"
        >
          Openness commitments in this prototype
        </h2>
        <ul className="max-w-3xl list-disc space-y-2 pl-5 text-sm leading-6 text-muted-foreground">
          <li>
            Research review status stays independent of popularity and consensus,
            and is not proof that a claim is true.
          </li>
          <li>
            Areas of agreement and disagreement are labeled neutrally; the
            interface does not infer or display participant ideology.
          </li>
          <li>
            Algorithms and fixtures organize or recommend; humans record
            institutional decisions, with overrides visible when applicable.
          </li>
          <li>
            Recommendation & council vote records keep majority rationale and
            minority reports at equal structural prominence (not board adoption).
          </li>
          <li>
            The public record means explainable institutional action, not
            publication of identity or granular political-opinion histories.
          </li>
          <li>
            Unresolved legal and governance questions are listed rather than
            invented—see repository docs{" "}
            <code className="text-foreground">docs/open-questions.md</code> and{" "}
            <code className="text-foreground">docs/legal-questions.md</code>.
          </li>
        </ul>
      </section>

      <section className="space-y-3" aria-labelledby="limitations-heading">
        <h2
          id="limitations-heading"
          className="font-heading text-2xl text-foreground"
        >
          Phase 1 limitations
        </h2>
        <ul className="max-w-3xl list-disc space-y-2 pl-5 text-sm leading-6 text-muted-foreground">
          <li>
            All people, organizations, evidence, votes, consultations, and decisions
            are synthetic fixtures.
          </li>
          <li>
            No real accounts, database, Pol.is account, payments, analytics, AI APIs,
            or identity-verification vendors are connected.
          </li>
          <li>
            Join and assent controls are nonfunctional; no form transmits personal
            data.
          </li>
          <li>
            Policy Council outputs are recommendations only. Governing-board adoption
            authority is intentionally unresolved.
          </li>
          <li>
            The demonstration cohort is not a representative sample of any
            population.
          </li>
        </ul>
      </section>

      <section className="space-y-3" aria-labelledby="contact-heading">
        <h2 id="contact-heading" className="font-heading text-2xl text-foreground">
          Contact placeholder
        </h2>
        <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
          Phase 1 does not publish a production contact channel, intake form, or
          mailing list. Collaborators should use the project repository and the
          guided demo’s audience stops (legal, technical, and prospective board) to
          critique the design. Do not send identity documents, membership requests,
          or donations through this demonstration.
        </p>
        <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
          Related in-app pages:{" "}
          <Link
            href="/transparency"
            className="font-medium text-primary underline underline-offset-4 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
          >
            The Public Record
          </Link>
          {" · "}
          <Link
            href="/join"
            className="font-medium text-primary underline underline-offset-4 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
          >
            How Joining Works
          </Link>
          .
        </p>
      </section>
    </MainContainer>
  );
}
