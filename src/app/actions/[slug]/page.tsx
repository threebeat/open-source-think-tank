import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { PageHeader } from "@/components/PageHeader";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { MainContainer } from "@/components/layout/MainContainer";
import { MemberActionsPanel } from "@/features/member-actions/MemberActionsPanel";
import { memberActionOpportunities } from "@/fixtures/journey-catalog";

type Props = {
  params: Promise<{ slug: string }>;
};

export async function generateStaticParams() {
  const slugs = [...new Set(memberActionOpportunities.map((item) => item.topicSlug))];
  return slugs.map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  return {
    title: `Member actions · ${slug}`,
    description:
      "Synthetic post-decision member action opportunities with sponsorship and non-endorsement labels.",
  };
}

export default async function MemberActionsPage({ params }: Props) {
  const { slug } = await params;
  const opportunities = memberActionOpportunities.filter(
    (item) => item.topicSlug === slug,
  );
  if (opportunities.length === 0) {
    notFound();
  }

  return (
    <MainContainer className="space-y-10">
      <Breadcrumbs
        items={[
          { href: "/", label: "Home" },
          { href: `/formal-topics/${slug}`, label: "Formal topic" },
          { label: "Member actions" },
        ]}
      />
      <PageHeader
        eyebrow="After the recommendation"
        title="Member action opportunities"
        description="Examples of civic follow-through related to a synthetic institutional recommendation."
      />
      <MemberActionsPanel
        opportunities={opportunities}
        topicTitle={slug}
      />
      <p className="text-sm text-muted-foreground">
        Return to{" "}
        <Link
          href={`/formal-topics/${slug}`}
          className="font-medium text-primary underline-offset-4 hover:underline"
        >
          formal topic gate view
        </Link>{" "}
        or{" "}
        <Link
          href={`/decisions/${slug}`}
          className="font-medium text-primary underline-offset-4 hover:underline"
        >
          recommendation record
        </Link>
        .
      </p>
    </MainContainer>
  );
}
