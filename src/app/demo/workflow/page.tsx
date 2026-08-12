import type { Metadata } from "next";
import { Suspense } from "react";

import { DisclosureNotice } from "@/components/DisclosureNotice";
import { PageHeader } from "@/components/PageHeader";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { MainContainer } from "@/components/layout/MainContainer";
import { WorkflowPreview } from "@/features/demo/workflow/WorkflowPreview";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Workflow practice",
  description:
    "Interactive synthetic practice for recommending a topic and contributing a source, plus secondary fixture snapshots of staff and visitor states.",
};

export default function DemoWorkflowPage() {
  return (
    <MainContainer className="space-y-10">
      <Breadcrumbs
        items={[
          { href: "/", label: "Home" },
          { href: "/demo", label: "Guided demo" },
          { label: "Workflow practice" },
        ]}
      />
      <PageHeader
        eyebrow="Public demonstration"
        title="Workflow practice"
        description="Operate a local topic-recommendation practice and a source-security practice with fixture data. A secondary explorer still shows example staff and visitor snapshots for phone review."
      />
      <DisclosureNotice title="Synthetic interaction prototype" tone="caution">
        Topic recommendation here is local practice only — not a live gated
        intake. Source practice uses the shared https URL policy without fetching
        remote content. Nothing on this page writes to a participant datastore.
      </DisclosureNotice>
      <Suspense
        fallback={
          <p className="text-sm text-muted-foreground">
            Loading workflow practice…
          </p>
        }
      >
        <WorkflowPreview />
      </Suspense>
    </MainContainer>
  );
}
