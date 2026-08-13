import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";

import { PublicReadUnavailable } from "@/components/topics/PublicReadUnavailable";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { MainContainer } from "@/components/layout/MainContainer";
import { CanonicalTopicPage } from "@/features/formal-topics/CanonicalTopicPage";
import { loadPublicDemoCanonicalTopic } from "@/features/formal-topics/load-public-demo-topic";
import {
  normalizeLegacyTopicView,
  parseTopicSection,
  topicSectionHref,
} from "@/features/formal-topics/topic-section";
import { formalTopicGateViews } from "@/fixtures/journey-catalog";
import { listTopics } from "@/domain/selectors";
import { fixtureCatalog } from "@/fixtures";
import { resolveAppMode } from "@/lib/env/app-mode";

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ section?: string | string[]; view?: string | string[] }>;
};

export const dynamic = "force-dynamic";

export function generateStaticParams() {
  if (resolveAppMode() === "gated") {
    return [];
  }
  const slugs = new Set<string>([
    ...formalTopicGateViews.map((gate) => gate.topicSlug),
    ...listTopics(fixtureCatalog).map((topic) => topic.slug),
  ]);
  return [...slugs].map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  if (resolveAppMode() === "gated") {
    await connection();
    const { loadGatedCanonicalTopic } = await import(
      "@/features/formal-topics/load-gated-canonical-topic"
    );
    const loaded = await loadGatedCanonicalTopic(slug);
    if (loaded.status === "unavailable") {
      return { title: "Publication unavailable" };
    }
    if (loaded.status === "not_found") {
      return { title: "Formal topic" };
    }
    return {
      title: loaded.model.title,
      description: loaded.model.question,
    };
  }
  const model = loadPublicDemoCanonicalTopic(slug);
  return {
    title: model?.title ?? "Formal topic",
    description: model?.question ?? "Canonical formal topic page.",
  };
}

export default async function FormalTopicDetailPage({
  params,
  searchParams,
}: Props) {
  const { slug } = await params;
  const query = await searchParams;

  if (query.view != null) {
    const legacy = normalizeLegacyTopicView(query.view);
    redirect(topicSectionHref(slug, legacy.section));
  }

  const section = parseTopicSection(query.section);

  if (resolveAppMode() === "gated") {
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
              { label: "Unavailable" },
            ]}
          />
          <PublicReadUnavailable contextLabel="detail" />
        </MainContainer>
      );
    }
    if (loaded.status === "not_found") {
      notFound();
    }
    return <CanonicalTopicPage model={loaded.model} section={section} />;
  }

  const model = loadPublicDemoCanonicalTopic(slug);
  if (!model) {
    notFound();
  }
  return <CanonicalTopicPage model={model} section={section} />;
}
