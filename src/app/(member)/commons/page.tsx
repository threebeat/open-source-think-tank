import type { Metadata } from "next";

import { CommonsCategorySection } from "@/components/commons/CommonsCategorySection";
import { CreatePostForm } from "@/components/commons/CreatePostForm";
import { DisclosureNotice } from "@/components/DisclosureNotice";
import { PageHeader } from "@/components/PageHeader";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { MainContainer } from "@/components/layout/MainContainer";
import { requireMemberSession } from "@/lib/auth/guard";
import {
  FORMAL_COMMONS_CATEGORIES,
  INFORMAL_COMMONS_CATEGORIES,
  MEMBER_CREATE_CATEGORIES,
  UNREVIEWED_CONTENT_DISCLAIMER,
  COMMONS_CATEGORY_LABELS,
  type CommonsListDto,
} from "@/lib/commons/categories";
import { loadMemberCommonsContext } from "@/lib/commons/member-context";
import { listCommons } from "@/lib/commons/service";
import { resolveAppMode } from "@/lib/env/app-mode";
import { localCommonsList } from "@/lib/pre-alpha/member-views";

export const metadata: Metadata = {
  title: "Commons",
  description:
    "Commonhall Commons — formal categories first, then informal discussion after the unreviewed-content disclaimer.",
};

export const dynamic = "force-dynamic";

function emptyList(): CommonsListDto {
  return {
    disclaimer: UNREVIEWED_CONTENT_DISCLAIMER,
    formal: FORMAL_COMMONS_CATEGORIES.map((category) => ({
      category,
      label: COMMONS_CATEGORY_LABELS[category],
      formal: true,
      discussions: [],
    })),
    informal: INFORMAL_COMMONS_CATEGORIES.map((category) => ({
      category,
      label: COMMONS_CATEGORY_LABELS[category],
      formal: false,
      discussions: [],
    })),
    canPost: false,
    memberCreateCategories: MEMBER_CREATE_CATEGORIES.map((value) => ({
      value,
      label: COMMONS_CATEGORY_LABELS[value],
    })),
  };
}

export default async function CommonsPage() {
  const session = await requireMemberSession();
  let commons = emptyList();
  if (resolveAppMode() !== "gated") {
    const { readPreAlphaAccountFromStore } = await import(
      "@/lib/auth/pre-alpha-local"
    );
    commons = localCommonsList(await readPreAlphaAccountFromStore());
  } else {
    const { db, principal, organizationId } = await loadMemberCommonsContext(
      session.accountId,
    );
    const listed =
      organizationId && db
        ? await listCommons(db, { principal, organizationId })
        : { ok: true as const, value: emptyList() };
    commons = listed.ok ? listed.value : emptyList();
  }

  return (
    <MainContainer className="space-y-10">
      <Breadcrumbs items={[{ href: "/", label: "Home" }, { label: "Commons" }]} />
      <PageHeader
        eyebrow="Member hall"
        title="Commons"
        description="Formal Commons listings appear first. Informal conversation follows the unreviewed-content disclaimer. Formal means published criteria were checked — not that the organization agrees."
      />
      <section aria-labelledby="formal-commons" className="space-y-6">
        <h2 id="formal-commons" className="font-heading text-2xl tracking-tight">
          Formal Commons
        </h2>
        {commons.formal.map((group) => (
          <CommonsCategorySection key={group.category} group={group} />
        ))}
      </section>
      <DisclosureNotice
        title="Unreviewed informal content"
        tone="caution"
        className="commons-unreviewed-disclaimer"
      >
        <p>{commons.disclaimer}</p>
      </DisclosureNotice>
      <section aria-labelledby="informal-commons" className="space-y-6">
        <h2 id="informal-commons" className="font-heading text-2xl tracking-tight">
          Informal Commons
        </h2>
        {commons.informal.map((group) => (
          <CommonsCategorySection key={group.category} group={group} />
        ))}
      </section>
      {commons.canPost ? (
        <CreatePostForm categories={commons.memberCreateCategories} />
      ) : (
        <DisclosureNotice title="Posting requires community membership" tone="neutral">
          You can read the Commons structure. Creating a post requires community
          membership in this organization. Organization-admin, Chamber, or
          platform-administrator status is not a substitute and is not granted by
          posting.
        </DisclosureNotice>
      )}
    </MainContainer>
  );
}
