import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";

import { DisclosureNotice } from "@/components/DisclosureNotice";
import { PageHeader } from "@/components/PageHeader";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { MainContainer } from "@/components/layout/MainContainer";
import { formatTopicGeography } from "@/lib/geography/tennessee-counties";

/**
 * Gated-only published topics list. Dynamically imported from /topics so
 * public-demo builds do not statically pull gated DB/auth modules.
 */
export default async function GatedPublishedTopicsPage() {
  await connection();

  const { getGatedDb } = await import("@/lib/auth/runtime");
  const { listPublishedTopicsForPublic } = await import(
    "@/lib/topics/gated-public-read"
  );
  const result = await listPublishedTopicsForPublic(getGatedDb());
  const topics = result.ok ? result.value : [];

  return (
    <MainContainer className="space-y-8">
      <Breadcrumbs
        items={[{ href: "/", label: "Home" }, { label: "Topics" }]}
      />
      <PageHeader
        eyebrow="Alpha publications"
        title="Published topics"
        description="Minimal gated visitor list of published topics only. Unpublished drafts and review queues are never shown here."
      />
      <DisclosureNotice title="Invite-only alpha" tone="caution">
        These records come from the gated alpha database. They are resettable and
        are not government adoption, legal authority, or truth certification.
      </DisclosureNotice>

      {topics.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No published topics are available yet.
        </p>
      ) : (
        <ul className="space-y-4">
          {topics.map((topic) => (
            <li
              key={topic.slug}
              className="border-t border-border pt-4 first:border-t-0 first:pt-0"
            >
              <Link
                href={`/topics/${topic.slug}`}
                className="font-heading text-xl text-foreground underline-offset-2 hover:underline"
              >
                {topic.title}
              </Link>
              <p className="mt-2 text-sm text-muted-foreground">
                {topic.question}
              </p>
              <p className="mt-2 text-xs text-muted-foreground">
                {formatTopicGeography({
                  jurisdictionLevel: topic.geography.jurisdictionLevel,
                  stateCode: "TN",
                  countyFips: topic.geography.countyFips,
                })}{" "}
                · Published {new Date(topic.publishedAt).toLocaleString()}
              </p>
            </li>
          ))}
        </ul>
      )}
    </MainContainer>
  );
}

export const gatedTopicsMetadata: Metadata = {
  title: "Published topics",
  description:
    "Minimal gated visitor list of published invite-only alpha topics.",
};
