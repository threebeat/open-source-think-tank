import type { Metadata } from "next";

import { PageHeader } from "@/components/PageHeader";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { MainContainer } from "@/components/layout/MainContainer";
import { TransparencyCenter } from "@/features/transparency/TransparencyCenter";
import { listAuditEvents } from "@/domain/selectors";
import { fixtureCatalog } from "@/fixtures";

export const metadata: Metadata = {
  title: "Transparency",
  description:
    "Synthetic audit feed, governance map, method registry, and open-versus-protected data guidance.",
};

export default function TransparencyPage() {
  return (
    <MainContainer className="space-y-10">
      <Breadcrumbs
        items={[{ href: "/", label: "Home" }, { label: "Transparency" }]}
      />
      <PageHeader
        eyebrow="Public transparency center"
        title="Transparency"
        description="Audit events, method versions, governance relationships, and what stays protected even under openness commitments."
      />
      <TransparencyCenter auditEvents={listAuditEvents(fixtureCatalog)} />
    </MainContainer>
  );
}
