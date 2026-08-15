import type { Metadata } from "next";
import Link from "next/link";

import { DisclosureNotice } from "@/components/DisclosureNotice";
import { PageHeader } from "@/components/PageHeader";
import { MainContainer } from "@/components/layout/MainContainer";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Commonhall",
  description:
    "A proposed computational-democracy digital town hall. Tour the synthetic demo or create an account in the gated pre-alpha.",
};

export default function Home() {
  return (
    <MainContainer className="space-y-10">
      <PageHeader
        eyebrow="Working name · Commonhall v2"
        title="Commonhall"
        description="A proposed public, nonpartisan digital town hall. Open community discussion, structured consultation, a public Chamber, and an organization Council stay on separate axes — algorithms organize, named humans decide."
        actions={
          <>
            <Link
              href="/demo"
              className={cn(buttonVariants({ size: "lg" }), "min-h-11 px-4")}
            >
              Tour the demo
            </Link>
            <Link
              href="/join"
              className={cn(
                buttonVariants({ variant: "outline", size: "lg" }),
                "min-h-11 px-4",
              )}
            >
              Create an account
            </Link>
            <Link
              href="/auth/sign-in"
              className={cn(
                buttonVariants({ variant: "outline", size: "lg" }),
                "min-h-11 px-4",
              )}
            >
              Sign in
            </Link>
            <Link
              href="/about"
              className={cn(
                buttonVariants({ variant: "outline", size: "lg" }),
                "min-h-11 px-4",
              )}
            >
              About
            </Link>
          </>
        }
      />

      <DisclosureNotice title="Pre-alpha demonstration" tone="caution">
        This is not a live town hall. People, topics, and outcomes you will see
        are synthetic. Hosted Pol.is is unavailable. Community membership here
        is organization service membership in a seeded synthetic hall — not
        nonprofit membership, statutory membership, or government standing.
      </DisclosureNotice>

      <section className="space-y-3" aria-labelledby="mission-heading">
        <h2 id="mission-heading" className="font-heading text-2xl text-foreground">
          Mission (proposed)
        </h2>
        <p className="max-w-3xl text-base leading-7 text-muted-foreground">
          Build a public process for examining shared questions with open
          evidence, community consultation, published criteria, and accountable
          recommendations. Preference, cross-group agreement, evidence quality,
          Chamber verdicts, and Council recommendations remain visibly separate.
        </p>
      </section>

      <section className="space-y-3" aria-labelledby="how-heading">
        <h2 id="how-heading" className="font-heading text-2xl text-foreground">
          How the hall works
        </h2>
        <ol className="max-w-3xl list-decimal space-y-2 pl-5 text-base leading-7 text-muted-foreground">
          <li>Commons: formal categories first, then informal discussion.</li>
          <li>Qualification: published criteria, not moderator agreement.</li>
          <li>Consultation: fixture aggregates only in this pre-alpha.</li>
          <li>Chamber: appointed deliberation with a full roll call.</li>
          <li>Council: intake, recommendations, and public records.</li>
        </ol>
      </section>
    </MainContainer>
  );
}
