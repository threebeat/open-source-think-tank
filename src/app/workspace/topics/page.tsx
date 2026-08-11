import { notFound, redirect } from "next/navigation";

import { DisclosureNotice } from "@/components/DisclosureNotice";
import { PageHeader } from "@/components/PageHeader";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { MainContainer } from "@/components/layout/MainContainer";
import { resolveAppMode } from "@/lib/env/app-mode";
import {
  publicationStatusHelp,
  publicationStatusLabel,
  workflowStateLabel,
} from "@/lib/topics/labels";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Workspace topics",
  description: "Gated administrator topic authoring for the operational alpha.",
};

export default async function WorkspaceTopicsPage() {
  if (resolveAppMode() !== "gated") {
    notFound();
  }

  const { requireGatedSession } = await import("@/lib/auth/guard");
  const gated = await requireGatedSession();
  if (!gated.ok) {
    if (gated.status === 401) {
      redirect("/auth/sign-in");
    }
    notFound();
  }

  const { getGatedDb } = await import("@/lib/auth/runtime");
  const { authorizeCapability } = await import(
    "@/lib/authz/authorize-capability"
  );
  const { loadPrincipal } = await import("@/lib/authz/load-principal");
  const db = getGatedDb();
  const principal = await loadPrincipal(db, gated.session.accountId);
  const decision = await authorizeCapability(db, principal, "topics.create");
  if (!decision.ok) {
    redirect("/");
  }

  const { listTopics } = await import("@/lib/topics/repository");
  const listed = await listTopics(db);
  const topics = listed.ok ? listed.value : [];

  return (
    <MainContainer className="space-y-8">
      <Breadcrumbs
        items={[
          { href: "/", label: "Home" },
          { href: "/workspace/topics", label: "Workspace" },
          { label: "Topics" },
        ]}
      />
      <PageHeader
        eyebrow="Administrator workspace"
        title="Topic authoring"
        description="Create and manage operational topic workflow. Publication status is independent and read-only until Package 3.6. Topics are not law, adopted policy, or board decisions."
      />
      <DisclosureNotice title="Operational vs publication" tone="caution">
        “Open for submissions” is an operational workflow state. “Not published”
        means visitors cannot see the topic in the gated public interface.
        Pausing or archiving never silently unpublishes.
      </DisclosureNotice>

      <p>
        <a
          className="inline-flex min-h-11 items-center rounded-md bg-foreground px-4 text-sm text-background"
          href="/workspace/topics/new"
        >
          Create draft topic
        </a>
      </p>

      <section aria-labelledby="workspace-topic-list-heading" className="space-y-3">
        <h2
          id="workspace-topic-list-heading"
          className="font-heading text-xl text-foreground"
        >
          Topics
        </h2>
        <div className="overflow-x-auto">
          <table className="min-w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-border">
                <th scope="col" className="px-3 py-2 font-medium">
                  Title
                </th>
                <th scope="col" className="px-3 py-2 font-medium">
                  Slug
                </th>
                <th scope="col" className="px-3 py-2 font-medium">
                  Operational workflow
                </th>
                <th scope="col" className="px-3 py-2 font-medium">
                  Publication status
                </th>
              </tr>
            </thead>
            <tbody>
              {topics.length === 0 ? (
                <tr>
                  <td
                    colSpan={4}
                    className="px-3 py-4 text-muted-foreground"
                  >
                    No topics yet.
                  </td>
                </tr>
              ) : (
                topics.map((topic) => (
                  <tr key={topic.id} className="border-b border-border/70">
                    <td className="px-3 py-3">
                      <a
                        className="underline"
                        href={`/workspace/topics/${topic.slug}`}
                      >
                        {topic.title}
                      </a>
                    </td>
                    <td className="px-3 py-3 font-mono text-xs">{topic.slug}</td>
                    <td className="px-3 py-3">
                      {workflowStateLabel(topic.workflowState)}
                    </td>
                    <td className="px-3 py-3">
                      <span className="block">
                        {publicationStatusLabel(topic.publicationStatus)}
                      </span>
                      <span className="block text-xs text-muted-foreground">
                        {publicationStatusHelp(topic.publicationStatus)}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </MainContainer>
  );
}
