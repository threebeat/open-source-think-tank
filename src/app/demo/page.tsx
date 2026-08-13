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
    "Follow an idea from community discussion to collective action — synthetic computational-democracy journey.",
};

export default function DemoPage() {
  return (
    <MainContainer className="space-y-10">
      <Breadcrumbs
        items={[{ href: "/", label: "Home" }, { label: "Guided demo" }]}
      />
      <PageHeader
        eyebrow="Primary demonstration"
        title="Guided demo"
        description="Follow an idea from community discussion to collective action. Reset restores local demo state only; no server data is stored."
      />
      <DisclosureNotice title="Primary vs secondary tools" tone="neutral">
        <p className="mb-3">
          This guided journey is the primary demo. The workflow snapshot explorer
          remains available as a secondary reference tool.
        </p>
        <Link
          href="/demo/workflow"
          className={cn(
            buttonVariants({ variant: "outline", size: "lg" }),
            "min-h-11 px-4",
          )}
        >
          Secondary: workflow tools
        </Link>
      </DisclosureNotice>
      <GuidedDemo />
    </MainContainer>
  );
}
