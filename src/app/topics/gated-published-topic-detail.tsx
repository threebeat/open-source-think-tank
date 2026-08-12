import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";

import { GatedPublicTopicView } from "@/components/topics/GatedPublicTopicView";
import { PublicReadUnavailable } from "@/components/topics/PublicReadUnavailable";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { MainContainer } from "@/components/layout/MainContainer";

type Props = { slug: string };

/**
 * Gated-only published topic detail. Dynamically imported from /topics/[slug]
 * so public-demo builds do not statically pull gated DB/auth modules.
 *
 * Missing/unpublished → generic 404.
 * Operational read failure → sanitized unavailable UI (not 404).
 * Published with no currently eligible content → addressable empty shell.
 */
export default async function GatedPublishedTopicDetailPage({ slug }: Props) {
  await connection();

  const { getGatedDb } = await import("@/lib/auth/runtime");
  const { getPublishedTopicProjection } = await import(
    "@/lib/topics/gated-public-read"
  );
  const result = await getPublishedTopicProjection(getGatedDb(), slug);

  if (!result.ok) {
    return (
      <MainContainer className="space-y-8">
        <Breadcrumbs
          items={[
            { href: "/", label: "Home" },
            { href: "/topics", label: "Topics" },
            { label: "Unavailable" },
          ]}
        />
        <PublicReadUnavailable contextLabel="detail" />
      </MainContainer>
    );
  }

  if (!result.value) {
    notFound();
  }

  return (
    <MainContainer className="space-y-8">
      <Breadcrumbs
        items={[
          { href: "/", label: "Home" },
          { href: "/topics", label: "Topics" },
          { label: result.value.title },
        ]}
      />
      <GatedPublicTopicView projection={result.value} />
    </MainContainer>
  );
}

export async function gatedTopicMetadata(slug: string): Promise<Metadata> {
  await connection();
  const { getGatedDb } = await import("@/lib/auth/runtime");
  const { getPublishedTopicProjection } = await import(
    "@/lib/topics/gated-public-read"
  );
  const result = await getPublishedTopicProjection(getGatedDb(), slug);
  if (!result.ok) {
    return { title: "Publication unavailable" };
  }
  if (!result.value) {
    return { title: "Topic not found" };
  }
  return {
    title: result.value.title,
    description: result.value.question,
  };
}
