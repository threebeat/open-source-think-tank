import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";

import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { MainContainer } from "@/components/layout/MainContainer";
import { PublicReadUnavailable } from "@/components/topics/PublicReadUnavailable";
import { PublicInputReportPanel } from "@/features/public-input/PublicInputReportPanel";
import { loadPublicDemoCanonicalTopic } from "@/features/formal-topics/load-public-demo-topic";
import { resolveAppMode } from "@/lib/env/app-mode";

type Props = {
  params: Promise<{ slug: string }>;
};

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  return {
    title: `Public Input report · ${slug}`,
    description:
      "Published allowlisted aggregate Public Input report. Live provider remains fail-closed.",
  };
}

export default async function FormalTopicConsultationReportPage({
  params,
}: Props) {
  const { slug } = await params;
  const mode = resolveAppMode();

  if (mode === "public-demo") {
    const model = loadPublicDemoCanonicalTopic(slug);
    if (!model?.publicInputReport) {
      notFound();
    }
    return (
      <MainContainer className="space-y-8">
        <Breadcrumbs
          items={[
            { href: "/", label: "Home" },
            { href: "/formal-topics", label: "Formal Topics" },
            { href: `/formal-topics/${slug}`, label: model.title },
            { href: `/formal-topics/${slug}/consultation`, label: "Consultation" },
            { label: "Report" },
          ]}
        />
        <PublicInputReportPanel report={model.publicInputReport} />
        <p className="flex flex-wrap gap-4 text-sm">
          <Link
            href={`/formal-topics/${slug}/consultation`}
            className="text-primary underline underline-offset-2"
          >
            Consultation surface
          </Link>
          <Link
            href={`/formal-topics/${slug}`}
            className="text-primary underline underline-offset-2"
          >
            Topic overview
          </Link>
        </p>
      </MainContainer>
    );
  }

  await connection();
  const { loadGatedCanonicalTopic } = await import(
    "@/features/formal-topics/load-gated-canonical-topic"
  );
  const loaded = await loadGatedCanonicalTopic(slug);
  if (loaded.status === "unavailable") {
    return (
      <MainContainer className="space-y-8">
        <Breadcrumbs
          items={[
            { href: "/", label: "Home" },
            { href: "/formal-topics", label: "Formal Topics" },
            { label: "Report" },
          ]}
        />
        <PublicReadUnavailable />
      </MainContainer>
    );
  }
  if (loaded.status === "not_found") {
    notFound();
  }

  if (!loaded.model.publicInputReport) {
    // Draft/import/review or unpublished → generic not-found (no leak).
    notFound();
  }

  return (
    <MainContainer className="space-y-8">
      <Breadcrumbs
        items={[
          { href: "/", label: "Home" },
          { href: "/formal-topics", label: "Formal Topics" },
          { href: `/formal-topics/${slug}`, label: loaded.model.title },
          { href: `/formal-topics/${slug}/consultation`, label: "Consultation" },
          { label: "Report" },
        ]}
      />
      <PublicInputReportPanel report={loaded.model.publicInputReport} />
      <p className="flex flex-wrap gap-4 text-sm">
        <Link
          href={`/formal-topics/${slug}/consultation`}
          className="text-primary underline underline-offset-2"
        >
          Consultation surface
        </Link>
        <Link
          href={`/formal-topics/${slug}`}
          className="text-primary underline underline-offset-2"
        >
          Topic overview
        </Link>
      </p>
    </MainContainer>
  );
}
