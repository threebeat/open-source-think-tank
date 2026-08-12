import type { Metadata } from "next";
import Link from "next/link";

import { DisclosureNotice } from "@/components/DisclosureNotice";
import { PageHeader } from "@/components/PageHeader";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { MainContainer } from "@/components/layout/MainContainer";
import { buttonVariants } from "@/components/ui/button";
import { GuidedDemo } from "@/features/demo/GuidedDemo";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Guided demo",
  description:
    "Five-to-eight-minute synthetic walkthrough from how joining works through recommendation & council vote and the public record.",
};

export default function DemoPage() {
  return (
    <MainContainer className="space-y-10">
      <Breadcrumbs
        items={[{ href: "/", label: "Home" }, { label: "Guided demo" }]}
      />
      <PageHeader
        eyebrow="Presentation mode"
        title="Guided demo"
        description="A short presenter-led path through the Cedar River synthetic scenario. Reset restores local demo state only; no server data is stored."
      />
      <DisclosureNotice title="Operational workflow feature tour" tone="neutral">
        <p className="mb-3">
          Explore synthetic snapshots of submission, review, revision,
          comparison, and moderation without live accounts or workspace APIs.
        </p>
        <Link
          href="/demo/workflow"
          className={cn(buttonVariants({ size: "lg" }), "min-h-11 px-4")}
        >
          Implemented feature tour
        </Link>
      </DisclosureNotice>
      <GuidedDemo />
    </MainContainer>
  );
}
