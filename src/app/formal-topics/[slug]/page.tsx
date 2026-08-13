import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";

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
    const model = await loadGatedCanonicalTopic(slug);
    return {
      title: model?.title ?? "Formal topic",
      description: model?.question ?? "Canonical formal topic page.",
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
    // Fragments are not reliable in HTTP redirects; Overview always includes
    // the Public Input report block with id="public-input-report".
    redirect(topicSectionHref(slug, legacy.section));
  }

  const section = parseTopicSection(query.section);

  if (resolveAppMode() === "gated") {
    await connection();
    const { loadGatedCanonicalTopic } = await import(
      "@/features/formal-topics/load-gated-canonical-topic"
    );
    const model = await loadGatedCanonicalTopic(slug);
    if (!model) {
      notFound();
    }
    return <CanonicalTopicPage model={model} section={section} />;
  }

  const model = loadPublicDemoCanonicalTopic(slug);
  if (!model) {
    notFound();
  }
  return <CanonicalTopicPage model={model} section={section} />;
}
