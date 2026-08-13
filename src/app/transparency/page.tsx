import type { Metadata } from "next";
import Link from "next/link";

import { PageHeader } from "@/components/PageHeader";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { MainContainer } from "@/components/layout/MainContainer";
import { TransparencyCenter } from "@/features/transparency/TransparencyCenter";
import { listAuditEvents } from "@/domain/selectors";
import { fixtureCatalog } from "@/fixtures";
import {
  formalTopicGateViews,
  journeyTrajectories,
} from "@/fixtures/journey-catalog";
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
        description="Demonstration activity history, topic lineage, method versions, who does what, and what stays protected even under openness commitments."
      />
      <section className="space-y-4" aria-labelledby="lineage-heading">
        <h2 id="lineage-heading" className="font-heading text-2xl text-foreground">
          Topic lineage and trajectories
        </h2>
        <ul className="space-y-4">
          {journeyTrajectories.map((trajectory) => (
            <li
              key={trajectory.id}
              className="rounded-md border border-border px-4 py-3 text-sm"
            >
              <p className="text-xs font-medium tracking-wide text-primary uppercase">
                {trajectory.outcome}
              </p>
              <p className="mt-1 font-medium text-foreground">{trajectory.title}</p>
              <p className="mt-1 text-muted-foreground">{trajectory.summary}</p>
              <div className="mt-2 flex flex-wrap gap-3">
                <Link
                  href={`/idea-commons/${trajectory.ideaCommonsRootId}`}
                  className="font-medium text-primary underline-offset-4 hover:underline"
                >
                  Idea Commons origin
                </Link>
                {trajectory.formalTopicSlug ? (
                  <Link
                    href={`/formal-topics/${trajectory.formalTopicSlug}`}
                    className="font-medium text-primary underline-offset-4 hover:underline"
                  >
                    Formal lineage
                  </Link>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
        <ul className="space-y-2 text-sm text-muted-foreground">
          {formalTopicGateViews.flatMap((gate) =>
            gate.lineage.map((event) => (
              <li key={event.id}>
                {event.at} · {gate.topicSlug} · {event.type}: {event.summary}
              </li>
            )),
          )}
        </ul>
      </section>
      <TransparencyCenter auditEvents={auditEvents} />
    </MainContainer>
  );
}
