import type { Metadata } from "next";
import { Suspense } from "react";

import { DisclosureNotice } from "@/components/DisclosureNotice";
import { PageHeader } from "@/components/PageHeader";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { MainContainer } from "@/components/layout/MainContainer";
import { WorkflowPreview } from "@/features/demo/workflow/WorkflowPreview";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Operational workflow preview",
  description:
    "Synthetic, fixture-backed feature tour of operational submission, review, revision, comparison, and moderation snapshots for the public demonstration.",
};

export default function DemoWorkflowPage() {
  return (
    <MainContainer className="space-y-10">
      <Breadcrumbs
        items={[
          { href: "/", label: "Home" },
          { href: "/demo", label: "Guided demo" },
          { label: "Operational workflow preview" },
        ]}
      />
      <PageHeader
        eyebrow="Public demonstration"
        title="Operational workflow preview"
        description="Phone-friendly synthetic snapshots of participant submission, independent review, revision history, evidence comparison, moderation visibility, and the visitor public projection. Nothing here is live operational state."
      />
      <DisclosureNotice title="Synthetic role preview" tone="caution">
        Labels such as “Synthetic role preview”, “Example held state”, and
        “Preview next state” describe fixture presentation only. This page does
        not claim that you held, hid, or restored content, and it is not an
        administrator console.
      </DisclosureNotice>
      <Suspense
        fallback={
          <p className="text-sm text-muted-foreground">
            Loading synthetic workflow preview…
          </p>
        }
      >
        <WorkflowPreview />
      </Suspense>
    </MainContainer>
  );
}
