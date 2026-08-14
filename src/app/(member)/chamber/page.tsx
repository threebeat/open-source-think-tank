import type { Metadata } from "next";

import { BodyTopicList } from "@/components/bodies/BodyTopicList";
import { RosterTable } from "@/components/bodies/RosterTable";
import { DisclosureNotice } from "@/components/DisclosureNotice";
import { PageHeader } from "@/components/PageHeader";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { MainContainer } from "@/components/layout/MainContainer";
import { requireMemberSession } from "@/lib/auth/guard";
import { listChamber } from "@/lib/bodies/service";
import type { BodyListDto } from "@/lib/bodies/types";
import { loadMemberCommonsContext } from "@/lib/commons/member-context";

export const metadata: Metadata = {
  title: "Chamber",
  description:
    "Commonhall Chamber — public schedule, roster, and roll calls for appointed members.",
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

export default async function ChamberPage() {
  const session = await requireMemberSession();
  const { db, principal, organizationId } = await loadMemberCommonsContext(
    session.accountId,
  );
  const listed = organizationId
    ? await listChamber(db, { principal, organizationId })
    : { ok: true as const, value: emptyList() };
  const chamber = listed.ok ? listed.value : emptyList();

  return (
    <MainContainer className="space-y-8">
      <Breadcrumbs items={[{ href: "/", label: "Home" }, { label: "Chamber" }]} />
      <PageHeader
        eyebrow="Member hall"
        title="Chamber"
        description="Appointed Chamber members deliberate in public. Community membership does not grant a Chamber seat. Chamber topics remain on the Public Agenda."
      />
      <DisclosureNotice title="Synthetic fixture" tone="caution">
        This roster and schedule are labeled synthetic. They are not a
        production Chamber size or quorum (V2-09). Hosted Pol.is remains
        unavailable.
      </DisclosureNotice>
      <section className="space-y-4" aria-labelledby="chamber-roster-heading">
        <h2 id="chamber-roster-heading" className="font-heading text-xl tracking-tight">
          Roster
        </h2>
        <RosterTable
          caption="Synthetic Chamber roster. Seats are organization-issued and time-bounded."
          seats={chamber.roster}
        />
      </section>
      <section className="space-y-4" aria-labelledby="chamber-topics-heading">
        <h2 id="chamber-topics-heading" className="font-heading text-xl tracking-tight">
          Topics
        </h2>
        <BodyTopicList
          topics={chamber.topics}
          hrefBase="/chamber"
          empty="No Chamber topics are listed for this organization."
        />
      </section>
    </MainContainer>
  );
}
