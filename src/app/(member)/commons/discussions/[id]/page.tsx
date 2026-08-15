import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";

import { SubmitForReviewButton } from "@/components/commons/SubmitForReviewButton";
import { DisclosureNotice } from "@/components/DisclosureNotice";
import { PageHeader } from "@/components/PageHeader";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { MainContainer } from "@/components/layout/MainContainer";
import { requireMemberSession } from "@/lib/auth/guard";
import { UNREVIEWED_CONTENT_DISCLAIMER } from "@/lib/commons/categories";
import { loadMemberCommonsContext } from "@/lib/commons/member-context";
import { getDiscussion } from "@/lib/commons/service";
import { formatPublicDateTime } from "@/lib/format/public-datetime";
import { resolveAppMode } from "@/lib/env/app-mode";
import { localCommonsDiscussion } from "@/lib/pre-alpha/member-views";

export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ id: string }> };

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { id } = await params;
  return {
    title: "Commons discussion",
    description: `Commonhall Commons discussion ${id}`,
  };
}

export default async function CommonsDiscussionPage({ params }: PageProps) {
  const { id } = await params;
  const session = await requireMemberSession();
  let discussion;
  if (resolveAppMode() !== "gated") {
    const { readPreAlphaAccountFromStore } = await import(
      "@/lib/auth/pre-alpha-local"
    );
    discussion = localCommonsDiscussion(id, await readPreAlphaAccountFromStore());
    if (!discussion) {
      notFound();
    }
  } else {
    const { db, principal, organizationId } = await loadMemberCommonsContext(
      session.accountId,
    );
    if (!organizationId || !db) {
      notFound();
    }
    const result = await getDiscussion(db, {
      principal,
      organizationId,
      publicId: id,
    });
    if (!result.ok) {
      notFound();
    }
    discussion = result.value;
  }

  return (
    <MainContainer className="space-y-8">
      <Breadcrumbs
        items={[
          { href: "/", label: "Home" },
          { href: "/commons", label: "Commons" },
          { label: discussion.title },
        ]}
      />
      <PageHeader
        eyebrow={discussion.formal ? "Formal Commons" : "Informal Commons"}
        title={discussion.title}
        description={discussion.categoryLabel}
      />
      {!discussion.formal ? (
        <DisclosureNotice title="Unreviewed informal content" tone="caution">
          <p>{UNREVIEWED_CONTENT_DISCLAIMER}</p>
        </DisclosureNotice>
      ) : (
        <DisclosureNotice title="Formal listing" tone="neutral">
          Formal means a moderator confirmed the applicable process and safety
          criteria. It never means the moderator, Chamber, Council, nonprofit, or
          service agrees with the content.
        </DisclosureNotice>
      )}
      <dl className="grid gap-3 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-muted-foreground">Author</dt>
          <dd className="font-medium">{discussion.authorDisplayName}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Posted</dt>
          <dd className="font-medium">
            {formatPublicDateTime(discussion.createdAt)}
          </dd>
        </div>
        {discussion.synthetic ? (
          <div>
            <dt className="text-muted-foreground">Catalog</dt>
            <dd className="font-medium">Synthetic seed</dd>
          </div>
        ) : null}
        {discussion.governanceState ? (
          <div>
            <dt className="text-muted-foreground">Governance state</dt>
            <dd className="font-medium">{discussion.governanceState}</dd>
          </div>
        ) : null}
      </dl>
      <article className="max-w-prose whitespace-pre-wrap text-base leading-7">
        {discussion.body}
      </article>
      {discussion.canSubmitForFormalReview ? (
        <SubmitForReviewButton publicId={discussion.publicId} />
      ) : null}
      <p className="text-sm">
        <Link className="underline" href="/commons">
          Back to Commons
        </Link>
      </p>
    </MainContainer>
  );
}
