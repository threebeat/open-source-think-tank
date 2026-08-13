import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { PageHeader } from "@/components/PageHeader";
import { ConsultationReportWorkspace } from "@/components/workspace/ConsultationReportWorkspace";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { MainContainer } from "@/components/layout/MainContainer";
import { resolveAppMode } from "@/lib/env/app-mode";

export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: PageProps) {
  const { slug } = await params;
  return {
    title: `Consultation reports · ${slug}`,
    description:
      "Aggregate-only Public Input report import, review, and publication workspace.",
  };
}

export default async function WorkspaceConsultationReportsPage({
  params,
}: PageProps) {
  if (resolveAppMode() !== "gated") {
    notFound();
  }

  const { slug } = await params;
  const { requireGatedSession } = await import("@/lib/auth/guard");
  const gated = await requireGatedSession();
  if (!gated.ok) {
    if (gated.status === 401) redirect("/auth/sign-in");
    notFound();
  }

  const { getGatedDb } = await import("@/lib/auth/runtime");
  const { authorizeCapability } = await import(
    "@/lib/authz/authorize-capability"
  );
  const { loadPrincipal } = await import("@/lib/authz/load-principal");
  const db = getGatedDb();
  const principal = await loadPrincipal(db, gated.session.accountId);

  const canImport = (
    await authorizeCapability(db, principal, "consultations.reports.import")
  ).ok;
  const canReview = (
    await authorizeCapability(db, principal, "consultations.reports.review")
  ).ok;
  const canPublish = (
    await authorizeCapability(db, principal, "consultations.reports.publish")
  ).ok;
  const canRecordProviderModeration = (
    await authorizeCapability(
      db,
      principal,
      "consultations.moderation.record",
    )
  ).ok;

  if (!canImport && !canReview && !canPublish && !canRecordProviderModeration) {
    redirect("/");
  }

  const { getTopicBySlug } = await import("@/lib/topics/repository");
  const topicResult = await getTopicBySlug(db, slug);
  if (!topicResult.ok || !topicResult.value) {
    notFound();
  }
  const topic = topicResult.value;

  const { getStaffConsultationSummary } = await import(
    "@/lib/public-input/lifecycle/service"
  );
  const consultation = await getStaffConsultationSummary(db, topic.id);
  if (!consultation.ok || !consultation.value) {
    return (
      <MainContainer className="space-y-8">
        <Breadcrumbs
          items={[
            { href: "/", label: "Home" },
            { href: "/workspace/topics", label: "Topics" },
            { href: `/workspace/topics/${slug}`, label: topic.title },
            { label: "Consultation reports" },
          ]}
        />
        <PageHeader
          eyebrow="Administrator workspace"
          title="Consultation reports"
          description="No current Public Input conversation is configured for this topic."
        />
        <p className="text-sm text-muted-foreground">
          Create and advance a consultation to voting_closed or closed before
          importing an aggregate-only report.
        </p>
        <Link
          href={`/workspace/topics/${slug}`}
          className="text-primary underline underline-offset-2"
        >
          Back to topic
        </Link>
      </MainContainer>
    );
  }

  const { listStaffReportsForConversation } = await import(
    "@/lib/public-input/reports/service"
  );
  const reports = await listStaffReportsForConversation(db, {
    actorAccountId: gated.session.accountId,
    conversationId: consultation.value.conversationId,
  });
  const initialReports = reports.ok ? reports.value : [];

  return (
    <MainContainer className="space-y-8">
      <Breadcrumbs
        items={[
          { href: "/", label: "Home" },
          { href: "/workspace/topics", label: "Topics" },
          { href: `/workspace/topics/${slug}`, label: topic.title },
          { label: "Consultation reports" },
        ]}
      />
      <PageHeader
        eyebrow="Administrator workspace"
        title="Consultation reports"
        description="Import, review, and publish aggregate-only Public Input reports. Independent from evidence quality and agenda qualification."
      />
      <ConsultationReportWorkspace
        conversationId={consultation.value.conversationId}
        topicSlug={topic.slug}
        topicTitle={topic.title}
        conversationWorkflowState={consultation.value.workflowState}
        initialReports={initialReports}
        canImport={canImport}
        canReview={canReview}
        canPublish={canPublish}
        canRecordProviderModeration={canRecordProviderModeration}
      />
    </MainContainer>
  );
}
