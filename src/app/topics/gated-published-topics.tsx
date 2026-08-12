import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";

import { DisclosureNotice } from "@/components/DisclosureNotice";
import { PageHeader } from "@/components/PageHeader";
import { PublicReadUnavailable } from "@/components/topics/PublicReadUnavailable";
import { PublicTime } from "@/components/topics/PublicTime";
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

  if (!result.ok) {
    return (
      <MainContainer className="space-y-8">
        <Breadcrumbs
          items={[{ href: "/", label: "Home" }, { label: "Topics" }]}
        />
        <PublicReadUnavailable contextLabel="list" />
      </MainContainer>
    );
  }

  const topics = result.value;

  return (
    <MainContainer className="space-y-8">
      <Breadcrumbs
        items={[{ href: "/", label: "Home" }, { label: "Topics" }]}
      />
      <PageHeader
        eyebrow="Alpha publications"
        title="Published topics"
        description="Invite-only alpha publications available to anonymous visitors. Only topics with publication status published appear here — drafts, review queues, and unpublished rows never do."
      />
      <DisclosureNotice title="Invite-only alpha" tone="caution">
        These records come from the gated alpha database. They are resettable and
        are not government adoption, legal authority, or truth certification.
        Author attribution is not shown while that question remains open.
      </DisclosureNotice>

      {topics.length === 0 ? (
        <section
          className="space-y-2"
          aria-labelledby="empty-published-topics-heading"
          data-testid="published-topics-empty"
        >
          <h2
            id="empty-published-topics-heading"
            className="font-heading text-xl text-foreground"
          >
            No published topics yet
          </h2>
          <p className="text-sm text-muted-foreground">
            When an administrator publishes a reviewed topic, it will appear in
            this list. An empty catalog means nothing is published — not that a
            read failed.
          </p>
        </section>
      ) : (
        <ul className="space-y-0" data-testid="published-topics-list">
          {topics.map((topic) => (
            <li key={topic.slug}>
              <article className="border-t border-border py-5 first:border-t-0 first:pt-0">
                <h2 className="font-heading text-xl text-foreground break-words">
                  <Link
                    href={`/topics/${topic.slug}`}
                    className="inline-flex min-h-11 items-center text-foreground underline-offset-2 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                  >
                    {topic.title}
                  </Link>
                </h2>
                <p className="mt-2 text-sm text-muted-foreground break-words">
                  {topic.question}
                </p>
                <dl className="mt-3 grid gap-2 text-xs text-muted-foreground sm:grid-cols-3">
                  <div>
                    <dt className="font-medium text-foreground">Geography</dt>
                    <dd className="mt-0.5 break-words">
                      {formatTopicGeography({
                        jurisdictionLevel: topic.geography.jurisdictionLevel,
                        stateCode: "TN",
                        countyFips: topic.geography.countyFips,
                      })}
                    </dd>
                  </div>
                  <div>
                    <dt className="font-medium text-foreground">
                      Operational status
                    </dt>
                    <dd className="mt-0.5 break-words">
                      {topic.operationalLabel}
                    </dd>
                  </div>
                  <div>
                    <dt className="font-medium text-foreground">Published</dt>
                    <dd className="mt-0.5">
                      <PublicTime dateTime={topic.publishedAt} />
                    </dd>
                  </div>
                </dl>
              </article>
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
    "Invite-only alpha publications available to anonymous visitors on the gated deployment.",
};
