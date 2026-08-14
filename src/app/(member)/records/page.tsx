import type { Metadata } from "next";

import { BodyTopicList } from "@/components/bodies/BodyTopicList";
import { DisclosureNotice } from "@/components/DisclosureNotice";
import { PageHeader } from "@/components/PageHeader";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { MainContainer } from "@/components/layout/MainContainer";
import { requireMemberSession } from "@/lib/auth/guard";
import { listRecords } from "@/lib/bodies/service";
import type { BodyListDto } from "@/lib/bodies/types";
import { loadMemberCommonsContext } from "@/lib/commons/member-context";

export const metadata: Metadata = {
  title: "Records",
  description:
    "Commonhall Records — published recommendations, roll calls, and version history.",
};

export const dynamic = "force-dynamic";

function emptyList(): BodyListDto {
  return {
    topics: [],
    roster: [],
    syntheticCatalog: false,
    hostedPolisEnabled: false,
  };
}

export default async function RecordsPage() {
  const session = await requireMemberSession();
  const { db, principal, organizationId } = await loadMemberCommonsContext(
    session.accountId,
  );
  const listed = organizationId
    ? await listRecords(db, { principal, organizationId })
    : { ok: true as const, value: emptyList() };
  const records = listed.ok ? listed.value : emptyList();

  return (
    <MainContainer className="space-y-8">
      <Breadcrumbs items={[{ href: "/", label: "Home" }, { label: "Records" }]} />
      <PageHeader
        eyebrow="Member hall"
        title="Records"
        description="Published recommendations and roll calls. These are not enacted law and are not attributed to a service nonprofit."
      />
      <DisclosureNotice title="Allowlisted public records" tone="neutral">
        Records show versioned Chamber verdicts and Council recommendations with
        complete roll calls. Individual consultation data, account IDs, and
        provider mappings are omitted.
      </DisclosureNotice>
      <BodyTopicList
        topics={records.topics}
        hrefBase="/records"
        empty="No published recommendation records are listed for this organization."
      />
    </MainContainer>
  );
}
