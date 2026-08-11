import type { Metadata } from "next";

import { PageHeader } from "@/components/PageHeader";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { MainContainer } from "@/components/layout/MainContainer";
import { TransparencyCenter } from "@/features/transparency/TransparencyCenter";
import { listAuditEvents } from "@/domain/selectors";
import { fixtureCatalog } from "@/fixtures";
import { resolveAppMode } from "@/lib/env/app-mode";

export const metadata: Metadata = {
  title: "The Public Record",
  description:
    "Demonstration activity history, who does what, methods and updates, and what we publish versus what we protect.",
};

export const dynamic = "force-dynamic";

export default async function TransparencyPage() {
  let auditEvents = listAuditEvents(fixtureCatalog);

  if (resolveAppMode() === "gated") {
    try {
      const { getGatedDb } = await import("@/lib/auth/runtime");
      const { listPublicAuditFeed } = await import("@/lib/audit/ledger");
      const projected = await listPublicAuditFeed(getGatedDb(), 50);
      auditEvents = projected.map((row) => ({
        id: row.id,
        at: row.at,
        actorRole: "public-projection",
        action: row.action,
        subjectType: row.subjectType,
        subjectId: "redacted",
        summary: row.summary,
        synthetic: true,
      }));
    } catch {
      auditEvents = [];
    }
  }

  return (
    <MainContainer className="space-y-10">
      <Breadcrumbs
        items={[{ href: "/", label: "Home" }, { label: "The Public Record" }]}
      />
      <PageHeader
        eyebrow="The Public Record"
        title="The Public Record"
        description="Demonstration activity history, method versions, who does what, and what stays protected even under openness commitments."
      />
      <TransparencyCenter auditEvents={auditEvents} />
    </MainContainer>
  );
}
