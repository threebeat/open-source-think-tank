import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";

import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { MainContainer } from "@/components/layout/MainContainer";
import { ConsultationSurface } from "@/features/public-input/ConsultationSurface";
import { loadPublicDemoCanonicalTopic } from "@/features/formal-topics/load-public-demo-topic";
import { resolveAppMode } from "@/lib/env/app-mode";

type Props = {
  params: Promise<{ slug: string }>;
};

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  return {
    title: `Consultation · ${slug}`,
    description:
      "Institutional Public Input consultation surface. Live provider embed remains fail-closed.",
  };
}

export default async function FormalTopicConsultationPage({ params }: Props) {
  const { slug } = await params;
  const mode = resolveAppMode();

  if (mode === "public-demo") {
    const model = loadPublicDemoCanonicalTopic(slug);
    if (!model) {
      notFound();
    }
    return (
      <MainContainer className="space-y-8">
        <Breadcrumbs
          items={[
            { href: "/", label: "Home" },
            { href: "/formal-topics", label: "Formal Topics" },
            { href: `/formal-topics/${slug}`, label: model.title },
            { label: "Consultation" },
          ]}
        />
        <ConsultationSurface
          topicSlug={slug}
          topicTitle={model.title}
          consultation={null}
          lane="public-demo"
        />
      </MainContainer>
    );
  }

  await connection();
  const { loadGatedCanonicalTopic } = await import(
    "@/features/formal-topics/load-gated-canonical-topic"
  );
  const loaded = await loadGatedCanonicalTopic(slug);
  if (loaded.status === "not_found") {
    notFound();
  }
  if (loaded.status === "unavailable") {
    notFound();
  }

  const { getGatedDb } = await import("@/lib/auth/runtime");
  const { getTopicBySlug } = await import("@/lib/topics/repository");
  const { getPublicConsultationView } = await import(
    "@/lib/public-input/lifecycle/service"
  );

  const db = getGatedDb();
  const topicResult = await getTopicBySlug(db, slug);
  let consultation = null;
  let operationalNote: string | null = null;

  if (topicResult.ok && topicResult.value) {
    const view = await getPublicConsultationView(db, topicResult.value.id);
    if (view.ok) {
      consultation = view.value;
    } else {
      operationalNote =
        "Consultation projection temporarily unavailable. Topic overview and evidence remain available.";
    }
  }

  return (
    <MainContainer className="space-y-8">
      <Breadcrumbs
        items={[
          { href: "/", label: "Home" },
          { href: "/formal-topics", label: "Formal Topics" },
          { href: `/formal-topics/${slug}`, label: loaded.model.title },
          { label: "Consultation" },
        ]}
      />
      <ConsultationSurface
        topicSlug={slug}
        topicTitle={loaded.model.title}
        consultation={consultation}
        lane="gated"
        operationalNote={operationalNote}
      />
    </MainContainer>
  );
}
